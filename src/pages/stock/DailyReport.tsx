import { AlertTriangle, ChevronLeft, ChevronRight, Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DataTable } from '../../components/DataTable'
import { columnHelper } from '../../lib/table'
import { Button, ErrorBox, PageHeader, Spinner, StatCard } from '../../components/ui'
import { addDays, formatDate, formatKg, formatNumber, todayISO } from '../../lib/format'
import { useDailyReport } from '../../lib/queries'
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
const columns = h.columns([
  h.accessor('variety_name', {
    header: 'Item',
    cell: (c) => (
      <div className="flex items-center gap-2">
        <span className="text-lg">{c.row.original.fruit_emoji}</span>
        <div>
          <div className="font-semibold">{c.getValue()}</div>
          <div className="text-2xs text-muted">{c.row.original.fruit_name}</div>
        </div>
      </div>
    ),
  }),
  h.accessor('opening_kg', { header: 'Opening', meta: { align: 'right' }, cell: (c) => num(c.getValue()) }),
  h.accessor('received_kg', { header: 'Received', meta: { align: 'right' }, cell: (c) => num(c.getValue(), true) }),
  h.accessor('adjusted_kg', { header: 'Adjusted', meta: { align: 'right' }, cell: (c) => num(c.getValue(), true) }),
  h.accessor('closing_kg', {
    header: 'Closing',
    meta: { align: 'right' },
    cell: (c) => <b className={Number(c.getValue()) < 0 ? 'text-danger' : ''}>{formatNumber(c.getValue())}</b>,
  }),
])

export function DailyReport() {
  const [day, setDay] = useState(todayISO())
  const report = useDailyReport(day)
  const rows = useMemo(() => report.data ?? [], [report.data])

  const totals = useMemo(
    () =>
      rows.reduce(
        (t, r) => ({
          opening: t.opening + Number(r.opening_kg),
          received: t.received + Number(r.received_kg),
          adjusted: t.adjusted + Number(r.adjusted_kg),
          closing: t.closing + Number(r.closing_kg),
        }),
        { opening: 0, received: 0, adjusted: 0, closing: 0 },
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
        title="Daily report"
        subtitle={`End-of-day stock summary for ${formatDate(`${day}T12:00:00+05:30`)}`}
        actions={
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="size-4" /> Print
          </Button>
        }
      />

      <div className="no-print mb-5 flex items-center gap-2">
        <Button variant="secondary" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day">
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
          aria-label="Next day"
        >
          <ChevronRight className="size-4" />
        </Button>
        {day !== todayISO() && (
          <Button variant="ghost" onClick={() => setDay(todayISO())}>
            Today
          </Button>
        )}
      </div>

      <ErrorBox error={report.error} />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Received" value={formatKg(totals.received)} icon={<ArrowDownToLine className="size-6" />} />
        <StatCard
          label="Adjusted / wastage"
          value={formatKg(totals.adjusted)}
          icon={<Trash2 className="size-6" />}
          tone={totals.adjusted < 0 ? 'amber' : 'neutral'}
        />
        <StatCard label="Closing stock" value={formatKg(totals.closing)} icon={<Scale className="size-6" />} tone="neutral" />
      </div>

      {alerts.length > 0 && (
        <div className="mb-5 rounded-card border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" /> Variance alerts
          </div>
          <ul className="list-disc pl-5">
            {alerts.map((a) => (
              <li key={a.variety_id}>
                {a.variety_name}:{' '}
                {Number(a.closing_kg) < 0
                  ? `closing stock is negative (${formatKg(a.closing_kg)})`
                  : `adjusted ${formatKg(a.adjusted_kg)}, more than 5% of available stock`}
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
          empty="No stock movements up to this day."
          footer={
            rows.length > 0 ? (
              <tr className="font-semibold">
                <td className="px-3 py-3">Total</td>
                <td className="num px-3 py-3 text-right">{formatNumber(totals.opening)}</td>
                <td className="num px-3 py-3 text-right">{formatNumber(totals.received)}</td>
                <td className="num px-3 py-3 text-right">{formatNumber(totals.adjusted)}</td>
                <td className="num px-3 py-3 text-right">{formatNumber(totals.closing)}</td>
              </tr>
            ) : undefined
          }
        />
      )}
    </div>
  )
}
