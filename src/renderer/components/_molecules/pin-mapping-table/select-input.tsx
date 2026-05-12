import { DevicePin, pinTypes } from '@root/types/PLC/devices'
import { CellContext } from '@tanstack/react-table'
import { startCase } from 'lodash'
import { useCallback, useEffect, useState } from 'react'

import { GenericSelectCell } from '../../_atoms'
import { toast } from '../../_features/[app]/toast/use-toast'

// Board info type from the store
type BoardInfo = {
  compiler: string
  core: string
  preview: string
  specs: {
    CPU: string
    RAM: string
    Flash: string
    DigitalPins: string
    AnalogPins: string
    PWMPins: string
    WiFi: string
    Bluetooth: string
    Ethernet: string
  }
  coreVersion?: string
  pins: {
    defaultAin?: Record<string, string>
    defaultAout?: Record<string, string>
    defaultDin?: Record<string, string>
    defaultDout?: Record<string, string>
  }
}

type AvailableBoards = Map<string, BoardInfo>

type PinSelectInputCellProps = CellContext<DevicePin, unknown> & {
  selected?: boolean
  editable?: boolean
  // Board information for determining available pin types
  availableBoards?: AvailableBoards
  selectedBoard?: string
}
export const PinSelectInputCell = ({
  getValue,
  row: { index },
  column: { id },
  table,
  selected = false,
  availableBoards,
  selectedBoard,
}: PinSelectInputCellProps) => {
  const initialValue = getValue<string>()
  const [cellValue, setCellValue] = useState(initialValue)

  const onValueChange = (value: string) => {
    if (value === initialValue) return

    const res = table.options.meta?.updateData(index, id, value)

    // Assume success when no structured response is returned
    if (res === undefined || res?.ok) return

    setCellValue(initialValue)
    toast({ title: res?.title, description: res?.message, variant: 'fail' })
  }

  const selectableValues = useCallback(() => {
    if (id === 'pinType') {
      // Determine which pin types are available based on board config
      const boardInfo = selectedBoard && availableBoards ? availableBoards.get(selectedBoard) : null
      const boardPins = boardInfo?.pins

      // Check if each pin type has available pins in hals.json
      const hasPinType = {
        digitalInput: boardPins?.defaultDin && Object.keys(boardPins.defaultDin).length > 0,
        analogInput: boardPins?.defaultAin && Object.keys(boardPins.defaultAin).length > 0,
        digitalOutput: boardPins?.defaultDout && Object.keys(boardPins.defaultDout).length > 0,
        analogOutput: boardPins?.defaultAout && Object.keys(boardPins.defaultAout).length > 0,
      }

      return Object.values(pinTypes).map((value) => ({
        id: value,
        value: value,
        label: startCase(value),
        // Disable pin types that are not available in the board config
        disabled: !hasPinType[value],
      }))
    }

    return []
  }, [id, selectedBoard, availableBoards])

  // If the initialValue is changed external, sync it up with our state
  useEffect(() => {
    setCellValue(initialValue)
  }, [initialValue])

  return (
    <GenericSelectCell
      value={cellValue}
      onValueChange={onValueChange}
      selectValues={selectableValues()}
      selected={selected}
    />
  )
}
