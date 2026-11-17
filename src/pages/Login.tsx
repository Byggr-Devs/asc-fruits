import { LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { BrandMark } from '../components/Brand'
import { Button, Field } from '../components/ui'
import { LanguageToggle, useT } from '../i18n/LanguageProvider'
import { supabase } from '../lib/supabase'

export function Login() {
  const { hasUsers } = useAuth()
  const t = useT()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (hasUsers === false) return <Navigate to="/setup" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) {
      setError(
        error.message === 'Invalid login credentials' ? t('login.wrongCredentials') : error.message,
      )
    }
  }

  return (
    <AuthLayout>
      <div className="mb-4 flex justify-end">
        <LanguageToggle />
      </div>
      <div className="mb-6 flex flex-col items-center text-center">
        <BrandMark className="size-14" />
        <h1 className="mt-3 font-brand text-2xl font-bold text-primary-ink">ASC Fruits</h1>
        <p className="mt-1 text-muted">{t('login.subtitle')}</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label={t('login.email')}>
          <input
            className="input text-base"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label={t('login.password')}>
          <input
            className="input text-base"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && (
          <div className="rounded-input bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>
        )}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          <LogIn className="size-5" /> {t('login.signIn')}
        </Button>
      </form>
    </AuthLayout>
  )
}

export function AuthLayout({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#E3F1E8,#F6F8F5_60%)] p-4">
      <div className={`card w-full p-6 sm:p-8 ${wide ? 'max-w-xl' : 'max-w-sm'}`}>{children}</div>
    </div>
  )
}
