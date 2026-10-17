import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { createApiHandler } from '../src/server/api.ts'
import { createPanelServer } from '../src/server/panel.ts'
import { SANDBOX_API_USER, seedBillingApi } from '../src/billing-api/seed.ts'
import { createBillingApiServer, type BillingApiServer } from '../src/billing-api/server.ts'
import { CobrixStore } from '../src/cobrix/store.ts'

process.env.SANDBOX_TODAY = '2026-10-13'

describe('entorno de Cobrix', () => {
  let dir: string
  let billingApi: BillingApiServer
  let billingApiUrl: string
  let panelUrl: string
  let panel: ReturnType<typeof createPanelServer>
  let store: CobrixStore

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'cobrix-entorno-'))
    const billingDb = join(dir, 'billing-api.sqlite')
    seedBillingApi(billingDb)
    billingApi = createBillingApiServer(billingDb)
    billingApiUrl = `http://127.0.0.1:${await billingApi.listen(0)}`
    store = new CobrixStore(join(dir, 'cobrix.sqlite'))

    const publicDir = join(dir, 'public')
    mkdirSync(join(publicDir, 'assets'), { recursive: true })
    writeFileSync(join(publicDir, 'index.html'), '<!doctype html><div id="root">Panel Cobrix</div>')
    writeFileSync(join(publicDir, 'assets', 'app.css'), 'body { color: #17212f; }')

    const api = createApiHandler({
      simulatorUrl: billingApiUrl,
      assignmentPath: fileURLToPath(new URL('../docs/ENUNCIADO.md', import.meta.url)),
      store,
    })
    panel = createPanelServer(publicDir, api)
    await new Promise<void>(resolve => panel.listen(0, '127.0.0.1', resolve))
    const address = panel.address()
    assert.ok(address && typeof address !== 'string')
    panelUrl = `http://127.0.0.1:${address.port}`
  })

  after(async () => {
    await new Promise<void>((resolve, reject) => panel.close(error => error ? reject(error) : resolve()))
    await billingApi.close()
    store.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('la API del administrador permite iniciar sesión y consultar contratos', async () => {
    const loginResponse = await fetch(`${billingApiUrl}/api/v1/usuario/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_name: SANDBOX_API_USER.user_name, password: SANDBOX_API_USER.password }),
    })
    assert.equal(loginResponse.status, 200)
    const login = await loginResponse.json() as { access_token: string }

    const contractsResponse = await fetch(`${billingApiUrl}/api/v1/isp/lista_ids_contratos`, {
      headers: { authorization: `Bearer ${login.access_token}` },
    })
    const contracts = await contractsResponse.json() as { data: number[] }
    assert.equal(contracts.data.length, 27)

    const contractResponse = await fetch(`${billingApiUrl}/api/v1/isp/contrato/individual?id_contrato=900101`, {
      headers: { authorization: `Bearer ${login.access_token}` },
    })
    const installments = await contractResponse.json() as Array<{ contrato_id: number }>
    assert.ok(installments.length > 0)
    assert.equal(installments[0]!.contrato_id, 900101)
  })

  it('las rutas publicadas por Swagger responden', async () => {
    const specResponse = await fetch(`${billingApiUrl}/openapi.json`)
    const spec = await specResponse.json() as { paths: Record<string, Record<string, unknown>> }

    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const method of Object.keys(methods)) {
        if (path === '/__sim/reiniciar') continue
        const response = await fetch(`${billingApiUrl}${path}`, {
          method: method.toUpperCase(),
          ...(method === 'post' ? { body: '{}' } : {}),
        })
        assert.ok(![404, 405].includes(response.status), `${method} ${path}`)
      }
    }
  })

  it('el panel devuelve los datos de Cobrix y el enunciado por su API', async () => {
    const summaryResponse = await fetch(`${panelUrl}/api/summary`)
    assert.equal(summaryResponse.status, 200)
    const summary = await summaryResponse.json() as { config?: { importacion?: unknown } }
    assert.ok(summary.config?.importacion)

    const assignmentResponse = await fetch(`${panelUrl}/api/enunciado`)
    const assignment = await assignmentResponse.json() as { texto: string }
    assert.match(assignment.texto, /Criterios de aceptación/)
  })

  it('muestra el nombre guardado y probar la conexión no guarda cambios', async () => {
    const configResponse = await fetch(`${panelUrl}/api/config`)
    const { config } = await configResponse.json() as {
      config: {
        empresa: { nombre: string }
        proveedor: { url: string; usuario: string; password: string }
        importacion: Record<string, unknown>
      }
    }
    config.empresa.nombre = 'Empresa de prueba'

    const saveResponse = await fetch(`${panelUrl}/api/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(config),
    })
    assert.equal(saveResponse.status, 200)
    const saveResult = await saveResponse.json() as { company: string }
    assert.equal(saveResult.company, 'Empresa de prueba')

    const metaResponse = await fetch(`${panelUrl}/api/meta`)
    assert.equal((await metaResponse.json() as { company: string }).company, 'Empresa de prueba')

    const probeConfig = structuredClone(config)
    probeConfig.empresa.nombre = 'Este nombre no debe guardarse'
    probeConfig.proveedor.url = billingApiUrl
    probeConfig.proveedor.usuario = SANDBOX_API_USER.user_name
    probeConfig.proveedor.password = SANDBOX_API_USER.password
    const probeResponse = await fetch(`${panelUrl}/api/config/probar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(probeConfig),
    })
    assert.equal(probeResponse.status, 200)
    assert.equal((await probeResponse.json() as { ok: boolean }).ok, true)

    const finalMetaResponse = await fetch(`${panelUrl}/api/meta`)
    assert.equal((await finalMetaResponse.json() as { company: string }).company, 'Empresa de prueba')
  })

  it('sirve el panel en la ruta principal y no intenta leer carpetas como archivos', async () => {
    const rootResponse = await fetch(`${panelUrl}/`)
    assert.equal(rootResponse.status, 200)
    assert.match(await rootResponse.text(), /Panel Cobrix/)

    const folderResponse = await fetch(`${panelUrl}/assets/`)
    assert.equal(folderResponse.status, 200)
    assert.match(await folderResponse.text(), /Panel Cobrix/)

    const assetResponse = await fetch(`${panelUrl}/assets/app.css`)
    assert.equal(assetResponse.status, 200)
    assert.match(assetResponse.headers.get('content-type') ?? '', /text\/css/)
    assert.match(await assetResponse.text(), /color/)
  })
})
