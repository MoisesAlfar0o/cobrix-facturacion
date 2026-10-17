/**
 * Base local de Cobrix. Conserva configuración, clientes, contratos, facturas, corridas e
 * historial; los importes se guardan en centavos para evitar errores de redondeo. La base del
 * administrador de facturas se consulta, pero nunca se modifica.
 */

import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

import { today } from '../shared/dates.ts'
import { DEFAULT_CONFIG, type AppConfig } from './config.ts'
import type { ContractState, PersonType } from './rules.ts'

export const DEFAULT_COBRIX_DB = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/cobrix.sqlite')

export type InvoiceStatus = 'abierta' | 'pagada'
export type RunType = 'importacion' | 'pagadas'
export type RunStatus = 'en_curso' | 'completada' | 'fallida'

export interface Cliente {
  readonly id: number
  readonly identificacion: string
  /** Documento tal como lo reporta el proveedor (p. ej. «V-12345678»), para consultar su libro. */
  readonly identificacion_proveedor: string
  readonly nombre: string
  readonly tipo: PersonType
  readonly email: string
  readonly telefono: string
  readonly origen: string
  readonly created_at: string
}

export interface Contrato {
  readonly id: number
  /** Titular; `null` cuando el contrato se espeja pero no genera cliente (sin cuotas importables). */
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
  /** Etiqueta de la cuota, p. ej. «PLAN15MB25 - 2026 Agosto». */
  readonly descripcion: string
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

export interface Historial {
  readonly id: number
  readonly cliente_id: number | null
  readonly factura_id: number | null
  readonly tipo: string
  readonly detalle: string
  readonly fecha: string
  /** Número de Cobrix de la factura implicada (FAC-…), si la hay. */
  readonly num_factura: string | null
}

/** Fila agregada de la tabla de clientes (§3.5). */
export interface ClienteResumen extends Cliente {
  readonly contratos: number
  readonly abiertas: number
  readonly pagadas: number
  readonly deuda_cents: number
  readonly vencimiento: string | null
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cliente (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identificacion TEXT NOT NULL UNIQUE,
        identificacion_proveedor TEXT NOT NULL DEFAULT '',
        nombre TEXT NOT NULL,
        tipo TEXT NOT NULL,
        email TEXT NOT NULL DEFAULT '',
        telefono TEXT NOT NULL DEFAULT '',
        origen TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS contrato (
        id INTEGER PRIMARY KEY,
        cliente_id INTEGER REFERENCES cliente(id),
        estado TEXT NOT NULL,
        plan TEXT NOT NULL,
        precio_cents INTEGER NOT NULL DEFAULT 0,
        sucursal TEXT NOT NULL DEFAULT '',
        moneda_sigla TEXT NOT NULL DEFAULT 'USD',
        direccion TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS factura (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER NOT NULL REFERENCES cliente(id),
        contrato_id INTEGER NOT NULL REFERENCES contrato(id),
        deuda_id TEXT NOT NULL UNIQUE,
        num_factura TEXT NOT NULL,
        periodo TEXT NOT NULL,
        vencimiento TEXT NOT NULL,
        corte TEXT NOT NULL,
        total_cents INTEGER NOT NULL,
        saldo_cents INTEGER NOT NULL,
        estado TEXT NOT NULL DEFAULT 'abierta',
        pagada_en TEXT,
        created_at TEXT NOT NULL,
        descripcion TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS corrida (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL,
        simulacion INTEGER NOT NULL DEFAULT 0,
        estado TEXT NOT NULL,
        inicio TEXT NOT NULL,
        fin TEXT,
        resumen TEXT NOT NULL DEFAULT '{}',
        error TEXT
);
CREATE TABLE IF NOT EXISTS corrida_detalle (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        corrida_id INTEGER NOT NULL REFERENCES corrida(id),
        contrato_id INTEGER NOT NULL,
        deuda_id TEXT NOT NULL DEFAULT '',
        periodo TEXT NOT NULL DEFAULT '',
        resultado TEXT NOT NULL,
        motivo TEXT NOT NULL DEFAULT '',
        cliente TEXT NOT NULL DEFAULT '',
        monto_cents INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS historial (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER,
        factura_id INTEGER,
        tipo TEXT NOT NULL,
        detalle TEXT NOT NULL DEFAULT '',
        fecha TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS factura_contrato ON factura(contrato_id, estado);
CREATE INDEX IF NOT EXISTS factura_cliente ON factura(cliente_id, estado);
CREATE INDEX IF NOT EXISTS detalle_corrida ON corrida_detalle(corrida_id);
CREATE INDEX IF NOT EXISTS historial_cliente ON historial(cliente_id);
`

export class CobrixStore {
  readonly #db: DatabaseSync

  constructor(path: string = DEFAULT_COBRIX_DB) {
    mkdirSync(dirname(path), { recursive: true })
    this.#db = new DatabaseSync(path)
    this.#db.exec('PRAGMA foreign_keys = ON')
    this.#db.exec(SCHEMA)
    this.#migrate()
  }

  /** Agrega columnas que falten en bases creadas con una versión anterior. */
  #migrate(): void {
    const columns = (table: string): Set<string> =>
      new Set((this.#db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(row => row.name))
    const add = (table: string, column: string, ddl: string): void => {
      if (!columns(table).has(column)) this.#db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`)
    }
    add('contrato', 'direccion', "TEXT NOT NULL DEFAULT ''")
    add('cliente', 'identificacion_proveedor', "TEXT NOT NULL DEFAULT ''")
    add('factura', 'descripcion', "TEXT NOT NULL DEFAULT ''")
    add('corrida_detalle', 'cliente', "TEXT NOT NULL DEFAULT ''")
    add('corrida_detalle', 'monto_cents', 'INTEGER NOT NULL DEFAULT 0')
  }

  close(): void {
    this.#db.close()
  }

  // Configuración

  getConfig(): AppConfig {
    const row = this.#db.prepare('SELECT json FROM config WHERE id = 1').get() as { json: string } | undefined
    if (!row) return structuredClone(DEFAULT_CONFIG)
    try {
      const saved = JSON.parse(row.json) as Partial<AppConfig>
      const base = structuredClone(DEFAULT_CONFIG)
      return {
        empresa: { ...base.empresa, ...saved.empresa },
        proveedor: { ...base.proveedor, ...saved.proveedor },
        importacion: { ...base.importacion, ...saved.importacion },
      }
    } catch {
      return structuredClone(DEFAULT_CONFIG)
    }
  }

  saveConfig(config: AppConfig): void {
    this.#db.prepare('INSERT INTO config (id, json) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json')
      .run(JSON.stringify(config))
  }

  // Clientes

  clienteByIdentificacion(identificacion: string): Cliente | undefined {
    return this.#db.prepare('SELECT * FROM cliente WHERE identificacion = ?').get(identificacion) as Cliente | undefined
  }

  clienteById(id: number): Cliente | undefined {
    return this.#db.prepare('SELECT * FROM cliente WHERE id = ?').get(id) as Cliente | undefined
  }

  createCliente(input: { identificacion: string; identificacionProveedor?: string; nombre: string; tipo: PersonType; email: string; telefono: string; origen: string; fecha: string; contratoId?: number }): number {
    const info = this.#db.prepare(
      'INSERT INTO cliente (identificacion, identificacion_proveedor, nombre, tipo, email, telefono, origen, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(input.identificacion, input.identificacionProveedor ?? '', input.nombre, input.tipo, input.email, input.telefono, input.origen, input.fecha)
    const id = Number(info.lastInsertRowid)
    const detalle = input.contratoId ? `Cliente creado desde el contrato ${input.contratoId} del administrador` : `${input.identificacion} · ${input.nombre}`
    this.addHistorial({ cliente_id: id, factura_id: null, tipo: 'cliente_creado', detalle, fecha: input.fecha })
    return id
  }

  /** Busca al cliente y lo crea solo si aún no existe; también completa su documento original. */
  ensureCliente(input: { identificacion: string; identificacionProveedor?: string; nombre: string; tipo: PersonType; email: string; telefono: string; origen: string; fecha: string; contratoId?: number }): number {
    const existing = this.clienteByIdentificacion(input.identificacion)
    if (existing) {
      if (!existing.identificacion_proveedor && input.identificacionProveedor) {
        this.#db.prepare('UPDATE cliente SET identificacion_proveedor = ? WHERE id = ?').run(input.identificacionProveedor, existing.id)
      }
      return existing.id
    }
    return this.createCliente(input)
  }

  /** Lista de clientes con sus totales de contratos, facturas y deuda. */
  listClientes(search = ''): ClienteResumen[] {
    const term = search.trim()
    const where = term
      ? 'WHERE c.nombre LIKE ? OR c.identificacion LIKE ?'
      : ''
    const like = `%${term}%`
    const params = term ? [like, like] : []
    return this.#db.prepare(`
                        SELECT c.*,
                                (SELECT COUNT(*) FROM contrato ct WHERE ct.cliente_id = c.id) AS contratos,
                                (SELECT COUNT(*) FROM factura f WHERE f.cliente_id = c.id AND f.estado = 'abierta') AS abiertas,
                                (SELECT COUNT(*) FROM factura f WHERE f.cliente_id = c.id AND f.estado = 'pagada') AS pagadas,
                                (SELECT COALESCE(SUM(f.saldo_cents), 0) FROM factura f WHERE f.cliente_id = c.id AND f.estado = 'abierta') AS deuda_cents,
                                (SELECT MIN(f.vencimiento) FROM factura f WHERE f.cliente_id = c.id AND f.estado = 'abierta') AS vencimiento
                        FROM cliente c
                        ${where}
                        ORDER BY c.nombre COLLATE NOCASE
                `).all(...params) as unknown as ClienteResumen[]
  }

  contratosDeCliente(clienteId: number): Contrato[] {
    return this.#db.prepare('SELECT * FROM contrato WHERE cliente_id = ? ORDER BY id').all(clienteId) as unknown as Contrato[]
  }

  facturasDeCliente(clienteId: number): Factura[] {
    return this.#db.prepare('SELECT * FROM factura WHERE cliente_id = ? ORDER BY periodo DESC, id DESC').all(clienteId) as unknown as Factura[]
  }

  historialDeCliente(clienteId: number): Historial[] {
    return this.#db.prepare(`
                        SELECT h.*, f.num_factura AS num_factura
                        FROM historial h LEFT JOIN factura f ON f.id = h.factura_id
                        WHERE h.cliente_id = ? ORDER BY h.id DESC
                `).all(clienteId) as unknown as Historial[]
  }

  // Contratos

  upsertContrato(input: { id: number; cliente_id: number | null; estado: string; plan: string; precio_cents: number; sucursal: string; moneda_sigla: string; direccion: string }): void {
    this.#db.prepare(`
                        INSERT INTO contrato (id, cliente_id, estado, plan, precio_cents, sucursal, moneda_sigla, direccion)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET
                                cliente_id = excluded.cliente_id, estado = excluded.estado, plan = excluded.plan,
                                precio_cents = excluded.precio_cents, sucursal = excluded.sucursal,
                                moneda_sigla = excluded.moneda_sigla, direccion = excluded.direccion
                `).run(input.id, input.cliente_id, input.estado, input.plan, input.precio_cents, input.sucursal, input.moneda_sigla, input.direccion)
  }

  // Facturas

  facturaByDeudaId(deudaId: string): Factura | undefined {
    return this.#db.prepare('SELECT * FROM factura WHERE deuda_id = ?').get(deudaId) as Factura | undefined
  }

  /** Facturas pendientes de un contrato que se revisarán al actualizar pagos. */
  facturasAbiertasDeContrato(contratoId: number): Factura[] {
    return this.#db.prepare("SELECT * FROM factura WHERE contrato_id = ? AND estado = 'abierta' ORDER BY periodo").all(contratoId) as unknown as Factura[]
  }

  /** Contratos con al menos una factura pendiente. */
  contratosConFacturasAbiertas(): number[] {
    const rows = this.#db.prepare("SELECT DISTINCT contrato_id FROM factura WHERE estado = 'abierta' ORDER BY contrato_id").all() as Array<{ contrato_id: number }>
    return rows.map(row => row.contrato_id)
  }

  /** Titulares con facturas pendientes, agrupados para consultar su libro una sola vez. */
  clientesConFacturasAbiertas(): Array<{ cliente_id: number; identificacion: string; identificacion_proveedor: string }> {
    const rows = this.#db.prepare(
      `SELECT DISTINCT c.id AS cliente_id, c.identificacion AS identificacion, c.identificacion_proveedor AS identificacion_proveedor
                         FROM factura f JOIN cliente c ON c.id = f.cliente_id
                         WHERE f.estado = 'abierta' ORDER BY c.id`,
    ).all() as Array<{ cliente_id: number; identificacion: string; identificacion_proveedor: string }>
    return rows
  }

  /** Facturas pendientes de todos los contratos del titular. */
  facturasAbiertasDeCliente(clienteId: number): Factura[] {
    return this.#db.prepare(
      "SELECT * FROM factura WHERE cliente_id = ? AND estado = 'abierta' ORDER BY contrato_id, periodo, id",
    ).all(clienteId) as unknown as Factura[]
  }

  createFactura(input: {
    cliente_id: number; contrato_id: number; deuda_id: string; periodo: string; vencimiento: string
    corte: string; total_cents: number; descripcion: string; fecha: string
  }): number {
    const info = this.#db.prepare(`
                        INSERT INTO factura (cliente_id, contrato_id, deuda_id, num_factura, periodo, vencimiento, corte, total_cents, saldo_cents, estado, created_at, descripcion)
                        VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, 'abierta', ?, ?)
                `).run(input.cliente_id, input.contrato_id, input.deuda_id, input.periodo, input.vencimiento, input.corte, input.total_cents, input.total_cents, input.fecha, input.descripcion)
    const id = Number(info.lastInsertRowid)
    const num = `FAC-${String(id).padStart(6, '0')}`
    this.#db.prepare('UPDATE factura SET num_factura = ? WHERE id = ?').run(num, id)
    this.addHistorial({ cliente_id: input.cliente_id, factura_id: id, tipo: 'factura_importada', detalle: `Cuota ${input.deuda_id} - ${input.descripcion}`, fecha: input.fecha })
    return id
  }

  /** Borra los datos importados y conserva la configuración de la empresa. */
  borrarDatosImportados(): void {
    this.#db.exec('DELETE FROM factura; DELETE FROM contrato; DELETE FROM cliente; DELETE FROM historial; DELETE FROM corrida_detalle; DELETE FROM corrida;')
  }

  markPaid(facturaId: number, fecha: string, evidencia?: string): void {
    const factura = this.#db.prepare('SELECT * FROM factura WHERE id = ?').get(facturaId) as Factura | undefined
    this.#db.prepare("UPDATE factura SET estado = 'pagada', saldo_cents = 0, pagada_en = ? WHERE id = ?").run(fecha, facturaId)
    if (factura) {
      const detalle = evidencia ? `Pagada en el administrador (${evidencia})` : `Cuota ${factura.deuda_id} pagada en el ISP`
      this.addHistorial({ cliente_id: factura.cliente_id, factura_id: facturaId, tipo: 'factura_pagada', detalle, fecha })
    }
  }

  // Corridas

  startRun(tipo: RunType, simulacion: boolean, inicio: string): number {
    const info = this.#db.prepare("INSERT INTO corrida (tipo, simulacion, estado, inicio) VALUES (?, ?, 'en_curso', ?)")
      .run(tipo, simulacion ? 1 : 0, inicio)
    return Number(info.lastInsertRowid)
  }

  finishRun(id: number, resumen: unknown, fin: string, error: string | null): void {
    this.#db.prepare('UPDATE corrida SET estado = ?, resumen = ?, fin = ?, error = ? WHERE id = ?')
      .run(error ? 'fallida' : 'completada', JSON.stringify(resumen), fin, error, id)
  }

  addRunDetail(corridaId: number, detail: { contrato_id: number; deuda_id: string; periodo: string; resultado: string; motivo: string; cliente?: string; monto_cents?: number }): void {
    this.#db.prepare('INSERT INTO corrida_detalle (corrida_id, contrato_id, deuda_id, periodo, resultado, motivo, cliente, monto_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(corridaId, detail.contrato_id, detail.deuda_id, detail.periodo, detail.resultado, detail.motivo, detail.cliente ?? '', detail.monto_cents ?? 0)
  }

  listRuns(limit = 20): Corrida[] {
    return this.#db.prepare('SELECT * FROM corrida ORDER BY id DESC LIMIT ?').all(limit) as unknown as Corrida[]
  }

  runById(id: number): Corrida | undefined {
    return this.#db.prepare('SELECT * FROM corrida WHERE id = ?').get(id) as Corrida | undefined
  }

  runDetails(corridaId: number): CorridaDetalle[] {
    return this.#db.prepare('SELECT * FROM corrida_detalle WHERE corrida_id = ? ORDER BY id').all(corridaId) as unknown as CorridaDetalle[]
  }

  addHistorial(input: { cliente_id: number | null; factura_id: number | null; tipo: string; detalle: string; fecha: string }): void {
    this.#db.prepare('INSERT INTO historial (cliente_id, factura_id, tipo, detalle, fecha) VALUES (?, ?, ?, ?, ?)')
      .run(input.cliente_id, input.factura_id, input.tipo, input.detalle, input.fecha)
  }

  // Resumen

  summary(): {
    clientes: number; contratos: number; abiertas: number; pagadas: number
    porCobrar_cents: number; fechaSandbox: string
    ultimaImportacion: Corrida | undefined; ultimaPagadas: Corrida | undefined
  } {
    const one = (sql: string): number => Number((this.#db.prepare(sql).get() as { n: number }).n)
    const abiertas = one("SELECT COUNT(*) AS n FROM factura WHERE estado = 'abierta'")
    const pagadas = one("SELECT COUNT(*) AS n FROM factura WHERE estado = 'pagada'")
    const porCobrar = one("SELECT COALESCE(SUM(saldo_cents), 0) AS n FROM factura WHERE estado = 'abierta'")
    const last = (tipo: RunType): Corrida | undefined =>
      this.#db.prepare('SELECT * FROM corrida WHERE tipo = ? ORDER BY id DESC LIMIT 1').get(tipo) as Corrida | undefined
    return {
      clientes: one('SELECT COUNT(*) AS n FROM cliente'),
      contratos: one('SELECT COUNT(*) AS n FROM contrato'),
      abiertas,
      pagadas,
      porCobrar_cents: porCobrar,
      fechaSandbox: today(),
      ultimaImportacion: last('importacion'),
      ultimaPagadas: last('pagadas'),
    }
  }
}

export type { ContractState }
