import {
  AlertTriangle,
  ArrowLeftRight,
  ChevronDown,
  FileText,
  History,
  Layers,
  Scale,
  SlidersHorizontal,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { DataTable } from '../../components/DataTable'
import { columnHelper } from '../../lib/table'
import { ErrorBox, PageHeader, Spinner, StatCard, Thumb } from '../../components/ui'
import { useLanguage } from '../../i18n/LanguageProvider'
import { formatDateTime, formatKg, formatNumber } from '../../lib/format'
import { useActiveLocations, useCurrentStock } from '../../lib/queries'
import type { CurrentStock } from '../../lib/types'

type Row = CurrentStock & {
  varietyLabel: string
  fruitLabel: string
  breakdown: { name: string; name_ta: string | null; qty: number }[]
}

const h = columnHelper<Row>()

const linkBtn =
  'inline-flex h-11 items-center gap-2 rounded-button border border-border bg-surface px-4 text-sm font-semibold text-ink transition hover:bg-surface-low'

export function StockDashboard() {
  const { t, displayName } = useLanguage()
  const stock = useCurrentStock()
  const locations = useActiveLocations()
  const [params, setParams] = useSearchParams()
  const [openFruit, setOpenFruit] = useState<string | null>(null)

  const activeIds = useMemo(() => new Set(locations.data.map((l) => l.id)), [locations.data])
  const paramLocation = params.get('location')
  // 'all' unless the query param names a currently active location
  const locationId = paramLocation && activeIds.has(paramLocation) ? paramLocation : 'all'

  function selectLocation(id: string) {
    setParams(id === 'all' ? {} : { location: id }, { replace: true })
  }

  // Per-location rows within the filter (only active locations; one location when filtered)
  const scoped = useMemo(
    () =>
      (stock.data ?? []).filter((r) =>
        locationId === 'all' ? activeIds.has(r.location_id) : r.location_id === locationId,
      ),
    [stock.data, locationId, activeIds],
  )

  // One row per variety. When viewing All, qty is summed across locations.
  const varietyRows = useMemo<Row[]>(() => {
    const byVariety = new Map<string, Row>()
    for (const r of scoped) {
      const existing = byVariety.get(r.variety_id)
      const breakdown = { name: r.location_name, name_ta: r.location_name_ta, qty: Number(r.qty_kg) }
      if (!existing) {
        byVariety.set(r.variety_id, {
          ...r,
          qty_kg: Number(r.qty_kg),
          varietyLabel: displayName({ name: r.variety_name, name_ta: r.variety_name_ta }),
          fruitLabel: displayName({ name: r.fruit_name, name_ta: r.fruit_name_ta }),
          breakdown: Number(r.qty_kg) !== 0 ? [breakdown] : [],
        })
        continue
      }
      existing.qty_kg = Number(existing.qty_kg) + Number(r.qty_kg)
      if (r.last_movement_at && (!existing.last_movement_at || r.last_movement_at > existing.last_movement_at))
        existing.last_movement_at = r.last_movement_at
      if (Number(r.qty_kg) !== 0) existing.breakdown.push(breakdown)
    }
    return [...byVariety.values()]
  }, [scoped, displayName])

  const { fruits, totalKg, inStock, negatives } = useMemo(() => {
    const byFruit = new Map<
      string,
      { id: string; name: string; emoji: string; image: string | null; kg: number; items: Row[] }
    >()
    for (const r of varietyRows) {
      const f = byFruit.get(r.fruit_id) ?? {
        id: r.fruit_id,
        name: displayName({ name: r.fruit_name, name_ta: r.fruit_name_ta }),
        emoji: r.fruit_emoji,
        image: r.fruit_image_path,
        kg: 0,
        items: [],
      }
      f.kg += Number(r.qty_kg)
      f.items.push(r)
      byFruit.set(r.fruit_id, f)
    }
    return {
      fruits: [...byFruit.values()].sort((a, b) => b.kg - a.kg),
      totalKg: varietyRows.reduce((s, r) => s + Number(r.qty_kg), 0),
      inStock: varietyRows.filter((r) => Number(r.qty_kg) > 0).length,
      // Negatives are checked per location so a shortfall in one place isn't hidden by another
      negatives: scoped.filter((r) => Number(r.qty_kg) < 0),
    }
  }, [varietyRows, scoped, displayName])

  const tableRows = useMemo(
    () => varietyRows.filter((r) => r.last_movement_at),
    [varietyRows],
  )

  const columns = useMemo(
    () =>
      h.columns([
        h.accessor('varietyLabel', {
          header: t('stock.colVariety'),
          cell: (c) => (
            <div className="flex items-center gap-2.5">
              <Thumb
                emoji={c.row.original.variety_emoji || c.row.original.fruit_emoji}
                imagePath={c.row.original.variety_image_path || c.row.original.fruit_image_path}
                size="sm"
              />
              <b>{c.getValue()}</b>
            </div>
          ),
        }),
        h.accessor('fruitLabel', { header: t('stock.colFruit') }),
        ...(locationId === 'all'
          ? [
              h.display({
                id: 'locations',
                header: t('stock.colLocation'),
                enableSorting: false,
                cell: (c) => (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-2xs text-muted">
                    {c.row.original.breakdown.map((b, i) => (
                      <span key={i} className="whitespace-nowrap">
                        {displayName({ name: b.name, name_ta: b.name_ta })}{' '}
                        <span className={`num font-semibold ${b.qty < 0 ? 'text-danger' : 'text-ink'}`}>
                          {formatNumber(b.qty)}
                        </span>
                      </span>
                    ))}
                  </div>
                ),
              }),
            ]
          : []),
        h.accessor('last_movement_at', {
          header: t('stock.colLastMovement'),
          cell: (c) => <span className="text-muted">{formatDateTime(c.getValue())}</span>,
        }),
        h.accessor('qty_kg', {
          header: t('stock.colInStock'),
          meta: { align: 'right' },
          cell: (c) => {
            const n = Number(c.getValue())
            return (
              <span className={`font-semibold ${n < 0 ? 'text-danger' : n === 0 ? 'text-muted' : ''}`}>
                {formatNumber(n)}
              </span>
            )
          },
        }),
      ]),
    [t, displayName, locationId],
  )

  if (stock.isLoading || locations.isLoading) return <Spinner />

  return (
    <div>
      <PageHeader
        title={t('stock.title')}
        subtitle={t('stock.subtitle')}
        actions={
          <>
            <Link
              to="/stock/adjust"
              className="inline-flex h-11 items-center gap-2 rounded-button bg-[linear-gradient(135deg,#3A9A62,#2E7D4F)] px-4 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(46,125,79,0.28)] transition hover:-translate-y-px"
            >
              <SlidersHorizontal className="size-4" /> {t('stock.adjust')}
            </Link>
            <Link to="/stock/transfer" className={linkBtn}>
              <ArrowLeftRight className="size-4" /> {t('stock.transfer')}
            </Link>
            <Link to="/stock/movements" className={linkBtn}>
              <History className="size-4" /> {t('stock.movements')}
            </Link>
            <Link to="/stock/report" className={linkBtn}>
              <FileText className="size-4" /> {t('stock.dailyReport')}
            </Link>
          </>
        }
      />
      <ErrorBox error={stock.error ?? locations.error} />

      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label={t('stock.location')}>
        {[{ id: 'all', label: t('stock.allLocations') }, ...locations.data.map((l) => ({ id: l.id, label: displayName(l) }))].map(
          (tab) => {
            const on = locationId === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => selectLocation(tab.id)}
                className={`h-10 cursor-pointer rounded-full border px-4 text-xs font-semibold transition ${on ? 'border-primary bg-primary-soft text-primary-ink' : 'border-border text-muted hover:bg-surface-low'}`}
              >
                {tab.label}
              </button>
            )
          },
        )}
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label={t('stock.totalStock')} value={formatKg(totalKg)} icon={<Scale className="size-6" />} />
        <StatCard
          label={t('stock.varietiesInStock')}
          value={inStock}
          icon={<Layers className="size-6" />}
          tone="neutral"
        />
        <StatCard
          label={t('stock.needsAttention')}
          value={negatives.length}
          icon={<AlertTriangle className="size-6" />}
          tone={negatives.length ? 'amber' : 'neutral'}
        />
      </div>

      {negatives.length > 0 && (
        <div className="mb-5 rounded-card border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          {t('stock.negative', {
            names: negatives
              .map((n) => {
                const name = displayName({ name: n.variety_name, name_ta: n.variety_name_ta })
                return locationId === 'all'
                  ? `${name} (${displayName({ name: n.location_name, name_ta: n.location_name_ta })})`
                  : name
              })
              .join(', '),
          })}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {fruits.map((f) => {
          const isOpen = openFruit === f.id
          return (
            <div key={f.id} className="card overflow-hidden">
              <button
                onClick={() => setOpenFruit(isOpen ? null : f.id)}
                className="flex w-full cursor-pointer items-center gap-3 p-4 text-left hover:bg-surface-low"
              >
                <Thumb emoji={f.emoji} imagePath={f.image} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{f.name}</div>
                  <div className={`num text-xl font-bold ${f.kg > 0 ? 'text-primary-ink' : 'text-muted'}`}>
                    {formatKg(f.kg)}
                  </div>
                </div>
                <ChevronDown className={`size-5 text-muted transition ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <ul className="divide-y divide-border border-t border-border bg-surface-low/50">
                  {f.items.map((v) => (
                    <li key={v.variety_id} className="flex items-center justify-between px-4 py-2.5">
                      <span>{displayName({ name: v.variety_name, name_ta: v.variety_name_ta })}</span>
                      <span
                        className={`num font-semibold ${Number(v.qty_kg) < 0 ? 'text-danger' : Number(v.qty_kg) === 0 ? 'text-muted' : ''}`}
                      >
                        {formatKg(v.qty_kg)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <h2 className="mb-3 text-lg font-semibold">{t('stock.allVarieties')}</h2>
      <DataTable
        data={tableRows}
        columns={columns}
        searchPlaceholder={t('stock.search')}
        initialSorting={[{ id: 'qty_kg', desc: true }]}
        empty={t('stock.empty')}
      />
    </div>
  )
}
