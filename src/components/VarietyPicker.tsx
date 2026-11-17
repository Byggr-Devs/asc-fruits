import { Check, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLanguage } from '../i18n/LanguageProvider'
import type { CatalogVariety } from '../lib/queries'
import type { Fruit } from '../lib/types'
import { Thumb } from './ui'

/**
 * Tap a fruit, then tap a variety. Optionally restricted to `allowedIds`
 * (e.g. a vendor's mapped varieties) with a "show all" escape hatch.
 */
export function VarietyPicker({
  fruits,
  varieties,
  onPick,
  selectedIds,
  allowedIds,
}: {
  fruits: Fruit[]
  varieties: CatalogVariety[]
  onPick: (variety: CatalogVariety) => void
  selectedIds?: Set<string>
  allowedIds?: Set<string>
}) {
  const { t, displayName } = useLanguage()
  const restrictable = !!allowedIds && allowedIds.size > 0
  const [showAll, setShowAll] = useState(!restrictable)
  const [fruitId, setFruitId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const pool = useMemo(
    () =>
      varieties.filter(
        (v) => v.active && v.fruit.active && (showAll || !restrictable || allowedIds!.has(v.id)),
      ),
    [varieties, showAll, restrictable, allowedIds],
  )

  const visibleFruits = useMemo(() => {
    const ids = new Set(pool.map((v) => v.fruit_id))
    return fruits.filter((f) => ids.has(f.id))
  }, [fruits, pool])

  const activeFruitId =
    fruitId && visibleFruits.some((f) => f.id === fruitId) ? fruitId : (visibleFruits[0]?.id ?? null)

  const q = query.trim().toLowerCase()
  const shown = q
    ? pool.filter((v) => {
        const names = [v.name, v.name_ta, v.fruit.name, v.fruit.name_ta]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return names.includes(q)
      })
    : pool.filter((v) => v.fruit_id === activeFruitId)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            className="input pl-9"
            placeholder={t('picker.searchFruit')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {restrictable && (
          <label className="flex h-11 cursor-pointer items-center gap-2 rounded-button border border-border bg-surface px-3 text-xs font-medium select-none">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            {t('picker.showAll')}
          </label>
        )}
      </div>

      {!q && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {visibleFruits.map((f) => {
            const active = f.id === activeFruitId
            const label = displayName(f)
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFruitId(f.id)}
                className={`flex min-w-[88px] cursor-pointer flex-col items-center gap-1.5 rounded-card border-2 px-3 py-2.5 transition ${
                  active
                    ? 'border-primary bg-primary-soft'
                    : 'border-transparent bg-surface-low hover:border-border'
                }`}
              >
                <Thumb emoji={f.emoji} imagePath={f.image_path} alt={label} />
                <span className="text-xs font-semibold whitespace-nowrap">{label}</span>
              </button>
            )
          })}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="rounded-card bg-surface-low px-4 py-8 text-center text-muted">
          {t('picker.noVarieties')}
          {restrictable && !showAll && t('picker.tryShowAll')}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
          {shown.map((v) => {
            const selected = selectedIds?.has(v.id)
            const vName = displayName(v)
            const fName = displayName(v.fruit)
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onPick(v)}
                className={`relative flex min-h-[64px] cursor-pointer items-center gap-3 rounded-card border-2 bg-surface p-2.5 text-left transition hover:border-primary/50 ${
                  selected ? 'border-primary bg-primary-soft' : 'border-border'
                }`}
              >
                <Thumb
                  emoji={v.emoji || v.fruit.emoji}
                  imagePath={v.image_path || v.fruit.image_path}
                  alt={vName}
                />
                <span className="min-w-0">
                  <span className="line-clamp-2 text-sm leading-tight font-semibold break-words">
                    {vName}
                  </span>
                  <span className="block truncate text-2xs text-muted">{fName}</span>
                </span>
                {selected && (
                  <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="size-3.5" />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
