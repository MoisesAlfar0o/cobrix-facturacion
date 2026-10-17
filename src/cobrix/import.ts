/**
 * Importa las cuotas pendientes que cumplen la configuración. Revisa todos los contratos y deja
 * el motivo de cada decisión en el detalle de la corrida. En modo de simulación no crea clientes
 * ni facturas, pero sí conserva el resultado de la prueba para poder consultarlo en el panel.
 */

import { currentPeriod, today } from '../shared/dates.ts'
import { toCents } from '../shared/money.ts'
import { asNumber, asString } from '../shared/values.ts'
import type { ApiRow, BillingApiClient } from './client.ts'
import {
  corteDate, isCurrencyIncoherent, isKnownState, isResidual, isWithinWindow,
  normalizeId, parseInstallment, withinRecentLimit,
} from './rules.ts'
import type { CobrixStore } from './store.ts'

/** Resultados que se muestran en el resumen de una importación. */
export interface ImportSummary {
  contractsObserved: number
  contractsWithDebt: number
  contractsIndeterminate: number
  contractsStatusUnrecognized: number
  contractsCurrencyIncoherent: number
  contractsExcludedByIdentifierType: number
  installmentsPending: number
  installmentsImported: number
  installmentsWouldImport: number
  installmentsAlreadyImported: number
  installmentsExcludedByStatus: number
  installmentsBlockedByLimit: number
  installmentsFailed: number
  installmentsZeroAmount: number
  installmentsNoLongerPending: number
  installmentsExcludedByWindow: number
  installmentsExcludedByRecentLimit: number
  installmentsExcludedByIdentifierType: number
  customersCreated: number
}

const emptySummary = (): ImportSummary => ({
  contractsObserved: 0,
  contractsWithDebt: 0,
  contractsIndeterminate: 0,
  contractsStatusUnrecognized: 0,
  contractsCurrencyIncoherent: 0,
  contractsExcludedByIdentifierType: 0,
  installmentsPending: 0,
  installmentsImported: 0,
  installmentsWouldImport: 0,
  installmentsAlreadyImported: 0,
  installmentsExcludedByStatus: 0,
  installmentsBlockedByLimit: 0,
  installmentsFailed: 0,
  installmentsZeroAmount: 0,
  installmentsNoLongerPending: 0,
  installmentsExcludedByWindow: 0,
  installmentsExcludedByRecentLimit: 0,
  installmentsExcludedByIdentifierType: 0,
  customersCreated: 0,
})


/** Datos necesarios para procesar una cuota con saldo pendiente. */
interface PendingCuota {
  readonly deudaId: string
  readonly deuda: number
  readonly periodo: string
  readonly vencimiento: string
  readonly descripcion: string
}

type ReadResult =
  | { kind: 'ok'; cuotas: PendingCuota[]; contrato: ApiRow }
  | { kind: 'status'; estado: string }
  | { kind: 'indeterminate'; motivo: string }

/** Comprueba que las filas pertenezcan al contrato y tengan cuotas interpretables. */
function readContract(contratoId: number, rows: ApiRow[]): ReadResult {
  const contrato = rows[0]
  if (!contrato) return { kind: 'indeterminate', motivo: 'respuesta vacía' }
  // Si se mezclaron contratos en la respuesta, no es seguro procesarla.
  if (rows.some(row => Number(row.contrato_id) !== contratoId)) return { kind: 'indeterminate', motivo: 'filas de otro contrato' }
  const estado = asString(contrato.estado)
  if (!isKnownState(estado)) return { kind: 'status', estado: estado || '(vacío)' }

  const cuotas: PendingCuota[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const deudaId = String(row.deuda_id ?? '')
    // El proveedor usa el identificador "0" para indicar que no hay cuota pendiente.
    if (deudaId === '0') continue
    if (!deudaId) return { kind: 'indeterminate', motivo: 'cuota sin id' }
    if (seen.has(deudaId)) return { kind: 'indeterminate', motivo: `cuota duplicada ${deudaId}` }
    seen.add(deudaId)
    const installment = parseInstallment(row.detalle_deuda)
    if (!installment) return { kind: 'indeterminate', motivo: `periodo ilegible de la cuota ${deudaId}` }
    const detalle = Array.isArray(row.detalle_deuda) ? row.detalle_deuda : []
    cuotas.push({ deudaId, deuda: asNumber(row.deuda), periodo: installment.periodo, vencimiento: installment.vencimiento, descripcion: asString(detalle[0]) })
  }
  return { kind: 'ok', cuotas, contrato }
}

export async function runImport(
  client: BillingApiClient,
  store: CobrixStore,
  options: { simulacion: boolean; fecha?: string },
): Promise<number> {
  const fecha = options.fecha ?? today()
  const { importacion } = store.getConfig()
  const corridaId = store.startRun('importacion', options.simulacion, fecha)
  const summary = emptySummary()
  const detail = (d: { contrato_id: number; deuda_id?: string; periodo?: string; resultado: string; motivo: string; cliente?: string; monto_cents?: number }): void =>
    store.addRunDetail(corridaId, { contrato_id: d.contrato_id, deuda_id: d.deuda_id ?? '', periodo: d.periodo ?? '', resultado: d.resultado, motivo: d.motivo, cliente: d.cliente, monto_cents: d.monto_cents })

  try {
    // Falla rápido con credenciales malas: la corrida queda registrada como fallida.
    const ids = await client.contractIds()
    const periodoActual = currentPeriod()
    const topeFacturas = importacion.maxFacturasPorCorrida
    const topeMonto = importacion.maxMontoPorCorrida !== null ? toCents(importacion.maxMontoPorCorrida) : null
    const yaContados = new Set<string>()
    let nuevasFacturas = 0
    let montoNuevoCents = 0

    for (const contratoId of ids) {
      summary.contractsObserved++
      let rows: ApiRow[]
      try {
        rows = await client.contractInstallments(contratoId)
      } catch (error) {
        summary.installmentsFailed++
        summary.contractsIndeterminate++
        detail({ contrato_id: contratoId, resultado: 'error_api', motivo: error instanceof Error ? error.message : String(error) })
        continue
      }

      const read = readContract(contratoId, rows)
      if (read.kind === 'status') {
        summary.contractsStatusUnrecognized++
        summary.contractsIndeterminate++
        detail({ contrato_id: contratoId, resultado: 'contrato_indeterminado', motivo: `estado desconocido: ${read.estado}` })
        continue
      }
      if (read.kind === 'indeterminate') {
        summary.contractsIndeterminate++
        detail({ contrato_id: contratoId, resultado: 'contrato_indeterminado', motivo: read.motivo })
        continue
      }
      const { cuotas, contrato } = read
      const clienteNombre = asString(contrato.nombre_contrato)
      const documentoProveedor = asString(contrato.identificacion_contrato)
      // «Cuotas pendientes» cuenta deuda real: el saldo residual (< 1 centavo) no es deuda.
      summary.installmentsPending += cuotas.filter(cuota => cuota.deuda > 0 && !isResidual(cuota.deuda)).length
      if (cuotas.length > 0) summary.contractsWithDebt++

      const identity = normalizeId(contrato.identificacion_contrato)
      if (!identity) {
        summary.contractsIndeterminate++
        detail({ contrato_id: contratoId, resultado: 'contrato_indeterminado', motivo: `identificación inválida: ${asString(contrato.identificacion_contrato) || '(vacía)'}`, cliente: clienteNombre })
        continue
      }

      // El contrato se espeja aunque no deje cuotas importables: el sync de Cobrix
      // refleja todos los contratos legibles, pero solo crea facturas de los que
      // pasan los filtros (y cliente solo si hay al menos una factura).
      const estado = asString(contrato.estado)
      const importable = (importacion.estadosImportables as string[]).includes(estado)
      const letter = identity.id[0]
      const documentoExcluido = Boolean(letter && (importacion.excluirTiposDocumento as string[]).includes(letter))
      const precioPlan = asNumber(contrato.precio_servicio)
      const maxDeuda = cuotas.reduce((max, cuota) => Math.max(max, cuota.deuda), 0)
      const monedaIncoherente = isCurrencyIncoherent(asString(contrato.moneda_sigla), maxDeuda, precioPlan)

      // Periodos con saldo real (no residual), ordenados del más nuevo al más viejo.
      const orderedPeriodos = cuotas.filter(cuota => cuota.deuda > 0 && !isResidual(cuota.deuda)).map(cuota => cuota.periodo)

      const importables: Array<PendingCuota & { montoCents: number }> = []
      for (const cuota of cuotas) {
        const base = { contrato_id: contratoId, deuda_id: cuota.deudaId, periodo: cuota.periodo, cliente: clienteNombre, monto_cents: toCents(cuota.deuda) }
        if (!importable) {
          summary.installmentsExcludedByStatus++
          detail({ ...base, resultado: 'excluida_por_estado', motivo: `contrato en estado ${estado}` })
          continue
        }
        if (documentoExcluido) {
          summary.installmentsExcludedByIdentifierType++
          detail({ ...base, resultado: 'excluida_por_documento', motivo: `tipo de documento ${letter}` })
          continue
        }
        if (monedaIncoherente) {
          detail({ ...base, resultado: 'excluida_por_moneda', motivo: `moneda incoherente: cuotas en ${asString(contrato.moneda_sigla)} muy por debajo del plan` })
          continue
        }
        if (cuota.deuda <= 0 || isResidual(cuota.deuda)) {
          summary.installmentsZeroAmount++
          detail({ ...base, resultado: 'excluida_por_saldo', motivo: 'saldo residual de menos de un centavo' })
          continue
        }
        if (!isWithinWindow(cuota.periodo, periodoActual, importacion.ventanaMeses)) {
          summary.installmentsExcludedByWindow++
          detail({ ...base, resultado: 'fuera_de_ventana', motivo: 'fuera de la ventana de importación' })
          continue
        }
        if (!withinRecentLimit(cuota.periodo, orderedPeriodos, importacion.maxCuotasRecientes)) {
          summary.installmentsExcludedByRecentLimit++
          detail({ ...base, resultado: 'fuera_de_limite', motivo: `más de ${importacion.maxCuotasRecientes} cuotas recientes` })
          continue
        }
        if (store.facturaByDeudaId(cuota.deudaId)) {
          summary.installmentsAlreadyImported++
          detail({ ...base, resultado: 'ya_importada', motivo: 'la cuota ya tiene factura en Cobrix' })
          continue
        }
        const montoCents = toCents(cuota.deuda)
        if ((topeFacturas !== null && nuevasFacturas >= topeFacturas) || (topeMonto !== null && montoNuevoCents + montoCents > topeMonto)) {
          summary.installmentsBlockedByLimit++
          detail({ ...base, resultado: 'frenada_por_tope', motivo: 'excede el tope de la corrida' })
          continue
        }
        nuevasFacturas++
        montoNuevoCents += montoCents
        importables.push({ ...cuota, montoCents })
      }

      // Contadores de contrato (el espejo incluye todos los contratos legibles).
      if (documentoExcluido) summary.contractsExcludedByIdentifierType++
      if (monedaIncoherente) summary.contractsCurrencyIncoherent++

      let clienteId: number | null = null
      if (importables.length > 0) {
        const existing = store.clienteByIdentificacion(identity.id)
        if (options.simulacion) {
          if (!existing && !yaContados.has(identity.id)) { yaContados.add(identity.id); summary.customersCreated++ }
          clienteId = existing ? existing.id : -1
        } else {
          clienteId = store.ensureCliente({
            identificacion: identity.id,
            identificacionProveedor: documentoProveedor,
            nombre: clienteNombre,
            tipo: identity.tipo,
            email: asString(contrato.email).toLowerCase(),
            telefono: asString(contrato.telefono),
            origen: 'administrador de facturas',
            fecha,
            contratoId,
          })
          if (!existing) summary.customersCreated++
        }
      }

      if (!options.simulacion) {
        store.upsertContrato({
          id: contratoId,
          cliente_id: clienteId,
          estado,
          plan: asString(contrato.nombre_plan),
          precio_cents: toCents(precioPlan),
          sucursal: asString(contrato.sigla_sucursal),
          moneda_sigla: asString(contrato.moneda_sigla),
          direccion: asString(contrato.direccion),
        })
      }
      if (importables.length === 0 || clienteId === null) continue

      for (const cuota of importables) {
        const montoCents = cuota.montoCents
        if (options.simulacion) summary.installmentsWouldImport++
        else summary.installmentsImported++
        detail({ contrato_id: contratoId, deuda_id: cuota.deudaId, periodo: cuota.periodo, resultado: options.simulacion ? 'se_importaria' : 'importada', motivo: cuota.descripcion || `periodo ${cuota.periodo}`, cliente: clienteNombre, monto_cents: montoCents })
        if (!options.simulacion) {
          store.createFactura({
            cliente_id: clienteId,
            contrato_id: contratoId,
            deuda_id: cuota.deudaId,
            periodo: cuota.periodo,
            vencimiento: cuota.vencimiento,
            corte: corteDate(cuota.vencimiento, importacion.diasGracia),
            total_cents: montoCents,
            descripcion: cuota.descripcion,
            fecha,
          })
        }
      }
    }

    store.finishRun(corridaId, summary, today(), null)
  } catch (error) {
    store.finishRun(corridaId, summary, today(), error instanceof Error ? error.message : String(error))
  }
  return corridaId
}
