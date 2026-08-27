import { describe, expect, it } from 'vitest'
import { LIBMEDIA_AVP_VERSION } from '../../src/index.js'

describe('public entry', () => {
  it('exports the library version as a stable string', () => {
    expect(LIBMEDIA_AVP_VERSION).toBe('0.1.0')
  })
})
