import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  type ColumnDef,
  type RowData,
} from '@tanstack/react-table'

export const appTableFeatures = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
  },
  filterFns: { includesString: filterFn_includesString },
})

export type AppTableFeatures = typeof appTableFeatures

export function columnHelper<T extends RowData>() {
  return createColumnHelper<AppTableFeatures, T>()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppColumn<T extends RowData> = ColumnDef<AppTableFeatures, T, any>
