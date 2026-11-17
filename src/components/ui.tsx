import { Loader2, X } from 'lucide-react'
import {
  useEffect,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { imageUrl } from '../lib/supabase'
import type { OrderStatus } from '../lib/types'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'md' | 'sm' | 'lg'

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-[linear-gradient(135deg,#3A9A62,#2E7D4F)] text-white shadow-[0_2px_8px_rgba(46,125,79,0.28)] hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(46,125,79,0.3)]',
  secondary: 'border border-border bg-surface text-ink hover:bg-surface-low',
  danger: 'border border-border bg-surface text-danger hover:bg-danger-soft',
  ghost: 'text-muted hover:bg-surface-low hover:text-ink',
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-xs gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-14 px-6 text-base gap-2.5',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-button font-semibold transition disabled:pointer-events-none disabled:opacity-50 ${variantClass[variant]} ${sizeClass[size]} ${className}`}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Spinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted">
      <Loader2 className="size-5 animate-spin text-primary" />
      <span>{label}</span>
    </div>
  )
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null
  const msg =
    typeof error === 'object' && error && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error)
  return (
    <div className="rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
      {msg}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      {icon && <div className="text-4xl">{icon}</div>}
      <div className="text-base font-semibold">{title}</div>
      {hint && <div className="max-w-sm text-muted">{hint}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Section({
  title,
  actions,
  children,
  className = '',
  bodyClassName = 'p-5',
}: {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          {actions}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative flex max-h-[92vh] w-full flex-col rounded-t-modal bg-surface shadow-modal sm:rounded-modal ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
      >
        <div className="flex items-center justify-between border-b border-border px-[22px] py-[18px]">
          <h3 className="text-md font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="-mr-2 flex size-10 cursor-pointer items-center justify-center rounded-button text-muted hover:bg-surface-low"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-[22px] py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-border px-[22px] py-4">{footer}</div>
        )}
      </div>
    </div>
  )
}

const statusStyle: Record<OrderStatus, string> = {
  pending: 'bg-warning-soft text-warning',
  fulfilled: 'bg-primary-soft text-primary-ink',
  cancelled: 'bg-surface-low text-muted',
}

export function StatusChip({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-2xs font-semibold capitalize ${statusStyle[status]}`}
    >
      {status}
    </span>
  )
}

export function Chip({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'green' | 'amber' | 'red'
  children: ReactNode
}) {
  const tones = {
    neutral: 'bg-surface-low text-muted',
    green: 'bg-primary-soft text-primary-ink',
    amber: 'bg-warning-soft text-warning',
    red: 'bg-danger-soft text-danger',
  }
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-2xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

export function Thumb({
  emoji,
  imagePath,
  size = 'md',
  alt = '',
}: {
  emoji?: string | null
  imagePath?: string | null
  size?: 'sm' | 'md' | 'lg'
  alt?: string
}) {
  const url = imageUrl(imagePath)
  const box = { sm: 'size-8 text-lg', md: 'size-12 text-3xl', lg: 'size-16 text-[40px]' }[size]
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-surface-low ${box}`}
    >
      {url ? (
        <img src={url} alt={alt} className="size-full object-cover" loading="lazy" />
      ) : (
        <span aria-hidden>{emoji || '🍏'}</span>
      )}
    </span>
  )
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-2xs text-muted">{hint}</span>}
    </label>
  )
}

export function StatCard({
  label,
  value,
  icon,
  tone = 'green',
}: {
  label: string
  value: ReactNode
  icon: ReactNode
  tone?: 'green' | 'amber' | 'neutral'
}) {
  const tones = {
    green: 'bg-primary-soft text-primary',
    amber: 'bg-warning-soft text-warning',
    neutral: 'bg-surface-low text-muted',
  }
  return (
    <div className="card flex items-center gap-4 p-4 sm:p-5">
      <div className={`flex size-12 items-center justify-center rounded-[12px] ${tones[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}</div>
        <div className="num truncate text-xl font-semibold sm:text-2xl">{value}</div>
      </div>
    </div>
  )
}
