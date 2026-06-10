import { communicationSelectors } from '@hooks/use-store-selectors'
import { Checkbox, Label } from '@root/renderer/components/_atoms'
import { DeviceEditorSlot } from '@root/renderer/components/_templates/[editors]'
import { useOpenPLCStore } from '@root/renderer/store'
import { cn, isOpenPLCRuntimeTarget } from '@root/utils'
import { useEffect, useMemo } from 'react'

import { ModbusRTUComponent } from './components/modbus-rtu'
import { ModbusRTUMasterComponent } from './components/modbus-rtu-master-component'
import { ModbusTCPComponent } from './components/modbus-tcp'

const Communication = () => {
  type RTUMasterConfig = {
    enabled: boolean
    rtuInterface: 'Serial' | 'Serial1' | 'Serial2' | 'Serial3'
    rtuBaudRate: '9600' | '14400' | '19200' | '38400' | '57600' | '115200'
    rtuRS485ENPin: string | null
    slaveId: number | null
    functionCode: '3' | '4' | '6' | '16' | '3+6' | '3+16' | '4+6' | '4+16'
    startAddress: number
    registerCount: number
    pollIntervalMs: number
    mapToInputStart: number
    mapFromOutputStart: number
  }

  const {
    deviceDefinitions: {
      configuration: { deviceBoard, communicationPort, runtimeIpAddress, communicationConfiguration },
    },
    deviceActions: { setDeviceDefinitions },
    deviceAvailableOptions: { availableBoards },
  } = useOpenPLCStore()

  const currentBoardInfo = availableBoards.get(deviceBoard)
  const isRuntimeTarget = isOpenPLCRuntimeTarget(currentBoardInfo)

  const communicationPreferences = communicationConfiguration.communicationPreferences
  const modbusRTUMaster = (communicationConfiguration as unknown as { modbusRTUMaster: RTUMasterConfig })
    .modbusRTUMaster

  const isRTUEnabled = communicationPreferences.enabledRTU
  const isRTUMasterEnabled = modbusRTUMaster.enabled
  const isTCPEnabled = communicationPreferences.enabledTCP

  const setCommunicationPreferences = communicationSelectors.useSetCommunicationPreferences()

  useEffect(() => {
    const updateModbusConfig = () => {
      if (isRuntimeTarget) {
        setCommunicationPreferences({ enableRTU: false })
        setDeviceDefinitions({
          configuration: {
            deviceBoard,
            communicationPort,
            runtimeIpAddress,
            communicationConfiguration: {
              ...communicationConfiguration,
              modbusRTUMaster: { ...modbusRTUMaster, enabled: false },
            },
          },
        })
        setCommunicationPreferences({ enableTCP: false })
      }
    }
    updateModbusConfig()
  }, [deviceBoard, isRuntimeTarget])

  const handleEnableModbusRTU = () => {
    setCommunicationPreferences({ enableRTU: !isRTUEnabled })
  }
  const memoizedIsModbusRTUEnabled = useMemo(() => isRTUEnabled ?? false, [isRTUEnabled])

  const handleEnableModbusRTUMaster = () => {
    setDeviceDefinitions({
      configuration: {
        deviceBoard,
        communicationPort,
        runtimeIpAddress,
        communicationConfiguration: {
          ...communicationConfiguration,
          modbusRTUMaster: { ...modbusRTUMaster, enabled: !isRTUMasterEnabled },
        },
      },
    })
  }
  const memoizedIsModbusRTUMasterEnabled = useMemo(() => isRTUMasterEnabled ?? false, [isRTUMasterEnabled])

  const handleEnableModbusTCP = () => {
    setCommunicationPreferences({ enableTCP: !isTCPEnabled })
  }
  const memoizedIsModbusTCPEnabled = useMemo(() => isTCPEnabled ?? false, [isTCPEnabled])

  return (
    <DeviceEditorSlot heading='Communication'>
      <div id='modbus-rtu-container' className='flex h-fit w-full flex-col gap-4'>
        <div
          id='enable-modbus-rtu'
          className={cn('flex select-none items-center gap-2', !isRTUEnabled && 'opacity-50')}
        >
          <Checkbox
            id='enable-modbus-rtu-checkbox'
            className={isRTUEnabled ? 'border-brand' : 'border-neutral-300'}
            checked={isRTUEnabled}
            disabled={isRuntimeTarget}
            onCheckedChange={handleEnableModbusRTU}
          />
          <Label
            htmlFor='enable-modbus-rtu-checkbox'
            className='text-sm font-medium text-neutral-950 hover:cursor-pointer dark:text-white'
          >
            Enable Modbus RTU
          </Label>
        </div>
        <ModbusRTUComponent isModbusRTUEnabled={memoizedIsModbusRTUEnabled} />
      </div>
      <hr id='container-split-rtu-master' className='h-[1px] w-full self-stretch bg-brand-light' />
      <div id='modbus-rtu-master-container' className='flex h-fit w-full flex-col gap-4'>
        <div
          id='enable-modbus-rtu-master'
          className={cn('flex select-none items-center gap-2', !isRTUMasterEnabled && 'opacity-50')}
        >
          <Checkbox
            id='enable-modbus-rtu-master-checkbox'
            className={isRTUMasterEnabled ? 'border-brand' : 'border-neutral-300'}
            checked={isRTUMasterEnabled}
            disabled={isRuntimeTarget}
            onCheckedChange={handleEnableModbusRTUMaster}
          />
          <Label
            htmlFor='enable-modbus-rtu-master-checkbox'
            className='text-sm font-medium text-neutral-950 hover:cursor-pointer dark:text-white'
          >
            Enable Modbus RTU Master
          </Label>
        </div>
        <ModbusRTUMasterComponent isModbusRTUMasterEnabled={memoizedIsModbusRTUMasterEnabled} />
      </div>
      <hr id='container-split' className='h-[1px] w-full self-stretch bg-brand-light' />
      <div id='modbus-tcp-container' className='flex h-full w-full flex-col gap-4'>
        <div
          id='enable-modbus-tcp'
          className={cn('flex select-none items-center gap-2', !isTCPEnabled && 'opacity-50')}
        >
          <Checkbox
            id='enable-modbus-tcp-checkbox'
            className={isTCPEnabled ? 'border-brand' : 'border-neutral-300'}
            checked={isTCPEnabled}
            disabled={isRuntimeTarget}
            onCheckedChange={handleEnableModbusTCP}
          />
          <Label
            htmlFor='enable-modbus-tcp-checkbox'
            className='text-sm font-medium text-neutral-950 hover:cursor-pointer dark:text-white'
          >
            Enable Modbus TCP
          </Label>
        </div>
        <ModbusTCPComponent isModbusTCPEnabled={memoizedIsModbusTCPEnabled} />
      </div>
    </DeviceEditorSlot>
  )
}

export { Communication }
