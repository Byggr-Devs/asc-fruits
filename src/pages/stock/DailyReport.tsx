import { AlertTriangle, ChevronLeft, ChevronRight, Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DataTable } from '../../components/DataTable'
import { columnHelper } from '../../lib/table'
import { useLanguage } from '../../i18n/LanguageProvider'
import { Button, ErrorBox, PageHeader, Spinner, StatCard } from '../../components/ui'
import { addDays, formatDate, formatKg, formatNumber, todayISO } from '../../lib/format'
import { useActiveLocations, useDailyReport } from '../../lib/queries'
import type { DailyReportRow } from '../../lib/types'
import { ArrowDownToLine, Scale, Trash2 } from 'lucide-react'

const h = columnHelper<DailyReportRow>()
const num = (n: number, signed = false) => {
  const v = Number(n)
  if (v === 0) return <span className="text-muted">0</span>
  return (
    <span className={signed ? (v < 0 ? 'text-danger' : 'text-primary') : ''}>
      {signed && v > 0 ? '+' : ''}
      {formatNumber(v)}
    </span>
  )
}
export function DailyReport() {
  const { t, displayName } = useLanguage()
  const [day, setDay] = useState(todayISO())
  const [locationId, setLocationId] = useState<string | null>(null)
  const locations = useActiveLocations()
  const report = useDailyReport(day, locationId)
  const rows = useMemo(() => report.data ?? [], [report.data])

  const columns = useMemo(
    () =>
      h.columns([
        h.accessor('variety_name', {
          header: t('report.colItem'),
          cell: (c) => (
            <div className="flex items-center gap-2">
              <span className="text-lg">{c.row.original.fruit_emoji}</span>
              <div>
                <div className="font-semibold">
                  {displayName({ name: c.getValue(), name_ta: c.row.original.variety_name_ta })}
                </div>
                <div className="text-2xs text-muted">
                  {displayName({
                    name: c.row.original.fruit_name,
                    name_ta: c.row.original.fruit_name_ta,
                  })}
                </div>
              </div>
            </div>
          ),
        }),
        ...(locationId === null
          ? [
              h.accessor('location_name', {
                header: t('report.colLocation'),
                cell: (c) => (
                  <span className="whitespace-nowrap">
                    {displayName({
                      name: c.getValue(),
                      name_ta: c.row.original.location_name_ta,
                    })}
                  </span>
                ),
              }),
            ]
          : []),
        h.accessor('opening_kg', {
          header: t('report.colOpening'),
          meta: { align: 'right' },
          cell: (c) => num(c.getValue()),
        }),
        h.accessor('received_kg', {
          header: t('report.colReceived'),
          meta: { align: 'right' },
          cell: (c) => num(c.getValue(), true),
        }),
        h.accessor('adjusted_kg', {
          header: t('report.colAdjusted'),
          meta: { align: 'right' },
          cell: (c) => num(c.getValue(), true),
        }),
        h.accessor('transferred_kg', {
          header: t('report.colTransferred'),
          meta: { align: 'right' },
          cell: (c) => num(c.getValue(), true),
        }),
        h.accessor('closing_kg', {
          header: t('report.colClosing'),
          meta: { align: 'right' },
          cell: (c) => (
            <b className={Number(c.getValue()) < 0 ? 'text-danger' : ''}>{formatNumber(c.getValue())}</b>
          ),
        }),
      ]),
    [t, displayName, locationId],
  )

  const totals = useMemo(
    () =>
      rows.reduce(
        (t, r) => ({
          opening: t.opening + Number(r.opening_kg),
          received: t.received + Number(r.received_kg),
          adjusted: t.adjusted + Number(r.adjusted_kg),
          transferred: t.transferred + Number(r.transferred_kg),
          closing: t.closing + Number(r.closing_kg),
        }),
        { opening: 0, received: 0, adjusted: 0, transferred: 0, closing: 0 },
      ),
    [rows],
  )

  const alerts = rows.filter(
    (r) =>
      Number(r.closing_kg) < 0 ||
      (Number(r.adjusted_kg) < 0 && Math.abs(Number(r.adjusted_kg)) > 0.05 * (Number(r.opening_kg) + Number(r.received_kg))),
  )

  return (
    <div>
      <PageHeader
        title={t('report.title')}
        subtitle={t('report.subtitle', { date: formatDate(`${day}T12:00:00+05:30`) })}
        actions={
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="size-4" /> {t('common.print')}
          </Button>
        }
      />

      <div className="no-print mb-5 flex items-center gap-2">
        <Button variant="secondary" onClick={() => setDay(addDays(day, -1))} aria-label={t('report.prevDay')}>
          <ChevronLeft className="size-4" />
        </Button>
        <input
          type="date"
          className="input w-auto"
          value={day}
          max={todayISO()}
          onChange={(e) => e.target.value && setDay(e.target.value)}
        />
        <Button
          variant="secondary"
          onClick={() => setDay(addDays(day, 1))}
          disabled={day >= todayISO()}
          aria-label={t('report.nextDay')}
        >
          <ChevronRight className="size-4" />
        </Button>
        {day !== todayISO() && (
          <Button variant="ghost" onClick={() => setDay(todayISO())}>
            {t('common.today')}
          </Button>
        )}
        <select
          className="input ml-auto w-auto"
          value={locationId ?? ''}
          onChange={(e) => setLocationId(e.target.value || null)}
          aria-label={t('stock.location')}
        >
          <option value="">{t('stock.allLocations')}</option>
          {locations.data.map((l) => (
            <option key={l.id} value={l.id}>
              {displayName(l)}
            </option>
          ))}
        </select>
      </div>

      <ErrorBox error={report.error} />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label={t('report.received')} value={formatKg(totals.received)} icon={<ArrowDownToLine className="size-6" />} />
        <StatCard
          label={t('report.adjusted')}
          value={formatKg(totals.adjusted)}
          icon={<Trash2 className="size-6" />}
          tone={totals.adjusted < 0 ? 'amber' : 'neutral'}
        />
        <StatCard label={t('report.closing')} value={formatKg(totals.closing)} icon={<Scale className="size-6" />} tone="neutral" />
      </div>

      {alerts.length > 0 && (
        <div className="mb-5 rounded-card border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" /> {t('report.alerts')}
          </div>
          <ul className="list-disc pl-5">
            {alerts.map((a) => (
              <li key={`${a.variety_id}:${a.location_id}`}>
                {displayName({ name: a.variety_name, name_ta: a.variety_name_ta })}
                {locationId === null &&
                  ` (${displayName({ name: a.location_name, name_ta: a.location_name_ta })})`}
                :{' '}
                {Number(a.closing_kg) < 0
                  ? t('report.negativeClosing', { kg: formatKg(a.closing_kg) })
                  : t('report.adjustedAlert', { kg: formatKg(a.adjusted_kg) })}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.isLoading ? (
        <Spinner />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          empty={t('report.empty')}
          footer={
            rows.length > 0 ? (
              <tr className="font-semibold">
                <td className="px-3 py-3">{t('common.total')}</td>
                {locationId === null && <td />}
                <td className="num px-3 py-3 text-right">{formatNumber(totals.opening)}</td>
                <td className="num px-3 py-3 text-right">{formatNumber(totals.received)}</td>
                <td className="num px-3 py-3 text-right">{formatNumber(totals.adjusted)}</td>
                <td className="num px-3 py-3 text-right">{formatNumber(totals.transferred)}</td>
                <td className="num px-3 py-3 text-right">{formatNumber(totals.closing)}</td>
              </tr>
            ) : undefined
          }
        />
      )}
    </div>
  )
}
