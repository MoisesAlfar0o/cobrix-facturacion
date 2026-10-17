/**
 * Resumen (§3.6): totales, alertas de cobranza, mayores deudores, proveedor y últimas corridas.
 */

import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.ts'
import type { SummaryPayload } from '../lib/types.ts'
import { date } from '../lib/format.ts'
import { usd } from '../lib/format.ts'
import { useFetch } from '../lib/use-fetch.ts'
import { useFlash } from '../components/Flash.tsx'
import { Alert, Card, CardBody, CardHeader, ErrorBox, Loading, Tile, Tiles } from '../components/ui.tsx'
import { RunsTable } from '../components/RunsTable.tsx'

const ventanaTexto = (meses: number | null, recientes: number | null): string => {
  const a = meses === null ? 'Sin ventana' : `${meses} meses`
  const b = recientes === null ? 'sin límite de recientes' : `hasta ${recientes} recientes`
  return `${a} · ${b}`
}

export function ResumenPage(): ReactNode {
  const { data, error, loading, reload } = useFetch<SummaryPayload>(() => api.summary(), [])
  const { show } = useFlash()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const correr = async (accion: 'importar' | 'pagadas'): Promise<void> => {
    setBusy(true)
    try {
      const result = accion === 'importar' ? await api.importar(false) : await api.actualizarPagadas(false)
      show(accion === 'importar' ? 'Importación terminada.' : 'Actualización de pagadas terminada.', 'ok')
      navigate(`/sincronizacion/corrida/${result.corridaId}`)
    } catch (cause) {
      show(`La corrida falló: ${cause instanceof Error ? cause.message : String(cause)}`, 'bad')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !data) return <Loading />
  if (error) return <ErrorBox message={error} />
  if (!data) return null

  const { summary: s, config, mora, topDeudores, proveedorUrl, simulador } = data
  const imp = config.importacion
  const sinCorridas = s.abiertas === 0 && s.pagadas === 0

  return (
    <>
      <div className="head">
        <div>
          <h1>Resumen</h1>
          <p>Integración de Cobrix con una API de administrador de facturas. La API está simulada sobre SQLite y el sync replica las reglas del sync de ISP de Cobrix.</p>
        </div>
        <div className="actions">
          <button className="btn" type="button" disabled={busy} onClick={() => void correr('importar')}>Importar</button>
          <button className="btn primary" type="button" disabled={busy} onClick={() => void correr('pagadas')}>Actualizar pagadas</button>
        </div>
      </div>

      {sinCorridas && (
        <Alert tone="info" icon="1" title="Empieza importando">
          <p>No hay facturas todavía. Pulsa «Importar» para traer clientes y facturas del administrador.</p>
        </Alert>
      )}

      <section className="hero">
        <div className="spotlight">
          <span>Por cobrar</span>
          <strong>{usd(s.porCobrar_cents)}</strong>
          <small>Saldo de las {s.abiertas} facturas abiertas</small>
          <div className="row">
            <div><span>Clientes</span><b>{s.clientes}</b></div>
            <div><span>Contratos</span><b>{s.contratos}</b></div>
            <div><span>Pagadas</span><b>{s.pagadas}</b></div>
          </div>
        </div>
        <Card>
          <CardHeader title="Alertas de cobranza" />
          <CardBody>
            {mora.clientes === 0
              ? <Alert tone="ok" icon="✓" title="Sin mora"><p>Ninguna factura abierta está vencida a la fecha del sandbox.</p></Alert>
              : (
                <Alert tone="warn" icon="!" title={`${mora.clientes} ${mora.clientes === 1 ? 'cliente' : 'clientes'} en mora`}>
                  <p>{usd(mora.monto_cents)} vencidos o con vencimiento más antiguo al {date(mora.hoy)}. <Link to="/clientes">Ver clientes</Link></p>
                </Alert>
              )}
            {topDeudores.length > 0 && (
              <div>
                <p className="muted" style={{ margin: '0 0 8px' }}>Mayores deudas</p>
                <div className="table-wrap">
                  <table>
                    <tbody>
                      {topDeudores.map(c => (
                        <tr key={c.id}>
                          <td><Link to={`/clientes/${c.id}`}>{c.nombre}</Link></td>
                          <td className="num">{usd(c.deuda_cents)}</td>
                          <td className="muted">{c.abiertas} abiertas</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </section>

      <Tiles>
        <Tile label="Clientes importados" value={String(s.clientes)} />
        <Tile label="Contratos espejados" value={String(s.contratos)} />
        <Tile label="Facturas abiertas" value={String(s.abiertas)} />
        <Tile label="Facturas pagadas" value={String(s.pagadas)} />
        <Tile label="Por cobrar" value={usd(s.porCobrar_cents)} />
      </Tiles>

      <Card>
        <CardHeader title="Proveedor"><Link to="/configuracion">Editar configuración</Link></CardHeader>
        <CardBody>
          <dl className="facts">
            <dt>Proveedor</dt><dd>{config.proveedor.nombre || 'Administrador de facturas'}</dd>
            <dt>URL de la API</dt><dd className="mono">{proveedorUrl}</dd>
            <dt>Documentación de la API</dt><dd><a href={`${simulador}/docs`} target="_blank" rel="noreferrer">Swagger</a> · <a href={`${simulador}/openapi.json`} target="_blank" rel="noreferrer">openapi.json</a></dd>
            <dt>Estados que se importan</dt><dd>{imp.estadosImportables.join(', ')}</dd>
            <dt>Ventana</dt><dd>{ventanaTexto(imp.ventanaMeses, imp.maxCuotasRecientes)}</dd>
            <dt>Corrida automática</dt><dd>{imp.corridaAutomatica ? `Activa a las ${imp.horaCorrida}` : 'Apagada'}</dd>
            <dt>Fecha del sandbox</dt><dd>{date(s.fechaSandbox)} — mes actual {s.fechaSandbox.slice(0, 7)}</dd>
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Últimas corridas"><Link to="/sincronizacion">Ver todas</Link></CardHeader>
        <RunsTable runs={data.runs} />
      </Card>
    </>
  )
}
