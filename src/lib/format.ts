const kgFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 })
const moneyFormat = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})
const plainMoney = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const TIME_ZONE = 'Asia/Kolkata'

export function formatKg(n: number | null | undefined): string {
  return `${kgFormat.format(Number(n ?? 0))} kg`
}

export function formatNumber(n: number | null | undefined): string {
  return kgFormat.format(Number(n ?? 0))
}

export function formatMoney(n: number | null | undefined): string {
  return moneyFormat.format(Number(n ?? 0))
}

/** PDF-safe money (the built-in PDF fonts have no rupee glyph). */
export function formatMoneyPlain(n: number | null | undefined): string {
  return `Rs. ${plainMoney.format(Number(n ?? 0))}`
}

export function orderNo(n: number): string {
  return `ORD-${String(n).padStart(4, '0')}`
}

export function deliveryNo(n: number): string {
  return `DEL-${String(n).padStart(4, '0')}`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: TIME_ZONE,
  })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  })
}

/** Today's date (YYYY-MM-DD) in the business time zone. */
export function todayISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIME_ZONE })
}

/** Start of the given business day (YYYY-MM-DD) as an ISO timestamp. */
export function dayStartISO(day: string): string {
  return new Date(`${day}T00:00:00+05:30`).toISOString()
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00+05:30`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toLocaleDateString('en-CA', { timeZone: TIME_ZONE })
}

export function parseQty(value: string): number {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}
