/**
 * Configuración (§3.1): empresa, proveedor y reglas de importación, con el mismo conjunto de
 * opciones del formulario «Configurar proveedor» de Cobrix.
 */

import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.ts'
import type { AppConfig } from '../lib/types.ts'
import { useFetch } from '../lib/use-fetch.ts'
import { useFlash } from '../components/Flash.tsx'
import { Card, CardBody, CardHeader, ErrorBox, Loading } from '../components/ui.tsx'

const CONTRACT_STATES = ['ACTIVO', 'CORTADO', 'CORTESIA', 'RETIRADO', 'RECHAZADO', 'ANULADO'] as const
const DOCUMENT_TYPES = ['V', 'E', 'J', 'G', 'P'] as const
const WINDOW_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ['3', '3 meses'], ['6', '6 meses'], ['9', '9 meses'], ['12', '12 meses'], ['sin', 'Sin ventana'],
]

/** Entero opcional del formulario: vacío o inválido → `null`. */
const optionalInt = (value: string): number | null => {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isInteger(n) ? n : null
}

interface FormState {
  empresaNombre: string
  empresaRif: string
  empresaEmail: string
  proveedorNombre: string
  proveedorUrl: string
  proveedorUsuario: string
  proveedorPassword: string
  estados: AppConfig['importacion']['estadosImportables']
  ventana: string
  maxCuotasRecientes: string
  diasGracia: string
  ventanaPagadasMeses: string
  maxFacturasPorCorrida: string
  maxMontoPorCorrida: string
  excluir: AppConfig['importacion']['excluirTiposDocumento']
  corridaAutomatica: boolean
  horaCorrida: string
}

function toForm(config: AppConfig): FormState {
  const imp = config.importacion
  return {
    empresaNombre: config.empresa.nombre,
    empresaRif: config.empresa.rif,
    empresaEmail: config.empresa.emailCobranza,
    proveedorNombre: config.proveedor.nombre,
    proveedorUrl: config.proveedor.url,
    proveedorUsuario: config.proveedor.usuario,
    proveedorPassword: '',
    estados: [...imp.estadosImportables],
    ventana: imp.ventanaMeses === null ? 'sin' : String(imp.ventanaMeses),
    maxCuotasRecientes: imp.maxCuotasRecientes === null ? '' : String(imp.maxCuotasRecientes),
    diasGracia: String(imp.diasGracia),
    ventanaPagadasMeses: String(imp.ventanaPagadasMeses),
    maxFacturasPorCorrida: imp.maxFacturasPorCorrida === null ? '' : String(imp.maxFacturasPorCorrida),
    maxMontoPorCorrida: imp.maxMontoPorCorrida === null ? '' : String(imp.maxMontoPorCorrida),
    excluir: [...imp.excluirTiposDocumento],
    corridaAutomatica: imp.corridaAutomatica,
    horaCorrida: imp.horaCorrida,
  }
}

/** Convierte el formulario al `AppConfig` que espera la API. */
function toPayload(form: FormState, config: AppConfig): AppConfig {
  return {
    empresa: {
      ...config.empresa,
      nombre: form.empresaNombre,
      rif: form.empresaRif,
      emailCobranza: form.empresaEmail,
    },
    proveedor: {
      ...config.proveedor,
      nombre: form.proveedorNombre,
      url: form.proveedorUrl,
      usuario: form.proveedorUsuario,
      password: form.proveedorPassword || config.proveedor.password,
    },
    importacion: {
      estadosImportables: form.estados,
      ventanaMeses: form.ventana === 'sin' ? null : Number(form.ventana),
      maxCuotasRecientes: optionalInt(form.maxCuotasRecientes),
      diasGracia: optionalInt(form.diasGracia) ?? 0,
      maxFacturasPorCorrida: optionalInt(form.maxFacturasPorCorrida),
      maxMontoPorCorrida: optionalInt(form.maxMontoPorCorrida),
      excluirTiposDocumento: form.excluir,
      ventanaPagadasMeses: optionalInt(form.ventanaPagadasMeses) ?? 0,
      corridaAutomatica: form.corridaAutomatica,
      horaCorrida: form.horaCorrida,
    },
  }
}

export function ConfiguracionPage({ onCompanyChange }: { onCompanyChange: (company: string) => void }): ReactNode {
  const { data, error, loading } = useFetch(() => api.config(), [])
  const { show } = useFlash()
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState | null>(null)
  const [busy, setBusy] = useState(false)

  const current = form ?? (data ? toForm(data.config) : null)
  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm(prev => ({ ...(prev ?? (data ? toForm(data.config) : ({} as FormState))), [key]: value }))
  }
  const toggle = <K extends 'estados' | 'excluir'>(key: K, value: FormState[K][number]): void => {
    setForm(prev => {
      const base = prev ?? toForm(data!.config)
      const list = base[key].includes(value) ? base[key].filter(v => v !== value) : [...base[key], value]
      return { ...base, [key]: list }
    })
  }

  if (loading && !data) return <Loading />
  if (error) return <ErrorBox message={error} />
  if (!data || !current) return null

  const guardar = async (probar: boolean): Promise<void> => {
    setBusy(true)
    try {
      const payload = toPayload(current, data.config)
      const result = probar ? await api.probarConexion(payload) : await api.guardarConfig(payload)
      show(result.mensaje, result.tone)
      if (!probar && result.ok) {
        onCompanyChange(result.company ?? payload.empresa.nombre)
        navigate('/')
      }
    } catch (cause) {
      show(`No se pudo guardar: ${cause instanceof Error ? cause.message : String(cause)}`, 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="config-page">
      <div className="head">
        <div>
          <h1>Configuración</h1>
          <p>Datos de la empresa y del administrador de facturas, con las mismas opciones del formulario «Configurar proveedor» de Cobrix.</p>
        </div>
      </div>
      <Card>
        <CardHeader title="Empresa" />
        <CardBody>
          <div className="grid2">
            <label className="field">Nombre<input type="text" value={current.empresaNombre} onChange={e => set('empresaNombre', e.target.value)} /></label>
            <label className="field">RIF<input type="text" value={current.empresaRif} onChange={e => set('empresaRif', e.target.value)} /></label>
            <label className="field">Correo de cobranza<input type="text" value={current.empresaEmail} onChange={e => set('empresaEmail', e.target.value)} /></label>
          </div>
          <dl className="facts"><dt>Zona horaria y moneda</dt><dd>{data.config.empresa.zonaHoraria} · {data.config.empresa.moneda}</dd></dl>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Administrador de facturas">
          <button className="btn" type="button" disabled={busy} onClick={() => void guardar(true)}>Probar conexión</button>
        </CardHeader>
        <CardBody>
          <div className="grid2">
            <label className="field">Nombre visible<input type="text" value={current.proveedorNombre} onChange={e => set('proveedorNombre', e.target.value)} /></label>
            <label className="field">URL de la API<input type="text" value={current.proveedorUrl} onChange={e => set('proveedorUrl', e.target.value)} /></label>
            <label className="field">Usuario o correo<input type="text" value={current.proveedorUsuario} onChange={e => set('proveedorUsuario', e.target.value)} /></label>
            <label className="field">Contraseña <small>Déjala vacía para conservar la actual</small><input type="password" value={current.proveedorPassword} onChange={e => set('proveedorPassword', e.target.value)} /></label>
          </div>
          <p className="note">Con o sin <span className="mono">/api</span>. El simulador local es <span className="mono">{data.simulador}</span>.</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Importación" />
        <CardBody>
          <fieldset>
            <legend>Estados de contrato que se importan</legend>
            {CONTRACT_STATES.map(estado => (
              <label key={estado}><input type="checkbox" checked={current.estados.includes(estado)} onChange={() => toggle('estados', estado)} /> {estado}</label>
            ))}
          </fieldset>
          <div className="grid2">
            <label className="field">Ventana de importación <small>Solo cuotas desde el mes actual menos N meses</small>
              <select value={current.ventana} onChange={e => set('ventana', e.target.value)}>
                {WINDOW_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="field">Máx. cuotas recientes por contrato <small>Vacío = todas (1 a 60)</small><input type="number" value={current.maxCuotasRecientes} onChange={e => set('maxCuotasRecientes', e.target.value)} /></label>
            <label className="field">Días de gracia para el corte <small>Corte = vencimiento + días (0 a 60)</small><input type="number" value={current.diasGracia} onChange={e => set('diasGracia', e.target.value)} /></label>
            <label className="field">Ventana de consulta de pagadas (meses) <small>0 = 12 meses; por defecto 12</small><input type="number" value={current.ventanaPagadasMeses} onChange={e => set('ventanaPagadasMeses', e.target.value)} /></label>
            <label className="field">Tope de facturas nuevas por corrida<input type="number" value={current.maxFacturasPorCorrida} onChange={e => set('maxFacturasPorCorrida', e.target.value)} /></label>
            <label className="field">Tope de monto nuevo por corrida (USD)<input type="number" value={current.maxMontoPorCorrida} onChange={e => set('maxMontoPorCorrida', e.target.value)} /></label>
          </div>
          <fieldset>
            <legend>Excluir por tipo de documento</legend>
            {DOCUMENT_TYPES.map(doc => (
              <label key={doc}><input type="checkbox" checked={current.excluir.includes(doc)} onChange={() => toggle('excluir', doc)} /> {doc}</label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Corrida automática</legend>
            <label><input type="checkbox" checked={current.corridaAutomatica} onChange={e => set('corridaAutomatica', e.target.checked)} /> Importar y actualizar pagadas una vez al día a las</label>
            <input type="time" value={current.horaCorrida} onChange={e => set('horaCorrida', e.target.value)} aria-label="Hora" />
            <span className="muted">({data.config.empresa.zonaHoraria})</span>
          </fieldset>
          <p className="note">Esta integración procesa únicamente cuotas pendientes y usa las fechas de vencimiento informadas por el administrador. No se ejecutan importaciones genéricas programadas.</p>
        </CardBody>
      </Card>
      <div className="actions">
        <button className="btn primary" type="button" disabled={busy} onClick={() => void guardar(false)}>Guardar configuración</button>
      </div>
    </div>
  )
}
