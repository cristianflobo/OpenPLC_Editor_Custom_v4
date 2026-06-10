import { DeviceConfiguration } from '@root/types/PLC/devices'

// Default configuration for deviceDefinitions.configuration
export const defaultDeviceConfiguration: DeviceConfiguration = {
  deviceBoard: 'OpenPLC Runtime v3',
  communicationPort: '',
  runtimeIpAddress: '',
  communicationConfiguration: {
    modbusRTU: {
      rtuInterface: 'Serial',
      rtuBaudRate: '115200',
      rtuSlaveId: null,
      rtuRS485ENPin: null,
    },
    modbusRTUMaster: {
      enabled: false,
      rtuInterface: 'Serial2',
      rtuBaudRate: '115200',
      rtuRS485ENPin: null,
      slaveId: null,
      functionCode: '3',
      startAddress: 0,
      registerCount: 4,
      pollIntervalMs: 100,
      mapToInputStart: 0,
      mapFromOutputStart: 0,
    },
    modbusTCP: {
      tcpInterface: 'Ethernet',
      tcpMacAddress: 'DE:AD:BE:EF:DE:AD',
      tcpStaticHostConfiguration: {
        ipAddress: '',
        dns: '',
        gateway: '',
        subnet: '',
      },
    },
    communicationPreferences: {
      enabledRTU: false,
      enabledTCP: false,
      enabledDHCP: true,
    },
  },
}
