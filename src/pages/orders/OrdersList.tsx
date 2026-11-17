import { Plus } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { DataTable } from '../../components/DataTable'
import { columnHelper } from '../../lib/table'
import { ErrorBox, PageHeader, Spinner, StatusChip } from '../../components/ui'
import { useLanguage } from '../../i18n/LanguageProvider'
import { formatDateTime, formatMoney, formatNumber, orderNo } from '../../lib/format'
import { useOrders } from '../../lib/queries'
import type { OrderListRow, OrderStatus } from '../../lib/types'

type Row = OrderListRow & { orderLabel: string; vendorName: string; itemCount: number; totalKg: number; total: number }

const h = columnHelper<Row>()

const tabs: { id: OrderStatus | 'all'; labelKey: string }[] = [
  { id: 'pending', labelKey: 'status.pending' },
  { id: 'fulfilled', labelKey: 'status.fulfilled' },
  { id: 'cancelled', labelKey: 'status.cancelled' },
  { id: 'all', labelKey: 'status.all' },
]

export function OrdersList() {
  const { t, displayName } = useLanguage()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as OrderStatus | 'all' | null) ?? 'pending'
  const orders = useOrders(status)
  const navigate = useNavigate()

  const rows = useMemo<Row[]>(
    () =>
      (orders.data ?? []).map((o) => ({
        ...o,
        orderLabel: orderNo(o.order_no),
        vendorName: displayName(o.vendor, '-'),
        itemCount: o.order_items.length,
        totalKg: o.order_items.reduce((s, i) => s + Number(i.qty_kg), 0),
        total: o.order_items.reduce((s, i) => s + Number(i.line_total), 0),
      })),
    [orders.data, displayName],
  )

  const columns = useMemo(
    () =>
      h.columns([
        h.accessor('orderLabel', {
          header: t('orders.colOrder'),
          cell: (c) => <span className="num font-semibold text-primary-ink">{c.getValue()}</span>,
        }),
        h.accessor('created_at', {
          header: t('orders.colDate'),
          sortFn: 'datetime',
          cell: (c) => <span className="whitespace-nowrap">{formatDateTime(c.getValue())}</span>,
        }),
        h.accessor('vendorName', { header: t('orders.colVendor'), cell: (c) => <b>{c.getValue()}</b> }),
        h.accessor('itemCount', { header: t('orders.colItems'), meta: { align: 'right' } }),
        h.accessor('totalKg', {
          header: t('orders.colQty'),
          meta: { align: 'right' },
          cell: (c) => formatNumber(c.getValue()),
        }),
        h.accessor('total', {
          header: t('orders.colAmount'),
          meta: { align: 'right' },
          cell: (c) => formatMoney(c.getValue()),
        }),
        h.accessor('status', {
          header: t('orders.colStatus'),
          cell: (c) => <StatusChip status={c.getValue()} />,
        }),
      ]),
    [t],
  )

  return (
    <div>
      <PageHeader
        title={t('orders.title')}
        subtitle={t('orders.subtitle')}
        actions={
          <Link
            to="/orders/new"
            className="inline-flex h-11 items-center gap-2 rounded-button bg-[linear-gradient(135deg,#3A9A62,#2E7D4F)] px-4 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(46,125,79,0.28)] transition hover:-translate-y-px"
          >
            <Plus className="size-4" /> {t('orders.new')}
          </Link>
        }
      />

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-button border border-border bg-surface p-1 sm:inline-flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setParams({ status: tab.id })}
            className={`h-9 cursor-pointer rounded-[8px] px-4 text-xs font-semibold whitespace-nowrap transition ${status === tab.id ? 'bg-primary text-white' : 'text-muted hover:bg-surface-low'}`}
          >
            {t(tab.labelKey)}
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
          searchPlaceholder={t('orders.search')}
          onRowClick={(o) => navigate(`/orders/${o.id}`)}
          initialSorting={[{ id: 'created_at', desc: true }]}
          empty={status === 'pending' ? t('orders.emptyPending') : t('orders.empty')}
        />
      )}
    </div>
  )
}
