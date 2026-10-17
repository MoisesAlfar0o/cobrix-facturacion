/**
 * Enunciado: muestra docs/ENUNCIADO.md tal cual, servido por la API.
 */

import type { ReactNode } from 'react'
import { api } from '../lib/api.ts'
import { useFetch } from '../lib/use-fetch.ts'
import { Card, CardBody, ErrorBox, Loading } from '../components/ui.tsx'

export function EnunciadoPage(): ReactNode {
  const { data, error, loading } = useFetch(() => api.enunciado(), [])

  if (loading && !data) return <Loading />
  if (error) return <ErrorBox message={error} />
  if (!data) return null

  return (
    <>
      <div className="head">
        <div>
          <h1>Enunciado</h1>
          <p>También en <span className="mono">docs/ENUNCIADO.md</span>.</p>
        </div>
      </div>
      <Card>
        <CardBody><pre className="doc">{data.texto}</pre></CardBody>
      </Card>
    </>
  )
}
