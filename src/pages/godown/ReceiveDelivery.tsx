import { useQueryClient } from '@tanstack/react-query'
import { useTable } from '@tanstack/react-table'
import { ArrowLeft, Check, CopyCheck, Plus, X } from 'lucide-react'
import { createContext, Fragment, useContext, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { appTableFeatures, columnHelper } from '../../lib/table'
import { useToast } from '../../components/toast'
import { Button, Chip, ErrorBox, Modal, PageHeader, Section, Spinner, Thumb } from '../../components/ui'
import { VarietyPicker } from '../../components/VarietyPicker'
import { VendorPicker } from '../../components/VendorPicker'
import { useLanguage } from '../../i18n/LanguageProvider'
import { formatDate, formatNumber, orderNo, parseQty, round3 } from '../../lib/format'
import {
  keys,
  useActiveLocations,
  useCatalog,
  useOrders,
  usePendingOrdersForVendor,
  useVendors,
  type CatalogVariety,
} from '../../lib/queries'
import { errorMessage, supabase } from '../../lib/supabase'
import { GODOWN_LOCATION_ID, type Location, type OrderDetail, type OrderItem } from '../../lib/types'

type MatrixRow = { varietyId: string; variety: CatalogVariety | undefined }

/** One destination line for a received variety. With a single line, its qty tracks the total received. */
type AllocLine = { location_id: string; qty: string }

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
  const { t, displayName } = useLanguage()
  const [params, setParams] = useSearchParams()
  const vendorId = params.get('vendor')
  const vendors = useVendors()
  const pendingAll = useOrders('pending')
  const pending = usePendingOrdersForVendor(vendorId)
  const catalog = useCatalog()
  const locations = useActiveLocations()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()

  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [orderQty, setOrderQty] = useState<Record<string, string>>({})
  const [received, setReceived] = useState<Record<string, string>>({})
  const [extras, setExtras] = useState<string[]>([])
  const [splits, setSplits] = useState<Record<string, AllocLine[]>>({})
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
    setSplits({})
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

  const defaultLine = (): AllocLine => ({ location_id: GODOWN_LOCATION_ID, qty: '' })
  const linesFor = (varietyId: string): AllocLine[] => splits[varietyId] ?? [defaultLine()]

  function updateLine(varietyId: string, idx: number, patch: Partial<AllocLine>) {
    setSplits((s) => {
      const lines = [...(s[varietyId] ?? [defaultLine()])]
      lines[idx] = { ...lines[idx], ...patch }
      return { ...s, [varietyId]: lines }
    })
  }

  function addLine(varietyId: string) {
    setSplits((s) => {
      const lines = [...(s[varietyId] ?? [defaultLine()])]
      // Going from one line to two: the first line keeps the whole amount until the user edits it
      if (lines.length === 1) lines[0] = { ...lines[0], qty: received[varietyId] ?? '' }
      const used = new Set(lines.map((l) => l.location_id))
      const next = locations.data.find((l) => !used.has(l.id))
      lines.push({ location_id: next?.id ?? GODOWN_LOCATION_ID, qty: '' })
      return { ...s, [varietyId]: lines }
    })
  }

  function removeLine(varietyId: string, idx: number) {
    setSplits((s) => {
      const lines = (s[varietyId] ?? []).filter((_, i) => i !== idx)
      const next = { ...s }
      if (lines.length <= 1 && lines[0]?.location_id === GODOWN_LOCATION_ID) delete next[varietyId]
      else next[varietyId] = lines
      return next
    })
  }

  /** Final per-location allocations for a variety (merged by location, zero lines dropped). */
  function allocationsFor(varietyId: string): { location_id: string; qty_kg: number }[] {
    const total = parseQty(received[varietyId] ?? '')
    if (total <= 0) return []
    const lines = linesFor(varietyId)
    if (lines.length === 1) return [{ location_id: lines[0].location_id, qty_kg: total }]
    const merged = new Map<string, number>()
    for (const l of lines) {
      const q = parseQty(l.qty)
      if (q > 0) merged.set(l.location_id, round3((merged.get(l.location_id) ?? 0) + q))
    }
    return [...merged].map(([location_id, qty_kg]) => ({ location_id, qty_kg }))
  }

  const allocSum = (varietyId: string) =>
    round3(allocationsFor(varietyId).reduce((s, a) => s + a.qty_kg, 0))

  const locationTotals = (() => {
    const m = new Map<string, number>()
    for (const r of rows)
      for (const a of allocationsFor(r.varietyId))
        m.set(a.location_id, round3((m.get(a.location_id) ?? 0) + a.qty_kg))
    return [...m]
  })()

  function review() {
    setErr(null)
    if (totalReceived <= 0) return setErr(t('godown.enterWeight'))
    for (const r of rows) {
      const total = round3(parseQty(received[r.varietyId] ?? ''))
      if (total <= 0) continue
      const sum = allocSum(r.varietyId)
      if (sum !== total) {
        return setErr(
          t('godown.splitMustMatch', {
            name: displayName(r.variety, t('common.unknown')),
            total: formatNumber(total),
            sum: formatNumber(sum),
          }),
        )
      }
    }
    setConfirmOpen(true)
  }

  async function save() {
    if (!vendor) return
    setBusy(true)
    const payload = {
      vendor_id: vendor.id,
      notes: notes.trim() || null,
      items: rows
        .map((r) => ({
          variety_id: r.varietyId,
          qty_kg: parseQty(received[r.varietyId] ?? ''),
          allocations: allocationsFor(r.varietyId),
        }))
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
      return setErr(errorMessage(error, t))
    }
    await Promise.all([
      qc.invalidateQueries({ queryKey: keys.orders }),
      qc.invalidateQueries({ queryKey: keys.deliveries }),
      qc.invalidateQueries({ queryKey: keys.stock }),
    ])
    toast(t('godown.saved', { kg: formatNumber(totalReceived) }))
    navigate('/godown')
  }

  if (vendors.isLoading || catalog.isLoading || locations.isLoading) return <Spinner />

  if (!vendor) {
    return (
      <div>
        <PageHeader title={t('godown.receiveTitle')} subtitle={t('godown.receiveStep1')} />
        <VendorPicker
          vendors={vendors.data ?? []}
          onPick={(v) => pickVendor(v.id)}
          badge={(v) => {
            const n = pendingCountByVendor.get(v.id)
            return n ? <Chip tone="amber">{t('godown.pendingBadge', { count: n })}</Chip> : null
          }}
        />
      </div>
    )
  }

  return (
    <MatrixContext.Provider value={matrix}>
      <div className="pb-28">
        <PageHeader
          title={t('godown.receiveFrom', { name: displayName(vendor) })}
          subtitle={t('godown.receiveSubtitle')}
          actions={
            <Button variant="secondary" onClick={() => pickVendor(null)}>
              <ArrowLeft className="size-4" /> {t('orders.changeVendor')}
            </Button>
          }
        />
        <ErrorBox error={pending.error} />

        {pending.isLoading ? (
          <Spinner label={t('godown.loadingPending')} />
        ) : (
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(340px,0.8fr)_1.2fr]">
            <Section
              title={t('godown.actualStock')}
              bodyClassName="p-0"
              actions={
                <div className="flex gap-2">
                  {orders.length > 0 && (
                    <Button variant="secondary" size="sm" onClick={copyExpected}>
                      <CopyCheck className="size-3.5" /> {t('godown.fillExpected')}
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setPickerOpen(true)}>
                    <Plus className="size-3.5" /> {t('godown.addItem')}
                  </Button>
                </div>
              }
            >
              {rows.length === 0 ? (
                <div className="px-5 py-12 text-center text-muted">
                  {t('godown.noPendingRows')}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-primary-soft text-3xs font-semibold tracking-wider text-primary-ink uppercase">
                      <th className="h-[52px] px-3 text-left">{t('godown.fruitVariety')}</th>
                      <th className="px-3 text-right">{t('godown.receivedKg')}</th>
                      <th className="px-3 text-right">{t('godown.vsExpected')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <Fragment key={r.varietyId}>
                      <tr className={`border-t border-border ${ROW_H}`}>
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
                                  setSplits((prev) => {
                                    const next = { ...prev }
                                    delete next[r.varietyId]
                                    return next
                                  })
                                }}
                                className="ml-1 cursor-pointer text-muted hover:text-danger"
                                aria-label={t('godown.remove')}
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
                      {parseQty(received[r.varietyId] ?? '') > 0 && (
                        <tr>
                          <td colSpan={3} className="px-3 pb-3">
                            <AllocationEditor
                              lines={linesFor(r.varietyId)}
                              locations={locations.data}
                              total={parseQty(received[r.varietyId] ?? '')}
                              onChange={(idx, patch) => updateLine(r.varietyId, idx, patch)}
                              onAdd={() => addLine(r.varietyId)}
                              onRemove={(idx) => removeLine(r.varietyId, idx)}
                            />
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="border-t border-border p-4">
                <span className="label">{t('godown.deliveryNotes')}</span>
                <input
                  className="input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('godown.deliveryNotesPlaceholder')}
                />
              </div>
            </Section>

            <Section
              title={t('godown.pendingOrders', { included: includedOrders.length, total: orders.length })}
              bodyClassName="p-0"
            >
              {orders.length === 0 ? (
                <div className="px-5 py-12 text-center text-muted">
                  {t('godown.noPendingOrders', { name: displayName(vendor) })}
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
              <div className="text-3xs font-semibold text-muted uppercase">{t('godown.receivedLabel')}</div>
              <div className="num text-xl font-bold text-primary-ink">
                {formatNumber(totalReceived)} {t('common.kg')}
              </div>
            </div>
            <div>
              <div className="text-3xs font-semibold text-muted uppercase">{t('godown.expectedLabel')}</div>
              <div className="num text-md font-semibold">
                {formatNumber(totalExpected)} {t('common.kg')}
              </div>
            </div>
            <Button size="lg" className="ml-auto px-4" onClick={review}>
              <Check className="size-5" />
              <span className="sm:hidden">{t('godown.complete')}</span>
              <span className="hidden sm:inline">{t('godown.completeDelivery')}</span>
            </Button>
            </div>
          </div>
        </div>

        <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title={t('godown.addArrivedItem')} wide>
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
          title={t('godown.confirmTitle')}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
                {t('godown.goBack')}
              </Button>
              <Button onClick={save} loading={busy}>
                <Check className="size-4" /> {t('godown.saveDelivery')}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p>
              {t('godown.confirmBody', {
                kg: formatNumber(totalReceived),
                name: displayName(vendor),
              })}
            </p>
            {locationTotals.length > 0 && (
              <div>
                <div className="label">{t('godown.colLocation')}</div>
                <ul className="divide-y divide-border rounded-card border border-border">
                  {locationTotals.map(([id, kg]) => (
                    <li key={id} className="flex justify-between px-3 py-2">
                      <span>{displayName(locations.data.find((l) => l.id === id), '-')}</span>
                      <span className="num font-semibold">
                        {formatNumber(kg)} {t('common.kg')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {includedOrders.length > 0 && (
              <div>
                <div className="label">{t('godown.markedFulfilled')}</div>
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
                <div className="label">{t('godown.stayPending')}</div>
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
  const { t, displayName } = useLanguage()
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Thumb
        emoji={variety?.emoji || variety?.fruit.emoji}
        imagePath={variety?.image_path || variety?.fruit.image_path}
        size="sm"
      />
      <div className="min-w-0">
        <div className="flex items-center truncate font-semibold">
          {displayName(variety, t('common.unknown'))}
          {children}
        </div>
        <div className="truncate text-2xs text-muted">{displayName(variety?.fruit)}</div>
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
  const { t } = useLanguage()
  if (!entered) {
    return (
      <span className="text-2xs text-muted">
        {expected ? t('godown.exp', { kg: formatNumber(expected) }) : '-'}
      </span>
    )
  }
  const diff = round3(received - expected)
  if (expected === 0) return received > 0 ? (
      <Chip tone="green">{t('godown.extraItem')}</Chip>
    ) : (
      <span className="text-muted">-</span>
    )
  if (diff === 0) return <Chip tone="green">{t('godown.matches')}</Chip>
  if (diff < 0) return <Chip tone="amber">{t('godown.short', { kg: formatNumber(-diff) })}</Chip>
  return <Chip tone="green">{t('godown.extra', { kg: formatNumber(diff) })}</Chip>
}

const mh = columnHelper<MatrixRow>()

function OrderMatrix({ orders, rows }: { orders: OrderDetail[]; rows: MatrixRow[] }) {
  const { t } = useLanguage()
  const columns = useMemo(
    () =>
      mh.columns([
        mh.display({
          id: 'variety',
          enableSorting: false,
          header: () => t('godown.fruitVariety'),
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
          header: () => <span className="block text-right">{t('godown.expectedTotal')}</span>,
          cell: (c) => <ExpectedCell varietyId={c.row.original.varietyId} />,
        }),
      ]),
    [orders, t],
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
  const { t } = useLanguage()
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
          title={t('godown.orderedKg', { kg: formatNumber(item.qty_kg) })}
        />
      ))}
    </div>
  )
}

function ExpectedCell({ varietyId }: { varietyId: string }) {
  const { expectedFor } = useMatrix()
  return <div className="num text-right font-semibold">{formatNumber(expectedFor(varietyId))}</div>
}

function AllocationEditor({
  lines,
  locations,
  total,
  onChange,
  onAdd,
  onRemove,
}: {
  lines: AllocLine[]
  locations: Location[]
  total: number
  onChange: (idx: number, patch: Partial<AllocLine>) => void
  onAdd: () => void
  onRemove: (idx: number) => void
}) {
  const { t, displayName } = useLanguage()
  const multi = lines.length > 1
  const sum = round3(lines.reduce((s, l) => s + parseQty(l.qty), 0))
  const mismatch = multi && sum !== round3(total)
  return (
    <div className="rounded-card bg-surface-low px-3 py-2.5">
      <div className="mb-1.5 text-3xs font-semibold tracking-wider text-muted uppercase">
        {t('godown.splitTo')}
      </div>
      <div className="space-y-2">
        {lines.map((line, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <select
              className="input h-10 min-w-0 flex-1"
              value={line.location_id}
              onChange={(e) => onChange(idx, { location_id: e.target.value })}
              aria-label={t('godown.colLocation')}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {displayName(l)}
                </option>
              ))}
            </select>
            {multi && (
              <>
                <input
                  className="input num h-10 w-[100px] text-right"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={line.qty}
                  onChange={(e) => onChange(idx, { qty: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => onRemove(idx)}
                  className="cursor-pointer text-muted hover:text-danger"
                  aria-label={t('godown.remove')}
                >
                  <X className="size-4" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        {locations.length > lines.length ? (
          <Button variant="secondary" size="sm" onClick={onAdd}>
            <Plus className="size-3.5" /> {t('godown.addLocationSplit')}
          </Button>
        ) : (
          <span />
        )}
        {mismatch && (
          <span className="num text-2xs font-semibold text-warning">
            {formatNumber(sum)} / {formatNumber(total)} {t('common.kg')}
          </span>
        )}
      </div>
    </div>
  )
}
