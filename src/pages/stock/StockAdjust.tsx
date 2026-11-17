import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Minus, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useToast } from '../../components/toast'
import { Button, PageHeader, Section, Spinner, Thumb } from '../../components/ui'
import { VarietyPicker } from '../../components/VarietyPicker'
import { formatKg, parseQty, round3 } from '../../lib/format'
import { keys, useCatalog, useCurrentStock, type CatalogVariety } from '../../lib/queries'
import { errorMessage, supabase } from '../../lib/supabase'
import type { AdjustmentReason } from '../../lib/types'

const reasons: { id: AdjustmentReason; label: string; hint: string }[] = [
  { id: 'wastage', label: 'Wastage', hint: 'Spoiled, damaged or thrown away' },
  { id: 'correction', label: 'Correction', hint: 'Fixing a counting mistake' },
  { id: 'other', label: 'Other', hint: 'Anything else, add a note' },
]

export function StockAdjust() {
  const catalog = useCatalog()
  const stock = useCurrentStock()
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()

  const [variety, setVariety] = useState<CatalogVariety | null>(null)
  const [direction, setDirection] = useState<'remove' | 'add'>('remove')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState<AdjustmentReason>('wastage')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const stockById = useMemo(
    () => new Map((stock.data ?? []).map((s) => [s.variety_id, Number(s.qty_kg)])),
    [stock.data],
  )
  const current = variety ? (stockById.get(variety.id) ?? 0) : 0
  const amount = parseQty(qty)
  const signed = direction === 'remove' ? -amount : amount
  const after = round3(current + signed)

  async function save() {
    setErr(null)
    if (!variety) return setErr('Choose a variety.')
    if (amount <= 0) return setErr('Enter how many kg.')
    if (reason === 'other' && !note.trim()) return setErr('Please add a note for "Other".')
    setBusy(true)
    const { error } = await supabase.from('stock_movements').insert({
      variety_id: variety.id,
      qty_kg: signed,
      type: 'adjustment',
      reason,
      note: note.trim() || null,
    })
    setBusy(false)
    if (error) return setErr(errorMessage(error))
    await qc.invalidateQueries({ queryKey: keys.stock })
    toast(`${variety.name}: ${direction === 'remove' ? 'removed' : 'added'} ${formatKg(amount)}`)
    navigate('/stock')
  }

  if (catalog.isLoading) return <Spinner />

  return (
    <div>
      <Link
        to="/stock"
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Stock
      </Link>
      <PageHeader title="Adjust stock" subtitle="Record wastage or fix a count." />

      {!variety ? (
        <Section title="Which item?">
          <VarietyPicker fruits={catalog.fruits} varieties={catalog.varieties} onPick={setVariety} />
        </Section>
      ) : (
        <div className="mx-auto max-w-xl space-y-5">
          <Section>
            <div className="flex items-center gap-3">
              <Thumb
                emoji={variety.emoji || variety.fruit.emoji}
                imagePath={variety.image_path || variety.fruit.image_path}
                size="lg"
              />
              <div className="flex-1">
                <div className="text-md font-semibold">{variety.name}</div>
                <div className="text-muted">
                  In stock now: <b className="num text-ink">{formatKg(current)}</b>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setVariety(null)}>
                Change
              </Button>
            </div>
          </Section>

          <Section>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-2">
                <DirectionButton
                  active={direction === 'remove'}
                  onClick={() => setDirection('remove')}
                  tone="danger"
                  icon={<Minus className="size-5" />}
                  label="Remove stock"
                />
                <DirectionButton
                  active={direction === 'add'}
                  onClick={() => setDirection('add')}
                  tone="primary"
                  icon={<Plus className="size-5" />}
                  label="Add stock"
                />
              </div>

              <label className="block">
                <span className="label">Quantity (kg)</span>
                <input
                  className="input num h-14 text-right text-xl"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  autoFocus
                  placeholder="0"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </label>

              <div>
                <span className="label">Reason</span>
                <div className="grid gap-2 sm:grid-cols-3">
                  {reasons.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setReason(r.id)}
                      className={`cursor-pointer rounded-card border-2 p-3 text-left transition ${reason === r.id ? 'border-primary bg-primary-soft' : 'border-border hover:bg-surface-low'}`}
                    >
                      <div className="font-semibold">{r.label}</div>
                      <div className="text-2xs text-muted">{r.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="label">Note {reason !== 'other' && '(optional)'}</span>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
              </label>

              {amount > 0 && (
                <div
                  className={`rounded-card px-4 py-3 ${after < 0 ? 'bg-warning-soft text-warning' : 'bg-surface-low'}`}
                >
                  Stock will change from <b className="num">{formatKg(current)}</b> to{' '}
                  <b className="num">{formatKg(after)}</b>
                  {after < 0 && '. This is below zero, please double check.'}
                </div>
              )}

              {err && <div className="rounded-input bg-danger-soft px-3 py-2 text-danger">{err}</div>}

              <Button size="lg" className="w-full" onClick={save} loading={busy}>
                <Check className="size-5" /> Save adjustment
              </Button>
            </div>
          </Section>
        </div>
      )}
    </div>
  )
}

function DirectionButton({
  active,
  onClick,
  tone,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  tone: 'danger' | 'primary'
  icon: React.ReactNode
  label: string
}) {
  const on =
    tone === 'danger' ? 'border-danger bg-danger-soft text-danger' : 'border-primary bg-primary-soft text-primary-ink'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-14 cursor-pointer items-center justify-center gap-2 rounded-card border-2 font-semibold transition ${active ? on : 'border-border text-muted hover:bg-surface-low'}`}
    >
      {icon} {label}
    </button>
  )
}
