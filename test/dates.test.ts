import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { caracasToday, today } from '../src/shared/dates.ts'

describe('fechas de Caracas', () => {
  it('calcula el día real aunque la fecha del sandbox esté fijada', () => {
    const previousSandboxDate = process.env.SANDBOX_TODAY
    process.env.SANDBOX_TODAY = '2026-10-13'

    try {
      const now = new Date('2026-10-17T03:30:00.000Z')
      assert.equal(today(), '2026-10-13')
      assert.equal(caracasToday(now), '2026-10-16')
    } finally {
      if (previousSandboxDate === undefined) delete process.env.SANDBOX_TODAY
      else process.env.SANDBOX_TODAY = previousSandboxDate
    }
  })
})
