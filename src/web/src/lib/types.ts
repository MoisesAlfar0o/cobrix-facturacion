/**
 * Tipos de los datos que devuelve la API JSON del panel. Se declaran aquí (no se importan del
 * backend) para que el frontend sea independiente del código de Node.
 */

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'mute'
export type RunType = 'importacion' | 'pagadas'
export type RunStatus = 'en_curso' | 'completada' | 'fallida'
export type InvoiceStatus = 'abierta' | 'pagada'

export interface Cliente {
  readonly id: number
  readonly identificacion: string
  readonly identificacion_proveedor: string
  readonly nombre: string
  readonly tipo: string
  readonly email: string
  readonly telefono: string
  readonly origen: string
  readonly created_at: string
}

export interface ClienteResumen extends Cliente {
  readonly contratos: number
  readonly abiertas: number
  readonly pagadas: number
  readonly deuda_cents: number
  readonly vencimiento: string | null
}

export interface Contrato {
  readonly id: number
  readonly cliente_id: number | null
  readonly estado: string
  readonly plan: string
  readonly precio_cents: number
  readonly sucursal: string
  readonly moneda_sigla: string
  readonly direccion: string
}

export interface Factura {
  readonly id: number
  readonly cliente_id: number
  readonly contrato_id: number
  readonly deuda_id: string
  readonly num_factura: string
  readonly periodo: string
  readonly vencimiento: string
  readonly corte: string
  readonly total_cents: number
  readonly saldo_cents: number
  readonly estado: InvoiceStatus
  readonly pagada_en: string | null
  readonly created_at: string
  readonly descripcion: string
}

export interface Historial {
  readonly id: number
  readonly cliente_id: number | null
  readonly factura_id: number | null
  readonly tipo: string
  readonly detalle: string
  readonly fecha: string
  readonly num_factura: string | null
}

export interface Corrida {
  readonly id: number
  readonly tipo: RunType
  readonly simulacion: number
  readonly estado: RunStatus
  readonly inicio: string
  readonly fin: string | null
  readonly resumen: string
  readonly error: string | null
}

export interface CorridaDetalle {
  readonly id: number
  readonly corrida_id: number
  readonly contrato_id: number
  readonly deuda_id: string
  readonly periodo: string
  readonly resultado: string
  readonly motivo: string
  readonly cliente: string
  readonly monto_cents: number
}

export interface ImportConfig {
  readonly estadosImportables: string[]
  readonly ventanaMeses: number | null
  readonly maxCuotasRecientes: number | null
  readonly diasGracia: number
  readonly maxFacturasPorCorrida: number | null
  readonly maxMontoPorCorrida: number | null
  readonly excluirTiposDocumento: string[]
  readonly ventanaPagadasMeses: number
  readonly corridaAutomatica: boolean
  readonly horaCorrida: string
}

export interface AppConfig {
  readonly empresa: { nombre: string; rif: string; emailCobranza: string; zonaHoraria: string; moneda: string }
  readonly proveedor: { nombre: string; url: string; usuario: string; password: string }
  readonly importacion: ImportConfig
}

export interface Summary {
  readonly clientes: number
  readonly contratos: number
  readonly abiertas: number
  readonly pagadas: number
  readonly porCobrar_cents: number
  readonly fechaSandbox: string
  readonly ultimaImportacion: Corrida | undefined
  readonly ultimaPagadas: Corrida | undefined
}

export interface SummaryPayload {
  readonly summary: Summary
  readonly config: AppConfig
  readonly simulador: string
  readonly proveedorUrl: string
  readonly runs: Corrida[]
  readonly mora: { clientes: number; monto_cents: number; hoy: string }
  readonly topDeudores: ClienteResumen[]
}

export interface ClientListPayload {
  readonly rows: ClienteResumen[]
  readonly total: number
  readonly hoy: string
}

export interface ExpedientePayload {
  readonly cliente: Cliente
  readonly contratos: Contrato[]
  readonly facturas: Factura[]
  readonly historial: Historial[]
}

export interface RunDetailPayload {
  readonly run: Corrida
  readonly detalles: CorridaDetalle[]
}

export interface ConfigPayload {
  readonly config: AppConfig
  readonly simulador: string
}

export interface MetaPayload {
  readonly company: string
  readonly simulador: string
}

export interface ActionResult {
  readonly ok: boolean
  readonly mensaje: string
  readonly tone: Tone
  readonly company?: string
}

export interface RunResult {
  readonly corridaId: number
}
