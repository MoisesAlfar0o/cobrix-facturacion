/**
 * Etiquetas del panel: contadores de cada corrida, resultados por cuota, tipos de corrida y
 * estados. Mismas claves que el sync de Cobrix para los contadores.
 */

import type { RunStatus, RunType, Tone } from './types.ts'

export interface CounterDef {
  readonly key: string
  readonly label: string
  readonly cobrix: string
}

export const IMPORT_COUNTERS: readonly CounterDef[] = [
  { key: 'contractsObserved', label: 'Contratos leídos', cobrix: 'contractsObserved' },
  { key: 'contractsWithDebt', label: 'Con deuda', cobrix: 'contractsWithDebt' },
  { key: 'contractsIndeterminate', label: 'Indeterminados', cobrix: 'contractsIndeterminate' },
  { key: 'contractsStatusUnrecognized', label: 'Estado desconocido', cobrix: 'contractsStatusUnrecognized' },
  { key: 'contractsCurrencyIncoherent', label: 'Moneda incoherente', cobrix: 'contractsCurrencyIncoherent' },
  { key: 'installmentsPending', label: 'Cuotas pendientes', cobrix: 'installmentsPending' },
  { key: 'installmentsImported', label: 'Importadas', cobrix: 'installmentsImported' },
  { key: 'installmentsWouldImport', label: 'Se importarían', cobrix: 'installmentsWouldImport' },
  { key: 'installmentsAlreadyImported', label: 'Ya importadas', cobrix: 'installmentsAlreadyImported' },
  { key: 'installmentsExcludedByStatus', label: 'Excluidas por estado', cobrix: 'installmentsExcludedByStatus' },
  { key: 'installmentsBlockedByLimit', label: 'Frenadas por tope', cobrix: 'installmentsBlockedByLimit' },
  { key: 'installmentsFailed', label: 'Fallidas', cobrix: 'installmentsFailed' },
  { key: 'installmentsZeroAmount', label: 'Saldo residual', cobrix: 'installmentsZeroAmount' },
  { key: 'installmentsNoLongerPending', label: 'Ya no pendientes', cobrix: 'installmentsNoLongerPending' },
  { key: 'installmentsExcludedByWindow', label: 'Fuera de ventana', cobrix: 'installmentsExcludedByWindow' },
  { key: 'installmentsExcludedByRecentLimit', label: 'Fuera de recientes', cobrix: 'installmentsExcludedByRecentLimit' },
  { key: 'contractsExcludedByIdentifierType', label: 'Contratos excluidos por documento', cobrix: 'contractsExcludedByIdentifierType' },
  { key: 'installmentsExcludedByIdentifierType', label: 'Cuotas excluidas por documento', cobrix: 'installmentsExcludedByIdentifierType' },
  { key: 'customersCreated', label: 'Clientes creados', cobrix: 'customersCreated' },
]

export const PAYMENTS_COUNTERS: readonly CounterDef[] = [
  { key: 'invoicesChecked', label: 'Facturas consultadas', cobrix: 'invoicesChecked' },
  { key: 'invoicesMarkedPaid', label: 'Marcadas pagadas', cobrix: 'invoicesMarkedPaid' },
  { key: 'invoicesWouldMarkPaid', label: 'Se marcarían pagadas', cobrix: 'invoicesWouldMarkPaid' },
  { key: 'invoicesStillOpen', label: 'Siguen pendientes', cobrix: 'invoicesStillOpen' },
  { key: 'invoicesPartiallyPaidAtIsp', label: 'Abono parcial', cobrix: 'invoicesPartiallyPaidAtIsp' },
  { key: 'invoicesUnderReview', label: 'En revisión', cobrix: 'invoicesUnderReview' },
  { key: 'invoicesUnknown', label: 'Sin evidencia', cobrix: 'invoicesUnknown' },
  { key: 'lookupsFailed', label: 'Consultas fallidas', cobrix: 'lookupsFailed' },
  { key: 'contractsRead', label: 'Contratos releídos', cobrix: 'contractsRead' },
]

/** Tarjetas destacadas de la cabecera de cada corrida (etiqueta, clave del resumen). */
export const IMPORT_TILES: ReadonlyArray<readonly [string, string]> = [
  ['Contratos leídos', 'contractsObserved'], ['Importadas', 'installmentsImported'],
  ['Se importarían', 'installmentsWouldImport'], ['Clientes creados', 'customersCreated'],
  ['Ya importadas', 'installmentsAlreadyImported'], ['Excluidas por estado', 'installmentsExcludedByStatus'],
]
export const PAYMENTS_TILES: ReadonlyArray<readonly [string, string]> = [
  ['Facturas consultadas', 'invoicesChecked'], ['Marcadas pagadas', 'invoicesMarkedPaid'],
  ['Se marcarían pagadas', 'invoicesWouldMarkPaid'], ['Abono parcial', 'invoicesPartiallyPaidAtIsp'],
  ['Siguen pendientes', 'invoicesStillOpen'], ['Sin evidencia', 'invoicesUnknown'],
]

export const RESULT_LABELS: Record<string, { text: string; tone: Tone }> = {
  importada: { text: 'Importada', tone: 'ok' },
  se_importaria: { text: 'Se importaría', tone: 'ok' },
  ya_importada: { text: 'Ya importada', tone: 'mute' },
  excluida_por_estado: { text: 'Excluida por estado del contrato', tone: 'mute' },
  excluida_por_documento: { text: 'Excluida por documento', tone: 'mute' },
  excluida_por_moneda: { text: 'No importable', tone: 'mute' },
  excluida_por_saldo: { text: 'Saldo residual', tone: 'mute' },
  fuera_de_ventana: { text: 'Fuera de ventana', tone: 'warn' },
  fuera_de_limite: { text: 'Fuera de recientes', tone: 'warn' },
  frenada_por_tope: { text: 'Frenada por tope', tone: 'warn' },
  contrato_indeterminado: { text: 'Contrato indeterminado', tone: 'bad' },
  error_api: { text: 'Error de API', tone: 'bad' },
  marcada_pagada: { text: 'Marcada pagada', tone: 'ok' },
  se_marcaria_pagada: { text: 'Se marcaría pagada', tone: 'ok' },
  abono_parcial: { text: 'Abono parcial en el administrador', tone: 'warn' },
  en_revision: { text: 'En revisión', tone: 'warn' },
  sin_evidencia: { text: 'Sin evidencia', tone: 'mute' },
  sigue_pendiente: { text: 'Sigue pendiente', tone: 'info' },
}

export const RUN_TYPE_LABELS: Record<RunType, string> = { importacion: 'Importación', pagadas: 'Actualización de pagadas' }

export const RUN_STATUS: Record<RunStatus, { text: string; tone: Tone }> = {
  en_curso: { text: 'En curso', tone: 'info' },
  completada: { text: 'Completada', tone: 'ok' },
  fallida: { text: 'Fallida', tone: 'bad' },
}

export const HISTORIAL_LABELS: Record<string, string> = {
  cliente_creado: 'Cliente creado',
  factura_importada: 'Factura importada',
  factura_pagada: 'Pagada en el ISP',
}

export const historialLabel = (tipo: string): string => HISTORIAL_LABELS[tipo] ?? tipo

export const runDetailReason = (reason: string): string =>
  reason === 'ledger_pending' ? 'La cuota sigue pendiente en el libro de pagos del administrador.' : reason

/** Tono del estado de un contrato. */
export const CONTRACT_STATUS_TONE: Record<string, Tone> = {
  ACTIVO: 'ok', CORTADO: 'bad', CORTESIA: 'info', RETIRADO: 'mute', RECHAZADO: 'mute', ANULADO: 'mute', status_unrecognized: 'bad',
}

/** Documento mostrado como en la referencia: naturales sin letra, jurídicos como RIF con guiones. */
export function documento(row: { identificacion: string; tipo: string }): string {
  if (row.tipo !== 'juridico') return row.identificacion.replace(/^[VEJP]/, '')
  const match = /^([VEJGP])(\d{8})(\d)$/.exec(row.identificacion)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : row.identificacion
}
