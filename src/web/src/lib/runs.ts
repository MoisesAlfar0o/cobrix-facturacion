/**
 * Cálculos de presentación de una corrida: parseo del resumen, texto corto para la tabla,
 * segmentos de la barra de progreso y resumen del detalle. Mismos criterios que el panel anterior.
 */

import type { CorridaDetalle, RunType, Tone } from './types.ts'
import { RESULT_LABELS } from './labels.ts'

export function parseResumen(json: string): Record<string, number> {
  try {
    return JSON.parse(json) as Record<string, number>
  } catch {
    return {}
  }
}

export const resultLabel = (resultado: string): { text: string; tone: Tone } => RESULT_LABELS[resultado] ?? { text: resultado, tone: 'mute' }

export interface BarSegment {
  readonly label: string
  readonly value: number
  readonly tone: Tone
}

export function barSegments(tipo: RunType, resumen: Record<string, number>, detalles: readonly CorridaDetalle[]): BarSegment[] {
  const n = (key: string): number => resumen[key] ?? 0
  const cuenta = (resultado: string): number => detalles.filter(d => d.resultado === resultado).length
  if (tipo === 'importacion') {
    return [
      { label: 'Importada', value: n('installmentsImported'), tone: 'ok' },
      { label: 'Ya importada', value: n('installmentsAlreadyImported'), tone: 'info' },
      { label: 'Excluida por estado', value: n('installmentsExcludedByStatus'), tone: 'mute' },
      { label: 'No importable', value: cuenta('excluida_por_moneda'), tone: 'mute' },
      { label: 'Saldo residual', value: cuenta('excluida_por_saldo'), tone: 'mute' },
      { label: 'Fuera de ventana', value: cuenta('fuera_de_ventana') + cuenta('fuera_de_limite'), tone: 'warn' },
      { label: 'Frenada por tope', value: cuenta('frenada_por_tope'), tone: 'warn' },
    ]
  }
  return [
    { label: 'Marcada pagada', value: n('invoicesMarkedPaid'), tone: 'ok' },
    { label: 'Sigue pendiente', value: n('invoicesStillOpen'), tone: 'info' },
    { label: 'Abono parcial', value: n('invoicesPartiallyPaidAtIsp'), tone: 'warn' },
    { label: 'En revisión', value: n('invoicesUnderReview'), tone: 'warn' },
    { label: 'Sin evidencia', value: n('invoicesUnknown'), tone: 'mute' },
  ]
}

/** Resumen del detalle: solo los resultados con filas. */
export function detalleResumen(tipo: RunType, resumen: Record<string, number>, detalles: readonly CorridaDetalle[]): string {
  const n = (key: string): number => resumen[key] ?? 0
  const cuenta = (resultado: string): number => detalles.filter(d => d.resultado === resultado).length
  const partes: string[] = []
  const push = (label: string, value: number): void => { if (value > 0) partes.push(`${label}: ${value}`) }
  if (tipo === 'importacion') {
    push('Importada', n('installmentsImported'))
    push('Se importarían', n('installmentsWouldImport'))
    push('Excluida por estado del contrato', n('installmentsExcludedByStatus'))
    push('No importable', cuenta('excluida_por_moneda'))
    push('Saldo residual', cuenta('excluida_por_saldo'))
  } else {
    push('Marcada pagada', n('invoicesMarkedPaid'))
    push('Se marcarían pagadas', n('invoicesWouldMarkPaid'))
    push('Sigue pendiente', n('invoicesStillOpen'))
    push('Abono parcial en el administrador', n('invoicesPartiallyPaidAtIsp'))
    push('Sin evidencia', n('invoicesUnknown'))
  }
  return partes.join(' · ')
}

/** Resumen de una fila de la tabla de corridas: solo los contadores con valor. */
export function runResumenTexto(run: { tipo: RunType; simulacion: number; estado: string; error: string | null; resumen: string }): string {
  const r = parseResumen(run.resumen)
  if (run.estado === 'fallida') return run.error ?? 'Falló'
  const n = (key: string): number => r[key] ?? 0
  const partes: string[] = []
  const push = (label: string, value: number): void => { if (value > 0) partes.push(`${label}: ${value}`) }
  if (run.tipo === 'importacion') {
    partes.push(`Contratos leídos: ${n('contractsObserved')}`)
    push(run.simulacion ? 'Se importarían' : 'Importadas', run.simulacion ? n('installmentsWouldImport') : n('installmentsImported'))
    if (!run.simulacion) push('Clientes creados', n('customersCreated'))
    push('Ya importadas', n('installmentsAlreadyImported'))
    push('Excluidas por estado', n('installmentsExcludedByStatus'))
  } else {
    partes.push(`Facturas consultadas: ${n('invoicesChecked')}`)
    push(run.simulacion ? 'Se marcarían pagadas' : 'Marcadas pagadas', run.simulacion ? n('invoicesWouldMarkPaid') : n('invoicesMarkedPaid'))
    push('Abono parcial', n('invoicesPartiallyPaidAtIsp'))
    push('Siguen pendientes', n('invoicesStillOpen'))
  }
  return partes.join(' · ')
}
