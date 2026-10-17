/** Crea el cliente del proveedor y coordina las corridas manuales y automáticas. */

import { caracasToday } from '../shared/dates.ts'
import { BillingApiClient } from './client.ts'
import type { AppConfig } from './config.ts'
import { runImport } from './import.ts'
import { runUpdatePaid } from './payment.ts'
import { apiBase } from './client.ts'
import type { CobrixStore } from './store.ts'

/** Usa la URL configurada; si está vacía, recurre a la dirección del simulador local. */
export function providerUrl(config: AppConfig, fallbackUrl: string): string {
  return apiBase(config.proveedor.url) || apiBase(fallbackUrl)
}

export function makeClient(config: AppConfig, fallbackUrl: string): BillingApiClient {
  return new BillingApiClient({
    url: providerUrl(config, fallbackUrl),
    usuario: config.proveedor.usuario,
    password: config.proveedor.password,
  })
}

export async function importFromConfig(store: CobrixStore, options: { simulacion: boolean; fallbackUrl: string }): Promise<number> {
  const client = makeClient(store.getConfig(), options.fallbackUrl)
  return runImport(client, store, { simulacion: options.simulacion })
}

export async function updatePaidFromConfig(store: CobrixStore, options: { simulacion: boolean; fallbackUrl: string }): Promise<number> {
  const client = makeClient(store.getConfig(), options.fallbackUrl)
  return runUpdatePaid(client, store, { simulacion: options.simulacion })
}

/**
 * Revisa cada minuto si llegó la hora programada en Caracas. Ese día ejecuta primero la
 * importación y luego la actualización de pagos, sin repetir la corrida.
 */
export function startScheduler(store: CobrixStore, options: { fallbackUrl: string }): () => void {
  let lastRunDay = ''
  const timer = setInterval(() => {
    const config = store.getConfig()
    if (!config.importacion.corridaAutomatica) return
    const now = new Date()
    const caracas = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(now)
    const day = caracasToday(now)
    if (caracas !== config.importacion.horaCorrida || lastRunDay === day) return
    lastRunDay = day
    void (async () => {
      try {
        await importFromConfig(store, { simulacion: false, fallbackUrl: options.fallbackUrl })
        await updatePaidFromConfig(store, { simulacion: false, fallbackUrl: options.fallbackUrl })
        console.log(`[cobrix] corrida automática ${day} ${caracas} completada`)
      } catch (error) {
        console.error('[cobrix] corrida automática falló', error)
      }
    })()
  }, 60_000)
  timer.unref()
  return () => clearInterval(timer)
}
