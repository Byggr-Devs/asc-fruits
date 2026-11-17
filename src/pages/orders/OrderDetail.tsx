import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban, Download, MessageCircle, Printer } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { DataTable } from '../../components/DataTable'
import { columnHelper } from '../../lib/table'
import { useToast } from '../../components/toast'
import { useLanguage } from '../../i18n/LanguageProvider'
import { Button, ErrorBox, PageHeader, Section, Spinner, StatusChip, Thumb } from '../../components/ui'
import {
  deliveryNo,
  formatDateTime,
  formatMoney,
  formatNumber,
  orderNo,
} from '../../lib/format'
import { keys, useCatalog, useOrder, type CatalogVariety } from '../../lib/queries'
import { errorMessage, supabase } from '../../lib/supabase'
import type { OrderItem } from '../../lib/types'

type ItemRow = OrderItem & { variety: CatalogVariety | undefined; varietyName: string }

const h = columnHelper<ItemRow>()

export function OrderDetailPage() {
  const { t, displayName } = useLanguage()
  const { id } = useParams()
  const order = useOrder(id)
  const { varietyById, isLoading } = useCatalog()
  const qc = useQueryClient()
  const toast = useToast()
  const [sharing, setSharing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const pdfModule = useRef<typeof import('../../lib/orderPdf') | null>(null)

  useEffect(() => {
    import('../../lib/orderPdf').then((m) => (pdfModule.current = m))
  }, [])

  const rows = useMemo<ItemRow[]>(
    () =>
      (order.data?.order_items ?? []).map((i) => {
        const variety = varietyById.get(i.variety_id)
        return { ...i, variety, varietyName: displayName(variety, t('common.unknown')) }
      }),
    [order.data, varietyById, displayName, t],
  )

  const { columns, fulfilledColumns } = useMemo(() => {
    const baseColumns = [
      h.accessor('varietyName', {
        header: t('orders.item'),
        cell: (c) => {
          const v = c.row.original.variety
          return (
            <div className="flex items-center gap-2.5">
              <Thumb
                emoji={v?.emoji || v?.fruit.emoji}
                imagePath={v?.image_path || v?.fruit.image_path}
                size="sm"
              />
              <div>
                <div className="font-semibold">{c.getValue()}</div>
                <div className="text-2xs text-muted">{displayName(v?.fruit)}</div>
              </div>
            </div>
          )
        },
      }),
      h.accessor('qty_kg', {
        header: t('orders.colQty'),
        meta: { align: 'right' },
        cell: (c) => formatNumber(c.getValue()),
      }),
      h.accessor('rate', {
        header: t('orders.rateKg'),
        meta: { align: 'right' },
        cell: (c) => formatMoney(c.getValue()),
      }),
      h.accessor('line_total', {
        header: t('orders.colAmount'),
        meta: { align: 'right' },
        cell: (c) => <b>{formatMoney(c.getValue())}</b>,
      }),
    ]
    return {
      columns: h.columns(baseColumns),
      fulfilledColumns: h.columns([
        ...baseColumns,
        h.accessor('fulfilled_qty_kg', {
          header: t('orders.receivedKg'),
          meta: { align: 'right' },
          cell: (c) => {
            const got = c.getValue()
            if (got == null) return '-'
            const diff = Number(got) - Number(c.row.original.qty_kg)
            return (
              <span className={diff < 0 ? 'text-warning' : diff > 0 ? 'text-primary' : ''}>
                {formatNumber(got)}
              </span>
            )
          },
        }),
      ]),
    }
  }, [t, displayName])

  if (order.isLoading || isLoading) return <Spinner />
  if (order.error || !order.data) return <ErrorBox error={order.error ?? t('orders.notFound')} />

  const o = order.data
  const totalKg = rows.reduce((s, r) => s + Number(r.qty_kg), 0)
  const total = rows.reduce((s, r) => s + Number(r.line_total), 0)
  const fileName = `${orderNo(o.order_no)}-${(o.vendor?.name ?? 'vendor').replace(/\s+/g, '-')}.pdf`

  const loadPdf = async () => (pdfModule.current ??= await import('../../lib/orderPdf'))

  async function download() {
    const { buildOrderPdf } = await loadPdf()
    buildOrderPdf(o, varietyById).save(fileName)
  }

  async function print() {
    const { buildOrderPdf } = await loadPdf()
    const doc = buildOrderPdf(o, varietyById)
    doc.autoPrint()
    window.open(String(doc.output('bloburl')), '_blank')
  }

  async function share() {
    setSharing(true)
    try {
      const { buildOrderPdf, orderSummaryText, whatsappNumber } = await loadPdf()
      const doc = buildOrderPdf(o, varietyById)
      const file = new File([doc.output('blob')], fileName, { type: 'application/pdf' })
      const text = orderSummaryText(o, varietyById)
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: orderNo(o.order_no), text })
      } else {
        const phone = whatsappNumber(o.vendor?.whatsapp || o.vendor?.phone)
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank')
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast(errorMessage(e, t), 'error')
    } finally {
      setSharing(false)
    }
  }

  async function cancel() {
    if (!confirm(t('orders.confirmCancel', { no: orderNo(o.order_no) }))) return
    setCancelling(true)
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', o.id)
      .eq('status', 'pending')
    setCancelling(false)
    if (error) return toast(errorMessage(error, t), 'error')
    await qc.invalidateQueries({ queryKey: keys.orders })
    toast(t('orders.cancelled'))
  }

  return (
    <div>
      <Link
        to="/orders"
        className="no-print mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" /> {t('orders.allOrders')}
      </Link>
      <PageHeader
        title={orderNo(o.order_no)}
        subtitle={`${displayName(o.vendor)} · ${formatDateTime(o.created_at)}`}
        actions={
          <>
            <Button onClick={share} loading={sharing}>
              <MessageCircle className="size-4" /> {t('orders.shareWhatsApp')}
            </Button>
            <Button variant="secondary" onClick={download}>
              <Download className="size-4" /> {t('orders.pdf')}
            </Button>
            <Button variant="secondary" onClick={print}>
              <Printer className="size-4" /> {t('common.print')}
            </Button>
            {o.status === 'pending' && (
              <Button variant="danger" onClick={cancel} loading={cancelling}>
                <Ban className="size-4" /> {t('orders.cancelOrder')}
              </Button>
            )}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <InfoTile label={t('orders.colStatus')}>
          <StatusChip status={o.status} />
        </InfoTile>
        <InfoTile label={t('orders.totalQty')}>
          <span className="num">
            {formatNumber(totalKg)} {t('common.kg')}
          </span>
        </InfoTile>
        <InfoTile label={t('orders.grandTotal')}>
          <span className="num text-primary-ink">{formatMoney(total)}</span>
        </InfoTile>
        <InfoTile label={o.status === 'fulfilled' ? t('orders.receivedIn') : t('orders.vendorPhone')}>
          {o.status === 'fulfilled' && o.delivery ? (
            <Link to="/godown" className="num text-primary underline">
              {deliveryNo(o.delivery.delivery_no)}
            </Link>
          ) : (
            <span className="num">{o.vendor?.whatsapp || o.vendor?.phone || '-'}</span>
          )}
        </InfoTile>
      </div>

      <DataTable
        data={rows}
        columns={o.status === 'fulfilled' ? fulfilledColumns : columns}
        footer={
          <tr className="font-semibold">
            <td className="px-3 py-3">{t('common.total')}</td>
            <td className="num px-3 py-3 text-right">{formatNumber(totalKg)}</td>
            <td />
            <td className="num px-3 py-3 text-right text-primary-ink">{formatMoney(total)}</td>
            {o.status === 'fulfilled' && <td />}
          </tr>
        }
      />

      {o.notes && (
        <Section title={t('orders.notesSection')} className="mt-5">
          <p className="whitespace-pre-wrap">{o.notes}</p>
        </Section>
      )}
    </div>
  )
}

function InfoTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="mb-1 text-3xs font-semibold tracking-wide text-muted uppercase">{label}</div>
      <div className="text-md font-semibold">{children}</div>
    </div>
  )
}
