import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { DEFAULT_CONFIG } from '../src/cobrix/config.ts'
import { parseConfig } from '../src/server/config-input.ts'

describe('validación de la hora de corrida automática', () => {
  it('acepta horas válidas y rechaza horas fuera del reloj', () => {
    assert.equal(parseConfig({ importacion: { horaCorrida: '23:59' } }, DEFAULT_CONFIG).importacion.horaCorrida, '23:59')
    assert.equal(parseConfig({ importacion: { horaCorrida: '00:00' } }, DEFAULT_CONFIG).importacion.horaCorrida, '00:00')
    assert.equal(parseConfig({ importacion: { horaCorrida: '24:00' } }, DEFAULT_CONFIG).importacion.horaCorrida, DEFAULT_CONFIG.importacion.horaCorrida)
    assert.equal(parseConfig({ importacion: { horaCorrida: '99:99' } }, DEFAULT_CONFIG).importacion.horaCorrida, DEFAULT_CONFIG.importacion.horaCorrida)
  })
})
