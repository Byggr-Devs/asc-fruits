import { useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Phone, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DataTable } from '../../components/DataTable'
import { columnHelper } from '../../lib/table'
import { useToast } from '../../components/toast'
import { useLanguage } from '../../i18n/LanguageProvider'
import { Button, Chip, ErrorBox, Field, Modal, PageHeader, Spinner, Thumb } from '../../components/ui'
import { keys, useCatalog, useVendors, useVendorVarieties } from '../../lib/queries'
import { errorMessage, supabase } from '../../lib/supabase'
import type { Vendor } from '../../lib/types'

type VendorRow = Vendor & { vendorName: string; varietyCount: number }

const h = columnHelper<VendorRow>()

export function Vendors() {
  const { t, displayName } = useLanguage()
  const vendors = useVendors()
  const mapping = useVendorVarieties()
  const [editing, setEditing] = useState<Vendor | 'new' | null>(null)

  const rows = useMemo<VendorRow[]>(() => {
    const counts = new Map<string, number>()
    for (const m of mapping.data ?? []) counts.set(m.vendor_id, (counts.get(m.vendor_id) ?? 0) + 1)
    return (vendors.data ?? []).map((v) => ({
      ...v,
      vendorName: displayName(v),
      varietyCount: counts.get(v.id) ?? 0,
    }))
  }, [vendors.data, mapping.data, displayName])

  const columns = useMemo(
    () =>
      h.columns([
        h.accessor('vendorName', {
          header: t('vendors.colVendor'),
          cell: (c) => (
            <div>
              <div className="font-semibold">{c.getValue()}</div>
              {c.row.original.contact_person && (
                <div className="text-2xs text-muted">{c.row.original.contact_person}</div>
              )}
            </div>
          ),
        }),
        h.accessor('phone', {
          header: t('vendors.colPhone'),
          cell: (c) =>
            c.getValue() ? (
              <a
                href={`tel:${c.getValue()}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 text-primary"
              >
                <Phone className="size-3.5" /> {c.getValue()}
              </a>
            ) : (
              <span className="text-muted">-</span>
            ),
        }),
        h.accessor('whatsapp', {
          header: t('vendors.colWhatsapp'),
          cell: (c) =>
            c.getValue() ? (
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="size-3.5 text-primary" /> {c.getValue()}
              </span>
            ) : (
              <span className="text-muted">-</span>
            ),
        }),
        h.accessor('varietyCount', {
          header: t('vendors.colSupplies'),
          meta: { align: 'right' },
          cell: (c) => t('common.varietiesCount', { count: c.getValue() }),
        }),
        h.accessor('active', {
          header: t('vendors.colStatus'),
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

  if (vendors.isLoading) return <Spinner />

  return (
    <div>
      <PageHeader
        title={t('vendors.title')}
        subtitle={t('vendors.subtitle')}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> {t('vendors.add')}
          </Button>
        }
      />
      <ErrorBox error={vendors.error} />
      <DataTable
        data={rows}
        columns={columns}
        searchPlaceholder={t('vendors.search')}
        onRowClick={(v) => setEditing(v)}
        initialSorting={[{ id: 'vendorName', desc: false }]}
        empty={t('vendors.empty')}
      />
      {editing && (
        <VendorForm vendor={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

function VendorForm({ vendor, onClose }: { vendor: Vendor | null; onClose: () => void }) {
  const { t, displayName } = useLanguage()
  const qc = useQueryClient()
  const toast = useToast()
  const { fruits, varieties } = useCatalog()
  const mapping = useVendorVarieties()
  const [form, setForm] = useState({
    name: vendor?.name ?? '',
    name_ta: vendor?.name_ta ?? '',
    contact_person: vendor?.contact_person ?? '',
    phone: vendor?.phone ?? '',
    whatsapp: vendor?.whatsapp ?? '',
    address: vendor?.address ?? '',
    notes: vendor?.notes ?? '',
    active: vendor?.active ?? true,
  })
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        (mapping.data ?? []).filter((m) => m.vendor_id === vendor?.id).map((m) => m.variety_id),
      ),
  )
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleFruit(fruitId: string, on: boolean) {
    setSelected((s) => {
      const next = new Set(s)
      for (const v of varieties) {
        if (v.fruit_id !== fruitId) continue
        if (on) next.add(v.id)
        else next.delete(v.id)
      }
      return next
    })
  }

  async function save() {
    if (!form.name.trim()) return setErr(t('vendors.enterName'))
    setBusy(true)
    setErr(null)
    const row = {
      name: form.name.trim(),
      name_ta: form.name_ta.trim() || null,
      contact_person: form.contact_person.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || form.phone.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      active: form.active,
    }
    try {
      let id = vendor?.id
      if (id) {
        const { error } = await supabase.from('vendors').update(row).eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('vendors').insert(row).select('id').single()
        if (error) throw error
        id = data.id as string
      }
      const del = await supabase.from('vendor_varieties').delete().eq('vendor_id', id)
      if (del.error) throw del.error
      if (selected.size) {
        const ins = await supabase
          .from('vendor_varieties')
          .insert([...selected].map((variety_id) => ({ vendor_id: id, variety_id })))
        if (ins.error) throw ins.error
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.vendors }),
        qc.invalidateQueries({ queryKey: keys.vendorVarieties }),
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
    if (!vendor || !confirm(t('common.confirmDelete', { name: displayName(vendor) }))) return
    setBusy(true)
    const { error } = await supabase.from('vendors').delete().eq('id', vendor.id)
    setBusy(false)
    if (error) return setErr(errorMessage(error, t))
    await qc.invalidateQueries({ queryKey: keys.vendors })
    toast(t('common.deleted', { name: displayName(vendor) }))
    onClose()
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={vendor ? t('vendors.edit', { name: displayName(vendor) }) : t('vendors.add')}
      footer={
        <>
          {vendor && (
            <Button variant="danger" onClick={remove} disabled={busy} className="mr-auto">
              <Trash2 className="size-4" /> {t('common.delete')}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save} loading={busy}>
            {t('vendors.save')}
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
        <Field label={t('vendors.contact')}>
          <input className="input" value={form.contact_person} onChange={set('contact_person')} />
        </Field>
        <Field label={t('vendors.phone')}>
          <input className="input" type="tel" value={form.phone} onChange={set('phone')} />
        </Field>
        <Field label={t('vendors.whatsapp')} hint={t('vendors.whatsappHint')}>
          <input className="input" type="tel" value={form.whatsapp} onChange={set('whatsapp')} />
        </Field>
        <Field label={t('vendors.address')}>
          <input className="input" value={form.address} onChange={set('address')} />
        </Field>
        <Field label={t('vendors.notes')}>
          <input className="input" value={form.notes} onChange={set('notes')} />
        </Field>
        <label className="flex h-11 cursor-pointer items-center gap-2 select-none">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          />
          <span className="font-medium">{t('vendors.active')}</span>
        </label>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="label mb-0">{t('vendors.varietiesSupplied', { count: selected.size })}</span>
        </div>
        <div className="space-y-3">
          {fruits.map((f) => {
            const fv = varieties.filter((v) => v.fruit_id === f.id)
            if (!fv.length) return null
            const all = fv.every((v) => selected.has(v.id))
            return (
              <div key={f.id} className="rounded-card border border-border p-3">
                <label className="mb-2 flex cursor-pointer items-center gap-2 font-semibold select-none">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={all}
                    onChange={(e) => toggleFruit(f.id, e.target.checked)}
                  />
                  <Thumb emoji={f.emoji} imagePath={f.image_path} size="sm" /> {displayName(f)}
                </label>
                <div className="flex flex-wrap gap-2">
                  {fv.map((v) => {
                    const on = selected.has(v.id)
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => toggle(v.id)}
                        className={`h-10 cursor-pointer rounded-full border px-3.5 text-xs font-semibold transition ${on ? 'border-primary bg-primary-soft text-primary-ink' : 'border-border text-muted hover:bg-surface-low'}`}
                      >
                        {displayName(v)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {err && <div className="mt-4 rounded-input bg-danger-soft px-3 py-2 text-danger">{err}</div>}
    </Modal>
  )
}
