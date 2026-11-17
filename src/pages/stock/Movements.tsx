import { useMemo, useState } from 'react'
import { DataTable } from '../../components/DataTable'
import { columnHelper } from '../../lib/table'
import { Chip, ErrorBox, PageHeader, Spinner, Thumb } from '../../components/ui'
import {
  addDays,
  dayStartISO,
  deliveryNo,
  formatDateTime,
  formatNumber,
  todayISO,
} from '../../lib/format'
import { useCatalog, useMovements, type CatalogVariety } from '../../lib/queries'
import type { StockMovement } from '../../lib/types'

type Row = StockMovement & {
  variety: CatalogVariety | undefined
  varietyName: string
  fruitName: string
  refLabel: string
}

const h = columnHelper<Row>()
const columns = h.columns([
  h.accessor('created_at', {
    header: 'When',
    sortFn: 'datetime',
    cell: (c) => <span className="whitespace-nowrap">{formatDateTime(c.getValue())}</span>,
  }),
  h.accessor('varietyName', {
    header: 'Item',
    cell: (c) => {
      const v = c.row.original.variety
      return (
        <div className="flex items-center gap-2.5">
          <Thumb emoji={v?.emoji || v?.fruit.emoji} imagePath={v?.image_path || v?.fruit.image_path} size="sm" />
          <div>
            <div className="font-semibold">{c.getValue()}</div>
            <div className="text-2xs text-muted">{c.row.original.fruitName}</div>
          </div>
        </div>
      )
    },
  }),
  h.accessor('type', {
    header: 'Type',
    cell: (c) =>
      c.getValue() === 'receipt' ? (
        <Chip tone="green">Received</Chip>
      ) : (
        <Chip tone={c.row.original.reason === 'wastage' ? 'red' : 'amber'}>
          {c.row.original.reason ? c.row.original.reason[0].toUpperCase() + c.row.original.reason.slice(1) : 'Adjustment'}
        </Chip>
      ),
  }),
  h.accessor('refLabel', {
    header: 'Reference / note',
    cell: (c) => (
      <span className="text-muted">
        {[c.getValue(), c.row.original.note].filter(Boolean).join(' · ') || '-'}
      </span>
    ),
  }),
  h.accessor('qty_kg', {
    header: 'Qty (kg)',
    meta: { align: 'right' },
    cell: (c) => {
      const n = Number(c.getValue())
      return (
        <span className={`font-semibold ${n < 0 ? 'text-danger' : 'text-primary'}`}>
          {n > 0 ? '+' : ''}
          {formatNumber(n)}
        </span>
      )
    },
  }),
])

export function Movements() {
  const [from, setFrom] = useState(addDays(todayISO(), -6))
  const [to, setTo] = useState(todayISO())
  const [type, setType] = useState<'all' | 'receipt' | 'adjustment'>('all')
  const { varietyById } = useCatalog()
  const movements = useMovements({
    from: from ? dayStartISO(from) : undefined,
    to: to ? dayStartISO(addDays(to, 1)) : undefined,
    type,
  })

  const rows = useMemo<Row[]>(
    () =>
      (movements.data ?? []).map((m) => {
        const variety = varietyById.get(m.variety_id)
        return {
          ...m,
          variety,
          varietyName: variety?.name ?? 'Unknown',
          fruitName: variety?.fruit.name ?? '',
          refLabel: m.delivery ? deliveryNo(m.delivery.delivery_no) : '',
        }
      }),
    [movements.data, varietyById],
  )

  const inKg = rows.filter((r) => r.qty_kg > 0).reduce((s, r) => s + Number(r.qty_kg), 0)
  const outKg = rows.filter((r) => r.qty_kg < 0).reduce((s, r) => s + Number(r.qty_kg), 0)

  return (
    <div>
      <PageHeader title="Stock movements" subtitle="Every kg in and out of the godown." />
      <ErrorBox error={movements.error} />
      <DataTable
        data={rows}
        columns={columns}
        searchPlaceholder="Search item, delivery or note"
        initialSorting={[{ id: 'created_at', desc: true }]}
        empty="No movements in this period."
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              className="input w-auto"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="From date"
            />
            <span className="text-muted">to</span>
            <input
              type="date"
              className="input w-auto"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              aria-label="To date"
            />
            <select
              className="input w-auto"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              aria-label="Type"
            >
              <option value="all">All types</option>
              <option value="receipt">Received</option>
              <option value="adjustment">Adjustments</option>
            </select>
          </div>
        }
        footer={
          rows.length > 0 ? (
            <tr className="font-semibold">
              <td className="px-3 py-3" colSpan={4}>
                In <span className="num text-primary">+{formatNumber(inKg)}</span> · Out{' '}
                <span className="num text-danger">{formatNumber(outKg)}</span>
              </td>
              <td className="num px-3 py-3 text-right">{formatNumber(inKg + outKg)}</td>
            </tr>
          ) : undefined
        }
      />
      {movements.isLoading && <Spinner />}
    </div>
  )
}
