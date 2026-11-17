import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { messages, type MessageKey } from './messages'
import type { Locale, MessageVars, TranslateFn } from './types'

const STORAGE_KEY = 'asc-fruits-lang'

type Named = { name: string; name_ta?: string | null }

type LanguageContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: TranslateFn
  displayName: (entity: Named | null | undefined, fallback?: string) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function readStoredLocale(): Locale {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'en' || v === 'ta') return v
  } catch {
    /* ignore */
  }
  return 'en'
}

function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] !== undefined ? String(vars[key]) : `{${key}}`,
  )
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    typeof window === 'undefined' ? 'en' : readStoredLocale(),
  )

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale === 'ta' ? 'ta' : 'en'
  }, [locale])

  const t = useCallback<TranslateFn>(
    (key, vars) => {
      const dict = messages[locale]
      const fallback = messages.en
      const template =
        (dict as Record<string, string>)[key] ??
        (fallback as Record<string, string>)[key] ??
        key
      return interpolate(template, vars)
    },
    [locale],
  )

  const displayName = useCallback(
    (entity: Named | null | undefined, fallback = '') => {
      if (!entity) return fallback
      if (locale === 'ta' && entity.name_ta?.trim()) return entity.name_ta.trim()
      return entity.name || fallback
    },
    [locale],
  )

  const value = useMemo(
    () => ({ locale, setLocale, t, displayName }),
    [locale, setLocale, t, displayName],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}

export function useT() {
  return useLanguage().t
}

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useLanguage()
  return (
    <div
      className={`inline-flex rounded-button border border-border bg-surface p-0.5 ${className}`}
      role="group"
      aria-label={t('lang.label')}
    >
      {(['en', 'ta'] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          className={`h-8 cursor-pointer rounded-[8px] px-2.5 text-2xs font-semibold transition ${
            locale === code
              ? 'bg-primary text-white'
              : 'text-muted hover:bg-surface-low hover:text-ink'
          }`}
        >
          {t(code === 'en' ? 'lang.en' : 'lang.ta')}
        </button>
      ))}
    </div>
  )
}

export function varietyCountLabel(t: TranslateFn, count: number) {
  return t(count === 1 ? 'common.varietyCount_one' : 'common.varietyCount_other', { count })
}

export type { MessageKey, Locale, TranslateFn }
