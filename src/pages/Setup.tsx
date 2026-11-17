import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { Navigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { BrandMark } from '../components/Brand'
import { Button } from '../components/ui'
import { AuthLayout } from './Login'

const PROJECT_REF = new URL(import.meta.env.VITE_SUPABASE_URL as string).hostname.split('.')[0]
const USERS_URL = `https://supabase.com/dashboard/project/${PROJECT_REF}/auth/users`

const steps = [
  <>
    Open the{' '}
    <a href={USERS_URL} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">
      Supabase Authentication &gt; Users
    </a>{' '}
    page for this project.
  </>,
  <>
    Click <b>Add user</b>, then <b>Create new user</b>.
  </>,
  <>
    Enter the person&apos;s <b>email</b> and a <b>password</b>, and keep <b>Auto Confirm User</b> ticked.
  </>,
  <>
    Click <b>Create user</b>. This page will notice automatically and take you to sign in.
  </>,
]

export function Setup() {
  const { hasUsers, refetchHasUsers } = useAuth()
  if (hasUsers) return <Navigate to="/login" replace />

  return (
    <AuthLayout wide>
      <div className="flex items-center gap-3">
        <BrandMark className="size-12" />
        <div>
          <h1 className="text-xl font-bold">Welcome to ASC Fruits</h1>
          <p className="text-muted">Let&apos;s set up your first user.</p>
        </div>
      </div>

      <p className="mt-5 text-muted">
        There is no sign up screen. Users are created by the owner in Supabase, and every user has
        full access for now.
      </p>

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
          Open Supabase <ExternalLink className="size-4" />
        </a>
        <Button variant="secondary" onClick={refetchHasUsers}>
          <RefreshCw className="size-4" /> Check again
        </Button>
      </div>

      <div className="mt-5 flex items-center gap-2 text-xs text-muted">
        <Loader2 className="size-3.5 animate-spin text-primary" />
        Waiting for the first user...
      </div>
    </AuthLayout>
  )
}
