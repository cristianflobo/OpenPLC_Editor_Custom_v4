#include "Arduino_OpenPLC.h"
#include "defines.h"
#include <RswitchCheck.h>

#ifdef MODBUS_ENABLED
#include "ModbusSlave.h"
#endif

// ===== BOTÓN DE SEGURIDAD =====
// Configuración del botón de seguridad RUN/STOP
// #ifndef SAFETY_BUTTON_PIN
//     #define SAFETY_BUTTON_PIN 22  // Cambiar este pin según tu hardware (GPIO0 por defecto)
// #endif

bool plc_run_mode = true;  // true = RUN, false = STOP
bool last_button_state = HIGH;
unsigned long last_debounce_time = 0;
const unsigned long debounce_delay = 50;  // 50ms de debounce

//Include WiFi lib to turn off WiFi radio on ESP32 and ESP8266 boards if we're not using WiFi
#ifndef MBTCP
    #if defined(BOARD_ESP8266)
        #include <ESP8266WiFi.h>
    #elif defined(BOARD_ESP32)
        #include <WiFi.h>
    #endif
#endif

uint32_t __tick = 0;

unsigned long scan_cycle;
unsigned long last_run = 0;
bool first_cycle = false;

#include "arduino_libs.h"

#ifdef USE_ARDUINO_SKETCH
    #include "ext/arduino_sketch.h"
#endif

extern uint8_t pinMask_DIN[];
extern uint8_t pinMask_AIN[];
extern uint8_t pinMask_DOUT[];
extern uint8_t pinMask_AOUT[];

void disablePinFromMasks(uint8_t targetPin)
{
    for (int i = 0; i < NUM_DISCRETE_INPUT; i++)
    {
        if (pinMask_DIN[i] == targetPin)
            pinMask_DIN[i] = 255;
    }
    for (int i = 0; i < NUM_ANALOG_INPUT; i++)
    {
        if (pinMask_AIN[i] == targetPin)
            pinMask_AIN[i] = 255;
    }
    for (int i = 0; i < NUM_DISCRETE_OUTPUT; i++)
    {
        if (pinMask_DOUT[i] == targetPin)
            pinMask_DOUT[i] = 255;
    }
    for (int i = 0; i < NUM_ANALOG_OUTPUT; i++)
    {
        if (pinMask_AOUT[i] == targetPin)
            pinMask_AOUT[i] = 255;
    }
}

#ifdef MBSERIAL_MASTER
#ifndef MBSERIAL_MASTER_READ_FC
    #if MBSERIAL_MASTER_FC == 3 || MBSERIAL_MASTER_FC == 4
        #define MBSERIAL_MASTER_READ_FC MBSERIAL_MASTER_FC
    #else
        #define MBSERIAL_MASTER_READ_FC 0
    #endif
#endif

#ifndef MBSERIAL_MASTER_WRITE_FC
    #if MBSERIAL_MASTER_FC == 6 || MBSERIAL_MASTER_FC == 16
        #define MBSERIAL_MASTER_WRITE_FC MBSERIAL_MASTER_FC
    #else
        #define MBSERIAL_MASTER_WRITE_FC 0
    #endif
#endif

Stream* mb_master_serialport = NULL;
int8_t mb_master_txpin = -1;
uint16_t mb_master_t15 = 750;
uint16_t mb_master_t35 = 2625;
unsigned long mb_master_last_poll = 0;

void mbconfig_master_serial_iface(Stream* port, long baud, int txPin)
{
    mb_master_serialport = port;
    mb_master_txpin = txPin;

    if (txPin >= 0)
    {
        pinMode(txPin, OUTPUT);
        digitalWrite(txPin, LOW);
    }

    if (baud > 19200)
        mb_master_t15 = 750;
    else
        mb_master_t15 = 16500000/baud;

    mb_master_t35 = mb_master_t15 * 3.5;
}

uint16_t calcMasterCrc(uint8_t *buffer, uint16_t length)
{
    uint8_t uchCRCHi = 0xFF;
    uint8_t uchCRCLo = 0xFF;
    uint16_t index;

    while (length--)
    {
        index = uchCRCHi ^ *buffer++;
        uchCRCHi = uchCRCLo ^ _auchCRCHi[index];
        uchCRCLo = _auchCRCLo[index];
    }

    return (uchCRCHi << 8 | uchCRCLo);
}

void setMasterTransmit(bool enabled)
{
    if (mb_master_txpin >= 0)
        digitalWrite(mb_master_txpin, enabled ? HIGH : LOW);
}

bool mbmasterReadRegisters(uint8_t slaveId, uint8_t functionCode, uint16_t startAddress, uint16_t registerCount, uint16_t *dest)
{
    if (mb_master_serialport == NULL || registerCount == 0 || registerCount > 64)
        return false;

    while ((*mb_master_serialport).available() > 0)
        (*mb_master_serialport).read();

    uint8_t request[8];
    request[0] = slaveId;
    request[1] = functionCode;
    request[2] = (uint8_t)(startAddress >> 8);
    request[3] = (uint8_t)(startAddress & 0xFF);
    request[4] = (uint8_t)(registerCount >> 8);
    request[5] = (uint8_t)(registerCount & 0xFF);
    uint16_t crc = calcMasterCrc(request, 6);
    request[6] = (uint8_t)(crc >> 8);
    request[7] = (uint8_t)(crc & 0xFF);

    setMasterTransmit(true);
    (*mb_master_serialport).write(request, sizeof(request));
    (*mb_master_serialport).flush();
    delayMicroseconds(mb_master_t35);
    setMasterTransmit(false);

    uint8_t response[133];
    uint16_t responseLen = 0;
    unsigned long timeoutStart = millis();
    unsigned long lastByteMicros = 0;

    while ((millis() - timeoutStart) < 100)
    {
        while ((*mb_master_serialport).available() > 0 && responseLen < sizeof(response))
        {
            response[responseLen++] = (*mb_master_serialport).read();
            lastByteMicros = micros();
        }

        if (responseLen >= 5 && lastByteMicros != 0 && (*mb_master_serialport).available() == 0)
        {
            if ((micros() - lastByteMicros) >= mb_master_t35)
                break;
        }
    }

    if (responseLen < 5)
        return false;

    if (response[0] != slaveId)
        return false;

    if (response[1] == (functionCode | 0x80))
        return false;

    if (response[1] != functionCode)
        return false;

    uint16_t responseCrc = ((uint16_t)response[responseLen - 2] << 8) | response[responseLen - 1];
    if (responseCrc != calcMasterCrc(response, responseLen - 2))
        return false;

    uint8_t byteCount = response[2];
    if (byteCount != registerCount * 2)
        return false;

    if (responseLen != (uint16_t)(byteCount + 5))
        return false;

    for (uint16_t i = 0; i < registerCount; i++)
    {
        dest[i] = ((uint16_t)response[3 + (i * 2)] << 8) | response[4 + (i * 2)];
    }

    return true;
}

bool mbmasterWriteSingleRegister(uint8_t slaveId, uint16_t startAddress, uint16_t value)
{
    if (mb_master_serialport == NULL)
        return false;

    while ((*mb_master_serialport).available() > 0)
        (*mb_master_serialport).read();

    uint8_t request[8];
    request[0] = slaveId;
    request[1] = 6;
    request[2] = (uint8_t)(startAddress >> 8);
    request[3] = (uint8_t)(startAddress & 0xFF);
    request[4] = (uint8_t)(value >> 8);
    request[5] = (uint8_t)(value & 0xFF);
    uint16_t crc = calcMasterCrc(request, 6);
    request[6] = (uint8_t)(crc >> 8);
    request[7] = (uint8_t)(crc & 0xFF);

    setMasterTransmit(true);
    (*mb_master_serialport).write(request, sizeof(request));
    (*mb_master_serialport).flush();
    delayMicroseconds(mb_master_t35);
    setMasterTransmit(false);

    uint8_t response[8];
    uint16_t responseLen = 0;
    unsigned long timeoutStart = millis();
    unsigned long lastByteMicros = 0;

    while ((millis() - timeoutStart) < 100)
    {
        while ((*mb_master_serialport).available() > 0 && responseLen < sizeof(response))
        {
            response[responseLen++] = (*mb_master_serialport).read();
            lastByteMicros = micros();
        }

        if (responseLen >= 8 && lastByteMicros != 0 && (*mb_master_serialport).available() == 0)
        {
            if ((micros() - lastByteMicros) >= mb_master_t35)
                break;
        }
    }

    if (responseLen != 8)
        return false;

    if (response[0] != slaveId || response[1] != 6)
        return false;

    uint16_t responseCrc = ((uint16_t)response[responseLen - 2] << 8) | response[responseLen - 1];
    if (responseCrc != calcMasterCrc(response, responseLen - 2))
        return false;

    if (response[2] != request[2] || response[3] != request[3] || response[4] != request[4] || response[5] != request[5])
        return false;

    return true;
}

bool mbmasterWriteMultipleRegisters(uint8_t slaveId, uint16_t startAddress, uint16_t registerCount, uint16_t *values)
{
    if (mb_master_serialport == NULL || registerCount == 0 || registerCount > 64)
        return false;

    while ((*mb_master_serialport).available() > 0)
        (*mb_master_serialport).read();

    uint16_t requestLen = (uint16_t)(9 + (registerCount * 2));
    uint8_t request[137];

    request[0] = slaveId;
    request[1] = 16;
    request[2] = (uint8_t)(startAddress >> 8);
    request[3] = (uint8_t)(startAddress & 0xFF);
    request[4] = (uint8_t)(registerCount >> 8);
    request[5] = (uint8_t)(registerCount & 0xFF);
    request[6] = (uint8_t)(registerCount * 2);

    for (uint16_t i = 0; i < registerCount; i++)
    {
        request[7 + (i * 2)] = (uint8_t)(values[i] >> 8);
        request[8 + (i * 2)] = (uint8_t)(values[i] & 0xFF);
    }

    uint16_t crc = calcMasterCrc(request, requestLen - 2);
    request[requestLen - 2] = (uint8_t)(crc >> 8);
    request[requestLen - 1] = (uint8_t)(crc & 0xFF);

    setMasterTransmit(true);
    (*mb_master_serialport).write(request, requestLen);
    (*mb_master_serialport).flush();
    delayMicroseconds(mb_master_t35);
    setMasterTransmit(false);

    uint8_t response[8];
    uint16_t responseLen = 0;
    unsigned long timeoutStart = millis();
    unsigned long lastByteMicros = 0;

    while ((millis() - timeoutStart) < 100)
    {
        while ((*mb_master_serialport).available() > 0 && responseLen < sizeof(response))
        {
            response[responseLen++] = (*mb_master_serialport).read();
            lastByteMicros = micros();
        }

        if (responseLen >= 8 && lastByteMicros != 0 && (*mb_master_serialport).available() == 0)
        {
            if ((micros() - lastByteMicros) >= mb_master_t35)
                break;
        }
    }

    if (responseLen != 8)
        return false;

    if (response[0] != slaveId || response[1] != 16)
        return false;

    uint16_t responseCrc = ((uint16_t)response[responseLen - 2] << 8) | response[responseLen - 1];
    if (responseCrc != calcMasterCrc(response, responseLen - 2))
        return false;

    if (response[2] != request[2] || response[3] != request[3] || response[4] != request[4] || response[5] != request[5])
        return false;

    return true;
}

void modbusMasterTask()
{
    if (mb_master_serialport == NULL)
        return;

    if (mb_master_last_poll != 0 && (millis() - mb_master_last_poll) < MBSERIAL_MASTER_POLL_MS)
        return;

    mb_master_last_poll = millis();

    if (MBSERIAL_MASTER_READ_FC == 3 || MBSERIAL_MASTER_READ_FC == 4)
    {
        uint16_t values[64];
        if (mbmasterReadRegisters(MBSERIAL_MASTER_SLAVE, MBSERIAL_MASTER_READ_FC, MBSERIAL_MASTER_START, MBSERIAL_MASTER_COUNT, values))
        {
            for (uint16_t i = 0; i < MBSERIAL_MASTER_COUNT; i++)
            {
                uint16_t inputIndex = MBSERIAL_MASTER_MAP_START + i;
                if (inputIndex >= MAX_ANALOG_INPUT)
                    break;

                if (int_input[inputIndex] != NULL)
                    *int_input[inputIndex] = values[i];
            }
        }
    }

    if (MBSERIAL_MASTER_WRITE_FC == 6)
    {
        uint16_t outputIndex = MBSERIAL_MASTER_MAP_OUT_START;
        uint16_t value = 0;

        if (outputIndex < MAX_ANALOG_OUTPUT && int_output[outputIndex] != NULL)
            value = *int_output[outputIndex];

        mbmasterWriteSingleRegister(MBSERIAL_MASTER_SLAVE, MBSERIAL_MASTER_START, value);
        return;
    }

    if (MBSERIAL_MASTER_WRITE_FC == 16)
    {
        uint16_t values[64];
        for (uint16_t i = 0; i < MBSERIAL_MASTER_COUNT; i++)
        {
            uint16_t outputIndex = MBSERIAL_MASTER_MAP_OUT_START + i;
            values[i] = 0;

            if (outputIndex < MAX_ANALOG_OUTPUT && int_output[outputIndex] != NULL)
                values[i] = *int_output[outputIndex];
        }

        mbmasterWriteMultipleRegisters(MBSERIAL_MASTER_SLAVE, MBSERIAL_MASTER_START, MBSERIAL_MASTER_COUNT, values);
            return;
    }

    // Unsupported function code
}
#endif

/*
extern "C" int availableMemory(char *);

int availableMemory(char *msg)
{
  int size = 8192; // Use 2048 with ATmega328
  byte *buf;

  while ((buf = (byte *) malloc(--size)) == NULL);

  free(buf);
  Serial.print(msg);
  Serial.println(size);
}
*/

void setupCycleDelay(unsigned long long cycle_time)
{
    scan_cycle = (uint32_t)(cycle_time/1000);
    last_run = micros();
}

void setup()
{
    // ===== CPU IDENTIFICATION BROADCAST =====
    // auto-detect the connected device when a communication port is selected.
    #ifdef BOARD_CPU_MODEL
        Serial.begin(115200);
        delay(100);
        Serial.println(BOARD_CPU_MODEL);
        Serial.flush();
        delay(10);
        Serial.end();
    #endif

    rswitch_check();
    //Turn off WiFi radio on ESP32 and ESP8266 boards if we're not using WiFi
    #ifndef MBTCP
        #if defined(BOARD_ESP8266) || defined(BOARD_ESP32)
            WiFi.mode(WIFI_OFF);
        #endif
    #endif
    
    // Configurar botón de seguridad
    // pinMode(SAFETY_BUTTON_PIN, INPUT_PULLUP);
    // plc_run_mode = digitalRead(SAFETY_BUTTON_PIN) == HIGH;  // HIGH = RUN, LOW = STOP
    
    config_init__();
    glueVars();
    hardwareInit();
	#ifdef MODBUS_ENABLED
        #ifdef MBSERIAL
	        //Config Modbus Serial (port, speed, rs485 tx pin)
            #ifdef MBSERIAL_TXPIN
                disablePinFromMasks(MBSERIAL_TXPIN);
                MBSERIAL_IFACE.begin(MBSERIAL_BAUD); //Initialize serial interface
                mbconfig_serial_iface(&MBSERIAL_IFACE, MBSERIAL_BAUD, MBSERIAL_TXPIN);
            #else
                MBSERIAL_IFACE.begin(MBSERIAL_BAUD); //Initialize serial interface
                mbconfig_serial_iface(&MBSERIAL_IFACE, MBSERIAL_BAUD, -1);;
            #endif

	        //Set the Slave ID
	        modbus.slaveid = MBSERIAL_SLAVE;
        #endif

        #ifdef MBSERIAL_MASTER
            #ifdef MBSERIAL_MASTER_TXPIN
                disablePinFromMasks(MBSERIAL_MASTER_TXPIN);
                MBSERIAL_MASTER_IFACE.begin(MBSERIAL_MASTER_BAUD);
                mbconfig_master_serial_iface(&MBSERIAL_MASTER_IFACE, MBSERIAL_MASTER_BAUD, MBSERIAL_MASTER_TXPIN);
            #else
                MBSERIAL_MASTER_IFACE.begin(MBSERIAL_MASTER_BAUD);
                mbconfig_master_serial_iface(&MBSERIAL_MASTER_IFACE, MBSERIAL_MASTER_BAUD, -1);
            #endif
        #endif

        #ifdef MBTCP
        uint8_t mac[] = { MBTCP_MAC };
        uint8_t ip[] = { MBTCP_IP };
        uint8_t dns[] = { MBTCP_DNS };
        uint8_t gateway[] = { MBTCP_GATEWAY };
        uint8_t subnet[] = { MBTCP_SUBNET };

        if (sizeof(ip)/sizeof(uint8_t) < 4)
            mbconfig_ethernet_iface(mac, NULL, NULL, NULL, NULL);
        else if (sizeof(dns)/sizeof(uint8_t) < 4)
            mbconfig_ethernet_iface(mac, ip, NULL, NULL, NULL);
        else if (sizeof(gateway)/sizeof(uint8_t) < 4)
            mbconfig_ethernet_iface(mac, ip, dns, NULL, NULL);
        else if (sizeof(subnet)/sizeof(uint8_t) < 4)
            mbconfig_ethernet_iface(mac, ip, dns, gateway, NULL);
        else
            mbconfig_ethernet_iface(mac, ip, dns, gateway, subnet);
        #endif

        //Add all modbus registers
        init_mbregs(MAX_ANALOG_OUTPUT + MAX_MEMORY_WORD, MAX_MEMORY_DWORD, MAX_MEMORY_LWORD, MAX_DIGITAL_OUTPUT, MAX_ANALOG_INPUT, MAX_DIGITAL_INPUT);
        mapEmptyBuffers();
	#endif

    setupCycleDelay(common_ticktime__);

    #ifdef USE_ARDUINO_SKETCH
        sketch_setup();
    #endif
}

#ifdef MODBUS_ENABLED
void mapEmptyBuffers()
{
    //Map all NULL I/O buffers to Modbus registers
    for (int i = 0; i < MAX_DIGITAL_OUTPUT; i++)
    {
        if (bool_output[i/8][i%8] == NULL)
        {
			bool_output[i/8][i%8] = (IEC_BOOL *)malloc(sizeof(IEC_BOOL));
			*bool_output[i/8][i%8] = 0;
        }
    }
    for (int i = 0; i < MAX_ANALOG_OUTPUT; i++)
    {
        if (int_output[i] == NULL)
        {
			int_output[i] = (IEC_UINT *)(modbus.holding + i);
        }
    }
    for (int i = 0; i < MAX_DIGITAL_INPUT; i++)
    {
        if (bool_input[i/8][i%8] == NULL)
        {
            bool_input[i/8][i%8] = (IEC_BOOL *)malloc(sizeof(IEC_BOOL));
			*bool_input[i/8][i%8] = 0;
        }
    }
    for (int i = 0; i < MAX_ANALOG_INPUT; i++)
    {
        if (int_input[i] == NULL)
        {
			int_input[i] = (IEC_UINT *)(modbus.input_regs + i);
        }
    }
    #if !defined(__AVR_ATmega328P__) && !defined(__AVR_ATmega168__) && !defined(__AVR_ATmega32U4__) && !defined(__AVR_ATmega16U4__)
        for (int i = 0; i < MAX_MEMORY_WORD; i++)
        {
            if (int_memory[i] == NULL)
            {
                int_memory[i] = (IEC_UINT *)(modbus.holding + MAX_ANALOG_OUTPUT + i);
            }
        }
        for (int i = 0; i < MAX_MEMORY_DWORD; i++)
        {
            if (dint_memory[i] == NULL)
            {
                dint_memory[i] = (IEC_UDINT *)(modbus.dint_memory + i);
            }
        }
        for (int i = 0; i < MAX_MEMORY_LWORD; i++)
        {
            if (lint_memory[i] == NULL)
            {
                lint_memory[i] = (IEC_ULINT *)(modbus.lint_memory + i);
            }
        }
    #endif
}

void modbusTask()
{
    //Sync OpenPLC Buffers with Modbus Buffers
    for (int i = 0; i < MAX_DIGITAL_OUTPUT; i++)
    {
        if (bool_output[i/8][i%8] != NULL)
        {
            write_discrete(i, COILS, (bool)*bool_output[i/8][i%8]);
        }
    }
    for (int i = 0; i < MAX_ANALOG_OUTPUT; i++)
    {
        if (int_output[i] != NULL)
        {
            modbus.holding[i] = *int_output[i];
        }
    }
    for (int i = 0; i < MAX_DIGITAL_INPUT; i++)
    {
        if (bool_input[i/8][i%8] != NULL)
        {
            write_discrete(i, INPUTSTATUS, (bool)*bool_input[i/8][i%8]);
        }
    }
    for (int i = 0; i < MAX_ANALOG_INPUT; i++)
    {
        if (int_input[i] != NULL)
        {
            modbus.input_regs[i] = *int_input[i];
        }
    }
    #if !defined(__AVR_ATmega328P__) && !defined(__AVR_ATmega168__) && !defined(__AVR_ATmega32U4__) && !defined(__AVR_ATmega16U4__)
        for (int i = 0; i < MAX_MEMORY_WORD; i++)
        {
            if (int_memory[i] != NULL)
            {
                modbus.holding[i + MAX_ANALOG_OUTPUT] = *int_memory[i];
            }
        }
        for (int i = 0; i < MAX_MEMORY_DWORD; i++)
        {
            if (dint_memory[i] != NULL)
            {
                modbus.dint_memory[i] = *dint_memory[i];
            }
        }
        for (int i = 0; i < MAX_MEMORY_LWORD; i++)
        {
            if (lint_memory[i] != NULL)
            {
                modbus.lint_memory[i] = *lint_memory[i];
            }
        }
    #endif

    //Read changes from clients
    mbtask();

    //Write changes back to OpenPLC Buffers
    for (int i = 0; i < MAX_DIGITAL_OUTPUT; i++)
    {
        if (bool_output[i/8][i%8] != NULL)
        {
            *bool_output[i/8][i%8] = get_discrete(i, COILS);
        }
    }
    for (int i = 0; i < MAX_ANALOG_OUTPUT; i++)
    {
        if (int_output[i] != NULL)
        {
            *int_output[i] = modbus.holding[i];
        }
    }
    #if !defined(__AVR_ATmega328P__) && !defined(__AVR_ATmega168__) && !defined(__AVR_ATmega32U4__) && !defined(__AVR_ATmega16U4__)
        for (int i = 0; i < MAX_MEMORY_WORD; i++)
        {
            if (int_memory[i] != NULL)
            {
                *int_memory[i] = modbus.holding[i + MAX_ANALOG_OUTPUT];
            }
        }
        for (int i = 0; i < MAX_MEMORY_DWORD; i++)
        {
            if (dint_memory[i] != NULL)
            {
                *dint_memory[i] = modbus.dint_memory[i];
            }
        }
        for (int i = 0; i < MAX_MEMORY_LWORD; i++)
        {
            if (lint_memory[i] != NULL)
            {
                *lint_memory[i] = modbus.lint_memory[i];
            }
        }
    #endif
}
#endif

// Función para leer el botón de seguridad con debounce
// void readSafetyButton()
// {
//     bool current_button = digitalRead(SAFETY_BUTTON_PIN);
    
//     // Detectar cambio de estado con debounce
//     if (current_button != last_button_state)
//     {
//         last_debounce_time = millis();
//     }
    
//     if ((millis() - last_debounce_time) > debounce_delay)
//     {
//         // El estado del botón es estable
//         plc_run_mode = (current_button == HIGH);  // HIGH = RUN, LOW = STOP
//     }
    
//     last_button_state = current_button;
// }

// Función para forzar todas las salidas a 0 en modo STOP
void forceSafeOutputs()
{
    // Forzar salidas digitales a 0
    for (int i = 0; i < MAX_DIGITAL_OUTPUT; i++)
    {
        if (bool_output[i/8][i%8] != NULL)
        {
            *bool_output[i/8][i%8] = 0;
        }
    }
    
    // Forzar salidas analógicas a 0
    for (int i = 0; i < MAX_ANALOG_OUTPUT; i++)
    {
        if (int_output[i] != NULL)
        {
            *int_output[i] = 0;
        }
    }
}

void plcCycleTask()
{
    updateInputBuffers();

    #ifdef MBSERIAL_MASTER
        modbusMasterTask();
    #endif
    
    // Leer estado del botón de seguridad
    // readSafetyButton();
    
    if (plc_run_mode)
    {
        // Modo RUN: ejecutar lógica del PLC normalmente
        config_run__(__tick++); //PLC Logic
        updateOutputBuffers();
    }
    else
    {
        // Modo STOP: forzar todas las salidas a 0 (seguridad)
        forceSafeOutputs();
        updateOutputBuffers();
    }
    
    updateTime();
}

void scheduler()
{
    // Run tasks round robin - higher priority first

    plcCycleTask();

    #ifdef USE_ARDUINO_SKETCH
        sketch_loop();
    #endif

    #ifdef MODBUS_ENABLED
        modbusTask();
    #endif

    if (!first_cycle)
    {
        first_cycle = true;
        // Recalculate last_run to avoid time drift on the first cycle
        last_run = micros() - scan_cycle;
    }
}

void loop()
{
    // ignore until next scan cycle (run lower priority tasks if time permits)
    // always rely on the difference between now (aka micros() ) and the last_run,
    // which always is a positive integer number, even when micros() wraps around every 71 minutes.
    if ((micros() - last_run) >= scan_cycle)
    {
        scheduler();

        //set timer for the next scan cycle
        last_run += scan_cycle;
    }

    #ifdef MODBUS_ENABLED
    //Only run Modbus task again if we have at least 10ms gap until the next cycle
    if ((micros() - last_run) >= 10000)
    {
        modbusTask();
    }
    #endif
}
