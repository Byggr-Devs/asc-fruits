import { Search, Store } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useLanguage } from '../i18n/LanguageProvider'
import type { Vendor } from '../lib/types'
import { EmptyState } from './ui'

export function VendorPicker({
  vendors,
  onPick,
  badge,
}: {
  vendors: Vendor[]
  onPick: (vendor: Vendor) => void
  badge?: (vendor: Vendor) => React.ReactNode
}) {
  const { t, displayName } = useLanguage()
  const [query, setQuery] = useState('')
  const active = vendors.filter((v) => v.active)
  const q = query.trim().toLowerCase()
  const shown = q
    ? active.filter((v) => {
        const hay = [v.name, v.name_ta, v.contact_person].filter(Boolean).join(' ').toLowerCase()
        return hay.includes(q)
      })
    : active

  if (active.length === 0) {
    return (
      <EmptyState
        icon={<Store className="size-10 text-muted" />}
        title={t('picker.noVendors')}
        hint={t('picker.noVendorsHint')}
        action={
          <Link to="/vendors" className="font-semibold text-primary underline">
            {t('picker.goVendors')}
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-3">
      {active.length > 6 && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            className="input pl-9"
            placeholder={t('picker.searchVendor')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((v) => {
          const label = displayName(v)
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onPick(v)}
              className="flex min-h-[72px] cursor-pointer items-center gap-3 rounded-card border-2 border-border bg-surface p-3 text-left transition hover:border-primary hover:bg-primary-soft/40"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-lg font-bold text-primary-ink">
                {label.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{label}</span>
                <span className="block truncate text-2xs text-muted">
                  {[v.contact_person, v.phone].filter(Boolean).join(' · ') || t('picker.noContact')}
                </span>
              </span>
              {badge?.(v)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
