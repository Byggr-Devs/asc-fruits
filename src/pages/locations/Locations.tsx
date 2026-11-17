import { useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DataTable } from '../../components/DataTable'
import { useToast } from '../../components/toast'
import { Button, Chip, ErrorBox, Field, Modal, PageHeader, Spinner } from '../../components/ui'
import { useLanguage } from '../../i18n/LanguageProvider'
import { keys, useLocations } from '../../lib/queries'
import { errorMessage, supabase } from '../../lib/supabase'
import { columnHelper } from '../../lib/table'
import type { Location } from '../../lib/types'

type LocationRow = Location & { locationName: string }

const h = columnHelper<LocationRow>()

export function Locations() {
  const { t, displayName } = useLanguage()
  const locations = useLocations()
  const [editing, setEditing] = useState<Location | 'new' | null>(null)

  const rows = useMemo<LocationRow[]>(
    () => (locations.data ?? []).map((l) => ({ ...l, locationName: displayName(l) })),
    [locations.data, displayName],
  )

  const columns = useMemo(
    () =>
      h.columns([
        h.accessor('locationName', {
          header: t('locations.colName'),
          cell: (c) => <div className="font-semibold">{c.getValue()}</div>,
        }),
        h.accessor('sort_order', {
          header: t('locations.colOrder'),
          meta: { align: 'right' },
        }),
        h.accessor('active', {
          header: t('locations.colStatus'),
          cell: (c) =>
            c.getValue() ? (
              <Chip tone="green">{t('common.active')}</Chip>
            ) : (
              <Chip>{t('common.inactive')}</Chip>
            ),
        }),
      ]),
    [t],
  )

  if (locations.isLoading) return <Spinner />

  return (
    <div>
      <PageHeader
        title={t('locations.title')}
        subtitle={t('locations.subtitle')}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> {t('locations.add')}
          </Button>
        }
      />
      <ErrorBox error={locations.error} />
      <DataTable
        data={rows}
        columns={columns}
        searchPlaceholder={t('locations.search')}
        onRowClick={(l) => setEditing(l)}
        initialSorting={[{ id: 'sort_order', desc: false }]}
        empty={t('locations.empty')}
      />
      {editing && (
        <LocationForm
          location={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function LocationForm({ location, onClose }: { location: Location | null; onClose: () => void }) {
  const { t, displayName } = useLanguage()
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState({
    name: location?.name ?? '',
    name_ta: location?.name_ta ?? '',
    sort_order: String(location?.sort_order ?? 0),
    active: location?.active ?? true,
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const set = (k: 'name' | 'name_ta' | 'sort_order') => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    if (!form.name.trim()) return setErr(t('locations.enterName'))
    setBusy(true)
    setErr(null)
    const row = {
      name: form.name.trim(),
      name_ta: form.name_ta.trim() || null,
      sort_order: Number.parseInt(form.sort_order, 10) || 0,
      active: form.active,
    }
    try {
      if (location) {
        const { error } = await supabase.from('locations').update(row).eq('id', location.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('locations').insert(row)
        if (error) throw error
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.locations }),
        qc.invalidateQueries({ queryKey: keys.stock }),
      ])
      toast(t('common.saved', { name: row.name }))
      onClose()
    } catch (e) {
      setErr(errorMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!location || !confirm(t('common.confirmDelete', { name: displayName(location) }))) return
    setBusy(true)
    setErr(null)
    const { error } = await supabase.from('locations').delete().eq('id', location.id)
    setBusy(false)
    if (error) {
      // FK restrict (stock movements / allocations reference this location)
      return setErr(error.code === '23503' ? t('locations.cannotDelete') : errorMessage(error, t))
    }
    await Promise.all([
      qc.invalidateQueries({ queryKey: keys.locations }),
      qc.invalidateQueries({ queryKey: keys.stock }),
    ])
    toast(t('common.deleted', { name: displayName(location) }))
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={location ? t('locations.edit', { name: displayName(location) }) : t('locations.add')}
      footer={
        <>
          {location && (
            <Button variant="danger" onClick={remove} disabled={busy} className="mr-auto">
              <Trash2 className="size-4" /> {t('common.delete')}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save} loading={busy}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label={t('common.nameEn')}>
          <input className="input" autoFocus value={form.name} onChange={set('name')} />
        </Field>
        <Field label={t('common.nameTa')}>
          <input className="input" value={form.name_ta} onChange={set('name_ta')} />
        </Field>
        <Field label={t('locations.displayOrder')}>
          <input
            className="input num"
            type="number"
            inputMode="numeric"
            value={form.sort_order}
            onChange={set('sort_order')}
          />
        </Field>
        <label className="flex h-11 cursor-pointer items-center gap-2 self-end select-none">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          />
          <span className="font-medium">{t('locations.active')}</span>
        </label>
      </div>
      {err && <div className="mt-4 rounded-input bg-danger-soft px-3 py-2 text-danger">{err}</div>}
    </Modal>
  )
}
