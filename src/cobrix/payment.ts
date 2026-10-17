/**
 * Compara las facturas abiertas de Cobrix con el libro de pagos del administrador. Solo marca
 * como pagadas las cuotas con evidencia completa; los abonos parciales y los datos inconsistentes
 * quedan abiertos o se señalan para revisión. En simulación no cambia facturas, pero registra el
 * resultado de la revisión para que pueda consultarse en el panel.
 */

import { addMonths, currentPeriod, lastDayOfPeriod, today } from '../shared/dates.ts'
import { toCents } from '../shared/money.ts'
import { asNumber as num } from '../shared/values.ts'
import type { ApiRow, BillingApiClient } from './client.ts'
import type { CobrixStore, Factura } from './store.ts'

/** Resultados que se muestran al actualizar el estado de las facturas. */
export interface PaymentsSummary {
  invoicesChecked: number
  invoicesMarkedPaid: number
  invoicesWouldMarkPaid: number
  invoicesStillOpen: number
  invoicesPartiallyPaidAtIsp: number
  invoicesUnderReview: number
  invoicesUnknown: number
  lookupsFailed: number
  contractsRead: number
}

const emptySummary = (): PaymentsSummary => ({
  invoicesChecked: 0,
  invoicesMarkedPaid: 0,
  invoicesWouldMarkPaid: 0,
  invoicesStillOpen: 0,
  invoicesPartiallyPaidAtIsp: 0,
  invoicesUnderReview: 0,
  invoicesUnknown: 0,
  lookupsFailed: 0,
  contractsRead: 0,
})

interface CuotaState {
  /** Todas las filas coinciden entre sí (saldo y tarifa). */
  readonly consistente: boolean
  readonly saldo_cents: number
  readonly pagado: boolean
  readonly tieneFactura: boolean
  /** Factura del administrador que la pagó, si la hay. */
  readonly numFactura: string
  readonly fechaFactura: string
}

/** Agrupa los movimientos por cuota y comprueba que sus saldos sean coherentes. */
function readLedger(rows: ApiRow[]): Map<string, CuotaState> {
  const byCuota = new Map<string, ApiRow[]>()
  for (const row of rows) {
    const detalle = row.detalle_pago as Record<string, unknown> | undefined
    const idCuota = detalle?.id_cuota
    if (idCuota === undefined || idCuota === null) continue
    const key = String(idCuota)
    const list = byCuota.get(key) ?? []
    list.push(row)
    byCuota.set(key, list)
  }
  const result = new Map<string, CuotaState>()
  for (const [key, list] of byCuota) {
    const first = list[0]!.detalle_pago as Record<string, unknown>
    const saldo = num(first.saldo_cuota)
    const tarifa = num(first.tarifa)
    const consistente = list.every(row => {
      const detalle = row.detalle_pago as Record<string, unknown>
      return num(detalle.saldo_cuota) === saldo && num(detalle.tarifa) === tarifa
    })
    const pagado = list.some(row => num((row.detalle_pago as Record<string, unknown>).valor_pago) > 0)
    // La fila con id_factura != 0 es el cobro que tocó la cuota. Una cuota puede tener
    // varias (un cobro viejo y el actual): se cita el más reciente por emisión y factura.
    const conFactura = list
      .filter(row => num(row.id_factura) !== 0)
      .sort((a, b) => {
        const fa = String(a.fecha_emision ?? '')
        const fb = String(b.fecha_emision ?? '')
        if (fa !== fb) return fa < fb ? -1 : 1
        return num(a.id_factura) - num(b.id_factura)
      })
      .at(-1)
    result.set(key, {
      consistente,
      saldo_cents: toCents(saldo),
      pagado,
      tieneFactura: Boolean(conFactura),
      numFactura: conFactura ? String(conFactura.num_factura ?? '') : '',
      fechaFactura: conFactura ? String(conFactura.fecha_emision ?? '') : '',
    })
  }
  return result
}

/** ¿La cuota sigue pendiente en el contrato? (fallback de la cuota del mes en curso). */
async function stillPendingInContract(client: BillingApiClient, contratoId: number, deudaId: string): Promise<boolean> {
  const rows = await client.contractInstallments(contratoId)
  const row = rows.find(item => String(item.deuda_id ?? '') === deudaId)
  return row ? num(row.deuda) > 0 : false
}

export async function runUpdatePaid(
  client: BillingApiClient,
  store: CobrixStore,
  options: { simulacion: boolean; fecha?: string },
): Promise<number> {
  const fecha = options.fecha ?? today()
  const { importacion } = store.getConfig()
  const corridaId = store.startRun('pagadas', options.simulacion, fecha)
  const summary = emptySummary()
  const detail = (d: { contrato_id: number; deuda_id: string; periodo: string; resultado: string; motivo: string; cliente?: string; monto_cents?: number }): void =>
    store.addRunDetail(corridaId, { contrato_id: d.contrato_id, deuda_id: d.deuda_id, periodo: d.periodo, resultado: d.resultado, motivo: d.motivo, cliente: d.cliente, monto_cents: d.monto_cents })

  try {
    const periodoActual = currentPeriod()
    // El libro se consulta por documento del titular: un cliente con dos contratos (p. ej.
    // LUIS GOMEZ) se lee una sola vez y sus cuotas llegan juntas en la misma respuesta.
    const clientes = store.clientesConFacturasAbiertas()
    const meses = importacion.ventanaPagadasMeses > 0 ? importacion.ventanaPagadasMeses : 12

    for (const titular of clientes) {
      const facturas = store.facturasAbiertasDeCliente(titular.cliente_id)
      if (facturas.length === 0) continue
      const cliente = store.clienteById(titular.cliente_id)?.nombre ?? ''
      // El documento del proveedor puede traer guion («V-12345678»); se conserva tal
      // cual para consultar su libro. Se cae al normalizado si no hay documento guardado.
      const documento = titular.identificacion_proveedor || titular.identificacion
      const inicio = facturas.reduce((min, f) => (f.vencimiento < min ? f.vencimiento : min), facturas[0]!.vencimiento)
      const desde = inicio < addMonths(periodoActual, -meses) ? inicio : addMonths(periodoActual, -meses)
      const hasta = lastDayOfPeriod(periodoActual)

      let ledger: Map<string, CuotaState>
      try {
        ledger = readLedger(await client.paymentLedgerByIdentificacion(documento, `${desde}-01`, hasta))
      } catch (error) {
        summary.lookupsFailed++
        for (const factura of facturas) {
          summary.invoicesChecked++
          summary.invoicesUnknown++
          detail({ contrato_id: factura.contrato_id, deuda_id: factura.deuda_id, periodo: factura.periodo, resultado: 'sin_evidencia', motivo: error instanceof Error ? error.message : String(error), cliente, monto_cents: factura.saldo_cents })
        }
        continue
      }

      for (const factura of facturas) {
        summary.invoicesChecked++
        await evaluate(client, store, factura, ledger, { summary, detail, periodoActual, simulacion: options.simulacion, fecha, cliente })
      }
    }

    // «Contratos releídos»: titulares con factura abierta al terminar la corrida. La
    // referencia muestra 18: los 20 titulares menos ANA PEREZ y EL FARO, cuyas facturas
    // quedaron todas pagadas en esta misma corrida.
    summary.contractsRead = store.clientesConFacturasAbiertas().length
    store.finishRun(corridaId, summary, today(), null)
  } catch (error) {
    store.finishRun(corridaId, summary, today(), error instanceof Error ? error.message : String(error))
  }
  return corridaId
}

async function evaluate(
  client: BillingApiClient,
  store: CobrixStore,
  factura: Factura,
  ledger: Map<string, CuotaState>,
  ctx: {
    summary: PaymentsSummary
    detail: (d: { contrato_id: number; deuda_id: string; periodo: string; resultado: string; motivo: string; cliente?: string; monto_cents?: number }) => void
    periodoActual: string
    simulacion: boolean
    fecha: string
    cliente: string
  },
): Promise<void> {
  const { summary, detail } = ctx
  const base = { contrato_id: factura.contrato_id, deuda_id: factura.deuda_id, periodo: factura.periodo, cliente: ctx.cliente, monto_cents: factura.saldo_cents }
  const cuota = ledger.get(factura.deuda_id)

  if (!cuota) {
    // La cuota del mes en curso puede no aparecer en el libro hasta fin de mes.
    if (factura.periodo === ctx.periodoActual) {
      let pending: boolean
      try {
        pending = await stillPendingInContract(client, factura.contrato_id, factura.deuda_id)
      } catch (error) {
        summary.invoicesUnknown++
        detail({ ...base, resultado: 'sin_evidencia', motivo: `no se pudo consultar el contrato: ${error instanceof Error ? error.message : String(error)}` })
        return
      }
      if (!pending) {
        if (ctx.simulacion) summary.invoicesWouldMarkPaid++
        else summary.invoicesMarkedPaid++
        detail({ ...base, resultado: ctx.simulacion ? 'se_marcaria_pagada' : 'marcada_pagada', motivo: 'cuota del mes en curso ya no pendiente en el contrato' })
        if (!ctx.simulacion) store.markPaid(factura.id, ctx.fecha)
        return
      }
    }
    summary.invoicesUnknown++
    detail({ ...base, resultado: 'sin_evidencia', motivo: 'la cuota no aparece en el libro de pagos' })
    return
  }

  if (!cuota.consistente) {
    summary.invoicesUnderReview++
    detail({ ...base, resultado: 'en_revision', motivo: 'las filas de la cuota no coinciden entre sí' })
    return
  }
  if (cuota.saldo_cents === 0 && (cuota.pagado || cuota.tieneFactura)) {
    if (ctx.simulacion) summary.invoicesWouldMarkPaid++
    else summary.invoicesMarkedPaid++
    const facturaAplicada = cuota.tieneFactura ? `factura del administrador ${cuota.numFactura} del ${cuota.fechaFactura}` : 'saldo 0 y hubo cobro'
    detail({ ...base, resultado: ctx.simulacion ? 'se_marcaria_pagada' : 'marcada_pagada', motivo: facturaAplicada })
    if (!ctx.simulacion) store.markPaid(factura.id, ctx.fecha, cuota.tieneFactura ? facturaAplicada : undefined)
    return
  }
  if (cuota.saldo_cents === 0) {
    summary.invoicesUnderReview++
    detail({ ...base, resultado: 'en_revision', motivo: 'saldo 0 sin cobro: no es un pago' })
    return
  }
  if (cuota.saldo_cents < factura.saldo_cents) {
    summary.invoicesPartiallyPaidAtIsp++
    // Como en la referencia, en un abono parcial el monto mostrado es lo que aún debe el
    // administrador (15), no el saldo de Cobrix (20).
    detail({ ...base, resultado: 'abono_parcial', monto_cents: cuota.saldo_cents, motivo: `el administrador debe ${(cuota.saldo_cents / 100).toFixed(2)}, Cobrix ${(factura.saldo_cents / 100).toFixed(2)}. No se aplica: solo se aplican cuotas saldadas.` })
    return
  }
  summary.invoicesStillOpen++
  detail({ ...base, resultado: 'sigue_pendiente', motivo: 'La cuota sigue pendiente en el libro de pagos del administrador.' })
}
