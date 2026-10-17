/**
 * Expediente de un cliente (§3.6): datos, contratos, facturas e historial.
 */

import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api.ts'
import type { ExpedientePayload } from '../lib/types.ts'
import { date, dateTime, periodText, usd } from '../lib/format.ts'
import { CONTRACT_STATUS_TONE, documento, historialLabel } from '../lib/labels.ts'
import { useFetch } from '../lib/use-fetch.ts'
import { Card, CardBody, CardHeader, ErrorBox, Loading, Pill, Tile, Tiles } from '../components/ui.tsx'

export function ExpedientePage(): ReactNode {
  const params = useParams()
  const id = Number(params.id)
  const { data, error, loading } = useFetch<ExpedientePayload>(() => api.expediente(id), [id])

  if (loading && !data) return <Loading />
  if (error) return <ErrorBox message={error} />
  if (!data) return null

  const { cliente, contratos, facturas, historial } = data
  const abiertas = facturas.filter(f => f.estado === 'abierta')
  const deuda = abiertas.reduce((sum, f) => sum + f.saldo_cents, 0)
  const contratosIds = new Set(contratos.map(c => c.id))
  const origen = cliente.origen.toLocaleLowerCase() === 'administrador de facturas'
    ? 'Administrador de facturas'
    : cliente.origen || '—'

  return (
    <>
      <div className="head">
        <div>
          <h1>{cliente.nombre}</h1>
          <p>{cliente.tipo === 'juridico' ? 'Persona jurídica' : 'Persona natural'} · {cliente.identificacion}</p>
        </div>
        <Link className="btn" to="/clientes">Volver</Link>
      </div>
      <Tiles>
        <Tile label="Deuda abierta" value={usd(deuda)} />
        <Tile label="Facturas abiertas" value={String(abiertas.length)} />
        <Tile label="Facturas pagadas" value={String(facturas.length - abiertas.length)} />
        <Tile label="Contratos" value={String(contratos.length)} />
      </Tiles>
      <div className="grid2">
        <Card>
          <CardHeader title="Datos del cliente" />
          <CardBody>
            <dl className="facts">
              <dt>ID externo</dt><dd className="mono">{cliente.identificacion}</dd>
              <dt>Documento</dt><dd className="mono">{documento(cliente)}</dd>
              <dt>Correo</dt><dd>{cliente.email || '—'}</dd>
              <dt>Teléfono</dt><dd>{cliente.telefono || '—'}</dd>
              <dt>Origen</dt><dd>{origen}</dd>
              <dt>Creado</dt><dd>{dateTime(cliente.created_at)}</dd>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Contratos en el administrador" />
          {contratos.length === 0
            ? <CardBody><p className="note">Sin contratos registrados.</p></CardBody>
            : (
              <div className="table-wrap contracts-table">
                <table>
                  <thead>
                    <tr><th>Contrato</th><th>Estado</th><th>Plan</th><th>Sucursal</th></tr>
                  </thead>
                  <tbody>
                    {contratos.map(c => (
                      <tr key={c.id}>
                        <td>
                          <strong className="mono">{c.id}</strong>
                          <small className="contract-address">{c.direccion || 'Dirección no disponible'}</small>
                        </td>
                        <td><Pill label={c.estado} tone={CONTRACT_STATUS_TONE[c.estado] ?? 'mute'} /></td>
                        <td>
                          <span>{c.plan || '—'}</span>
                          <small className="contract-price">{c.moneda_sigla} · {usd(c.precio_cents)}/mes</small>
                        </td>
                        <td>
                          <span className="mono">{c.sucursal || '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </Card>
      </div>
      <Card>
        <CardHeader title="Facturas"><span className="muted">Una factura por cuota del administrador</span></CardHeader>
        {facturas.length === 0
          ? <CardBody><p className="note">Sin facturas.</p></CardBody>
          : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Factura</th><th>Cuota en el administrador</th><th>Periodo</th><th>Descripción</th><th>Vence</th><th>Corte</th><th className="num">Total</th><th className="num">Saldo</th><th>Estado</th></tr></thead>
                <tbody>
                  {facturas.map(f => (
                    <tr key={f.id}>
                      <td className="mono">{f.num_factura}</td>
                      <td className="mono">{f.deuda_id}{contratosIds.has(f.contrato_id) ? <><br /><small className="muted">contrato {f.contrato_id}</small></> : null}</td>
                      <td>{periodText(f.periodo)}</td>
                      <td>{f.descripcion || '—'}</td>
                      <td>{date(f.vencimiento)}</td>
                      <td>{date(f.corte)}</td>
                      <td className="num">{usd(f.total_cents)}</td>
                      <td className="num">{usd(f.saldo_cents)}</td>
                      <td>{f.estado === 'pagada'
                        ? <><Pill label="Pagada" tone="ok" /><br /><small className="muted">{date(f.pagada_en)}</small></>
                        : <Pill label="Abierta" tone="info" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        <CardBody><p className="note">El vencimiento es el primer día del periodo, como en el sync real de Cobrix: el administrador de facturas no da un vencimiento por cuota. El corte suma los días de gracia configurados.</p></CardBody>
      </Card>
      <Card>
        <CardHeader title="Historial" />
        {historial.length === 0
          ? <CardBody><p className="note">Sin movimientos.</p></CardBody>
          : (
            <CardBody>
              <ul className="timeline">
                {historial.map(h => (
                  <li key={h.id}>
                    <time>{dateTime(h.fecha)}</time>
                    <div>
                      <strong>{historialLabel(h.tipo)}{h.num_factura ? ` - ${h.num_factura}` : ''}</strong>
                      <br /><span className="muted">{h.detalle}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          )}
      </Card>
    </>
  )
}
