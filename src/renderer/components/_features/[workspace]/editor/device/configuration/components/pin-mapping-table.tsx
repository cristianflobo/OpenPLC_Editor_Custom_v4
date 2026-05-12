import { GenericTable } from '@root/renderer/components/_atoms/generic-table'
import {
  PinComboboxInputCell,
  PinSelectInputCell,
  PinTextInputCell,
} from '@root/renderer/components/_molecules/pin-mapping-table'
import { boardSelectors, pinSelectors } from '@root/renderer/hooks'
import { useOpenPLCStore } from '@root/renderer/store'
import type { DevicePin } from '@root/types/PLC/devices'
import { createColumnHelper } from '@tanstack/react-table'

const columnHelper = createColumnHelper<DevicePin>()

type PinMappingTableProps = {
  pins: DevicePin[]
  selectedRowId: number
  handleRowClick: (row: HTMLTableRowElement) => void
}

const PinMappingTable = ({ pins, selectedRowId, handleRowClick }: PinMappingTableProps) => {
  const updatePin = pinSelectors.useUpdatePin()
  const availableBoards = useOpenPLCStore((state) => state.deviceAvailableOptions.availableBoards)
  const selectedBoard = boardSelectors.useDeviceBoard()

  const columns = [
    columnHelper.accessor('pin', {
      header: 'I/O',
      cell: PinComboboxInputCell,
    }),
    columnHelper.accessor('pinType', {
      header: 'Type',
      cell: (props) => (
        <PinSelectInputCell {...props} availableBoards={availableBoards} selectedBoard={selectedBoard} />
      ),
    }),
    columnHelper.accessor('address', {
      header: 'Address',
      cell: (props) => props.getValue(),
    }),
    columnHelper.accessor('name', {
      header: 'Name',
      cell: PinTextInputCell,
    }),
  ]

  const handleUpdateDataRequest = (_rowIndex: number, columnId: string, value: unknown) => {
    const res = updatePin({
      [columnId as keyof DevicePin]: value,
    })
    return res
  }

  return (
    <GenericTable<DevicePin>
      columns={columns}
      tableData={pins}
      selectedRow={selectedRowId}
      handleRowClick={handleRowClick}
      updateData={handleUpdateDataRequest}
      tableContext='Pin mapping table'
    />
  )
}

export { PinMappingTable }
