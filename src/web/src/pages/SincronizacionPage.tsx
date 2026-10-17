/**
 * Sincronización (§3.7): dispara las corridas (importar y actualizar pagadas), lista el historial
 * de corridas y permite borrar los datos importados.
 */

import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.ts'
import { useFetch } from '../lib/use-fetch.ts'
import { useFlash } from '../components/Flash.tsx'
import { Card, CardBody, CardHeader, ErrorBox, Loading } from '../components/ui.tsx'
import { RunsTable } from '../components/RunsTable.tsx'

type Accion = { tipo: 'importacion' | 'pagadas'; simulacion: boolean }

export function SincronizacionPage(): ReactNode {
  const { data, error, loading, reload } = useFetch(() => api.runs(), [])
  const { show } = useFlash()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const correr = async (accion: Accion): Promise<void> => {
    setBusy(true)
    try {
      const result = accion.tipo === 'importacion'
        ? await api.importar(accion.simulacion)
        : await api.actualizarPagadas(accion.simulacion)
      const nombre = accion.tipo === 'importacion' ? 'Importación' : 'Actualización de pagadas'
      show(`${accion.simulacion ? 'Simulación' : 'Corrida'} de ${nombre.toLowerCase()} terminada.`, 'ok')
      navigate(`/sincronizacion/corrida/${result.corridaId}`)
    } catch (cause) {
      show(`La corrida falló: ${cause instanceof Error ? cause.message : String(cause)}`, 'bad')
    } finally {
      setBusy(false)
    }
  }

  const borrar = async (): Promise<void> => {
    if (!window.confirm('¿Borrar todos los datos importados? Se conserva la configuración.')) return
    setBusy(true)
    try {
      const result = await api.borrarDatos()
      show(result.mensaje, result.tone)
      reload()
    } catch (cause) {
      show(`No se pudo borrar: ${cause instanceof Error ? cause.message : String(cause)}`, 'bad')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !data) return <Loading />
  if (error) return <ErrorBox message={error} />

  return (
    <>
      <div className="head">
        <div>
          <h1>Sincronización</h1>
          <p>La importación lee cada contrato del administrador y crea una factura abierta por cuota pendiente. La actualización de pagadas consulta el libro de cuotas del administrador y marca pagadas las que el ISP ya cobró.</p>
        </div>
      </div>
      <div className="grid2">
        <Card>
          <CardHeader title="Importar cuotas" />
          <CardBody>
            <p className="muted">Recorre todos los contratos (<span className="mono">lista_ids_contratos</span> → <span className="mono">contrato/individual</span>) y aplica los estados, la ventana, el límite de recientes y los topes de la configuración.</p>
            <div className="actions">
              <button className="btn primary" type="button" disabled={busy} onClick={() => void correr({ tipo: 'importacion', simulacion: false })}>Importar</button>
              <button className="btn" type="button" disabled={busy} onClick={() => void correr({ tipo: 'importacion', simulacion: true })}>Simular importación</button>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Actualizar facturas pagadas" />
          <CardBody>
            <p className="muted">Para cada factura abierta lee <span className="mono">pago_informacion</span> (CUOTA) de su contrato. Solo se marca pagada una cuota con saldo 0, algo pagado y filas coherentes. Los abonos parciales se informan, no se aplican.</p>
            <div className="actions">
              <button className="btn primary" type="button" disabled={busy} onClick={() => void correr({ tipo: 'pagadas', simulacion: false })}>Actualizar pagadas</button>
              <button className="btn" type="button" disabled={busy} onClick={() => void correr({ tipo: 'pagadas', simulacion: true })}>Simular actualización</button>
            </div>
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader title="Corridas">
          <button className="btn" type="button" disabled={busy} onClick={() => void borrar()}>Borrar datos importados</button>
        </CardHeader>
        <RunsTable runs={data?.runs ?? []} />
      </Card>
    </>
  )
}
