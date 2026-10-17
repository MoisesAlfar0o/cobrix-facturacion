/**
 * Hook de carga de datos: ejecuta una promesa y expone `data`, `error`,
 * `loading` y `reload`. Centraliza el patrón «cargar al montar / recargar» de todas las pantallas.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export interface AsyncState<T> {
  readonly data: T | undefined
  readonly error: string | undefined
  readonly loading: boolean
  readonly reload: () => void
}

export function useFetch<T>(fn: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(undefined)
    fnRef.current()
      .then(result => { if (active) setData(result) })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : String(cause)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick(t => t + 1), [])
  return { data, error, loading, reload }
}
