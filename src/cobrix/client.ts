/**
 * Centraliza las llamadas HTTP al administrador de facturas: inicio de sesión, contratos y pagos.
 * También adapta aquí las respuestas particulares del proveedor para que el resto de Cobrix
 * trabaje con una forma de datos consistente.
 */

import type { ProviderConfig } from './config.ts'

export type ApiRow = Record<string, unknown>

/**
 * Base de la API a partir de la URL configurada. Acepta la URL con o sin `/api/v1` (o cualquier
 * sufijo), como en el formulario de Cobrix: se queda con el origen y añade `/api/v1`.
 */
export function apiBase(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '')
  if (!trimmed) return trimmed
  try {
    return `${new URL(trimmed).origin}/api/v1`
  } catch {
    return trimmed
  }
}

/** Error de la API con el status y el cuerpo crudo, para poder registrarlo en la corrida. */
export class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(status: number, body: unknown) {
    super(messageFromBody(status, body))
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

function messageFromBody(status: number, body: unknown): string {
  if (Array.isArray(body)) {
    const first = body[0] as { message?: string; field?: string } | undefined
    if (first?.message) return `${first.field ? `${first.field}: ` : ''}${first.message}`
  }
  if (body && typeof body === 'object') {
    const detail = (body as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
    if (detail && typeof detail === 'object') {
      const mensaje = (detail as { mensaje?: unknown }).mensaje
      if (typeof mensaje === 'string') return mensaje
    }
    const message = (body as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return `La API respondió ${status}`
}

interface LoginResponse {
  access_token: string
  access_token_expires_in: string
  usuario?: string
  email?: string
}

export class BillingApiClient {
  readonly #base: string
  readonly #user: string
  readonly #password: string
  #token: string | null = null
  #expiresAt = 0

  constructor(provider: Pick<ProviderConfig, 'url' | 'usuario' | 'password'>) {
    this.#base = apiBase(provider.url)
    this.#user = provider.usuario
    this.#password = provider.password
  }

  /** Comprueba las credenciales y confirma que se pueden consultar los contratos. */
  async testConnection(): Promise<{ usuario: string; contratos: number }> {
    await this.#login(true)
    const ids = await this.contractIds()
    return { usuario: this.#user, contratos: ids.length }
  }

  async #login(force = false): Promise<void> {
    // Se renueva antes del vencimiento para evitar que una petición use un token caducado.
    if (!force && this.#token && Date.now() < this.#expiresAt - 30_000) return
    const response = await fetch(`${this.#base}/usuario/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_name: this.#user, password: this.#password }),
    })
    const body = await parseBody(response)
    if (!response.ok) throw new ApiError(response.status, body)
    const data = body as LoginResponse
    if (typeof data?.access_token !== 'string') {
      throw new ApiError(response.status, { detail: { mensaje: 'Respuesta de login sin access_token' } })
    }
    this.#token = data.access_token
    // El proveedor entrega la fecha de expiración en UTC, sin indicar la zona horaria.
    const parsed = Date.parse(`${data.access_token_expires_in}Z`)
    this.#expiresAt = Number.isNaN(parsed) ? Date.now() + 7_200_000 : parsed
  }

  async #get<T>(path: string): Promise<T> {
    await this.#login()
    let response = await fetch(`${this.#base}${path}`, { headers: { authorization: `Bearer ${this.#token}` } })
    if (response.status === 401) {
      await this.#login(true)
      response = await fetch(`${this.#base}${path}`, { headers: { authorization: `Bearer ${this.#token}` } })
    }
    const body = await parseBody(response)
    if (!response.ok) throw new ApiError(response.status, body)
    return body as T
  }

  /**
   * IDs de todos los contratos. Nunca se manda `estado`: cualquier valor devolvería solo los
   * activos, y la corrida debe recorrer todos los contratos.
   */
  async contractIds(): Promise<number[]> {
    const envelope = await this.#get<{ data?: unknown }>('/isp/lista_ids_contratos')
    const data = envelope?.data
    if (!Array.isArray(data)) {
      throw new ApiError(200, { detail: { mensaje: 'lista_ids_contratos sin arreglo data' } })
    }
    return data.map(Number).filter(Number.isFinite)
  }

  /** Cuotas pendientes de un contrato. Devuelve una lista SIN envoltorio, sin orden. */
  async contractInstallments(contratoId: number): Promise<ApiRow[]> {
    const rows = await this.#get<unknown>(`/isp/contrato/individual?id_contrato=${encodeURIComponent(contratoId)}`)
    if (!Array.isArray(rows)) {
      throw new ApiError(200, { detail: { mensaje: 'contrato/individual no devolvió una lista' } })
    }
    return rows as ApiRow[]
  }

  /** Libro de cuotas y pagos de un contrato en un rango de fechas. */
  async paymentLedger(contratoId: number, fechaInicio: string, fechaFin: string): Promise<ApiRow[]> {
    return this.#paymentLedger({ id_contrato: String(contratoId) }, fechaInicio, fechaFin)
  }

  /** Igual que `paymentLedger` pero por documento del titular: el libro puede traer varias cuotas/contratos. */
  async paymentLedgerByIdentificacion(identificacion: string, fechaInicio: string, fechaFin: string): Promise<ApiRow[]> {
    return this.#paymentLedger({ identificacion }, fechaInicio, fechaFin)
  }

  async #paymentLedger(filtro: Record<string, string>, fechaInicio: string, fechaFin: string): Promise<ApiRow[]> {
    const query = new URLSearchParams({
      ...filtro,
      tipo_busqueda: 'CUOTA',
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
    })
    const envelope = await this.#get<{ data?: unknown }>(`/isp/pago_informacion?${query}`)
    const data = envelope?.data
    // En algunas respuestas `success` no refleja los datos; el contenido útil está en `data`.
    if (!Array.isArray(data)) {
      throw new ApiError(200, { detail: { mensaje: 'pago_informacion sin arreglo data' } })
    }
    return data as ApiRow[]
  }
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
