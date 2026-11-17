import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useToast } from '../../components/toast'
import { Button, ErrorBox, PageHeader, Section, Spinner, Thumb } from '../../components/ui'
import { VarietyPicker } from '../../components/VarietyPicker'
import { VendorPicker } from '../../components/VendorPicker'
import { formatMoney, formatNumber, parseQty } from '../../lib/format'
import { keys, useCatalog, useVendors, useVendorVarieties, type CatalogVariety } from '../../lib/queries'
import { errorMessage, supabase } from '../../lib/supabase'

type Line = { key: string; variety: CatalogVariety; qty: string; rate: string }

export function OrderNew() {
  const [params, setParams] = useSearchParams()
  const vendorId = params.get('vendor')
  const vendors = useVendors()
  const mapping = useVendorVarieties()
  const catalog = useCatalog()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()

  const [lines, setLines] = useState<Line[]>([])
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const vendor = vendors.data?.find((v) => v.id === vendorId) ?? null
  const allowedIds = useMemo(
    () =>
      new Set((mapping.data ?? []).filter((m) => m.vendor_id === vendorId).map((m) => m.variety_id)),
    [mapping.data, vendorId],
  )
  const selectedIds = useMemo(() => new Set(lines.map((l) => l.variety.id)), [lines])

  const totalKg = lines.reduce((s, l) => s + parseQty(l.qty), 0)
  const total = lines.reduce((s, l) => s + parseQty(l.qty) * parseQty(l.rate), 0)

  function addVariety(v: CatalogVariety) {
    if (selectedIds.has(v.id)) {
      document.getElementById(`qty-${v.id}`)?.focus()
      return
    }
    setLines((ls) => [...ls, { key: crypto.randomUUID(), variety: v, qty: '', rate: '' }])
    setTimeout(() => document.getElementById(`qty-${v.id}`)?.focus(), 50)
  }

  function update(key: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  async function save() {
    setErr(null)
    if (!vendor) return
    if (lines.length === 0) return setErr('Add at least one item.')
    const bad = lines.find((l) => parseQty(l.qty) <= 0)
    if (bad) return setErr(`Enter the quantity for ${bad.variety.name}.`)

    setBusy(true)
    try {
      const { data: order, error } = await supabase
        .from('orders')
        .insert({ vendor_id: vendor.id, notes: notes.trim() || null })
        .select('id')
        .single()
      if (error) throw error
      const items = await supabase.from('order_items').insert(
        lines.map((l) => ({
          order_id: order.id,
          variety_id: l.variety.id,
          qty_kg: parseQty(l.qty),
          rate: parseQty(l.rate),
        })),
      )
      if (items.error) {
        await supabase.from('orders').delete().eq('id', order.id)
        throw items.error
      }
      await qc.invalidateQueries({ queryKey: keys.orders })
      toast('Order created')
      navigate(`/orders/${order.id}`, { replace: true })
    } catch (e) {
      setErr(errorMessage(e))
      setBusy(false)
    }
  }

  if (vendors.isLoading || catalog.isLoading) return <Spinner />

  if (!vendor) {
    return (
      <div>
        <PageHeader title="New order" subtitle="Step 1 of 2: Choose the vendor" />
        <VendorPicker vendors={vendors.data ?? []} onPick={(v) => setParams({ vendor: v.id })} />
      </div>
    )
  }

  return (
    <div className="pb-28">
      <PageHeader
        title={`New order: ${vendor.name}`}
        subtitle="Step 2 of 2: Tap fruits to add them, then enter kg and rate."
        actions={
          <Button variant="secondary" onClick={() => setParams({})}>
            <ArrowLeft className="size-4" /> Change vendor
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_minmax(380px,0.9fr)]">
        <Section title="Add items">
          <VarietyPicker
            fruits={catalog.fruits}
            varieties={catalog.varieties}
            onPick={addVariety}
            selectedIds={selectedIds}
            allowedIds={allowedIds}
          />
        </Section>

        <Section title={`Order items (${lines.length})`} bodyClassName="p-0">
          {lines.length === 0 ? (
            <div className="px-5 py-12 text-center text-muted">
              Tap a variety on the left to add it to this order.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {lines.map((l) => {
                const lineTotal = parseQty(l.qty) * parseQty(l.rate)
                return (
                  <li key={l.key} className="p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <Thumb
                        emoji={l.variety.emoji || l.variety.fruit.emoji}
                        imagePath={l.variety.image_path || l.variety.fruit.image_path}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{l.variety.name}</div>
                        <div className="text-2xs text-muted">{l.variety.fruit.name}</div>
                      </div>
                      <button
                        onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                        className="flex size-10 cursor-pointer items-center justify-center rounded-button text-muted hover:bg-danger-soft hover:text-danger"
                        aria-label={`Remove ${l.variety.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2.5">
                      <label>
                        <span className="label">Qty (kg)</span>
                        <input
                          id={`qty-${l.variety.id}`}
                          className="input num text-right text-base"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="any"
                          value={l.qty}
                          onChange={(e) => update(l.key, { qty: e.target.value })}
                          placeholder="0"
                        />
                      </label>
                      <label>
                        <span className="label">Rate / kg (₹)</span>
                        <input
                          className="input num text-right text-base"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="any"
                          value={l.rate}
                          onChange={(e) => update(l.key, { rate: e.target.value })}
                          placeholder="0"
                        />
                      </label>
                      <div className="min-w-[96px] pb-2.5 text-right">
                        <div className="text-3xs font-semibold text-muted uppercase">Total</div>
                        <div className="num font-semibold">{formatMoney(lineTotal)}</div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="border-t border-border p-4">
            <label>
              <span className="label">Notes for vendor (optional)</span>
              <textarea
                className="input h-20 py-2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Deliver before 7 AM"
              />
            </label>
          </div>
        </Section>
      </div>

      <div className="no-print fixed inset-x-0 bottom-16 z-20 border-t border-border bg-surface/95 backdrop-blur md:bottom-0 md:left-[var(--sidebar-w,0px)]">
        <div className="mx-auto max-w-[1400px] px-4 py-3 sm:px-6">
          {err && <div className="mb-2 text-sm text-danger">{err}</div>}
          <div className="flex items-center gap-4 sm:gap-6">
          <div>
            <div className="text-3xs font-semibold text-muted uppercase">Total qty</div>
            <div className="num text-md font-semibold">{formatNumber(totalKg)} kg</div>
          </div>
          <div>
            <div className="text-3xs font-semibold text-muted uppercase">Grand total</div>
            <div className="num text-2xl font-bold text-primary-ink">{formatMoney(total)}</div>
          </div>
          <Button size="lg" className="ml-auto px-4" onClick={save} loading={busy} disabled={!lines.length}>
            <Check className="size-5" /> Confirm<span className="hidden sm:inline"> order</span>
          </Button>
          </div>
        </div>
      </div>
      <ErrorBox error={vendors.error ?? catalog.error} />
    </div>
  )
}
