import { INPUT_STYLES } from '@data/constants/device-styles'
import { InputWithRef, Label, Select, SelectContent, SelectItem, SelectTrigger } from '@root/renderer/components/_atoms'
import { useOpenPLCStore } from '@root/renderer/store'
import { cn } from '@root/utils'
import { memo } from 'react'

type RTUMasterConfig = {
  enabled: boolean
  slaveId: number | null
  functionCode: '3' | '4' | '6' | '16' | '3+6' | '3+16' | '4+6' | '4+16'
  startAddress: number
  registerCount: number
  pollIntervalMs: number
  mapToInputStart: number
  mapFromOutputStart: number
}

type RTUMasterField = Exclude<keyof RTUMasterConfig, 'enabled'>

const ModbusRTUMasterComponent = memo(function ({ isModbusRTUMasterEnabled }: { isModbusRTUMasterEnabled: boolean }) {
  const deviceBoard = useOpenPLCStore((state) => state.deviceDefinitions.configuration.deviceBoard)
  const communicationPort = useOpenPLCStore((state) => state.deviceDefinitions.configuration.communicationPort)
  const runtimeIpAddress = useOpenPLCStore((state) => state.deviceDefinitions.configuration.runtimeIpAddress)
  const communicationConfiguration = useOpenPLCStore(
    (state) => state.deviceDefinitions.configuration.communicationConfiguration,
  )
  const modbusRTUMaster = communicationConfiguration.modbusRTUMaster as RTUMasterConfig
  const setDeviceDefinitions = useOpenPLCStore((state) => state.deviceActions.setDeviceDefinitions)

  const updateMasterConfig = <T extends keyof RTUMasterConfig>(field: T, value: RTUMasterConfig[T]) => {
    setDeviceDefinitions({
      configuration: {
        deviceBoard,
        communicationPort,
        runtimeIpAddress,
        communicationConfiguration: {
          ...communicationConfiguration,
          modbusRTUMaster: { ...modbusRTUMaster, [field]: value },
        },
      },
    })
  }

  const updateNumber = (field: RTUMasterField, value: string) => {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isNaN(parsed)) {
      updateMasterConfig(field, parsed as RTUMasterConfig[typeof field])
    }
  }

  return (
    <div
      id='modbus-rtu-master-form-config-container'
      className={cn('flex gap-6', !isModbusRTUMasterEnabled && 'hidden')}
    >
      <div id='modbus-rtu-master-form-config-left-slot' className='flex flex-1 flex-col gap-4'>
        <div id='modbus-rtu-master-slave-id-container' className='flex w-full flex-1 items-center justify-start gap-1'>
          <Label htmlFor='rtuMasterSlaveId' className='whitespace-pre text-xs text-neutral-950 dark:text-white'>
            Target Slave ID
          </Label>
          <InputWithRef
            id='rtuMasterSlaveId'
            placeholder='1-247'
            type='number'
            min={1}
            max={247}
            value={modbusRTUMaster.slaveId ?? ''}
            onChange={(e) => {
              const value = e.target.value
              if (value === '') {
                updateMasterConfig('slaveId', null)
                return
              }
              const parsed = Number.parseInt(value, 10)
              if (!Number.isNaN(parsed)) {
                updateMasterConfig('slaveId', parsed)
              }
            }}
            className={INPUT_STYLES.default}
          />
        </div>

        <div
          id='modbus-rtu-master-function-code-container'
          className='flex w-full flex-1 items-center justify-start gap-1'
        >
          <Label className='whitespace-pre text-xs text-neutral-950 dark:text-white'>Function</Label>
          <Select
            aria-label='modbus-rtu-master-function-select'
            value={modbusRTUMaster.functionCode}
            onValueChange={(value) => updateMasterConfig('functionCode', value as RTUMasterConfig['functionCode'])}
          >
            <SelectTrigger
              placeholder='Select function code'
              withIndicator
              className='flex h-[30px] w-full items-center justify-between gap-1 rounded-md border border-neutral-300 bg-white px-2 py-1 font-caption text-cp-sm font-medium text-neutral-850 outline-none data-[state=open]:border-brand-medium-dark dark:border-neutral-850 dark:bg-neutral-950 dark:text-neutral-300'
            />
            <SelectContent className='h-fit w-[--radix-select-trigger-width] overflow-y-auto rounded-lg border border-neutral-300 bg-white outline-none drop-shadow-lg dark:border-brand-medium-dark dark:bg-neutral-950'>
              <SelectItem
                value='3'
                className='flex w-full cursor-pointer items-center justify-start px-2 py-1 outline-none hover:bg-neutral-100 dark:hover:bg-neutral-800'
              >
                <span className='text-start font-caption text-xs font-normal text-neutral-700 dark:text-neutral-100'>
                  FC03 - Holding Registers
                </span>
              </SelectItem>
              <SelectItem
                value='4'
                className='flex w-full cursor-pointer items-center justify-start px-2 py-1 outline-none hover:bg-neutral-100 dark:hover:bg-neutral-800'
              >
                <span className='text-start font-caption text-xs font-normal text-neutral-700 dark:text-neutral-100'>
                  FC04 - Input Registers
                </span>
              </SelectItem>
              <SelectItem
                value='6'
                className='flex w-full cursor-pointer items-center justify-start px-2 py-1 outline-none hover:bg-neutral-100 dark:hover:bg-neutral-800'
              >
                <span className='text-start font-caption text-xs font-normal text-neutral-700 dark:text-neutral-100'>
                  FC06 - Write Single Register
                </span>
              </SelectItem>
              <SelectItem
                value='16'
                className='flex w-full cursor-pointer items-center justify-start px-2 py-1 outline-none hover:bg-neutral-100 dark:hover:bg-neutral-800'
              >
                <span className='text-start font-caption text-xs font-normal text-neutral-700 dark:text-neutral-100'>
                  FC16 - Write Multiple Registers
                </span>
              </SelectItem>
              <SelectItem
                value='3+16'
                className='flex w-full cursor-pointer items-center justify-start px-2 py-1 outline-none hover:bg-neutral-100 dark:hover:bg-neutral-800'
              >
                <span className='text-start font-caption text-xs font-normal text-neutral-700 dark:text-neutral-100'>
                  FC03 + FC16 - Read + Write
                </span>
              </SelectItem>
              <SelectItem
                value='4+16'
                className='flex w-full cursor-pointer items-center justify-start px-2 py-1 outline-none hover:bg-neutral-100 dark:hover:bg-neutral-800'
              >
                <span className='text-start font-caption text-xs font-normal text-neutral-700 dark:text-neutral-100'>
                  FC04 + FC16 - Read + Write
                </span>
              </SelectItem>
              <SelectItem
                value='3+6'
                className='flex w-full cursor-pointer items-center justify-start px-2 py-1 outline-none hover:bg-neutral-100 dark:hover:bg-neutral-800'
              >
                <span className='text-start font-caption text-xs font-normal text-neutral-700 dark:text-neutral-100'>
                  FC03 + FC06 - Read + Write
                </span>
              </SelectItem>
              <SelectItem
                value='4+6'
                className='flex w-full cursor-pointer items-center justify-start px-2 py-1 outline-none hover:bg-neutral-100 dark:hover:bg-neutral-800'
              >
                <span className='text-start font-caption text-xs font-normal text-neutral-700 dark:text-neutral-100'>
                  FC04 + FC06 - Read + Write
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div
          id='modbus-rtu-master-start-address-container'
          className='flex w-full flex-1 items-center justify-start gap-1'
        >
          <Label htmlFor='rtuMasterStartAddress' className='whitespace-pre text-xs text-neutral-950 dark:text-white'>
            Start Address
          </Label>
          <InputWithRef
            id='rtuMasterStartAddress'
            type='number'
            min={0}
            max={65535}
            value={modbusRTUMaster.startAddress}
            onChange={(e) => updateNumber('startAddress', e.target.value)}
            className={INPUT_STYLES.default}
          />
        </div>
      </div>

      <div id='modbus-rtu-master-form-config-right-slot' className='flex flex-1 flex-col gap-4'>
        <div
          id='modbus-rtu-master-register-count-container'
          className='flex w-full flex-1 items-center justify-start gap-1'
        >
          <Label htmlFor='rtuMasterRegisterCount' className='whitespace-pre text-xs text-neutral-950 dark:text-white'>
            Register Count
          </Label>
          <InputWithRef
            id='rtuMasterRegisterCount'
            type='number'
            min={1}
            max={64}
            value={modbusRTUMaster.registerCount}
            onChange={(e) => updateNumber('registerCount', e.target.value)}
            className={INPUT_STYLES.default}
          />
        </div>

        <div
          id='modbus-rtu-master-poll-interval-container'
          className='flex w-full flex-1 items-center justify-start gap-1'
        >
          <Label htmlFor='rtuMasterPollIntervalMs' className='whitespace-pre text-xs text-neutral-950 dark:text-white'>
            Poll (ms)
          </Label>
          <InputWithRef
            id='rtuMasterPollIntervalMs'
            type='number'
            min={20}
            max={60000}
            value={modbusRTUMaster.pollIntervalMs}
            onChange={(e) => updateNumber('pollIntervalMs', e.target.value)}
            className={INPUT_STYLES.default}
          />
        </div>

        <div id='modbus-rtu-master-map-start-container' className='flex w-full flex-1 items-center justify-start gap-1'>
          <Label htmlFor='rtuMasterMapToInputStart' className='whitespace-pre text-xs text-neutral-950 dark:text-white'>
            Map to %IW Start
          </Label>
          <InputWithRef
            id='rtuMasterMapToInputStart'
            type='number'
            min={0}
            value={modbusRTUMaster.mapToInputStart}
            onChange={(e) => updateNumber('mapToInputStart', e.target.value)}
            className={INPUT_STYLES.default}
          />
        </div>
      </div>
    </div>
  )
})

export { ModbusRTUMasterComponent }
