/**
 * Levanta en un solo proceso el panel de Cobrix y la API simulada del administrador.
 * La fecha queda fijada para que los resultados coincidan con los criterios de aceptación.
 * Para cambiarla, define SANDBOX_TODAY antes de iniciar el servidor.
 */

import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

process.env.SANDBOX_TODAY ??= '2026-10-13'

const { DEFAULT_BILLING_API_DB, seedBillingApi } = await import('./billing-api/seed.ts')
const { createBillingApiServer } = await import('./billing-api/server.ts')
const { createApiHandler } = await import('./server/api.ts')
const { createPanelServer } = await import('./server/panel.ts')
const { CobrixStore, DEFAULT_COBRIX_DB } = await import('./cobrix/store.ts')
const { startScheduler } = await import('./cobrix/service.ts')

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const billingApiDb = process.env.BILLING_API_DB ?? DEFAULT_BILLING_API_DB
const cobrixDb = process.env.COBRIX_DB ?? DEFAULT_COBRIX_DB
const appPort = Number(process.env.PORT ?? 4300)
const billingApiPort = Number(process.env.BILLING_API_PORT ?? 4310)
const host = process.env.HOST ?? '127.0.0.1'
/** URL para mostrar: si se escucha en todas las interfaces, se muestra 127.0.0.1. */
const displayHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host

if (!existsSync(billingApiDb)) seedBillingApi(billingApiDb)

const billingApi = createBillingApiServer(billingApiDb)
await billingApi.listen(billingApiPort, host)
const simulatorUrl = `http://${host}:${billingApiPort}`

const store = new CobrixStore(cobrixDb)
const apiHandler = createApiHandler({ simulatorUrl, assignmentPath: resolve(root, 'docs/ENUNCIADO.md'), store })
const publicDir = resolve(root, 'src/web/public')
const panel = createPanelServer(publicDir, apiHandler)
panel.listen(appPort, host)
const stopScheduler = startScheduler(store, { fallbackUrl: simulatorUrl })

console.log(`Panel (React) y API:      http://${displayHost}:${appPort}`)
console.log(`API del administrador:    http://${displayHost}:${billingApiPort}/api/v1`)
console.log(`Swagger:                  http://${displayHost}:${billingApiPort}/docs`)
console.log(`Base de Cobrix:           ${cobrixDb}`)
console.log(`Panel compilado:          ${publicDir}${existsSync(publicDir) ? '' : ' (falta: pnpm run build:web)'}`)
console.log(`Fecha de la prueba:       ${process.env.SANDBOX_TODAY}`)

const shutdown = (): void => {
  stopScheduler()
  panel.close()
  void billingApi.close().then(() => {
    store.close()
    process.exit(0)
  })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
