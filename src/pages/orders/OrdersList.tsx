import { Plus } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { DataTable } from '../../components/DataTable'
import { columnHelper } from '../../lib/table'
import { ErrorBox, PageHeader, Spinner, StatusChip } from '../../components/ui'
import { formatDateTime, formatMoney, formatNumber, orderNo } from '../../lib/format'
import { useOrders } from '../../lib/queries'
import type { OrderListRow, OrderStatus } from '../../lib/types'

type Row = OrderListRow & { orderLabel: string; vendorName: string; itemCount: number; totalKg: number; total: number }

const h = columnHelper<Row>()
const columns = h.columns([
  h.accessor('orderLabel', {
    header: 'Order',
    cell: (c) => <span className="num font-semibold text-primary-ink">{c.getValue()}</span>,
  }),
  h.accessor('created_at', {
    header: 'Date',
    sortFn: 'datetime',
    cell: (c) => <span className="whitespace-nowrap">{formatDateTime(c.getValue())}</span>,
  }),
  h.accessor('vendorName', { header: 'Vendor', cell: (c) => <b>{c.getValue()}</b> }),
  h.accessor('itemCount', { header: 'Items', meta: { align: 'right' } }),
  h.accessor('totalKg', {
    header: 'Qty (kg)',
    meta: { align: 'right' },
    cell: (c) => formatNumber(c.getValue()),
  }),
  h.accessor('total', {
    header: 'Amount',
    meta: { align: 'right' },
    cell: (c) => formatMoney(c.getValue()),
  }),
  h.accessor('status', { header: 'Status', cell: (c) => <StatusChip status={c.getValue()} /> }),
])

const tabs: { id: OrderStatus | 'all'; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'fulfilled', label: 'Fulfilled' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'all', label: 'All' },
]

export function OrdersList() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as OrderStatus | 'all' | null) ?? 'pending'
  const orders = useOrders(status)
  const navigate = useNavigate()

  const rows = useMemo<Row[]>(
    () =>
      (orders.data ?? []).map((o) => ({
        ...o,
        orderLabel: orderNo(o.order_no),
        vendorName: o.vendor?.name ?? '-',
        itemCount: o.order_items.length,
        totalKg: o.order_items.reduce((s, i) => s + Number(i.qty_kg), 0),
        total: o.order_items.reduce((s, i) => s + Number(i.line_total), 0),
      })),
    [orders.data],
  )

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Purchase orders sent to vendors."
        actions={
          <Link
            to="/orders/new"
            className="inline-flex h-11 items-center gap-2 rounded-button bg-[linear-gradient(135deg,#3A9A62,#2E7D4F)] px-4 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(46,125,79,0.28)] transition hover:-translate-y-px"
          >
            <Plus className="size-4" /> New order
          </Link>
        }
      />

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-button border border-border bg-surface p-1 sm:inline-flex">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setParams({ status: t.id })}
            className={`h-9 cursor-pointer rounded-[8px] px-4 text-xs font-semibold whitespace-nowrap transition ${status === t.id ? 'bg-primary text-white' : 'text-muted hover:bg-surface-low'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ErrorBox error={orders.error} />
      {orders.isLoading ? (
        <Spinner />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          searchPlaceholder="Search by vendor or order number"
          onRowClick={(o) => navigate(`/orders/${o.id}`)}
          initialSorting={[{ id: 'created_at', desc: true }]}
          empty={status === 'pending' ? 'No pending orders.' : 'No orders found.'}
        />
      )}
    </div>
  )
}
