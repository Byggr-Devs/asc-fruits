import { useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useToast } from '../../components/toast'
import {
  Button,
  Chip,
  EmptyState,
  ErrorBox,
  Field,
  Modal,
  PageHeader,
  Section,
  Spinner,
  Thumb,
} from '../../components/ui'
import { keys, useCatalog } from '../../lib/queries'
import { errorMessage, imageUrl, supabase, uploadImage } from '../../lib/supabase'
import type { Fruit, Variety } from '../../lib/types'

const FRUIT_EMOJIS = ['🍎', '🍏', '🥭', '🍌', '🍊', '🍋', '🍇', '🍉', '🍍', '🍓', '🍒', '🍑', '🍐', '🥝', '🥥', '🫐', '🍈', '🥑', '🔴', '🟢']

type Editing =
  | { kind: 'fruit'; item: Fruit | null }
  | { kind: 'variety'; item: Variety | null; fruitId: string }

export function Catalog() {
  const { fruits, varieties, isLoading, error } = useCatalog()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)

  const selected = fruits.find((f) => f.id === selectedId) ?? fruits[0] ?? null
  const fruitVarieties = varieties.filter((v) => v.fruit_id === selected?.id)

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Fruits & Varieties"
        subtitle="Tap a fruit to see and manage its varieties."
        actions={
          <Button onClick={() => setEditing({ kind: 'fruit', item: null })}>
            <Plus className="size-4" /> Add fruit
          </Button>
        }
      />
      <ErrorBox error={error} />

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
        {fruits.map((f) => {
          const count = varieties.filter((v) => v.fruit_id === f.id).length
          const active = f.id === selected?.id
          return (
            <button
              key={f.id}
              onClick={() => setSelectedId(f.id)}
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 bg-surface p-3 transition ${active ? 'border-primary bg-primary-soft' : 'border-border hover:border-primary/40'} ${f.active ? '' : 'opacity-50'}`}
            >
              <Thumb emoji={f.emoji} imagePath={f.image_path} size="lg" alt={f.name} />
              <span className="text-center text-sm leading-tight font-semibold">{f.name}</span>
              <span className="text-2xs text-muted">
                {count} {count === 1 ? 'variety' : 'varieties'}
              </span>
            </button>
          )
        })}
        <button
          onClick={() => setEditing({ kind: 'fruit', item: null })}
          className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-border text-muted transition hover:border-primary hover:text-primary"
        >
          <Plus className="size-7" />
          <span className="text-xs font-semibold">Add fruit</span>
        </button>
      </div>

      {selected && (
        <Section
          className="mt-6"
          title={
            <span className="flex items-center gap-2">
              <Thumb emoji={selected.emoji} imagePath={selected.image_path} size="sm" />
              {selected.name} varieties
              {!selected.active && <Chip>Inactive</Chip>}
            </span>
          }
          actions={
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditing({ kind: 'fruit', item: selected })}
              >
                <Pencil className="size-3.5" /> Edit fruit
              </Button>
              <Button
                size="sm"
                onClick={() => setEditing({ kind: 'variety', item: null, fruitId: selected.id })}
              >
                <Plus className="size-3.5" /> Add variety
              </Button>
            </div>
          }
        >
          {fruitVarieties.length === 0 ? (
            <EmptyState icon={selected.emoji} title="No varieties yet" hint="Add the first variety." />
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {fruitVarieties.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setEditing({ kind: 'variety', item: v, fruitId: selected.id })}
                  className={`flex cursor-pointer items-center gap-3 rounded-card border border-border bg-surface p-3 text-left transition hover:border-primary/50 hover:bg-surface-low ${v.active ? '' : 'opacity-50'}`}
                >
                  <Thumb
                    emoji={v.emoji || selected.emoji}
                    imagePath={v.image_path || selected.image_path}
                    alt={v.name}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{v.name}</span>
                    {!v.active && <span className="text-2xs text-muted">Inactive</span>}
                  </span>
                  <Pencil className="size-4 text-muted" />
                </button>
              ))}
            </div>
          )}
        </Section>
      )}

      {editing && (
        <CatalogItemModal
          editing={editing}
          fruitEmoji={selected?.emoji}
          onClose={() => setEditing(null)}
          onSaved={(id) => editing.kind === 'fruit' && setSelectedId(id)}
        />
      )}
    </div>
  )
}

function CatalogItemModal({
  editing,
  fruitEmoji,
  onClose,
  onSaved,
}: {
  editing: Editing
  fruitEmoji?: string
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const item = editing.item
  const isFruit = editing.kind === 'fruit'
  const [name, setName] = useState(item?.name ?? '')
  const [emoji, setEmoji] = useState(item?.emoji ?? (isFruit ? '🍎' : ''))
  const [imagePath, setImagePath] = useState<string | null>(item?.image_path ?? null)
  const [active, setActive] = useState(item?.active ?? true)
  const [sortOrder, setSortOrder] = useState(String(isFruit ? ((item as Fruit | null)?.sort_order ?? 0) : 0))
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const table = isFruit ? 'fruits' : 'varieties'
  const label = isFruit ? 'fruit' : 'variety'

  async function onFile(file: File | undefined) {
    if (!file) return
    setUploading(true)
    setErr(null)
    try {
      setImagePath(await uploadImage(file, isFruit ? 'fruits' : 'varieties'))
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    if (!name.trim()) return setErr('Please enter a name.')
    setBusy(true)
    setErr(null)
    const row: Record<string, unknown> = {
      name: name.trim(),
      emoji: emoji.trim() || (isFruit ? '🍎' : null),
      image_path: imagePath,
      active,
    }
    if (isFruit) row.sort_order = Number.parseInt(sortOrder, 10) || 0
    else row.fruit_id = editing.fruitId

    const res = item
      ? await supabase.from(table).update(row).eq('id', item.id).select('id').single()
      : await supabase.from(table).insert(row).select('id').single()
    setBusy(false)
    if (res.error) return setErr(errorMessage(res.error))
    await qc.invalidateQueries({ queryKey: isFruit ? keys.fruits : keys.varieties })
    qc.invalidateQueries({ queryKey: keys.stock })
    toast(`${name.trim()} saved`)
    onSaved(res.data.id)
    onClose()
  }

  async function remove() {
    if (!item || !confirm(`Delete ${item.name}? This cannot be undone.`)) return
    setBusy(true)
    const { error } = await supabase.from(table).delete().eq('id', item.id)
    setBusy(false)
    if (error) return setErr(errorMessage(error))
    await qc.invalidateQueries({ queryKey: isFruit ? keys.fruits : keys.varieties })
    toast(`${item.name} deleted`)
    onClose()
  }

  const preview = imageUrl(imagePath)

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? `Edit ${label}` : `Add ${label}`}
      footer={
        <>
          {item && (
            <Button variant="danger" onClick={remove} disabled={busy} className="mr-auto">
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={uploading}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <input
            className="input"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isFruit ? 'e.g. Apple' : 'e.g. Kashmir Apple'}
          />
        </Field>

        <div>
          <span className="label">Picture</span>
          <div className="flex items-center gap-4">
            <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-card border border-border bg-surface-low text-5xl">
              {preview ? (
                <img src={preview} alt="" className="size-full object-cover" />
              ) : (
                emoji || fruitEmoji || '🍏'
              )}
            </span>
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <Button
                variant="secondary"
                size="sm"
                loading={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="size-4" /> {preview ? 'Change photo' : 'Upload photo'}
              </Button>
              {preview && (
                <Button variant="ghost" size="sm" onClick={() => setImagePath(null)}>
                  Use emoji instead
                </Button>
              )}
            </div>
          </div>
        </div>

        <div>
          <span className="label">Emoji {!isFruit && '(optional, defaults to the fruit emoji)'}</span>
          <div className="flex flex-wrap gap-1.5">
            {FRUIT_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`flex size-10 cursor-pointer items-center justify-center rounded-input border text-xl ${emoji === e ? 'border-primary bg-primary-soft' : 'border-border hover:bg-surface-low'}`}
              >
                {e}
              </button>
            ))}
            <input
              className="input h-10 w-20 text-center text-lg"
              value={emoji ?? ''}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="Other"
              maxLength={4}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          {isFruit && (
            <Field label="Display order">
              <input
                className="input w-28"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </Field>
          )}
          <label className="flex h-11 cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <span className="font-medium">Active</span>
            <span className="text-muted">(inactive items are hidden from new orders)</span>
          </label>
        </div>

        {err && <div className="rounded-input bg-danger-soft px-3 py-2 text-danger">{err}</div>}
      </div>
    </Modal>
  )
}
