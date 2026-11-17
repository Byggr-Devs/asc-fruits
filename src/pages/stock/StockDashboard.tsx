import { AlertTriangle, ChevronDown, FileText, History, Layers, Scale, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { DataTable } from '../../components/DataTable'
import { columnHelper } from '../../lib/table'
import { ErrorBox, PageHeader, Spinner, StatCard, Thumb } from '../../components/ui'
import { formatDateTime, formatKg, formatNumber } from '../../lib/format'
import { useCurrentStock } from '../../lib/queries'
import type { CurrentStock } from '../../lib/types'

const h = columnHelper<CurrentStock>()
const columns = h.columns([
  h.accessor('variety_name', {
    header: 'Variety',
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
  h.accessor('fruit_name', { header: 'Fruit' }),
  h.accessor('last_movement_at', {
    header: 'Last movement',
    cell: (c) => <span className="text-muted">{formatDateTime(c.getValue())}</span>,
  }),
  h.accessor('qty_kg', {
    header: 'In stock (kg)',
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
])

const linkBtn =
  'inline-flex h-11 items-center gap-2 rounded-button border border-border bg-surface px-4 text-sm font-semibold text-ink transition hover:bg-surface-low'

export function StockDashboard() {
  const stock = useCurrentStock()
  const [openFruit, setOpenFruit] = useState<string | null>(null)

  const { fruits, totalKg, inStock, negatives } = useMemo(() => {
    const data = stock.data ?? []
    const byFruit = new Map<
      string,
      { id: string; name: string; emoji: string; image: string | null; kg: number; items: CurrentStock[] }
    >()
    for (const r of data) {
      const f = byFruit.get(r.fruit_id) ?? {
        id: r.fruit_id,
        name: r.fruit_name,
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
      totalKg: data.reduce((s, r) => s + Number(r.qty_kg), 0),
      inStock: data.filter((r) => Number(r.qty_kg) > 0).length,
      negatives: data.filter((r) => Number(r.qty_kg) < 0),
    }
  }, [stock.data])

  const tableRows = useMemo(
    () => (stock.data ?? []).filter((r) => r.last_movement_at),
    [stock.data],
  )

  if (stock.isLoading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Stock"
        subtitle="Live godown stock, by fruit and variety."
        actions={
          <>
            <Link
              to="/stock/adjust"
              className="inline-flex h-11 items-center gap-2 rounded-button bg-[linear-gradient(135deg,#3A9A62,#2E7D4F)] px-4 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(46,125,79,0.28)] transition hover:-translate-y-px"
            >
              <SlidersHorizontal className="size-4" /> Adjust stock
            </Link>
            <Link to="/stock/movements" className={linkBtn}>
              <History className="size-4" /> Movements
            </Link>
            <Link to="/stock/report" className={linkBtn}>
              <FileText className="size-4" /> Daily report
            </Link>
          </>
        }
      />
      <ErrorBox error={stock.error} />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total stock" value={formatKg(totalKg)} icon={<Scale className="size-6" />} />
        <StatCard
          label="Varieties in stock"
          value={inStock}
          icon={<Layers className="size-6" />}
          tone="neutral"
        />
        <StatCard
          label="Needs attention"
          value={negatives.length}
          icon={<AlertTriangle className="size-6" />}
          tone={negatives.length ? 'amber' : 'neutral'}
        />
      </div>

      {negatives.length > 0 && (
        <div className="mb-5 rounded-card border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <b>Negative stock:</b> {negatives.map((n) => n.variety_name).join(', ')}. Please check and
          record a correction.
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
                      <span>{v.variety_name}</span>
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

      <h2 className="mb-3 text-lg font-semibold">All varieties</h2>
      <DataTable
        data={tableRows}
        columns={columns}
        searchPlaceholder="Search variety or fruit"
        initialSorting={[{ id: 'qty_kg', desc: true }]}
        empty="No stock recorded yet. Receive a delivery to add stock."
      />
    </div>
  )
}
