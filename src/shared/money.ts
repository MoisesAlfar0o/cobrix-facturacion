/**
 * Montos en centavos. Toda la integración guarda y suma dinero en enteros de centavos para no
 * arrastrar errores de punto flotante; aquí vive la única conversión.
 */

/** Dólares (o cualquier unidad) a centavos enteros: `20` → `2000`. */
export const toCents = (value: number): number => Math.round(value * 100)

/** Centavos enteros a la unidad: `2000` → `20`. */
export const fromCents = (cents: number): number => cents / 100
