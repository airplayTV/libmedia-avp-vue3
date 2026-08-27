import { describe, expect, it } from 'vitest'
import {
  LIBMEDIA_VERSION,
  parseAssetManifest
} from '../../src/core/asset-manifest.js'

const validManifest = {
  schemaVersion: 1,
  avplayerVersion: '1.3.1',
  upstreamCommit: '152f629d3021fd8013efa464fcb7b55f9fbe7753',
  preset: 'standard',
  variants: ['baseline', 'simd'],
  files: {}
}

describe('asset manifest parsing', () => {
  it('accepts the pinned runtime contract', () => {
    const manifest = parseAssetManifest(validManifest)

    expect(LIBMEDIA_VERSION).toBe('1.3.1')
    expect(manifest).toMatchObject(validManifest)
    expect(Object.isFrozen(manifest)).toBe(true)
  })

  it.each([
    [{ ...validManifest, schemaVersion: 2 }],
    [{ ...validManifest, avplayerVersion: '1.2.0' }],
    [{ ...validManifest, upstreamCommit: '' }]
  ])('rejects an incompatible runtime identity', (manifest) => {
    expect(() => parseAssetManifest(manifest)).toThrowError(
      expect.objectContaining({ code: 'RUNTIME_VERSION_MISMATCH' })
    )
  })

  it.each([
    [null],
    [[]],
    [{ ...validManifest, variants: ['future'] }],
    [{ ...validManifest, files: [] }]
  ])('rejects malformed manifest data', (manifest) => {
    expect(() => parseAssetManifest(manifest)).toThrowError(
      expect.objectContaining({ code: 'RUNTIME_LOAD_FAILED' })
    )
  })
})
