import { useQueryClient } from '@tanstack/react-query'
import { useTable } from '@tanstack/react-table'
import { ArrowLeft, Check, CopyCheck, Plus, X } from 'lucide-react'
import { createContext, useContext, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { appTableFeatures, columnHelper } from '../../lib/table'
import { useToast } from '../../components/toast'
import { Button, Chip, ErrorBox, Modal, PageHeader, Section, Spinner, Thumb } from '../../components/ui'
import { VarietyPicker } from '../../components/VarietyPicker'
import { VendorPicker } from '../../components/VendorPicker'
import { formatDate, formatNumber, orderNo, parseQty, round3 } from '../../lib/format'
import {
  keys,
  useCatalog,
  useOrders,
  usePendingOrdersForVendor,
  useVendors,
  type CatalogVariety,
} from '../../lib/queries'
import { errorMessage, supabase } from '../../lib/supabase'
import type { OrderDetail, OrderItem } from '../../lib/types'

type MatrixRow = { varietyId: string; variety: CatalogVariety | undefined }

type MatrixState = {
  excluded: Set<string>
  toggleOrder: (orderId: string) => void
  qtyOf: (item: OrderItem) => string
  setQty: (itemId: string, value: string) => void
  itemsFor: (orderId: string, varietyId: string) => OrderItem[]
  expectedFor: (varietyId: string) => number
}

const MatrixContext = createContext<MatrixState | null>(null)
const useMatrix = () => useContext(MatrixContext)!

const ROW_H = 'h-[64px]'

export function ReceiveDelivery() {
  const [params, setParams] = useSearchParams()
  const vendorId = params.get('vendor')
  const vendors = useVendors()
  const pendingAll = useOrders('pending')
  const pending = usePendingOrdersForVendor(vendorId)
  const catalog = useCatalog()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()

  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [orderQty, setOrderQty] = useState<Record<string, string>>({})
  const [received, setReceived] = useState<Record<string, string>>({})
  const [extras, setExtras] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const vendor = vendors.data?.find((v) => v.id === vendorId) ?? null
  const orders = useMemo(() => pending.data ?? [], [pending.data])

  const pendingCountByVendor = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of pendingAll.data ?? []) m.set(o.vendor_id, (m.get(o.vendor_id) ?? 0) + 1)
    return m
  }, [pendingAll.data])

  const rows = useMemo<MatrixRow[]>(() => {
    const ids: string[] = []
    for (const o of orders) for (const i of o.order_items) if (!ids.includes(i.variety_id)) ids.push(i.variety_id)
    for (const id of extras) if (!ids.includes(id)) ids.push(id)
    return ids.map((varietyId) => ({ varietyId, variety: catalog.varietyById.get(varietyId) }))
  }, [orders, extras, catalog.varietyById])

  const fromOrders = useMemo(
    () => new Set(orders.flatMap((o) => o.order_items.map((i) => i.variety_id))),
    [orders],
  )

  const matrix: MatrixState = {
    excluded,
    toggleOrder: (id) =>
      setExcluded((s) => {
        const next = new Set(s)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    qtyOf: (item) => orderQty[item.id] ?? String(Number(item.qty_kg)),
    setQty: (id, value) => setOrderQty((q) => ({ ...q, [id]: value })),
    itemsFor: (orderId, varietyId) =>
      orders.find((o) => o.id === orderId)?.order_items.filter((i) => i.variety_id === varietyId) ?? [],
    expectedFor: (varietyId) =>
      round3(
        orders
          .filter((o) => !excluded.has(o.id))
          .flatMap((o) => o.order_items)
          .filter((i) => i.variety_id === varietyId)
          .reduce((s, i) => s + parseQty(orderQty[i.id] ?? String(i.qty_kg)), 0),
      ),
  }

  const includedOrders = orders.filter((o) => !excluded.has(o.id))
  const totalReceived = rows.reduce((s, r) => s + parseQty(received[r.varietyId] ?? ''), 0)
  const totalExpected = rows.reduce((s, r) => s + matrix.expectedFor(r.varietyId), 0)

  function pickVendor(id: string | null) {
    setExcluded(new Set())
    setOrderQty({})
    setReceived({})
    setExtras([])
    setNotes('')
    setErr(null)
    setParams(id ? { vendor: id } : {})
  }

  function copyExpected() {
    setReceived((r) => {
      const next = { ...r }
      for (const row of rows) {
        const exp = matrix.expectedFor(row.varietyId)
        if (!next[row.varietyId] && exp > 0) next[row.varietyId] = String(exp)
      }
      return next
    })
  }

  function addExtra(v: CatalogVariety) {
    if (!rows.some((r) => r.varietyId === v.id)) setExtras((e) => [...e, v.id])
    setPickerOpen(false)
    setTimeout(() => document.getElementById(`recv-${v.id}`)?.focus(), 50)
  }

  function review() {
    setErr(null)
    if (totalReceived <= 0) return setErr('Enter the weight received for at least one item.')
    setConfirmOpen(true)
  }

  async function save() {
    if (!vendor) return
    setBusy(true)
    const payload = {
      vendor_id: vendor.id,
      notes: notes.trim() || null,
      items: rows
        .map((r) => ({ variety_id: r.varietyId, qty_kg: parseQty(received[r.varietyId] ?? '') }))
        .filter((i) => i.qty_kg > 0),
      orders: includedOrders.map((o) => ({
        order_id: o.id,
        items: o.order_items.map((i) => ({
          order_item_id: i.id,
          fulfilled_qty_kg: parseQty(matrix.qtyOf(i)),
        })),
      })),
    }
    const { error } = await supabase.rpc('complete_delivery', { payload })
    setBusy(false)
    if (error) {
      setConfirmOpen(false)
      return setErr(errorMessage(error))
    }
    await Promise.all([
      qc.invalidateQueries({ queryKey: keys.orders }),
      qc.invalidateQueries({ queryKey: keys.deliveries }),
      qc.invalidateQueries({ queryKey: keys.stock }),
    ])
    toast(`Delivery saved. ${formatNumber(totalReceived)} kg added to stock.`)
    navigate('/godown')
  }

  if (vendors.isLoading || catalog.isLoading) return <Spinner />

  if (!vendor) {
    return (
      <div>
        <PageHeader title="Receive delivery" subtitle="Which vendor's goods have arrived?" />
        <VendorPicker
          vendors={vendors.data ?? []}
          onPick={(v) => pickVendor(v.id)}
          badge={(v) => {
            const n = pendingCountByVendor.get(v.id)
            return n ? <Chip tone="amber">{n} pending</Chip> : null
          }}
        />
      </div>
    )
  }

  return (
    <MatrixContext.Provider value={matrix}>
      <div className="pb-28">
        <PageHeader
          title={`Receive from ${vendor.name}`}
          subtitle="Weigh the goods, enter the kg received, and tick the orders this delivery covers."
          actions={
            <Button variant="secondary" onClick={() => pickVendor(null)}>
              <ArrowLeft className="size-4" /> Change vendor
            </Button>
          }
        />
        <ErrorBox error={pending.error} />

        {pending.isLoading ? (
          <Spinner label="Loading pending orders..." />
        ) : (
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(340px,0.8fr)_1.2fr]">
            <Section
              title="Actual stock received"
              bodyClassName="p-0"
              actions={
                <div className="flex gap-2">
                  {orders.length > 0 && (
                    <Button variant="secondary" size="sm" onClick={copyExpected}>
                      <CopyCheck className="size-3.5" /> Fill expected
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setPickerOpen(true)}>
                    <Plus className="size-3.5" /> Add item
                  </Button>
                </div>
              }
            >
              {rows.length === 0 ? (
                <div className="px-5 py-12 text-center text-muted">
                  No pending orders for this vendor. Use <b>Add item</b> to record what arrived.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-primary-soft text-3xs font-semibold tracking-wider text-primary-ink uppercase">
                      <th className="h-[52px] px-3 text-left">Fruit / variety</th>
                      <th className="px-3 text-right">Received (kg)</th>
                      <th className="px-3 text-right">Vs expected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.varietyId} className={`border-t border-border ${ROW_H}`}>
                        <td className="px-3">
                          <VarietyLabel variety={r.variety}>
                            {!fromOrders.has(r.varietyId) && (
                              <button
                                onClick={() => {
                                  setExtras((e) => e.filter((x) => x !== r.varietyId))
                                  setReceived((prev) => {
                                    const next = { ...prev }
                                    delete next[r.varietyId]
                                    return next
                                  })
                                }}
                                className="ml-1 cursor-pointer text-muted hover:text-danger"
                                aria-label="Remove"
                              >
                                <X className="size-3.5" />
                              </button>
                            )}
                          </VarietyLabel>
                        </td>
                        <td className="w-[130px] px-3">
                          <input
                            id={`recv-${r.varietyId}`}
                            className="input num h-11 text-right text-base"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="any"
                            placeholder="0"
                            value={received[r.varietyId] ?? ''}
                            onChange={(e) =>
                              setReceived((v) => ({ ...v, [r.varietyId]: e.target.value }))
                            }
                          />
                        </td>
                        <td className="px-3 text-right">
                          <Variance
                            received={parseQty(received[r.varietyId] ?? '')}
                            expected={matrix.expectedFor(r.varietyId)}
                            entered={!!received[r.varietyId]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="border-t border-border p-4">
                <span className="label">Delivery notes (optional)</span>
                <input
                  className="input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Vehicle number, damaged crates"
                />
              </div>
            </Section>

            <Section
              title={`Pending orders (${includedOrders.length} of ${orders.length} included)`}
              bodyClassName="p-0"
            >
              {orders.length === 0 ? (
                <div className="px-5 py-12 text-center text-muted">
                  There are no pending orders for {vendor.name}. This will be saved as an unplanned
                  delivery.
                </div>
              ) : (
                <OrderMatrix orders={orders} rows={rows} />
              )}
            </Section>
          </div>
        )}

        <div className="no-print fixed inset-x-0 bottom-16 z-20 border-t border-border bg-surface/95 backdrop-blur md:bottom-0 md:left-[var(--sidebar-w,0px)]">
          <div className="mx-auto max-w-[1400px] px-4 py-3 sm:px-6">
          {err && <div className="mb-2 text-sm text-danger">{err}</div>}
          <div className="flex items-center gap-4 sm:gap-6">
            <div>
              <div className="text-3xs font-semibold text-muted uppercase">Received</div>
              <div className="num text-xl font-bold text-primary-ink">{formatNumber(totalReceived)} kg</div>
            </div>
            <div>
              <div className="text-3xs font-semibold text-muted uppercase">Expected</div>
              <div className="num text-md font-semibold">{formatNumber(totalExpected)} kg</div>
            </div>
            <Button size="lg" className="ml-auto px-4" onClick={review}>
              <Check className="size-5" /> Complete<span className="hidden sm:inline"> delivery</span>
            </Button>
            </div>
          </div>
        </div>

        <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Add an item that arrived" wide>
          <VarietyPicker
            fruits={catalog.fruits}
            varieties={catalog.varieties}
            onPick={addExtra}
            selectedIds={new Set(rows.map((r) => r.varietyId))}
          />
        </Modal>

        <Modal
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title="Confirm delivery"
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
                Go back
              </Button>
              <Button onClick={save} loading={busy}>
                <Check className="size-4" /> Save delivery
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p>
              <b className="num">{formatNumber(totalReceived)} kg</b> will be added to godown stock
              from <b>{vendor.name}</b>.
            </p>
            {includedOrders.length > 0 && (
              <div>
                <div className="label">Marked as fulfilled</div>
                <div className="flex flex-wrap gap-1.5">
                  {includedOrders.map((o) => (
                    <Chip key={o.id} tone="green">
                      {orderNo(o.order_no)}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
            {excluded.size > 0 && (
              <div>
                <div className="label">Stay pending</div>
                <div className="flex flex-wrap gap-1.5">
                  {orders
                    .filter((o) => excluded.has(o.id))
                    .map((o) => (
                      <Chip key={o.id} tone="amber">
                        {orderNo(o.order_no)}
                      </Chip>
                    ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      </div>
    </MatrixContext.Provider>
  )
}

function VarietyLabel({
  variety,
  children,
}: {
  variety: CatalogVariety | undefined
  children?: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Thumb
        emoji={variety?.emoji || variety?.fruit.emoji}
        imagePath={variety?.image_path || variety?.fruit.image_path}
        size="sm"
      />
      <div className="min-w-0">
        <div className="flex items-center truncate font-semibold">
          {variety?.name ?? 'Unknown'}
          {children}
        </div>
        <div className="truncate text-2xs text-muted">{variety?.fruit.name}</div>
      </div>
    </div>
  )
}

function Variance({
  received,
  expected,
  entered,
}: {
  received: number
  expected: number
  entered: boolean
}) {
  if (!entered) return <span className="text-2xs text-muted">{expected ? `${formatNumber(expected)} exp.` : '-'}</span>
  const diff = round3(received - expected)
  if (expected === 0) return received > 0 ? <Chip tone="green">Extra item</Chip> : <span className="text-muted">-</span>
  if (diff === 0) return <Chip tone="green">Matches</Chip>
  if (diff < 0) return <Chip tone="amber">Short {formatNumber(-diff)}</Chip>
  return <Chip tone="green">+{formatNumber(diff)} extra</Chip>
}

const mh = columnHelper<MatrixRow>()

function OrderMatrix({ orders, rows }: { orders: OrderDetail[]; rows: MatrixRow[] }) {
  const columns = useMemo(
    () =>
      mh.columns([
        mh.display({
          id: 'variety',
          enableSorting: false,
          header: () => 'Fruit / variety',
          cell: (c) => <VarietyLabel variety={c.row.original.variety} />,
        }),
        ...orders.map((o) =>
          mh.display({
            id: o.id,
            enableSorting: false,
            header: () => <OrderHeader order={o} />,
            cell: (c) => <OrderCell orderId={o.id} varietyId={c.row.original.varietyId} />,
          }),
        ),
        mh.display({
          id: 'expected',
          enableSorting: false,
          header: () => <span className="block text-right">Expected total</span>,
          cell: (c) => <ExpectedCell varietyId={c.row.original.varietyId} />,
        }),
      ]),
    [orders],
  )

  const table = useTable({ features: appTableFeatures, columns, data: rows })

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          {table.getHeaderGroups().map((g) => (
            <tr key={g.id} className="text-3xs font-semibold tracking-wider text-primary-ink uppercase">
              {g.headers.map((header) => (
                <th
                  key={header.id}
                  className={`h-[52px] bg-primary-soft px-3 text-left whitespace-nowrap ${header.column.id === 'variety' ? 'sticky left-0 z-10 min-w-[170px]' : ''}`}
                >
                  <table.FlexRender header={header} />
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className={ROW_H}>
              {row.getAllCells().map((cell) => (
                <td
                  key={cell.id}
                  className={`border-t border-border px-3 ${cell.column.id === 'variety' ? 'sticky left-0 z-10 bg-surface' : ''}`}
                >
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OrderHeader({ order }: { order: OrderDetail }) {
  const { excluded, toggleOrder } = useMatrix()
  const included = !excluded.has(order.id)
  return (
    <label className="flex cursor-pointer items-center gap-2 normal-case select-none">
      <input
        type="checkbox"
        className="size-5 accent-primary"
        checked={included}
        onChange={() => toggleOrder(order.id)}
      />
      <span>
        <span className={`num block text-xs font-bold ${included ? '' : 'text-muted line-through'}`}>
          {orderNo(order.order_no)}
        </span>
        <span className="block text-3xs font-medium text-muted">{formatDate(order.created_at)}</span>
      </span>
    </label>
  )
}

function OrderCell({ orderId, varietyId }: { orderId: string; varietyId: string }) {
  const { excluded, itemsFor, qtyOf, setQty } = useMatrix()
  const items = itemsFor(orderId, varietyId)
  const off = excluded.has(orderId)
  if (items.length === 0) return <span className="text-muted">-</span>
  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => (
        <input
          key={item.id}
          className={`input num h-10 w-[100px] text-right ${off ? 'opacity-40' : ''}`}
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          disabled={off}
          value={qtyOf(item)}
          onChange={(e) => setQty(item.id, e.target.value)}
          title={`Ordered ${formatNumber(item.qty_kg)} kg`}
        />
      ))}
    </div>
  )
}

function ExpectedCell({ varietyId }: { varietyId: string }) {
  const { expectedFor } = useMatrix()
  return <div className="num text-right font-semibold">{formatNumber(expectedFor(varietyId))}</div>
}
