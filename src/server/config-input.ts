/**
 * Normaliza la configuración recibida por la API antes de guardarla. El navegador no es una
 * fuente confiable: los tipos, rangos y valores permitidos se comprueban también en el servidor.
 */

import { ALL_CONTRACT_STATES, DOCUMENT_TYPES, WINDOW_OPTIONS, type AppConfig, type DocumentType } from '../cobrix/config.ts'
import { KNOWN_STATES, type ContractState } from '../cobrix/rules.ts'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value.trim() : fallback)

/** Convierte un valor en entero si está dentro del rango; si no, lo deja sin valor. */
const optionalInt = (value: unknown, min: number, max: number): number | null => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

/** Aplica el valor indicado cuando el entero recibido está vacío o fuera del rango. */
const intOr = (value: unknown, min: number, max: number, fallback: number): number => optionalInt(value, min, max) ?? fallback

/** Combina los campos válidos recibidos con la configuración actual. */
export function parseConfig(body: unknown, current: AppConfig): AppConfig {
  if (!isRecord(body)) return current
  const empresa = isRecord(body.empresa) ? body.empresa : {}
  const proveedor = isRecord(body.proveedor) ? body.proveedor : {}
  const importacion = isRecord(body.importacion) ? body.importacion : {}

  const estados = Array.isArray(importacion.estadosImportables)
    ? importacion.estadosImportables.filter((value): value is ContractState => typeof value === 'string' && (KNOWN_STATES as readonly string[]).includes(value))
    : []
  const excluir = Array.isArray(importacion.excluirTiposDocumento)
    ? importacion.excluirTiposDocumento.filter((value): value is DocumentType => typeof value === 'string' && (DOCUMENT_TYPES as readonly string[]).includes(value))
    : []
  const ventanaRaw = importacion.ventanaMeses
  const ventana = ventanaRaw === null ? null : optionalInt(ventanaRaw, 1, 120)
  const ventanaValida = ventana !== null && WINDOW_OPTIONS.includes(ventana) ? ventana : null
  const password = text(proveedor.password)
  const hora = text(importacion.horaCorrida)

  return {
    empresa: {
      nombre: text(empresa.nombre, current.empresa.nombre),
      rif: text(empresa.rif, current.empresa.rif),
      emailCobranza: text(empresa.emailCobranza, current.empresa.emailCobranza),
      zonaHoraria: current.empresa.zonaHoraria,
      moneda: current.empresa.moneda,
    },
    proveedor: {
      nombre: text(proveedor.nombre, current.proveedor.nombre),
      url: text(proveedor.url, current.proveedor.url),
      usuario: text(proveedor.usuario, current.proveedor.usuario),
      password: password || current.proveedor.password,
    },
    importacion: {
      estadosImportables: estados.length ? estados : current.importacion.estadosImportables,
      ventanaMeses: ventanaValida,
      maxCuotasRecientes: optionalInt(importacion.maxCuotasRecientes, 1, 60),
      diasGracia: intOr(importacion.diasGracia, 0, 60, current.importacion.diasGracia),
      maxFacturasPorCorrida: optionalInt(importacion.maxFacturasPorCorrida, 0, 1_000_000),
      maxMontoPorCorrida: optionalInt(importacion.maxMontoPorCorrida, 0, 100_000_000),
      excluirTiposDocumento: excluir,
      ventanaPagadasMeses: intOr(importacion.ventanaPagadasMeses, 0, 120, current.importacion.ventanaPagadasMeses),
      corridaAutomatica: importacion.corridaAutomatica === true,
      horaCorrida: /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hora) ? hora : current.importacion.horaCorrida,
    },
  }
}

export const CONTRACT_STATES = ALL_CONTRACT_STATES

export { ALL_CONTRACT_STATES, DOCUMENT_TYPES }
