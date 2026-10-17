/**
 * Ciclo completo contra la API simulada REAL (sin mocks): importar → pagar en la caja del ISP →
 * actualizar pagadas. Comprueba los números de los criterios de aceptación (§5) y la idempotencia.
 */

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'

import { seedBillingApi } from '../src/billing-api/seed.ts'
import { createBillingApiServer, type BillingApiServer } from '../src/billing-api/server.ts'
import { BillingApiClient } from '../src/cobrix/client.ts'
import { runImport } from '../src/cobrix/import.ts'
import { runUpdatePaid } from '../src/cobrix/payment.ts'
import { CobrixStore } from '../src/cobrix/store.ts'

process.env.SANDBOX_TODAY = '2026-10-13'

describe('ciclo completo de la integración', () => {
        let dir: string
        let api: BillingApiServer
        let base: string
        let store: CobrixStore
        let client: BillingApiClient

        const cashier = async (route: string, body: unknown): Promise<Record<string, unknown>> =>
                (await (await fetch(`${base}/__sim/${route}`, { method: 'POST', body: JSON.stringify(body) })).json()) as Record<string, unknown>

        before(async () => {
                dir = mkdtempSync(join(tmpdir(), 'ciclo-'))
                seedBillingApi(join(dir, 'billing-api.sqlite'))
                api = createBillingApiServer(join(dir, 'billing-api.sqlite'))
                base = `http://127.0.0.1:${await api.listen(0)}`
                store = new CobrixStore(join(dir, 'cobrix.sqlite'))
                client = new BillingApiClient({ url: `${base}/api/v1`, usuario: 'cobrix', password: 'cobrix-sandbox' })
        })

        after(async () => {
                await api.close()
                store.close()
                rmSync(dir, { recursive: true, force: true })
        })

        it('simular importación cuenta sin escribir', async () => {
                await runImport(client, store, { simulacion: true })
                const summary = store.summary()
                assert.equal(summary.clientes, 0)
                assert.equal(summary.abiertas, 0)
                const run = store.listRuns(1)[0]!
                const resumen = JSON.parse(run.resumen) as Record<string, number>
                assert.equal(resumen.installmentsWouldImport, 42)
                assert.equal(resumen.customersCreated, 20)
                assert.equal(resumen.contractsObserved, 27)
                assert.equal(resumen.contractsWithDebt, 26)
                assert.equal(resumen.installmentsPending, 53)
        })

        it('importar crea 20 clientes y 42 facturas por USD 1.235,00', async () => {
                await runImport(client, store, { simulacion: false })
                const summary = store.summary()
                assert.equal(summary.clientes, 20)
                assert.equal(summary.abiertas, 42)
                assert.equal(summary.porCobrar_cents, 123_500)
                const resumen = JSON.parse(store.listRuns(1)[0]!.resumen) as Record<string, number>
                assert.equal(resumen.installmentsImported, 42)
                assert.equal(resumen.installmentsExcludedByStatus, 9)
                assert.equal(resumen.contractsCurrencyIncoherent, 1)
                assert.equal(resumen.installmentsZeroAmount, 1)
                assert.equal(resumen.installmentsPending, 53)
        })

        it('los titulares que no deben aparecer no se importaron', () => {
                for (const identificacion of ['V15111222', 'V16222333', 'V17333444', 'V21777888', 'V18444555', 'V19555666']) {
                        assert.equal(store.clienteByIdentificacion(identificacion), undefined, identificacion)
                }
        })

        it('LUIS GOMEZ es un cliente con dos contratos; ELENA RUIZ normaliza su cédula', () => {
                const luis = store.clienteByIdentificacion('V9876543')
                assert.ok(luis)
                assert.equal(store.contratosDeCliente(luis.id).length, 2)
                const elena = store.clienteByIdentificacion('9000123')
                assert.ok(elena)
                assert.equal(elena.identificacion, '9000123')
        })

        it('importar otra vez no duplica nada (idempotencia)', async () => {
                await runImport(client, store, { simulacion: false })
                const summary = store.summary()
                assert.equal(summary.clientes, 20)
                assert.equal(summary.abiertas, 42)
                const resumen = JSON.parse(store.listRuns(1)[0]!.resumen) as Record<string, number>
                assert.equal(resumen.installmentsImported, 0)
                assert.equal(resumen.installmentsAlreadyImported, 42)
        })

        it('actualizar pagadas marca 8 pagadas y deja 34 abiertas por USD 955,00', async () => {
                await cashier('pagar', { id_contrato: 900101 })
                await cashier('pagar', { id_contrato: 900103, monto: 25 })
                await cashier('pagar', { id_contrato: 900104 })
                await cashier('pagar', { id_contrato: 900114, monto: 70 })
                const elena = await cashier('pagar', { id_contrato: 900113 })
                await cashier('anular', { id_factura: elena.id_factura })

                await runUpdatePaid(client, store, { simulacion: false })
                const summary = store.summary()
                assert.equal(summary.pagadas, 8)
                assert.equal(summary.abiertas, 34)
                assert.equal(summary.porCobrar_cents, 95_500)
                const resumen = JSON.parse(store.listRuns(1)[0]!.resumen) as Record<string, number>
                assert.equal(resumen.invoicesChecked, 42)
                assert.equal(resumen.invoicesMarkedPaid, 8)
                assert.equal(resumen.invoicesStillOpen, 33)
                assert.equal(resumen.invoicesPartiallyPaidAtIsp, 1)
                assert.equal(resumen.invoicesUnknown, 0)
                // El libro se consulta por titular: LUIS GOMEZ tiene dos contratos y cuenta una vez.
                assert.equal(resumen.contractsRead, 18)
        })

        it('repetir la actualización no cambia nada', async () => {
                await runUpdatePaid(client, store, { simulacion: false })
                const summary = store.summary()
                assert.equal(summary.pagadas, 8)
                assert.equal(summary.abiertas, 34)
        })
})
