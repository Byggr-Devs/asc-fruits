import { ArrowDownToLine, ClipboardList, PackageCheck, Plus, Scale, SlidersHorizontal } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Chip, Section, Spinner, StatCard, Thumb } from '../components/ui'
import { dayStartISO, formatDateTime, formatKg, formatNumber, todayISO } from '../lib/format'
import { useCatalog, useCurrentStock, useMovements, usePendingOrderCount } from '../lib/queries'

const actions = [
  { to: '/orders/new', label: 'New order', hint: 'Order from a vendor', icon: Plus },
  { to: '/godown/receive', label: 'Receive delivery', hint: 'Goods arrived at godown', icon: PackageCheck },
  { to: '/stock/adjust', label: 'Adjust stock', hint: 'Wastage or correction', icon: SlidersHorizontal },
]

export function Dashboard() {
  const { session } = useAuth()
  const stock = useCurrentStock()
  const pending = usePendingOrderCount()
  const today = useMovements({ from: dayStartISO(todayISO()), type: 'receipt' })
  const recent = useMovements({ limit: 8 })
  const { varietyById } = useCatalog()

  const totalKg = useMemo(
    () => (stock.data ?? []).reduce((s, r) => s + Number(r.qty_kg), 0),
    [stock.data],
  )
  const receivedToday = (today.data ?? []).reduce((s, m) => s + Number(m.qty_kg), 0)
  const name = session?.user.email?.split('@')[0] ?? ''

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">
          Hello{name ? `, ${name}` : ''}
        </h1>
        <p className="text-muted">Here is what is happening at ASC Fruits today.</p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Total stock"
          value={stock.isLoading ? '...' : formatKg(totalKg)}
          icon={<Scale className="size-6" />}
        />
        <Link to="/orders?status=pending" className="block">
          <StatCard
            label="Pending orders"
            value={pending.isLoading ? '...' : pending.data}
            icon={<ClipboardList className="size-6" />}
            tone={pending.data ? 'amber' : 'neutral'}
          />
        </Link>
        <StatCard
          label="Received today"
          value={today.isLoading ? '...' : formatKg(receivedToday)}
          icon={<ArrowDownToLine className="size-6" />}
          tone="neutral"
        />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {actions.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="group flex items-center gap-4 rounded-card border-2 border-border bg-surface p-4 transition hover:border-primary hover:bg-primary-soft/40"
          >
            <span className="flex size-14 items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,#3A9A62,#2E7D4F)] text-white shadow-[0_2px_8px_rgba(46,125,79,0.28)]">
              <a.icon className="size-7" />
            </span>
            <span>
              <span className="block text-base font-semibold">{a.label}</span>
              <span className="block text-xs text-muted">{a.hint}</span>
            </span>
          </Link>
        ))}
      </div>

      <Section
        title="Latest stock movements"
        bodyClassName="p-0"
        actions={
          <Link to="/stock/movements" className="text-xs font-semibold text-primary">
            View all
          </Link>
        }
      >
        {recent.isLoading ? (
          <Spinner />
        ) : (recent.data ?? []).length === 0 ? (
          <div className="px-5 py-10 text-center text-muted">
            No stock movements yet. Start by creating an order or receiving a delivery.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {(recent.data ?? []).map((m) => {
              const v = varietyById.get(m.variety_id)
              const n = Number(m.qty_kg)
              return (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <Thumb emoji={v?.emoji || v?.fruit.emoji} imagePath={v?.image_path || v?.fruit.image_path} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{v?.name ?? 'Unknown'}</div>
                    <div className="text-2xs text-muted">{formatDateTime(m.created_at)}</div>
                  </div>
                  {m.type === 'receipt' ? (
                    <Chip tone="green">Received</Chip>
                  ) : (
                    <Chip tone={m.reason === 'wastage' ? 'red' : 'amber'}>{m.reason}</Chip>
                  )}
                  <span className={`num w-24 text-right font-semibold ${n < 0 ? 'text-danger' : 'text-primary'}`}>
                    {n > 0 ? '+' : ''}
                    {formatNumber(n)} kg
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </div>
  )
}
