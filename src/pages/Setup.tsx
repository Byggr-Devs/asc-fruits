import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { Navigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { BrandMark } from '../components/Brand'
import { Button } from '../components/ui'
import { LanguageToggle, useT } from '../i18n/LanguageProvider'
import { AuthLayout } from './Login'

const PROJECT_REF = new URL(import.meta.env.VITE_SUPABASE_URL as string).hostname.split('.')[0]
const USERS_URL = `https://supabase.com/dashboard/project/${PROJECT_REF}/auth/users`

export function Setup() {
  const { hasUsers, refetchHasUsers } = useAuth()
  const t = useT()
  if (hasUsers) return <Navigate to="/login" replace />

  const steps = [
    <>
      {t('setup.step1Before')}{' '}
      <a href={USERS_URL} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">
        {t('setup.step1Link')}
      </a>{' '}
      {t('setup.step1After')}
    </>,
    t('setup.step2'),
    t('setup.step3'),
    t('setup.step4'),
  ]

  return (
    <AuthLayout wide>
      <div className="mb-4 flex justify-end">
        <LanguageToggle />
      </div>
      <div className="flex items-center gap-3">
        <BrandMark className="size-12" />
        <div>
          <h1 className="text-xl font-bold">{t('setup.title')}</h1>
          <p className="text-muted">{t('setup.subtitle')}</p>
        </div>
      </div>

      <p className="mt-5 text-muted">{t('setup.intro')}</p>

      <ol className="mt-5 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-ink">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a
          href={USERS_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-button bg-[linear-gradient(135deg,#3A9A62,#2E7D4F)] px-4 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(46,125,79,0.28)] transition hover:-translate-y-px"
        >
          {t('setup.openSupabase')} <ExternalLink className="size-4" />
        </a>
        <Button variant="secondary" onClick={refetchHasUsers}>
          <RefreshCw className="size-4" /> {t('setup.checkAgain')}
        </Button>
      </div>

      <div className="mt-5 flex items-center gap-2 text-xs text-muted">
        <Loader2 className="size-3.5 animate-spin text-primary" />
        {t('setup.waiting')}
      </div>
    </AuthLayout>
  )
}
