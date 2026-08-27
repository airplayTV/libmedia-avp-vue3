import { describe, expect, it } from 'vitest'
import {
  engineTimeToSeconds,
  secondsToEngineTime
} from '../../src/core/time.js'

describe('player time conversion', () => {
  it('rounds public seconds to engine milliseconds', () => {
    expect(secondsToEngineTime(1.2344)).toBe(1234n)
    expect(secondsToEngineTime(1.2345)).toBe(1235n)
  })

  it('converts engine milliseconds to fractional seconds', () => {
    expect(engineTimeToSeconds(2500n)).toBe(2.5)
  })

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid public time %s',
    (value) => {
      expect(() => secondsToEngineTime(value)).toThrowError(
        expect.objectContaining({ code: 'INVALID_TIME' })
      )
    }
  )
})
