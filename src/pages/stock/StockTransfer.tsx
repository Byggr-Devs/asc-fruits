import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useToast } from '../../components/toast'
import { Button, ErrorBox, PageHeader, Section, Spinner, Thumb } from '../../components/ui'
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
import { GODOWN_LOCATION_ID } from '../../lib/types'

export function StockTransfer() {
  const { t, displayName } = useLanguage()
  const catalog = useCatalog()
  const stock = useCurrentStock()
  const locations = useActiveLocations()
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()

  const [variety, setVariety] = useState<CatalogVariety | null>(null)
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const locs = locations.data
  // Default source = Godown (or first location); destination = first other location.
  const effectiveFrom =
    fromId || (locs.find((l) => l.id === GODOWN_LOCATION_ID)?.id ?? locs[0]?.id ?? '')
  const effectiveTo = toId || (locs.find((l) => l.id !== effectiveFrom)?.id ?? '')

  const stockByKey = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of stock.data ?? []) m.set(`${s.variety_id}:${s.location_id}`, Number(s.qty_kg))
    return m
  }, [stock.data])

  const available = variety ? (stockByKey.get(`${variety.id}:${effectiveFrom}`) ?? 0) : 0
  const amount = parseQty(qty)
  const toStock = variety ? (stockByKey.get(`${variety.id}:${effectiveTo}`) ?? 0) : 0

  async function save() {
    setErr(null)
    if (!variety) return setErr(t('stock.chooseVariety'))
    if (!effectiveFrom || !effectiveTo) return setErr(t('stock.chooseLocation'))
    if (effectiveFrom === effectiveTo) return setErr(t('transfer.sameLocation'))
    if (amount <= 0) return setErr(t('stock.enterKg'))
    if (round3(amount) > round3(available)) return setErr(t('transfer.insufficient'))
    setBusy(true)
    const { error } = await supabase.rpc('transfer_stock', {
      p_variety_id: variety.id,
      p_from_location_id: effectiveFrom,
      p_to_location_id: effectiveTo,
      p_qty_kg: amount,
      p_note: note.trim() || null,
    })
    setBusy(false)
    if (error) return setErr(errorMessage(error, t))
    await qc.invalidateQueries({ queryKey: keys.stock })
    toast(t('transfer.done', { name: displayName(variety), kg: formatKg(amount) }))
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
      <PageHeader title={t('transfer.title')} subtitle={t('transfer.subtitle')} />
      <ErrorBox error={locations.error ?? stock.error} />

      {!variety ? (
        <Section title={t('transfer.whichItem')}>
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
                  {t('transfer.available')} <b className="num text-ink">{formatKg(available)}</b>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setVariety(null)}>
                {t('common.change')}
              </Button>
            </div>
          </Section>

          <Section>
            <div className="space-y-5">
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <label className="block">
                  <span className="label">{t('transfer.from')}</span>
                  <select
                    className="input"
                    value={effectiveFrom}
                    onChange={(e) => setFromId(e.target.value)}
                  >
                    {locs.map((l) => (
                      <option key={l.id} value={l.id}>
                        {displayName(l)}
                      </option>
                    ))}
                  </select>
                </label>
                <ArrowRight className="mb-3 size-5 text-muted" />
                <label className="block">
                  <span className="label">{t('transfer.to')}</span>
                  <select
                    className="input"
                    value={effectiveTo}
                    onChange={(e) => setToId(e.target.value)}
                  >
                    {locs.map((l) => (
                      <option key={l.id} value={l.id}>
                        {displayName(l)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

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

              <label className="block">
                <span className="label">{t('stock.noteOptional')}</span>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
              </label>

              {amount > 0 && effectiveFrom !== effectiveTo && (
                <div
                  className={`rounded-card px-4 py-3 ${amount > available ? 'bg-warning-soft text-warning' : 'bg-surface-low'}`}
                >
                  <div>
                    {displayName(locs.find((l) => l.id === effectiveFrom))}:{' '}
                    {formatKg(available)} → {formatKg(round3(available - amount))}
                  </div>
                  <div>
                    {displayName(locs.find((l) => l.id === effectiveTo))}: {formatKg(toStock)} →{' '}
                    {formatKg(round3(toStock + amount))}
                  </div>
                  {amount > available && <div className="mt-1">{t('transfer.insufficient')}</div>}
                </div>
              )}

              {err && <div className="rounded-input bg-danger-soft px-3 py-2 text-danger">{err}</div>}

              <Button size="lg" className="w-full" onClick={save} loading={busy}>
                <Check className="size-5" /> {t('transfer.save')}
              </Button>
            </div>
          </Section>
        </div>
      )}
    </div>
  )
}
