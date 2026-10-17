/**
 * Reglas de importación que no dependen de la API ni de la base de datos. Al mantenerlas aquí,
 * se pueden probar por separado y las respuestas dudosas no se convierten en datos inventados.
 */

import { addCivilDays } from '../shared/dates.ts'

export type PersonType = 'natural' | 'juridico'

export interface NormalizedId {
  /** Documento normalizado: tipo opcional y número sin ceros iniciales. */
  readonly id: string
  readonly tipo: PersonType
}

const TYPE_LETTERS = 'VEJGP'

/**
 * Normaliza el documento del titular: tipo opcional (V, E, J, G o P), seguido de 6 a 12 dígitos.
 * Se eliminan separadores y ceros iniciales para poder comparar documentos equivalentes.
 *
 * `V-12345678` → `V12345678` · `09000123` → `9000123` · `J-40123456-7` → `J401234567`.
 * Devuelve `null` si no es válida: un contrato sin identificación válida no se importa.
 */
export function normalizeId(raw: unknown): NormalizedId | null {
  if (typeof raw !== 'string') return null
  const clean = raw.toUpperCase().replaceAll(/[\s.\-/]/g, '')
  const match = /^([VEJGP])?(\d{6,12})$/.exec(clean)
  if (!match) return null
  const letter = match[1] ?? ''
  if (letter && !TYPE_LETTERS.includes(letter)) return null
  const digits = match[2]!.replace(/^0+(?=\d)/, '')
  if (!digits) return null
  // J y G son personas jurídicas; el resto, naturales.
  return { id: letter + digits, tipo: letter === 'J' || letter === 'G' ? 'juridico' : 'natural' }
}

export const KNOWN_STATES = ['ACTIVO', 'CORTADO', 'CORTESIA', 'RETIRADO', 'RECHAZADO', 'ANULADO'] as const
export type ContractState = (typeof KNOWN_STATES)[number]

export const DEFAULT_IMPORTABLE_STATES: readonly ContractState[] = ['ACTIVO', 'CORTADO']

export const isKnownState = (value: unknown): value is ContractState =>
  typeof value === 'string' && (KNOWN_STATES as readonly string[]).includes(value)

const MONTH_NAMES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

const deaccent = (value: string): string => value.normalize('NFD').replaceAll(/\p{Diacritic}/gu, '').toLowerCase()

export interface Installment {
  readonly periodo: string
  readonly vencimiento: string
}

/**
 * Periodo y vencimiento de una cuota a partir de `detalle_deuda`
 * («PLAN15MB25 - 2026 Agosto» → periodo `2026-08`, vencimiento `2026-08-01`).
 * Devuelve `null` si no se puede leer con certeza.
 */
export function parseInstallment(detalle: unknown): Installment | null {
  if (!Array.isArray(detalle)) return null
  for (const raw of [...detalle].reverse()) {
    if (typeof raw !== 'string') continue
    const match = /(\d{4})\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)/.exec(raw)
    if (!match) continue
    const month = MONTH_NAMES[deaccent(match[2]!)]
    if (!month) continue
    const periodo = `${match[1]}-${String(month).padStart(2, '0')}`
    return { periodo, vencimiento: `${periodo}-01` }
  }
  return null
}

/** Fecha de corte = vencimiento + días de gracia (§3.1). */
export const corteDate = (vencimiento: string, diasGracia: number): string => addCivilDays(vencimiento, diasGracia)

/** Convierte `YYYY-MM` en un número comparable para calcular ventanas entre meses. */
export function periodIndex(periodo: string): number {
  const [year, month] = periodo.split('-').map(Number)
  return (year ?? 0) * 12 + ((month ?? 1) - 1)
}

/** Indica si el periodo está dentro de la ventana configurada; `null` no limita la antigüedad. */
export function isWithinWindow(periodo: string, currentPeriodo: string, meses: number | null): boolean {
  if (meses === null) return true
  return periodIndex(periodo) >= periodIndex(currentPeriodo) - meses
}

/** Comprueba si la cuota está entre las más recientes permitidas; `null` no aplica límite. */
export function withinRecentLimit(periodo: string, orderedPeriodos: readonly string[], maxCuotas: number | null): boolean {
  if (maxCuotas === null) return true
  const ordered = [...orderedPeriodos].sort((a, b) => periodIndex(b) - periodIndex(a))
  return ordered.indexOf(periodo) < maxCuotas
}

/**
 * Moneda incoherente (§4 · Facturas): un contrato reportado en USD con cuotas absurdamente bajas
 * frente al precio del plan (menos del 1 %) se descarta.
 */
export function isCurrencyIncoherent(monedaSigla: unknown, deuda: number, precioPlan: number): boolean {
  if (monedaSigla !== 'USD') return false
  if (!(precioPlan > 0) || !(deuda > 0)) return false
  return deuda < precioPlan * 0.01
}

/** Saldo residual de menos de un centavo: no se importa. */
export const isResidual = (deuda: number): boolean => deuda > 0 && deuda < 0.01
