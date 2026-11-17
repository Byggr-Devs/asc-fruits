import { useTable, type RowData, type SortingState } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useT } from '../i18n/LanguageProvider'
import { appTableFeatures, type AppColumn } from '../lib/table'

export function DataTable<T extends RowData>({
  data,
  columns,
  searchPlaceholder,
  onRowClick,
  empty,
  initialSorting = [],
  toolbar,
  footer,
}: {
  data: T[]
  columns: AppColumn<T>[]
  searchPlaceholder?: string
  onRowClick?: (row: T) => void
  empty?: ReactNode
  initialSorting?: SortingState
  toolbar?: ReactNode
  footer?: ReactNode
}) {
  const t = useT()
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>(initialSorting)

  const table = useTable({
    features: appTableFeatures,
    columns,
    data,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    globalFilterFn: 'includesString',
  })

  const rows = table.getRowModel().rows

  return (
    <div className="card overflow-hidden">
      {(searchPlaceholder || toolbar) && (
        <div className="no-print flex flex-wrap items-center gap-3 border-b border-border p-3">
          {searchPlaceholder && (
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                className="input pl-9"
                placeholder={searchPlaceholder}
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
              />
            </div>
          )}
          {toolbar}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="bg-primary-soft">
                {group.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  const align = (header.column.columnDef.meta as { align?: string } | undefined)
                    ?.align
                  return (
                    <th
                      key={header.id}
                      className={`px-3 py-2.5 text-3xs font-semibold tracking-wider whitespace-nowrap text-primary-ink uppercase ${align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={`inline-flex cursor-pointer items-center gap-1 uppercase ${align === 'right' ? 'flex-row-reverse' : ''}`}
                        >
                          <table.FlexRender header={header} />
                          {sorted === 'asc' ? (
                            <ArrowUp className="size-3" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ChevronsUpDown className="size-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={`border-t border-border transition-colors hover:bg-surface-low ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {row.getAllCells().map((cell) => {
                  const align = (cell.column.columnDef.meta as { align?: string } | undefined)
                    ?.align
                  return (
                    <td
                      key={cell.id}
                      className={`px-3 py-3 align-middle ${align === 'right' ? 'num text-right whitespace-nowrap' : ''}`}
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot className="border-t-2 border-border bg-surface-low">{footer}</tfoot>}
        </table>
      </div>
      {rows.length === 0 && (
        <div className="px-4 py-10 text-center text-muted">
          {globalFilter ? t('common.noMatches') : (empty ?? t('common.emptyDefault'))}
        </div>
      )}
    </div>
  )
}
