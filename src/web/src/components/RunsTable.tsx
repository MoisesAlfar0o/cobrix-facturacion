/**
 * Tabla de corridas, compartida por Resumen y Sincronización. Cada fila enlaza al detalle.
 */

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Corrida } from '../lib/types.ts'
import { RUN_STATUS, RUN_TYPE_LABELS } from '../lib/labels.ts'
import { runResumenTexto } from '../lib/runs.ts'
import { dateTime } from '../lib/format.ts'
import { Pill } from './ui.tsx'

export function RunsTable({ runs }: { runs: readonly Corrida[] }): ReactNode {
  if (runs.length === 0) return <div className="body"><p className="note">Todavía no hay corridas.</p></div>
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Tipo</th><th>Inicio</th><th>Estado</th><th>Resultado</th></tr></thead>
        <tbody>
          {runs.map(run => {
            const status = RUN_STATUS[run.estado]
            return (
              <tr key={run.id}>
                <td className="mono"><Link to={`/sincronizacion/corrida/${run.id}`}>{run.id}</Link></td>
                <td>
                  <Link to={`/sincronizacion/corrida/${run.id}`}>{RUN_TYPE_LABELS[run.tipo]}</Link>
                  {run.simulacion ? <><br /><Pill label="Simulación" tone="info" /></> : null}
                </td>
                <td>{dateTime(run.inicio)}</td>
                <td>{status ? <Pill label={status.text} tone={status.tone} /> : run.estado}</td>
                <td className="muted">{runResumenTexto(run)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
