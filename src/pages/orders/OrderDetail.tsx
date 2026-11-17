import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban, Download, MessageCircle, Printer } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { DataTable } from '../../components/DataTable'
import { columnHelper } from '../../lib/table'
import { useToast } from '../../components/toast'
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
const baseColumns = [
  h.accessor('varietyName', {
    header: 'Item',
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
            <div className="text-2xs text-muted">{v?.fruit.name}</div>
          </div>
        </div>
      )
    },
  }),
  h.accessor('qty_kg', {
    header: 'Qty (kg)',
    meta: { align: 'right' },
    cell: (c) => formatNumber(c.getValue()),
  }),
  h.accessor('rate', {
    header: 'Rate / kg',
    meta: { align: 'right' },
    cell: (c) => formatMoney(c.getValue()),
  }),
  h.accessor('line_total', {
    header: 'Amount',
    meta: { align: 'right' },
    cell: (c) => <b>{formatMoney(c.getValue())}</b>,
  }),
]
const columns = h.columns(baseColumns)
const fulfilledColumns = h.columns([
  ...baseColumns,
  h.accessor('fulfilled_qty_kg', {
    header: 'Received (kg)',
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
])

export function OrderDetailPage() {
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
        return { ...i, variety, varietyName: variety?.name ?? 'Unknown' }
      }),
    [order.data, varietyById],
  )

  if (order.isLoading || isLoading) return <Spinner />
  if (order.error || !order.data) return <ErrorBox error={order.error ?? 'Order not found'} />

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
      if ((e as Error).name !== 'AbortError') toast(errorMessage(e), 'error')
    } finally {
      setSharing(false)
    }
  }

  async function cancel() {
    if (!confirm(`Cancel order ${orderNo(o.order_no)}?`)) return
    setCancelling(true)
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', o.id)
      .eq('status', 'pending')
    setCancelling(false)
    if (error) return toast(errorMessage(error), 'error')
    await qc.invalidateQueries({ queryKey: keys.orders })
    toast('Order cancelled')
  }

  return (
    <div>
      <Link
        to="/orders"
        className="no-print mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" /> All orders
      </Link>
      <PageHeader
        title={orderNo(o.order_no)}
        subtitle={`${o.vendor?.name ?? ''} · ${formatDateTime(o.created_at)}`}
        actions={
          <>
            <Button onClick={share} loading={sharing}>
              <MessageCircle className="size-4" /> Share to WhatsApp
            </Button>
            <Button variant="secondary" onClick={download}>
              <Download className="size-4" /> PDF
            </Button>
            <Button variant="secondary" onClick={print}>
              <Printer className="size-4" /> Print
            </Button>
            {o.status === 'pending' && (
              <Button variant="danger" onClick={cancel} loading={cancelling}>
                <Ban className="size-4" /> Cancel
              </Button>
            )}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <InfoTile label="Status">
          <StatusChip status={o.status} />
        </InfoTile>
        <InfoTile label="Total qty">
          <span className="num">{formatNumber(totalKg)} kg</span>
        </InfoTile>
        <InfoTile label="Grand total">
          <span className="num text-primary-ink">{formatMoney(total)}</span>
        </InfoTile>
        <InfoTile label={o.status === 'fulfilled' ? 'Received in' : 'Vendor phone'}>
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
            <td className="px-3 py-3">Total</td>
            <td className="num px-3 py-3 text-right">{formatNumber(totalKg)}</td>
            <td />
            <td className="num px-3 py-3 text-right text-primary-ink">{formatMoney(total)}</td>
            {o.status === 'fulfilled' && <td />}
          </tr>
        }
      />

      {o.notes && (
        <Section title="Notes" className="mt-5">
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
