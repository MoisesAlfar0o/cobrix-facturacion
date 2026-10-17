/**
 * Clientes (§3.5): búsqueda, filtros rápidos y tabla con deuda y vencimiento más antiguo.
 */

import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api.ts'
import type { ClientListPayload } from '../lib/types.ts'
import { date, usd } from '../lib/format.ts'
import { documento } from '../lib/labels.ts'
import { useFetch } from '../lib/use-fetch.ts'
import { Card, ErrorBox, Loading, Pill } from '../components/ui.tsx'

type Filtro = '' | 'abiertas' | 'mora' | 'al-dia'

export function ClientesPage(): ReactNode {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const filtro = (params.get('filtro') ?? '') as Filtro
  const [texto, setTexto] = useState(q)
  const { data, error, loading } = useFetch<ClientListPayload>(() => api.clientes(q), [q])

  if (loading && !data) return <Loading />
  if (error) return <ErrorBox message={error} />
  if (!data) return null

  const hoy = data.hoy
  const todos = data.rows
  const rows = filtro === 'mora'
    ? todos.filter(c => c.vencimiento && c.vencimiento < hoy)
    : filtro === 'abiertas'
      ? todos.filter(c => c.abiertas > 0)
      : filtro === 'al-dia'
        ? todos.filter(c => c.abiertas === 0)
        : todos
  const nAbiertas = todos.filter(c => c.abiertas > 0).length
  const nMora = todos.filter(c => c.vencimiento && c.vencimiento < hoy).length

  const cambiarFiltro = (valor: Filtro): void => {
    const next = new URLSearchParams()
    if (valor) next.set('filtro', valor)
    if (q) next.set('q', q)
    setParams(next)
  }

  const buscar = (event: React.FormEvent): void => {
    event.preventDefault()
    const next = new URLSearchParams()
    if (filtro) next.set('filtro', filtro)
    if (texto) next.set('q', texto)
    setParams(next)
  }

  const chips: ReadonlyArray<readonly [Filtro, string, number]> = [
    ['', 'Todos', todos.length],
    ['abiertas', 'Con facturas abiertas', nAbiertas],
    ['mora', 'En mora', nMora],
    ['al-dia', 'Al día', todos.length - nAbiertas],
  ]

  return (
    <>
      <div className="head">
        <div>
          <h1>Clientes</h1>
          <p>Clientes creados por el sync del administrador. Un cliente por cédula o RIF: si el titular tiene varios contratos, se agrupan aquí.</p>
        </div>
      </div>
      <section className="client-filters" aria-label="Filtros de clientes">
        <div className="client-filters-heading">
          <div>
            <h2>Filtrar clientes</h2>
            <p>Selecciona un estado para acotar la lista.</p>
          </div>
          <span className="client-total">{todos.length} {todos.length === 1 ? 'cliente' : 'clientes'}</span>
        </div>
        <div className="chips">
          {chips.map(([valor, label, count]) => (
            <button
              key={valor || 'todos'}
              type="button"
              className={`chip${filtro === valor ? ' active' : ''}`}
              aria-pressed={filtro === valor}
              onClick={() => cambiarFiltro(valor)}
            >
              <span>{label}</span>
              <span className="filter-count">{count}</span>
            </button>
          ))}
        </div>
      </section>
      <Card className="client-list">
        <header>
          <form className="search" onSubmit={buscar}>
            <input type="search" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Nombre, cédula o RIF" aria-label="Buscar" />
            <button className="btn" type="submit">Buscar</button>
          </form>
          <span className="client-result-count">Mostrando <strong>{rows.length}</strong> de <strong>{data.total}</strong> {data.total === 1 ? 'cliente' : 'clientes'}</span>
        </header>
        {rows.length === 0
          ? <div className="body"><p className="note">{q || filtro ? 'No hay clientes que coincidan con el filtro o la búsqueda.' : 'Todavía no hay clientes. Ejecuta una importación desde Sincronización.'}</p></div>
          : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Cliente</th><th>Documento</th><th>Tipo</th><th className="num">Contratos</th><th className="num">Abiertas</th><th className="num">Pagadas</th><th className="num">Deuda</th><th>Vence la más antigua</th></tr></thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.id}>
                      <td><Link to={`/clientes/${row.id}`}>{row.nombre}</Link></td>
                      <td className="mono">{documento(row)}</td>
                      <td>{row.tipo === 'juridico' ? 'Jurídico' : 'Natural'}</td>
                      <td className="num">{row.contratos}</td>
                      <td className="num">{row.abiertas}</td>
                      <td className="num">{row.pagadas}</td>
                      <td className="num">{usd(row.deuda_cents)}</td>
                      <td>{row.abiertas === 0 ? <Pill label="Al día" tone="ok" /> : date(row.vencimiento)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>
    </>
  )
}
