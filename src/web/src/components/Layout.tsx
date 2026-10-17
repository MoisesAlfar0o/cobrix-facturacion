/** Estructura común del panel: marca, navegación lateral y contenido de cada sección. */

import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const ICONS: Record<string, ReactNode> = {
  '/': <><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></>,
  '/clientes': <><circle cx="8" cy="5.5" r="2.4" /><path d="M3.2 13c0-2.4 2.1-3.9 4.8-3.9s4.8 1.5 4.8 3.9" /></>,
  '/sincronizacion': <><path d="M13 8a5 5 0 1 1-1.6-3.7" /><path d="M13.2 2.4v3.1h-3.1" /></>,
  '/configuracion': <><path d="M3 4.6h10M3 8h10M3 11.4h10" /><circle cx="6" cy="4.6" r="1.4" /><circle cx="10" cy="8" r="1.4" /><circle cx="7" cy="11.4" r="1.4" /></>,
}

const NAV = [
  ['/', 'Resumen'],
  ['/clientes', 'Clientes'],
  ['/sincronizacion', 'Sincronización'],
  ['/configuracion', 'Configuración'],
] as const

export function Layout({ children, company }: { children: ReactNode; company: string }): ReactNode {
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><span className="mark">C</span><div><strong>Cobrix</strong><small>Sandbox de facturación</small></div></div>
        <nav>
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              <svg viewBox="0 0 16 16" aria-hidden="true">{ICONS[to]}</svg>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-foot"><span className="dot" />{company}</div>
      </aside>
      <main className="main">{children}</main>
    </div>
  )
}
