type Value = number | null | undefined
const nbsp = '\u00a0'
const number = (value: number, decimals: number) => new Intl.NumberFormat('sv-SE', {
  minimumFractionDigits: decimals, maximumFractionDigits: decimals,
}).format(value).replace(/-/g, '−').replace(/[\u202f ]/g, nbsp)
const valid = (value: Value): value is number => value != null && Number.isFinite(value)
const signed = (value: number, decimals = 1) => `${value > 0 ? '+' : ''}${number(value, decimals)}`

export const fmtTkr = (value: Value) => !valid(value) ? '—' : Math.abs(value) >= 10_000_000
  ? `${number(value / 1_000_000, 1)}${nbsp}mkr` : `${number(value / 1000, 0)}${nbsp}tkr`
export const fmtPct = (value: Value, decimals = 1) => valid(value) ? `${number(value, decimals)}${nbsp}%` : '—'
export const fmtDeltaPct = (value: Value, decimals = 1) => valid(value) ? `${signed(value, decimals)}${nbsp}%` : '—'
export const fmtPp = (value: Value) => valid(value) ? `${signed(value)}${nbsp}p.e.` : '—'
export const fmtInt = (value: Value) => valid(value) ? number(value, 0) : '—'

function monthDate(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Ogiltig månad')
  return new Date(`${month}-01T12:00:00Z`)
}
export const fmtMonth = (month: string) => new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(monthDate(month))
export const fmtMonthShort = (month: string) => new Intl.DateTimeFormat('sv-SE', { month: 'short', timeZone: 'UTC' }).format(monthDate(month)).replace('.', '')
