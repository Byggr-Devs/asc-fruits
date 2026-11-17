import { PackageCheck, Truck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { DataTable } from '../../components/DataTable'
import { columnHelper } from '../../lib/table'
import { useLanguage } from '../../i18n/LanguageProvider'
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
const receiveLinkClass =
  'inline-flex h-11 items-center gap-2 rounded-button bg-[linear-gradient(135deg,#3A9A62,#2E7D4F)] px-4 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(46,125,79,0.28)] transition hover:-translate-y-px'

export function DeliveriesList() {
  const { t, displayName } = useLanguage()
  const deliveries = useDeliveries()
  const { varietyById } = useCatalog()
  const [open, setOpen] = useState<Row | null>(null)

  const rows = useMemo<Row[]>(
    () =>
      (deliveries.data ?? []).map((d) => ({
        ...d,
        deliveryLabel: deliveryNo(d.delivery_no),
        vendorName: displayName(d.vendor, '-'),
        totalKg: d.delivery_items.reduce((s, i) => s + Number(i.qty_kg), 0),
        itemCount: d.delivery_items.length,
        orderLabels: d.orders.map((o) => orderNo(o.order_no)).join(' '),
      })),
    [deliveries.data, displayName],
  )

  const columns = useMemo(
    () =>
      h.columns([
        h.accessor('deliveryLabel', {
          header: t('godown.colDelivery'),
          cell: (c) => <span className="num font-semibold text-primary-ink">{c.getValue()}</span>,
        }),
        h.accessor('received_at', {
          header: t('godown.colReceived'),
          sortFn: 'datetime',
          cell: (c) => <span className="whitespace-nowrap">{formatDateTime(c.getValue())}</span>,
        }),
        h.accessor('vendorName', { header: t('godown.colVendor'), cell: (c) => <b>{c.getValue()}</b> }),
        h.accessor('itemCount', { header: t('godown.colItems'), meta: { align: 'right' } }),
        h.accessor('totalKg', {
          header: t('godown.colTotalKg'),
          meta: { align: 'right' },
          cell: (c) => formatNumber(c.getValue()),
        }),
        h.accessor('orderLabels', {
          header: t('godown.colOrders'),
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
              <Chip>{t('godown.unplanned')}</Chip>
            ),
        }),
      ]),
    [t],
  )

  return (
    <div>
      <PageHeader
        title={t('godown.title')}
        subtitle={t('godown.subtitle')}
        actions={
          <Link to="/godown/receive" className={receiveLinkClass}>
            <PackageCheck className="size-4" /> {t('godown.receive')}
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
            title={t('godown.emptyTitle')}
            hint={t('godown.emptyHint')}
            action={
              <Link to="/godown/receive" className={receiveLinkClass}>
                <PackageCheck className="size-4" /> {t('godown.receive')}
              </Link>
            }
          />
        </div>
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          searchPlaceholder={t('godown.search')}
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
                    <div className="font-semibold">{displayName(v, t('common.unknown'))}</div>
                    <div className="text-2xs text-muted">{displayName(v?.fruit)}</div>
                    {(i.delivery_item_allocations ?? []).length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-2xs text-muted">
                        {(i.delivery_item_allocations ?? []).map((a) => (
                          <li key={a.location_id} className="flex gap-1.5">
                            <span>{displayName(a.location, '-')}</span>
                            <span className="num font-semibold text-ink">
                              {formatNumber(a.qty_kg)} {t('common.kg')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="num font-semibold">
                    {formatNumber(i.qty_kg)} {t('common.kg')}
                  </div>
                </li>
              )
            })}
            <li className="flex justify-between bg-surface-low px-3 py-2.5 font-semibold">
              <span>{t('common.total')}</span>
              <span className="num">
                {formatNumber(open.totalKg)} {t('common.kg')}
              </span>
            </li>
          </ul>
          {open.orders.length > 0 && (
            <div className="mt-4">
              <div className="label">{t('godown.colOrders')}</div>
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
              <div className="label">{t('godown.notes')}</div>
              <p>{open.notes}</p>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
