import { exec } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { app as electronApp } from 'electron'
import { produce } from 'immer'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - serialport types are not available at build time but will be at runtime
import { SerialPort as SerialPortClass } from 'serialport'

import type { AvailableBoards, HalsFile, SerialPort } from './hardware-types'

/** Minimal interface covering the SerialPort methods used for board detection. */
interface SerialPortInstance {
  isOpen: boolean
  open(callback: (error: Error | null) => void): void
  close(callback: (error?: Error | null) => void): void
  set(options: { dtr?: boolean; rts?: boolean }, callback: (error: Error | null) => void): void
  on(event: 'data', listener: (chunk: Buffer) => void): this
  on(event: 'error', listener: (error: Error) => void): this
  removeListener(event: 'data', listener: (chunk: Buffer) => void): this
  removeListener(event: 'error', listener: (error: Error) => void): this
}

// interface MethodsResult<T> {
//   success: boolean
//   data?: T
// }

class HardwareModule {
  binaryDirectoryPath: string
  sourcesDirectoryPath: string

  arduinoCliBinaryPath: string
  arduinoCliConfigurationFilePath: string
  arduinoCliBaseParameters: string[]
  arduinoCoreFilePath: string

  private static readonly SERIAL_DETECT_BAUD_RATE = 115200
  private static readonly SERIAL_DETECT_TIMEOUT_MS = 6000
  private static readonly SERIAL_RESET_WAIT_MS = 1000

  // ############################################################################
  // =========================== Static properties ==============================
  // ############################################################################
  static readonly HOST_PLATFORM = process.platform
  static readonly HOST_ARCHITECTURE = process.arch
  static readonly DEVELOPMENT_MODE = process.env.NODE_ENV === 'development'

  constructor() {
    this.binaryDirectoryPath = this.#constructBinaryDirectoryPath()
    this.sourcesDirectoryPath = this.#constructSourceDirectoryPath()

    this.arduinoCliBinaryPath = this.#constructArduinoCliBinaryPath()
    this.arduinoCliConfigurationFilePath = join(electronApp.getPath('userData'), 'User', 'arduino-cli.yaml')
    // INFO: We use this approach because some commands can receive additional parameters as a string array.
    this.arduinoCliBaseParameters = ['--config-file', this.arduinoCliConfigurationFilePath]
    this.arduinoCoreFilePath = this.#constructArduinoCoreFilePath()
  }

  // ############################################################################
  // =========================== Static methods =================================
  // ############################################################################

  static async readJSONFile<T>(filePath: string): Promise<T> {
    const data = await readFile(filePath, 'utf-8')
    return JSON.parse(data) as T
  }

  // ############################################################################
  // =========================== Private methods ================================
  // ############################################################################

  // Initialize paths based on the environment
  #constructBinaryDirectoryPath(): string {
    if (HardwareModule.HOST_ARCHITECTURE !== 'x64' && HardwareModule.HOST_ARCHITECTURE !== 'arm64') return ''
    const platformSpecificPath = join(HardwareModule.HOST_PLATFORM, HardwareModule.HOST_ARCHITECTURE)
    return join(
      HardwareModule.DEVELOPMENT_MODE ? process.cwd() : process.resourcesPath,
      HardwareModule.DEVELOPMENT_MODE ? 'resources' : '',
      'bin',
      HardwareModule.DEVELOPMENT_MODE ? platformSpecificPath : '',
    )
  }

  #constructSourceDirectoryPath(): string {
    return join(
      HardwareModule.DEVELOPMENT_MODE ? process.cwd() : process.resourcesPath,
      HardwareModule.DEVELOPMENT_MODE ? 'resources' : '',
      'sources',
    )
  }

  // TODO: Validate the path.
  #constructArduinoCliBinaryPath(): string {
    return join(this.binaryDirectoryPath, 'arduino-cli')
  }

  #constructArduinoCoreFilePath(): string {
    return join(electronApp.getPath('userData'), 'User', 'Runtime', 'arduino-core-control.json')
  }

  // ############################################################################
  // =========================== Public methods =================================
  // ############################################################################

  // ++ ============================= Getters ================================ ++
  async getAvailableSerialPorts(): Promise<SerialPort[]> {
    let xml2stBinaryPath = join(
      this.binaryDirectoryPath,
      'xml2st',
      HardwareModule.HOST_PLATFORM === 'darwin' ? 'xml2st' : '',
    )
    if (HardwareModule.HOST_PLATFORM === 'win32') {
      xml2stBinaryPath += '.exe'
    }
    const executeCommand = promisify(exec)

    try {
      const { stdout, stderr } = await executeCommand(`"${xml2stBinaryPath}" --list-ports`)

      if (stderr) {
        console.warn('xml2st stderr output:', stderr)
      }

      let normalizedOutputString: SerialPort[] = [{ name: '', address: 'fallback' }]

      if (stdout) {
        try {
          const parsedOutput = JSON.parse(stdout) as {
            ports: {
              name: string
              address: string
            }[]
          }
          normalizedOutputString = parsedOutput.ports.map((port) => ({
            name: port.name ?? port.address,
            address: port.address,
          }))
        } catch (parseError: unknown) {
          console.error('Failed to parse xml2st output:', parseError)
          return []
        }
      }

      return normalizedOutputString
    } catch (execError: unknown) {
      console.error('Failed to execute xml2st:', execError)
      return []
    }
  }

  async getAvailableBoards(): Promise<AvailableBoards> {
    // Construct the path to the hals.json file
    const halsFilePath = join(this.sourcesDirectoryPath, 'boards', 'hals.json')

    // Read the content of the necessary files - hals.json and arduino-core-control.json
    const halsFileContent = await HardwareModule.readJSONFile<HalsFile>(halsFilePath)
    const arduinoCoreFileContent = await HardwareModule.readJSONFile<{ [core: string]: string }[]>(
      this.arduinoCoreFilePath,
    )

    // Create a Map to store the available boards, which will be returned
    let availableBoards: AvailableBoards = new Map()

    for (const [board, boardData] of Object.entries(halsFileContent)) {
      const coreVersion = arduinoCoreFileContent.find((core) => Object.keys(core)[0] === boardData.core)?.[
        boardData.core
      ]

      availableBoards = produce(availableBoards, (draft) => {
        draft.set(board, {
          compiler: boardData.compiler,
          core: boardData.core,
          preview: boardData.preview,
          specs: boardData.specs,
          coreVersion: coreVersion ?? undefined,
          pins: {
            defaultAin: boardData.default_ain ?? {},
            defaultAout: boardData.default_aout ?? {},
            defaultDin: boardData.default_din ?? {},
            defaultDout: boardData.default_dout ?? {},
          },
        })
      })
    }
    // TODO: Improve error handling and return type
    // if (availableBoards.size === 0) {
    //   return { success: false, data: undefined }
    // }
    return availableBoards
  }

  async getBoardImagePreview(image: string) {
    const imagePath = join(this.sourcesDirectoryPath, 'boards', 'previews', image)

    const imageBuffer = await readFile(imagePath)

    const base64Image = imageBuffer.toString('base64')

    return `data:image/png;base64,${base64Image}`
  }

  async getDeviceConfigurationOptions() {
    const [communicationPorts, availableBoards] = await Promise.allSettled([
      this.getAvailableSerialPorts(),
      this.getAvailableBoards(),
    ])
    return { ports: communicationPorts, boards: availableBoards }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private async resetDevice(serialPort: SerialPortInstance): Promise<void> {
    // NOTE: This is a generic reset implementation using DTR/RTS toggling.
    // If your target requires a custom reset sequence, replace this method body.
    await new Promise<void>((resolve, reject) => {
      serialPort.set({ dtr: false, rts: false }, (error: unknown) => {
        if (error) {
          reject(new Error(error instanceof Error ? error.message : JSON.stringify(error)))
          return
        }
        resolve()
      })
    })

    await this.sleep(150)

    await new Promise<void>((resolve, reject) => {
      serialPort.set({ dtr: true, rts: true }, (error: unknown) => {
        if (error) {
          reject(new Error(error instanceof Error ? error.message : JSON.stringify(error)))
          return
        }
        resolve()
      })
    })
  }

  private extractCpuSignature(data: string): string | null {
    const match = data.match(/\bRS[A-Z0-9-]*\b/g)
    return match && match.length > 0 ? match[0] : null
  }

  async detectBoardFromCommunicationPort(
    port: string,
  ): Promise<{ success: boolean; cpu?: string; board?: string; error?: string }> {
    if (!port || port === 'fallback') {
      return { success: false, error: 'Invalid communication port.' }
    }

    let serialPort: SerialPortInstance | null = null

    try {
      const halsFilePath = join(this.sourcesDirectoryPath, 'boards', 'hals.json')
      const halsFileContent = await HardwareModule.readJSONFile<HalsFile>(halsFilePath)

      serialPort = new SerialPortClass({
        path: port,
        baudRate: HardwareModule.SERIAL_DETECT_BAUD_RATE,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        autoOpen: false,
      }) as SerialPortInstance

      // Capture in a non-null const so TypeScript can narrow it inside all closures below.
      const sp = serialPort

      await new Promise<void>((resolve, reject) => {
        sp.open((error: unknown) => {
          if (error) {
            reject(new Error(error instanceof Error ? error.message : JSON.stringify(error)))
            return
          }
          resolve()
        })
      })

      const cpu = await new Promise<string>((resolve, reject) => {
        let buffer = ''
        let completed = false

        const onData = (chunk: Buffer) => {
          buffer += chunk.toString('utf8')

          if (buffer.length > 8192) {
            buffer = buffer.slice(-8192)
          }

          const extractedCpu = this.extractCpuSignature(buffer)
          if (!extractedCpu) return

          completed = true
          cleanup()
          resolve(extractedCpu)
        }

        const onError = (error: Error) => {
          completed = true
          cleanup()
          reject(error)
        }

        const timeoutHandle = setTimeout(() => {
          if (completed) return
          completed = true
          cleanup()
          reject(new Error('No CPU signature received from device.'))
        }, HardwareModule.SERIAL_DETECT_TIMEOUT_MS)

        const cleanup = () => {
          clearTimeout(timeoutHandle)
          sp.removeListener('data', onData)
          sp.removeListener('error', onError)
        }

        sp.on('data', onData)
        sp.on('error', onError)

        void (async () => {
          try {
            await this.resetDevice(sp)
            await this.sleep(HardwareModule.SERIAL_RESET_WAIT_MS)
          } catch (error) {
            if (completed) return
            completed = true
            cleanup()
            reject(error instanceof Error ? error : new Error(JSON.stringify(error)))
          }
        })()
      })

      const normalizedCpu = cpu.trim().toUpperCase()
      const matchedBoard = Object.entries(halsFileContent).find(([, boardData]) => {
        const boardCpu = boardData.specs?.CPU
        return typeof boardCpu === 'string' && boardCpu.trim().toUpperCase() === normalizedCpu
      })

      if (!matchedBoard) {
        return {
          success: false,
          cpu,
          error: `CPU '${cpu}' was detected but no matching board exists in hals.json.`,
        }
      }

      return {
        success: true,
        cpu,
        board: matchedBoard[0],
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    } finally {
      if (serialPort?.isOpen) {
        const sp = serialPort
        await new Promise<void>((resolve) => {
          sp.close(() => resolve())
        })
      }
    }
  }
}

export { HardwareModule }
