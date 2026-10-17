/**
 * Formato de montos y fechas, igual que el panel anterior: montos en USD con dos decimales y
 * fechas cortas en español («13 oct 2026») más la hora en la zona de Caracas.
 */

const money = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const usd = (minor: number | null | undefined): string => `USD ${money.format(Number(minor ?? 0) / 100)}`

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function date(value: string | null | undefined): string {
  if (typeof value !== 'string' || !value) return '—'
  const [y, m, d] = value.slice(0, 10).split('-')
  const month = MONTHS[Number(m) - 1] ?? ''
  return d ? `${Number(d)} ${month} ${y}` : `${month} ${y}`
}

export function dateTime(value: string | null | undefined): string {
  if (typeof value !== 'string' || !value) return '—'
  return new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

/** `2026-08` → `ago 2026`. */
export function periodText(period: string): string {
  const [year, month] = period.slice(0, 7).split('-').map(Number)
  return `${MONTHS[(month ?? 1) - 1]} ${year}`
}

/** Segundos entre dos marcas ISO, con un decimal; `—` si falta el fin. */
export function duration(inicio: string, fin: string | null): string {
  if (!fin) return '—'
  return `${Math.max(0, (Date.parse(fin) - Date.parse(inicio)) / 1000).toFixed(1)}s`
}
