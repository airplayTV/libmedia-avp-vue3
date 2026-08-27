import { describe, expect, it } from 'vitest'
import { getDefaultAssetBase } from '../../src/core/default-asset-base.js'

describe('default asset base', () => {
  it('uses the safe conventional path when no Vite plugin define exists', () => {
    expect(getDefaultAssetBase()).toBe('/assets/libmedia-avp/')
  })
})
