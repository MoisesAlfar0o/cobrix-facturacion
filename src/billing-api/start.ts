import { existsSync } from 'node:fs'

import { DEFAULT_BILLING_API_DB } from './seed.ts'
import { createBillingApiServer } from './server.ts'

const port = Number(process.env.BILLING_API_PORT ?? 4310)
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
	throw new Error(`Puerto inválido para BILLING_API_PORT: ${process.env.BILLING_API_PORT}`)
}

if (!existsSync(DEFAULT_BILLING_API_DB)) {
	throw new Error(`No existe ${DEFAULT_BILLING_API_DB}. Ejecuta primero: npm run seed`)
}

const api = createBillingApiServer(DEFAULT_BILLING_API_DB)
const listeningPort = await api.listen(port)
console.log(`API del administrador disponible en http://127.0.0.1:${listeningPort}/docs`)

let closing = false
const close = (): void => {
	if (closing) return
	closing = true
	void api.close()
}

process.once('SIGINT', close)
process.once('SIGTERM', close)
