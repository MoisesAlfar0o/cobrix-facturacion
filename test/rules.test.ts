/**
 * Pruebas de las reglas de la sección 4 del enunciado (puras, sin red).
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
        corteDate, isCurrencyIncoherent, isResidual, isWithinWindow, normalizeId,
        parseInstallment, periodIndex, withinRecentLimit,
} from '../src/cobrix/rules.ts'

describe('normalización de la identificación', () => {
        it('quita separadores y conserva la letra de tipo', () => {
                assert.deepEqual(normalizeId('V-12345678'), { id: 'V12345678', tipo: 'natural' })
                assert.deepEqual(normalizeId('J-40123456-7'), { id: 'J401234567', tipo: 'juridico' })
                assert.deepEqual(normalizeId('E 81234567'), { id: 'E81234567', tipo: 'natural' })
        })
        it('quita ceros a la izquierda y admite identificación sin letra', () => {
                assert.deepEqual(normalizeId('09000123'), { id: '9000123', tipo: 'natural' })
                assert.deepEqual(normalizeId('000000123456'), { id: '123456', tipo: 'natural' })
        })
        it('J y G son personas jurídicas; el resto, naturales', () => {
                assert.equal(normalizeId('G-12345678')?.tipo, 'juridico')
                assert.equal(normalizeId('P-12345678')?.tipo, 'natural')
                assert.equal(normalizeId('12345678')?.tipo, 'natural')
        })
        it('rechaza lo que no es una identificación válida', () => {
                assert.equal(normalizeId('V-12345'), null) // menos de 6 dígitos
                assert.equal(normalizeId('V-1234567890123'), null) // más de 12
                assert.equal(normalizeId('X-12345678'), null) // letra desconocida
                assert.equal(normalizeId(''), null)
                assert.equal(normalizeId(null), null)
        })
})

describe('periodo y vencimiento', () => {
        it('lee «PLAN - 2026 Agosto»', () => {
                assert.deepEqual(parseInstallment(['PLAN15MB25 - 2026 Agosto']), { periodo: '2026-08', vencimiento: '2026-08-01' })
        })
        it('acepta acentos y nombres alternativos', () => {
                assert.equal(parseInstallment(['PLAN - 2026 Setiembre'])?.periodo, '2026-09')
        })
        it('devuelve null si no se puede leer', () => {
                assert.equal(parseInstallment([]), null)
                assert.equal(parseInstallment(['PLAN - sin fecha']), null)
                assert.equal(parseInstallment(null), null)
        })
        it('el corte es el vencimiento más los días de gracia', () => {
                assert.equal(corteDate('2026-08-01', 5), '2026-08-06')
                assert.equal(corteDate('2026-08-01', 0), '2026-08-01')
        })
})

describe('ventana de importación', () => {
        it('sin ventana acepta todo', () => {
                assert.equal(isWithinWindow('2020-01', '2026-10', null), true)
        })
        it('con ventana de 3 meses desde 2026-10 deja fuera lo anterior a 2026-07', () => {
                assert.equal(isWithinWindow('2026-07', '2026-10', 3), true)
                assert.equal(isWithinWindow('2026-06', '2026-10', 3), false)
        })
        it('periodIndex compara periodos entre años', () => {
                assert.equal(periodIndex('2027-01') - periodIndex('2026-12'), 1)
        })
})

describe('máximo de cuotas recientes', () => {
        it('conserva las más recientes', () => {
                const periodos = ['2026-08', '2026-09', '2026-10']
                assert.equal(withinRecentLimit('2026-10', periodos, 2), true)
                assert.equal(withinRecentLimit('2026-09', periodos, 2), true)
                assert.equal(withinRecentLimit('2026-08', periodos, 2), false)
        })
        it('sin límite acepta todas', () => {
                assert.equal(withinRecentLimit('2020-01', ['2020-01'], null), true)
        })
})

describe('moneda y saldos', () => {
        it('descarta USD muy por debajo del plan (<1 %)', () => {
                assert.equal(isCurrencyIncoherent('USD', 0.05, 20), true)
                assert.equal(isCurrencyIncoherent('USD', 20, 20), false)
                assert.equal(isCurrencyIncoherent('VES', 0.05, 20), false)
        })
        it('un saldo residual es menos de un centavo', () => {
                assert.equal(isResidual(0.001317), true)
                assert.equal(isResidual(0.01), false)
                assert.equal(isResidual(0), false)
        })
})
