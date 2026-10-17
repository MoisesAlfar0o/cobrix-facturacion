/**
 * Endpoints que usa el panel React. Aquí se reúnen las lecturas y acciones de la interfaz;
 * las reglas de importación y conciliación siguen en los módulos de Cobrix.
 */

import { type IncomingMessage, type ServerResponse } from 'node:http'
import { readFileSync } from 'node:fs'

import type { AppConfig } from '../cobrix/config.ts'
import { providerUrl, importFromConfig, makeClient, updatePaidFromConfig } from '../cobrix/service.ts'
import type { CobrixStore, RunType } from '../cobrix/store.ts'
import { today } from '../shared/dates.ts'
import { parseConfig } from './config-input.ts'

export interface ApiDeps {
  /** URL base de la API simulada (por ejemplo, http://127.0.0.1:4310). */
  readonly simulatorUrl: string
  /** Ruta de docs/ENUNCIADO.md, servida en /api/enunciado. */
  readonly assignmentPath: string
  /** Almacén propio de Cobrix. */
  readonly store: CobrixStore
}

interface ApiResponse {
  status: number
  body: unknown
}

const json = (res: ServerResponse, status: number, body: unknown): void => {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(payload)
}

/** Lee el cuerpo JSON de una petición; un cuerpo vacío o inválido se trata como objeto vacío. */
async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {}
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return {}
  }
}

const referencia = (url: string): string => {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}

export interface ApiHandler {
  readonly handle: (req: IncomingMessage, res: ServerResponse) => Promise<void>
}

export function createApiHandler(deps: ApiDeps): ApiHandler {
  const { store } = deps
  const providerBase = (config: AppConfig): string => referencia(providerUrl(config, deps.simulatorUrl)).replace('://0.0.0.0', '://127.0.0.1')
  /** URL del simulador para enlazar desde el navegador (0.0.0.0 no es navegable). */
  const simulador = deps.simulatorUrl.replace('://0.0.0.0', '://127.0.0.1')

  const resumen = (): unknown => {
    const s = store.summary()
    const config = store.getConfig()
    const clientes = store.listClientes()
    const hoy = s.fechaSandbox
    const enMora = clientes.filter(c => c.vencimiento && c.vencimiento < hoy)
    const topDeudores = [...clientes].filter(c => c.deuda_cents > 0).sort((a, b) => b.deuda_cents - a.deuda_cents).slice(0, 5)
    return {
      summary: s,
      config,
      simulador,
      proveedorUrl: providerBase(config),
      runs: store.listRuns(5),
      mora: { clientes: enMora.length, monto_cents: enMora.reduce((sum, c) => sum + c.deuda_cents, 0), hoy },
      topDeudores,
    }
  }

  const expediente = (id: number): ApiResponse => {
    const cliente = store.clienteById(id)
    if (!cliente) return { status: 404, body: { error: 'Cliente no encontrado' } }
    return {
      status: 200,
      body: {
        cliente,
        contratos: store.contratosDeCliente(id),
        facturas: store.facturasDeCliente(id),
        historial: store.historialDeCliente(id),
      },
    }
  }

  const corrida = (id: number): ApiResponse => {
    const run = store.runById(id)
    if (!run) return { status: 404, body: { error: 'Corrida no encontrada' } }
    return { status: 200, body: { run, detalles: store.runDetails(id) } }
  }

  async function ejecutarCorrida(res: ServerResponse, tipo: RunType, simulacion: boolean): Promise<void> {
    const corridaId = tipo === 'pagadas'
      ? await updatePaidFromConfig(store, { simulacion, fallbackUrl: deps.simulatorUrl })
      : await importFromConfig(store, { simulacion, fallbackUrl: deps.simulatorUrl })
    json(res, 200, { corridaId })
  }

  async function guardarConfig(res: ServerResponse, body: unknown, probar: boolean): Promise<void> {
    const config = parseConfig(body, store.getConfig())
    if (!probar) {
      store.saveConfig(config)
      return json(res, 200, {
        ok: true,
        mensaje: 'Configuración guardada.',
        tone: 'ok',
        company: config.empresa.nombre || 'Tu empresa',
      })
    }
    try {
      const result = await makeClient(config, deps.simulatorUrl).testConnection()
      json(res, 200, { ok: true, mensaje: `Conexión correcta con ${config.proveedor.usuario}: ${result.contratos} contratos.`, tone: 'ok' })
    } catch (error) {
      json(res, 200, { ok: false, mensaje: `No se pudo conectar: ${error instanceof Error ? error.message : String(error)}`, tone: 'bad' })
    }
  }

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://panel.local')
    const path = url.pathname.replace(/\/+$/, '') || '/'
    const method = req.method ?? 'GET'

    if (!path.startsWith('/api')) return json(res, 404, { error: 'No encontrado' })

    if (method === 'GET') {
      if (path === '/api/meta') return json(res, 200, { company: store.getConfig().empresa.nombre || 'Tu empresa', simulador })
      if (path === '/api/summary') return json(res, 200, resumen())
      if (path === '/api/clientes') return json(res, 200, { rows: store.listClientes(url.searchParams.get('q') ?? ''), total: store.listClientes().length, hoy: store.summary().fechaSandbox })
      if (path === '/api/runs') return json(res, 200, { runs: store.listRuns(30) })
      if (path === '/api/config') return json(res, 200, { config: store.getConfig(), simulador })
      if (path === '/api/enunciado') {
        let text: string
        try {
          text = readFileSync(deps.assignmentPath, 'utf8')
        } catch {
          text = 'No se encontró docs/ENUNCIADO.md.'
        }
        return json(res, 200, { texto: text })
      }
      const clienteMatch = /^\/api\/clientes\/(\d+)$/.exec(path)
      if (clienteMatch) {
        const { status, body } = expediente(Number(clienteMatch[1]))
        return json(res, status, body)
      }
      const corridaMatch = /^\/api\/runs\/(\d+)$/.exec(path)
      if (corridaMatch) {
        const { status, body } = corrida(Number(corridaMatch[1]))
        return json(res, status, body)
      }
      return json(res, 404, { error: 'No encontrado' })
    }

    if (method === 'POST') {
      const body = await readJson(req)
      const simulacion = body !== null && typeof body === 'object' && (body as Record<string, unknown>).simulacion === true
      if (path === '/api/runs/import') return ejecutarCorrida(res, 'importacion', simulacion)
      if (path === '/api/runs/pagadas') return ejecutarCorrida(res, 'pagadas', simulacion)
      if (path === '/api/config') return guardarConfig(res, body, false)
      if (path === '/api/config/probar') return guardarConfig(res, body, true)
      if (path === '/api/reset') {
        store.borrarDatosImportados()
        return json(res, 200, { ok: true, mensaje: 'Datos importados borrados. Se conserva la configuración.', tone: 'ok' })
      }
      return json(res, 404, { error: 'No encontrado' })
    }

    json(res, 405, { error: 'Método no permitido' })
  }

  return {
    handle: (req, res) => route(req, res).catch((error: unknown) => {
      console.error('[api]', error)
      if (!res.headersSent) json(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }),
  }
}

export { today }
