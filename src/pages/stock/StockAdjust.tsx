import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Minus, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useToast } from '../../components/toast'
import { Button, PageHeader, Section, Spinner, Thumb } from '../../components/ui'
import { VarietyPicker } from '../../components/VarietyPicker'
import { useLanguage } from '../../i18n/LanguageProvider'
import { formatKg, parseQty, round3 } from '../../lib/format'
import {
  keys,
  useActiveLocations,
  useCatalog,
  useCurrentStock,
  type CatalogVariety,
} from '../../lib/queries'
import { errorMessage, supabase } from '../../lib/supabase'
import { GODOWN_LOCATION_ID, type AdjustmentReason } from '../../lib/types'

const reasons: { id: AdjustmentReason; labelKey: string; hintKey: string }[] = [
  { id: 'wastage', labelKey: 'reason.wastage', hintKey: 'reason.wastageHint' },
  { id: 'correction', labelKey: 'reason.correction', hintKey: 'reason.correctionHint' },
  { id: 'other', labelKey: 'reason.other', hintKey: 'reason.otherHint' },
]

export function StockAdjust() {
  const { t, displayName } = useLanguage()
  const catalog = useCatalog()
  const stock = useCurrentStock()
  const locations = useActiveLocations()
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()

  const [variety, setVariety] = useState<CatalogVariety | null>(null)
  const [locationId, setLocationId] = useState(GODOWN_LOCATION_ID)
  const [direction, setDirection] = useState<'remove' | 'add'>('remove')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState<AdjustmentReason>('wastage')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const stockByKey = useMemo(
    () =>
      new Map((stock.data ?? []).map((s) => [`${s.variety_id}:${s.location_id}`, Number(s.qty_kg)])),
    [stock.data],
  )
  const current = variety ? (stockByKey.get(`${variety.id}:${locationId}`) ?? 0) : 0
  const amount = parseQty(qty)
  const signed = direction === 'remove' ? -amount : amount
  const after = round3(current + signed)

  async function save() {
    setErr(null)
    if (!variety) return setErr(t('stock.chooseVariety'))
    if (!locationId) return setErr(t('stock.chooseLocation'))
    if (amount <= 0) return setErr(t('stock.enterKg'))
    if (reason === 'other' && !note.trim()) return setErr(t('stock.noteRequired'))
    setBusy(true)
    const { error } = await supabase.from('stock_movements').insert({
      variety_id: variety.id,
      location_id: locationId,
      qty_kg: signed,
      type: 'adjustment',
      reason,
      note: note.trim() || null,
    })
    setBusy(false)
    if (error) return setErr(errorMessage(error, t))
    await qc.invalidateQueries({ queryKey: keys.stock })
    toast(
      t(direction === 'remove' ? 'stock.toastRemoved' : 'stock.toastAdded', {
        name: displayName(variety),
        kg: formatKg(amount),
      }),
    )
    navigate('/stock')
  }

  if (catalog.isLoading || locations.isLoading) return <Spinner />

  return (
    <div>
      <Link
        to="/stock"
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" /> {t('stock.back')}
      </Link>
      <PageHeader title={t('stock.adjustTitle')} subtitle={t('stock.adjustSubtitle')} />

      {!variety ? (
        <Section title={t('stock.whichItem')}>
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
                <div className="text-md font-semibold">{displayName(variety)}</div>
                <div className="text-muted">
                  {t('stock.inStockNow')} <b className="num text-ink">{formatKg(current)}</b>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setVariety(null)}>
                {t('common.change')}
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
                  label={t('stock.removeStock')}
                />
                <DirectionButton
                  active={direction === 'add'}
                  onClick={() => setDirection('add')}
                  tone="primary"
                  icon={<Plus className="size-5" />}
                  label={t('stock.addStock')}
                />
              </div>

              <label className="block">
                <span className="label">{t('stock.location')}</span>
                <select
                  className="input"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                >
                  {locations.data.map((l) => (
                    <option key={l.id} value={l.id}>
                      {displayName(l)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="label">{t('stock.quantity')}</span>
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
                <span className="label">{t('stock.reason')}</span>
                <div className="grid gap-2 sm:grid-cols-3">
                  {reasons.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setReason(r.id)}
                      className={`cursor-pointer rounded-card border-2 p-3 text-left transition ${reason === r.id ? 'border-primary bg-primary-soft' : 'border-border hover:bg-surface-low'}`}
                    >
                      <div className="font-semibold">{t(r.labelKey)}</div>
                      <div className="text-2xs text-muted">{t(r.hintKey)}</div>
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="label">
                  {reason !== 'other' ? t('stock.noteOptional') : t('stock.note')}
                </span>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
              </label>

              {amount > 0 && (
                <div
                  className={`rounded-card px-4 py-3 ${after < 0 ? 'bg-warning-soft text-warning' : 'bg-surface-low'}`}
                >
                  {t('stock.willChange', {
                    from: formatKg(current),
                    to: formatKg(after),
                  })}
                  {after < 0 && t('stock.belowZero')}
                </div>
              )}

              {err && <div className="rounded-input bg-danger-soft px-3 py-2 text-danger">{err}</div>}

              <Button size="lg" className="w-full" onClick={save} loading={busy}>
                <Check className="size-5" /> {t('stock.saveAdjustment')}
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
