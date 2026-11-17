import { useMemo, useState } from 'react'
import { DataTable } from '../../components/DataTable'
import { columnHelper } from '../../lib/table'
import { useLanguage } from '../../i18n/LanguageProvider'
import { Chip, ErrorBox, PageHeader, Spinner, Thumb } from '../../components/ui'
import {
  addDays,
  dayStartISO,
  deliveryNo,
  formatDateTime,
  formatNumber,
  todayISO,
} from '../../lib/format'
import { useActiveLocations, useCatalog, useMovements, type CatalogVariety } from '../../lib/queries'
import type { StockMovement } from '../../lib/types'

type Row = StockMovement & {
  variety: CatalogVariety | undefined
  varietyName: string
  fruitName: string
  refLabel: string
  locationName: string
}

const h = columnHelper<Row>()

export function Movements() {
  const { t, displayName } = useLanguage()
  const [from, setFrom] = useState(addDays(todayISO(), -6))
  const [to, setTo] = useState(todayISO())
  const [type, setType] = useState<'all' | 'receipt' | 'adjustment' | 'transfer'>('all')
  const [locationId, setLocationId] = useState<string>('all')
  const locations = useActiveLocations()
  const { varietyById } = useCatalog()
  const movements = useMovements({
    from: from ? dayStartISO(from) : undefined,
    to: to ? dayStartISO(addDays(to, 1)) : undefined,
    type,
    locationId,
  })

  const rows = useMemo<Row[]>(
    () =>
      (movements.data ?? []).map((m) => {
        const variety = varietyById.get(m.variety_id)
        return {
          ...m,
          variety,
          varietyName: displayName(variety, t('common.unknown')),
          fruitName: displayName(variety?.fruit),
          refLabel: m.delivery ? deliveryNo(m.delivery.delivery_no) : '',
          locationName: displayName(m.location, '-'),
        }
      }),
    [movements.data, varietyById, displayName, t],
  )

  const columns = useMemo(
    () =>
      h.columns([
        h.accessor('created_at', {
          header: t('movements.colWhen'),
          sortFn: 'datetime',
          cell: (c) => <span className="whitespace-nowrap">{formatDateTime(c.getValue())}</span>,
        }),
        h.accessor('varietyName', {
          header: t('movements.colItem'),
          cell: (c) => {
            const v = c.row.original.variety
            return (
              <div className="flex items-center gap-2.5">
                <Thumb
                  emoji={v?.emoji || v?.fruit.emoji}
                  imagePath={v?.image_path || v?.fruit.image_path}
                  size="sm"
                />
                <div>
                  <div className="font-semibold">{c.getValue()}</div>
                  <div className="text-2xs text-muted">{c.row.original.fruitName}</div>
                </div>
              </div>
            )
          },
        }),
        h.accessor('type', {
          header: t('movements.colType'),
          cell: (c) =>
            c.getValue() === 'receipt' ? (
              <Chip tone="green">{t('movement.received')}</Chip>
            ) : c.getValue() === 'transfer' ? (
              <Chip tone="neutral">{t('movement.transfer')}</Chip>
            ) : (
              <Chip tone={c.row.original.reason === 'wastage' ? 'red' : 'amber'}>
                {c.row.original.reason ? t(`reason.${c.row.original.reason}`) : t('reason.adjustment')}
              </Chip>
            ),
        }),
        h.accessor('locationName', {
          header: t('movements.colLocation'),
          cell: (c) => <span className="whitespace-nowrap">{c.getValue()}</span>,
        }),
        h.accessor('refLabel', {
          header: t('movements.colRef'),
          cell: (c) => (
            <span className="text-muted">
              {[c.getValue(), c.row.original.note].filter(Boolean).join(' · ') || '-'}
            </span>
          ),
        }),
        h.accessor('qty_kg', {
          header: t('movements.colQty'),
          meta: { align: 'right' },
          cell: (c) => {
            const n = Number(c.getValue())
            return (
              <span className={`font-semibold ${n < 0 ? 'text-danger' : 'text-primary'}`}>
                {n > 0 ? '+' : ''}
                {formatNumber(n)}
              </span>
            )
          },
        }),
      ]),
    [t],
  )

  const inKg = rows.filter((r) => r.qty_kg > 0).reduce((s, r) => s + Number(r.qty_kg), 0)
  const outKg = rows.filter((r) => r.qty_kg < 0).reduce((s, r) => s + Number(r.qty_kg), 0)

  return (
    <div>
      <PageHeader title={t('movements.title')} subtitle={t('movements.subtitle')} />
      <ErrorBox error={movements.error} />
      <DataTable
        data={rows}
        columns={columns}
        searchPlaceholder={t('movements.search')}
        initialSorting={[{ id: 'created_at', desc: true }]}
        empty={t('movements.empty')}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              className="input w-auto"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              aria-label={t('movements.fromDate')}
            />
            <span className="text-muted">{t('common.to')}</span>
            <input
              type="date"
              className="input w-auto"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              aria-label={t('movements.toDate')}
            />
            <select
              className="input w-auto"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              aria-label={t('movements.type')}
            >
              <option value="all">{t('movement.allTypes')}</option>
              <option value="receipt">{t('movement.received')}</option>
              <option value="adjustment">{t('movement.adjustments')}</option>
              <option value="transfer">{t('movement.transfers')}</option>
            </select>
            <select
              className="input w-auto"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              aria-label={t('stock.location')}
            >
              <option value="all">{t('stock.allLocations')}</option>
              {locations.data.map((l) => (
                <option key={l.id} value={l.id}>
                  {displayName(l)}
                </option>
              ))}
            </select>
          </div>
        }
        footer={
          rows.length > 0 ? (
            <tr className="font-semibold">
              <td className="px-3 py-3" colSpan={5}>
                {t('movements.in')}{' '}
                <span className="num text-primary">+{formatNumber(inKg)}</span> · {t('movements.out')}{' '}
                <span className="num text-danger">{formatNumber(outKg)}</span>
              </td>
              <td className="num px-3 py-3 text-right">{formatNumber(inKg + outKg)}</td>
            </tr>
          ) : undefined
        }
      />
      {movements.isLoading && <Spinner />}
    </div>
  )
}
