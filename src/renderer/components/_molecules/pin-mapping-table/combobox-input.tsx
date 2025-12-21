import { boardSelectors, pinSelectors } from '@root/renderer/hooks'
import { DevicePin } from '@root/types/PLC/devices'
import { CellContext } from '@tanstack/react-table'
import { useCallback, useEffect, useState } from 'react'

import { GenericComboboxCell } from '../../_atoms/generic-table-inputs/generic-combobox-cell'
import { toast } from '../../_features/[app]/toast/use-toast'

type PinSelectInputCellProps = CellContext<DevicePin, unknown> & {
  selected?: boolean
  editable?: boolean
}
export const PinComboboxInputCell = ({
  getValue,
  row: { index },
  column: { id },
  table,
  selected = false,
}: PinSelectInputCellProps) => {
  const initialValue = getValue<string>()
  const [cellValue, setCellValue] = useState(initialValue)

  const selectedDeviceBoard = boardSelectors.useDeviceBoard()
  const availableBoards = boardSelectors.useAvailableBoards()
  const existingPins = pinSelectors.usePins()

  const onValueChange = (value: string) => {
    if (value === initialValue) return

    const res = table.options.meta?.updateData(index, id, value)

    // Assume success when no structured response is returned
    if (res === undefined || res?.ok) return

    setCellValue(initialValue)
    toast({ title: res?.title, description: res?.message, variant: 'fail' })
  }

  const selectableValues = useCallback(() => {
    const transformPins = (pins: string[], labels: Record<string, string>) =>
      pins.map((pin) => ({
        id: `${id}-${pin}`,
        value: pin,
        label: labels[pin] || pin,
      }))

    const boardInfo = availableBoards.get(selectedDeviceBoard)
    const currentPinType = table.options.data[index]?.pinType

    let pinsToShow: string[] = []
    let ioLabels: Record<string, string> = {}

    // Always include all labels for display
    ioLabels = {
      ...(boardInfo?.pins?.defaultAin || {}),
      ...(boardInfo?.pins?.defaultAout || {}),
      ...(boardInfo?.pins?.defaultDin || {}),
      ...(boardInfo?.pins?.defaultDout || {}),
    }

    if (currentPinType === 'digitalInput') {
      pinsToShow = Object.keys(boardInfo?.pins?.defaultDin || {})
    } else if (currentPinType === 'analogInput') {
      pinsToShow = Object.keys(boardInfo?.pins?.defaultAin || {})
    } else if (currentPinType === 'digitalOutput') {
      pinsToShow = Object.keys(boardInfo?.pins?.defaultDout || {})
    } else if (currentPinType === 'analogOutput') {
      pinsToShow = Object.keys(boardInfo?.pins?.defaultAout || {})
    } else {
      // If no type selected, show all
      const defaultAinPins = Object.keys(boardInfo?.pins?.defaultAin || {})
      const defaultAoutPins = Object.keys(boardInfo?.pins?.defaultAout || {})
      const defaultDinPins = Object.keys(boardInfo?.pins?.defaultDin || {})
      const defaultDoutPins = Object.keys(boardInfo?.pins?.defaultDout || {})
      pinsToShow = [...defaultAinPins, ...defaultAoutPins, ...defaultDinPins, ...defaultDoutPins]
    }

    const currentValue = getValue<string>()

    let options = transformPins(pinsToShow, ioLabels).filter(
      (pin) => !existingPins.some((existingPin) => existingPin.pin === pin.value),
    )

    // If the current value is not in options but has a label, add it
    if (currentValue && ioLabels[currentValue] && !options.some((opt) => opt.value === currentValue)) {
      options = [
        ...options,
        {
          id: `current-${currentValue}`,
          value: currentValue,
          label: ioLabels[currentValue],
        },
      ]
    }

    return options.sort((a, b) => {
      const isALetter = /^[A-Za-z]/.test(a.label)
      const isBLetter = /^[A-Za-z]/.test(b.label)
      if (isALetter && !isBLetter) return -1
      if (!isALetter && isBLetter) return 1
      if (!isALetter && !isBLetter) {
        // Both are numbers, sort numerically
        return parseInt(a.label, 10) - parseInt(b.label, 10)
      }
      // Both are letter-prefixed, sort alphabetically
      return a.label.localeCompare(b.label)
    })
  }, [id, selectedDeviceBoard, availableBoards, existingPins, table.options.data, index])

  // If the initialValue is changed external, sync it up with our state
  useEffect(() => {
    setCellValue(initialValue)
  }, [initialValue])

  return (
    <GenericComboboxCell
      value={cellValue}
      onValueChange={onValueChange}
      selectValues={selectableValues()}
      selected={selected}
      canAddACustomOption
    />
  )
}
