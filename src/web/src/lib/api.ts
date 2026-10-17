/**
 * Cliente de la API JSON del panel. Todas las pantallas pasan por aquí: un único lugar para las
 * rutas, el `fetch` y el manejo de errores.
 */

import type {
  ActionResult, ClientListPayload, ConfigPayload, ExpedientePayload, MetaPayload,
  RunDetailPayload, RunResult, SummaryPayload,
} from './types.ts'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { headers: { 'content-type': 'application/json' }, ...init })
  const body = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new ApiError(response.status, body.error ?? `Error ${response.status}`)
  return body as T
}

const post = <T>(path: string, body: unknown = {}): Promise<T> =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) })

const query = (params: Record<string, string>): string => {
  const search = new URLSearchParams(params).toString()
  return search ? `?${search}` : ''
}

export const api = {
  meta: () => request<MetaPayload>('/api/meta'),
  summary: () => request<SummaryPayload>('/api/summary'),
  clientes: (q = '') => request<ClientListPayload>(`/api/clientes${query(q ? { q } : {})}`),
  expediente: (id: number) => request<ExpedientePayload>(`/api/clientes/${id}`),
  runs: () => request<{ runs: SummaryPayload['runs'] }>('/api/runs'),
  run: (id: number) => request<RunDetailPayload>(`/api/runs/${id}`),
  config: () => request<ConfigPayload>('/api/config'),
  enunciado: () => request<{ texto: string }>('/api/enunciado'),

  importar: (simulacion: boolean) => post<RunResult>('/api/runs/import', { simulacion }),
  actualizarPagadas: (simulacion: boolean) => post<RunResult>('/api/runs/pagadas', { simulacion }),
  guardarConfig: (config: unknown) => post<ActionResult>('/api/config', config),
  probarConexion: (config: unknown) => post<ActionResult>('/api/config/probar', config),
  borrarDatos: () => post<ActionResult>('/api/reset'),
}
