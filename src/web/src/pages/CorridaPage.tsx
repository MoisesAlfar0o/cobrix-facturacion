/**
 * Detalle de una corrida: barra de resultado, tarjetas de contadores, contadores completos con su
 * nombre en Cobrix y el detalle por cuota/factura.
 */

import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api.ts'
import type { RunDetailPayload } from '../lib/types.ts'
import { dateTime, duration, usd } from '../lib/format.ts'
import { IMPORT_COUNTERS, IMPORT_TILES, PAYMENTS_COUNTERS, PAYMENTS_TILES, RUN_STATUS, RUN_TYPE_LABELS, runDetailReason } from '../lib/labels.ts'
import { barSegments, detalleResumen, parseResumen, resultLabel } from '../lib/runs.ts'
import { useFetch } from '../lib/use-fetch.ts'
import { Bar, Card, CardBody, CardHeader, ErrorBox, Legend, Loading, Pill, Tile, Tiles } from '../components/ui.tsx'

export function CorridaPage(): ReactNode {
  const params = useParams()
  const id = Number(params.id)
  const { data, error, loading } = useFetch<RunDetailPayload>(() => api.run(id), [id])

  if (loading && !data) return <Loading />
  if (error) return <ErrorBox message={error} />
  if (!data) return null

  const { run, detalles } = data
  const resumen = parseResumen(run.resumen)
  const counters = run.tipo === 'importacion' ? IMPORT_COUNTERS : PAYMENTS_COUNTERS
  const tiles = run.tipo === 'importacion' ? IMPORT_TILES : PAYMENTS_TILES
  const status = RUN_STATUS[run.estado]
  const segmentos = barSegments(run.tipo, resumen, detalles)

  return (
    <>
      <div className="head">
        <div>
          <p className="muted"><Link to="/sincronizacion">Sincronización</Link></p>
          <h1>{RUN_TYPE_LABELS[run.tipo]} #{run.id}{run.simulacion ? <> <Pill label="Simulación" tone="info" /></> : null}</h1>
          <p>{dateTime(run.inicio)} · {status ? <Pill label={status.text} tone={status.tone} /> : null} · {duration(run.inicio, run.fin)}</p>
        </div>
      </div>
      {run.error ? <div className="flash bad">La corrida falló: {run.error}</div> : null}
      <Card>
        <CardHeader title="Resultado de la corrida"><span className="muted">{detalleResumen(run.tipo, resumen, detalles)}</span></CardHeader>
        <CardBody>
          <Bar segments={segmentos} />
          <Legend segments={segmentos} />
        </CardBody>
      </Card>
      <Tiles>
        {tiles.map(([label, key]) => <Tile key={key} label={label} value={String(resumen[key] ?? 0)} />)}
      </Tiles>
      <Card>
        <CardHeader title="Contadores"><span className="muted">Mismos nombres que en Cobrix</span></CardHeader>
        <div className="table-wrap">
          <table>
            <tbody>
              {counters.map(c => (
                <tr key={c.key}>
                  <td>{c.label}</td>
                  <td className="mono muted">{c.cobrix}</td>
                  <td className="num">{String(resumen[c.key] ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <CardHeader title="Detalle"><span className="muted">{detalleResumen(run.tipo, resumen, detalles)}</span></CardHeader>
        {detalles.length === 0
          ? <CardBody><p className="note">Sin detalle por cuota.</p></CardBody>
          : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Contrato</th><th>Cuota</th><th>Cliente</th><th>Resultado</th><th>Detalle</th><th className="num">Monto</th></tr></thead>
                <tbody>
                  {detalles.map(d => {
                    const label = resultLabel(d.resultado)
                    return (
                      <tr key={d.id}>
                        <td className="mono">{d.contrato_id}</td>
                        <td className="mono">{d.deuda_id || '—'}</td>
                        <td>{d.cliente || '—'}</td>
                        <td><Pill label={label.text} tone={label.tone} /></td>
                        <td className="muted">{runDetailReason(d.motivo)}</td>
                        <td className="num">{d.monto_cents ? usd(d.monto_cents) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
      </Card>
    </>
  )
}
