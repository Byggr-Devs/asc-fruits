import { ArrowDownToLine, ClipboardList, PackageCheck, Plus, Scale, SlidersHorizontal } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Chip, Section, Spinner, StatCard, Thumb } from '../components/ui'
import { useLanguage } from '../i18n/LanguageProvider'
import { dayStartISO, formatDateTime, formatKg, formatNumber, todayISO } from '../lib/format'
import { useCatalog, useCurrentStock, useMovements, usePendingOrderCount } from '../lib/queries'

export function Dashboard() {
  const { session } = useAuth()
  const { t, displayName } = useLanguage()
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

  const actions = [
    { to: '/orders/new', label: t('dash.newOrder'), hint: t('dash.newOrderHint'), icon: Plus },
    {
      to: '/godown/receive',
      label: t('dash.receiveDelivery'),
      hint: t('dash.receiveDeliveryHint'),
      icon: PackageCheck,
    },
    {
      to: '/stock/adjust',
      label: t('dash.adjustStock'),
      hint: t('dash.adjustStockHint'),
      icon: SlidersHorizontal,
    },
  ]

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">
          {name ? t('dash.helloName', { name }) : t('dash.hello')}
        </h1>
        <p className="text-muted">{t('dash.subtitle')}</p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard
          label={t('dash.totalStock')}
          value={stock.isLoading ? '...' : formatKg(totalKg)}
          icon={<Scale className="size-6" />}
        />
        <Link to="/orders?status=pending" className="block">
          <StatCard
            label={t('dash.pendingOrders')}
            value={pending.isLoading ? '...' : pending.data}
            icon={<ClipboardList className="size-6" />}
            tone={pending.data ? 'amber' : 'neutral'}
          />
        </Link>
        <StatCard
          label={t('dash.receivedToday')}
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
        title={t('dash.latestMovements')}
        bodyClassName="p-0"
        actions={
          <Link to="/stock/movements" className="text-xs font-semibold text-primary">
            {t('dash.viewAll')}
          </Link>
        }
      >
        {recent.isLoading ? (
          <Spinner />
        ) : (recent.data ?? []).length === 0 ? (
          <div className="px-5 py-10 text-center text-muted">{t('dash.noMovements')}</div>
        ) : (
          <ul className="divide-y divide-border">
            {(recent.data ?? []).map((m) => {
              const v = varietyById.get(m.variety_id)
              const n = Number(m.qty_kg)
              return (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <Thumb
                    emoji={v?.emoji || v?.fruit.emoji}
                    imagePath={v?.image_path || v?.fruit.image_path}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">
                      {displayName(v, t('common.unknown'))}
                    </div>
                    <div className="text-2xs text-muted">{formatDateTime(m.created_at)}</div>
                  </div>
                  {m.type === 'receipt' ? (
                    <Chip tone="green">{t('movement.received')}</Chip>
                  ) : (
                    <Chip tone={m.reason === 'wastage' ? 'red' : 'amber'}>
                      {m.reason ? t(`reason.${m.reason}`) : t('reason.adjustment')}
                    </Chip>
                  )}
                  <span
                    className={`num w-24 text-right font-semibold ${n < 0 ? 'text-danger' : 'text-primary'}`}
                  >
                    {n > 0 ? '+' : ''}
                    {formatNumber(n)} {t('common.kg')}
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
