/**
 * Coerciones seguras de valores que llegan de la API del administrador (o de la base), donde los
 * campos pueden venir de cualquier tipo. Se usan en toda la integración para no repetir la lógica.
 */

/** Cadena segura: devuelve `''` si el valor no es un string. */
export const asString = (value: unknown): string => (typeof value === 'string' ? value : '')

/** Número seguro: acepta number finito o algo convertible; si no, `0`. */
export const asNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0)
