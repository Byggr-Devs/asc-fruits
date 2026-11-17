import { PackageCheck, Truck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { DataTable } from '../../components/DataTable'
import { columnHelper } from '../../lib/table'
import { Chip, EmptyState, ErrorBox, Modal, PageHeader, Spinner, Thumb } from '../../components/ui'
import { deliveryNo, formatDateTime, formatNumber, orderNo } from '../../lib/format'
import { useCatalog, useDeliveries } from '../../lib/queries'
import type { DeliveryListRow } from '../../lib/types'

type Row = DeliveryListRow & {
  deliveryLabel: string
  vendorName: string
  totalKg: number
  itemCount: number
  orderLabels: string
}

const h = columnHelper<Row>()
const columns = h.columns([
  h.accessor('deliveryLabel', {
    header: 'Delivery',
    cell: (c) => <span className="num font-semibold text-primary-ink">{c.getValue()}</span>,
  }),
  h.accessor('received_at', {
    header: 'Received',
    sortFn: 'datetime',
    cell: (c) => <span className="whitespace-nowrap">{formatDateTime(c.getValue())}</span>,
  }),
  h.accessor('vendorName', { header: 'Vendor', cell: (c) => <b>{c.getValue()}</b> }),
  h.accessor('itemCount', { header: 'Items', meta: { align: 'right' } }),
  h.accessor('totalKg', {
    header: 'Total (kg)',
    meta: { align: 'right' },
    cell: (c) => formatNumber(c.getValue()),
  }),
  h.accessor('orderLabels', {
    header: 'Orders fulfilled',
    enableSorting: false,
    cell: (c) =>
      c.row.original.orders.length ? (
        <div className="flex flex-wrap gap-1">
          {c.row.original.orders.map((o) => (
            <Chip key={o.id} tone="green">
              {orderNo(o.order_no)}
            </Chip>
          ))}
        </div>
      ) : (
        <Chip>Unplanned</Chip>
      ),
  }),
])

const receiveLinkClass =
  'inline-flex h-11 items-center gap-2 rounded-button bg-[linear-gradient(135deg,#3A9A62,#2E7D4F)] px-4 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(46,125,79,0.28)] transition hover:-translate-y-px'

export function DeliveriesList() {
  const deliveries = useDeliveries()
  const { varietyById } = useCatalog()
  const [open, setOpen] = useState<Row | null>(null)

  const rows = useMemo<Row[]>(
    () =>
      (deliveries.data ?? []).map((d) => ({
        ...d,
        deliveryLabel: deliveryNo(d.delivery_no),
        vendorName: d.vendor?.name ?? '-',
        totalKg: d.delivery_items.reduce((s, i) => s + Number(i.qty_kg), 0),
        itemCount: d.delivery_items.length,
        orderLabels: d.orders.map((o) => orderNo(o.order_no)).join(' '),
      })),
    [deliveries.data],
  )

  return (
    <div>
      <PageHeader
        title="Godown"
        subtitle="Goods received at the warehouse."
        actions={
          <Link to="/godown/receive" className={receiveLinkClass}>
            <PackageCheck className="size-4" /> Receive delivery
          </Link>
        }
      />
      <ErrorBox error={deliveries.error} />
      {deliveries.isLoading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Truck className="size-10 text-muted" />}
            title="No deliveries yet"
            hint="When goods arrive from a vendor, record them here to add them to stock and close their orders."
            action={
              <Link to="/godown/receive" className={receiveLinkClass}>
                <PackageCheck className="size-4" /> Receive delivery
              </Link>
            }
          />
        </div>
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          searchPlaceholder="Search by vendor, delivery or order number"
          onRowClick={setOpen}
          initialSorting={[{ id: 'received_at', desc: true }]}
        />
      )}

      {open && (
        <Modal open onClose={() => setOpen(null)} title={`${open.deliveryLabel} · ${open.vendorName}`}>
          <div className="mb-3 text-muted">{formatDateTime(open.received_at)}</div>
          <ul className="divide-y divide-border rounded-card border border-border">
            {open.delivery_items.map((i, idx) => {
              const v = varietyById.get(i.variety_id)
              return (
                <li key={idx} className="flex items-center gap-3 px-3 py-2.5">
                  <Thumb
                    emoji={v?.emoji || v?.fruit.emoji}
                    imagePath={v?.image_path || v?.fruit.image_path}
                    size="sm"
                  />
                  <div className="flex-1">
                    <div className="font-semibold">{v?.name ?? 'Unknown'}</div>
                    <div className="text-2xs text-muted">{v?.fruit.name}</div>
                  </div>
                  <div className="num font-semibold">{formatNumber(i.qty_kg)} kg</div>
                </li>
              )
            })}
            <li className="flex justify-between bg-surface-low px-3 py-2.5 font-semibold">
              <span>Total</span>
              <span className="num">{formatNumber(open.totalKg)} kg</span>
            </li>
          </ul>
          {open.orders.length > 0 && (
            <div className="mt-4">
              <div className="label">Orders fulfilled</div>
              <div className="flex flex-wrap gap-2">
                {open.orders.map((o) => (
                  <Link key={o.id} to={`/orders/${o.id}`} className="text-primary underline">
                    {orderNo(o.order_no)}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {open.notes && (
            <div className="mt-4">
              <div className="label">Notes</div>
              <p>{open.notes}</p>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
