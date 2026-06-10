import { z } from 'zod'

const baudRateOptions = ['9600', '14400', '19200', '38400', '57600', '115200'] as const

const interfaceOptions = ['Serial', 'Serial1', 'Serial2', 'Serial3'] as const

const staticHostConfigurationSchema = z.object({
  ipAddress: z.string(), // This should have the format: XXX.XXX.XXX.XXX
  dns: z.string(), // This should have the format: XXX.XXX.XXX.XXX
  gateway: z.string(), // This should have the format: XXX.XXX.XXX.XXX
  subnet: z.string(), // This should have the format: XXX.XXX.XXX.XXX
})
type StaticHostConfiguration = z.infer<typeof staticHostConfigurationSchema>

const MAC_ADDRESS_REGEX = /^([0-9A-Fa-f]{2})([:\-,])(?:[0-9A-Fa-f]{2}\2){4}[0-9A-Fa-f]{2}$|^[0-9A-Fa-f]{12}$/
const BYTE_MAC_ADDRESS_REGEX = /^(?:0x[0-9a-f]{2}\s*,\s*){5}0x[0-9a-f]{2}$/i

const deviceConfigurationSchema = z.object({
  deviceBoard: z.string(),
  communicationPort: z.string(),
  runtimeIpAddress: z.string().optional(),
  communicationConfiguration: z.object({
    modbusRTU: z.object({
      rtuInterface: z.enum(interfaceOptions), // This will be an enumerated that will be associated with the device board selected - Validation will be added further.
      rtuBaudRate: z.enum(baudRateOptions), // This will be an enumerated that will be associated with the device board selected - Validation will be added further.
      rtuSlaveId: z.number().int().gte(0).lte(255).nullable(), // Can be any integer number from 0 to 255 - Validation will be added further.
      rtuRS485ENPin: z.string().nullable(), // Can be any integer number from 0 to 255 - Validation will be added further.
    }),
    modbusRTUMaster: z
      .object({
        enabled: z.boolean().default(false),
        rtuInterface: z.enum(interfaceOptions).default('Serial2'),
        rtuBaudRate: z.enum(baudRateOptions).default('115200'),
        rtuRS485ENPin: z.string().nullable().default(null),
        slaveId: z.number().int().gte(1).lte(247).nullable(),
        functionCode: z.enum(['3', '4', '6', '16', '3+6', '3+16', '4+6', '4+16']),
        startAddress: z.number().int().gte(0).lte(65535),
        registerCount: z.number().int().gte(1).lte(64),
        pollIntervalMs: z.number().int().gte(20).lte(60000),
        mapToInputStart: z.number().int().gte(0).lte(1023),
        mapFromOutputStart: z.number().int().gte(0).lte(1023),
      })
      .default({
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
      }),
    modbusTCP: z.discriminatedUnion('tcpInterface', [
      z.object({
        tcpInterface: z.literal('Wi-Fi'),
        tcpMacAddress: z.string().regex(MAC_ADDRESS_REGEX, 'Invalid MAC address format').nullable(), // This should have the format: XX:XX:XX:XX:XX:XX
        tcpWifiSSID: z.string().nullable(),
        tcpWifiPassword: z.string().nullable(),
        tcpStaticHostConfiguration: staticHostConfigurationSchema, // When this is omitted the user has chosen DHCP.
      }),
      z.object({
        tcpInterface: z.literal('Ethernet'),
        tcpMacAddress: z.string().regex(MAC_ADDRESS_REGEX, 'Invalid MAC address format').nullable(),
        tcpStaticHostConfiguration: staticHostConfigurationSchema, // When this is omitted the user has chosen DHCP.
      }),
    ]),
    communicationPreferences: z.object({
      enabledRTU: z.boolean(),
      enabledTCP: z.boolean(),
      enabledDHCP: z.boolean(),
    }),
  }),
})

type DeviceConfiguration = z.infer<typeof deviceConfigurationSchema>

export {
  baudRateOptions,
  BYTE_MAC_ADDRESS_REGEX,
  deviceConfigurationSchema,
  interfaceOptions,
  MAC_ADDRESS_REGEX,
  staticHostConfigurationSchema,
}
export type { DeviceConfiguration, StaticHostConfiguration }
