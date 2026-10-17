/**
 * Aviso flotante (flash) compartido por las pantallas. Se muestra arriba del contenido y se puede
 * cerrar. El tono viene del resultado de la acción (ok, bad, info, warn).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Tone } from '../lib/types.ts'

interface Flash {
  readonly tone: Tone
  readonly text: string
}

interface FlashContextValue {
  readonly show: (text: string, tone?: Tone) => void
}

const FlashContext = createContext<FlashContextValue | null>(null)

export function FlashProvider({ children }: { children: ReactNode }): ReactNode {
  const [flash, setFlash] = useState<Flash | null>(null)
  const show = useCallback((text: string, tone: Tone = 'info') => setFlash({ text, tone }), [])
  const value = useMemo(() => ({ show }), [show])

  useEffect(() => {
    if (!flash) return
    const timeout = window.setTimeout(() => setFlash(null), 2_000)
    return () => window.clearTimeout(timeout)
  }, [flash])

  return (
    <FlashContext.Provider value={value}>
      {flash && (
        <div className={`flash ${flash.tone}`} role="status">
          <span>{flash.text}</span>
          <button type="button" className="flash-close" aria-label="Cerrar" onClick={() => setFlash(null)}>×</button>
        </div>
      )}
      {children}
    </FlashContext.Provider>
  )
}

export function useFlash(): FlashContextValue {
  const context = useContext(FlashContext)
  if (!context) throw new Error('useFlash debe usarse dentro de FlashProvider')
  return context
}
