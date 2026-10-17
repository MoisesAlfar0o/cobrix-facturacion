/**
 * Componentes de presentación reutilizables. Son «tontos»: solo reciben props y pintan, sin
 * conocer la API. Así las pantallas quedan cortas y legibles.
 */

import type { ReactNode } from 'react'
import type { Tone } from '../lib/types.ts'

export function Pill({ label, tone }: { label: string; tone: Tone }): ReactNode {
  return <span className={`pill ${tone}`}>{label}</span>
}

export function Tile({ label, value }: { label: string; value: string }): ReactNode {
  return <div className="tile"><span>{label}</span><strong>{value}</strong></div>
}

export function Tiles({ children }: { children: ReactNode }): ReactNode {
  return <section className="tiles">{children}</section>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }): ReactNode {
  return <section className={`card${className ? ` ${className}` : ''}`}>{children}</section>
}

export function CardHeader({ title, children }: { title: string; children?: ReactNode }): ReactNode {
  return <header><h2>{title}</h2>{children}</header>
}

export function CardBody({ children }: { children: ReactNode }): ReactNode {
  return <div className="body">{children}</div>
}

export function Alert({ tone, icon, title, children }: { tone: Tone; icon: string; title: string; children?: ReactNode }): ReactNode {
  return (
    <div className={`alert ${tone}`}>
      <div className="ico">{icon}</div>
      <div><strong>{title}</strong>{children}</div>
    </div>
  )
}

export interface BarSegment {
  readonly label: string
  readonly value: number
  readonly tone: Tone
}

export function Bar({ segments }: { segments: readonly BarSegment[] }): ReactNode {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  if (total <= 0) return <div className="stack"><span className="mute" style={{ width: '100%' }} /></div>
  return (
    <div className="stack">
      {segments.filter(segment => segment.value > 0).map(segment => (
        <span
          key={segment.label}
          className={segment.tone}
          style={{ width: `${((segment.value / total) * 100).toFixed(2)}%` }}
          title={`${segment.label}: ${segment.value}`}
        />
      ))}
    </div>
  )
}

export function Legend({ segments }: { segments: readonly BarSegment[] }): ReactNode {
  return (
    <div className="legend">
      {segments.filter(segment => segment.value > 0).map(segment => (
        <span key={segment.label}><i className={segment.tone} />{segment.label} <b>{segment.value}</b></span>
      ))}
    </div>
  )
}

/** Estados de carga y error, para no repetir el mismo markup en cada pantalla. */
export function Loading({ label = 'Cargando…' }: { label?: string }): ReactNode {
  return <div className="body"><p className="note">{label}</p></div>
}

export function ErrorBox({ message }: { message: string }): ReactNode {
  return <div className="flash bad" role="alert">No se pudo cargar: {message}</div>
}
