/** Tipos y valores iniciales de la empresa, el administrador de facturas y la importación. */

import { DEFAULT_IMPORTABLE_STATES, type ContractState } from './rules.ts'

export const ALL_CONTRACT_STATES: readonly ContractState[] = ['ACTIVO', 'CORTADO', 'CORTESIA', 'RETIRADO', 'RECHAZADO', 'ANULADO']

export type DocumentType = 'V' | 'E' | 'J' | 'G' | 'P'
export const DOCUMENT_TYPES: readonly DocumentType[] = ['V', 'E', 'J', 'G', 'P']

/** Opciones de antigüedad para importar cuotas; `null` permite cualquier periodo. */
export const WINDOW_OPTIONS: readonly (number | null)[] = [3, 6, 9, 12, null]

export interface CompanyConfig {
  nombre: string
  rif: string
  emailCobranza: string
  /** Zona horaria de la empresa (por defecto America/Caracas). */
  zonaHoraria: string
  /** Moneda de la empresa (por defecto USD). */
  moneda: string
}

export interface ProviderConfig {
  /** Nombre visible del proveedor (el administrador de facturas). */
  nombre: string
  url: string
  usuario: string
  password: string
}

export interface ImportConfig {
  /** Estados de contrato que se importan. Por defecto ACTIVO y CORTADO. */
  estadosImportables: ContractState[]
  /** Solo cuotas desde el mes actual menos N meses; `null` = sin ventana. */
  ventanaMeses: number | null
  /** Máximo de cuotas recientes por contrato (1 a 60); `null` = todas. */
  maxCuotasRecientes: number | null
  /** Días de gracia para la fecha de corte (0 a 60). */
  diasGracia: number
  /** Tope de facturas nuevas por corrida; `null` = sin tope. */
  maxFacturasPorCorrida: number | null
  /** Tope de monto nuevo por corrida (en USD); `null` = sin tope. */
  maxMontoPorCorrida: number | null
  /** Tipos de documento del titular que se excluyen. */
  excluirTiposDocumento: DocumentType[]
  /** Meses hacia atrás que se consultan al actualizar pagadas (0 = 12 meses). */
  ventanaPagadasMeses: number
  /** Corrida automática diaria (zona America/Caracas). */
  corridaAutomatica: boolean
  horaCorrida: string
}

export interface AppConfig {
  empresa: CompanyConfig
  proveedor: ProviderConfig
  importacion: ImportConfig
}

export const DEFAULT_CONFIG: AppConfig = {
  empresa: { nombre: 'ISP de Prueba (sandbox)', rif: 'J-00000000-0', emailCobranza: 'cobranza@example.com', zonaHoraria: 'America/Caracas', moneda: 'USD' },
  proveedor: { nombre: 'Administrador de facturas', url: 'http://127.0.0.1:4310', usuario: 'cobrix', password: 'cobrix-sandbox' },
  importacion: {
    estadosImportables: [...DEFAULT_IMPORTABLE_STATES],
    ventanaMeses: null,
    maxCuotasRecientes: null,
    diasGracia: 0,
    maxFacturasPorCorrida: null,
    maxMontoPorCorrida: null,
    excluirTiposDocumento: [],
    ventanaPagadasMeses: 12,
    corridaAutomatica: false,
    horaCorrida: '06:00',
  },
}

/** Devuelve un entero del rango indicado o `null` si el campo está vacío o no es válido. */
export function optionalInt(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) return null
  return n
}

/** Devuelve el valor alternativo cuando el campo no contiene un entero válido. */
export function intOr(value: unknown, min: number, max: number, fallback: number): number {
  return optionalInt(value, min, max) ?? fallback
}
