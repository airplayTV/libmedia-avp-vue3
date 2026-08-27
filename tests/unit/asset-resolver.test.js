import { describe, expect, it } from 'vitest'
import { createAssetResolver } from '../../src/core/asset-resolver.js'
import { getCodecResource } from '../../src/core/codec-map.js'

const manifest = {
  schemaVersion: 1,
  avplayerVersion: '1.3.1',
  upstreamCommit: '152f629d3021fd8013efa464fcb7b55f9fbe7753',
  preset: 'minimal',
  variants: ['baseline', 'simd'],
  files: {
    'wasm/simd/h264.wasm': { sha256: 'a' },
    'wasm/simd/resample.wasm': { sha256: 'b' },
    'wasm/simd/stretchpitch.wasm': { sha256: 'c' },
    'wasm/baseline/h264.wasm': { sha256: 'd' },
    'wasm/baseline/resample.wasm': { sha256: 'e' },
    'wasm/baseline/stretchpitch.wasm': { sha256: 'f' }
  }
}

describe('codec resource mapping', () => {
  it('maps the approved codec IDs to stable decoder names', () => {
    expect(getCodecResource(27)).toBe('h264')
    expect(getCodecResource(173)).toBe('hevc')
    expect(getCodecResource(86018)).toBe('aac')
    expect(getCodecResource(86020)).toBe('dca')
    expect(getCodecResource(-1)).toBeNull()
  })
})

describe('asset resolver', () => {
  it('resolves decoder and shared resources through a safe root-relative base', () => {
    const resolver = createAssetResolver({
      baseUrl: '/assets/libmedia-avp/',
      manifest,
      capabilities: { simd: true, atomic: false },
      requestedVariant: 'auto'
    })

    expect(resolver.variant).toBe('simd')
    expect(resolver.getWasm('decoder', 27)).toBe(
      '/assets/libmedia-avp/wasm/simd/h264.wasm'
    )
    expect(resolver.getWasm('resampler')).toBe(
      '/assets/libmedia-avp/wasm/simd/resample.wasm'
    )
    expect(resolver.getWasm('stretchpitcher')).toBe(
      '/assets/libmedia-avp/wasm/simd/stretchpitch.wasm'
    )
  })

  it('preserves an absolute CDN origin', () => {
    const resolver = createAssetResolver({
      baseUrl: 'https://cdn.example/player/',
      manifest,
      capabilities: { simd: true, atomic: false },
      requestedVariant: 'simd'
    })

    expect(resolver.getWasm('decoder', 27)).toBe(
      'https://cdn.example/player/wasm/simd/h264.wasm'
    )
  })

  it('distinguishes an omitted decoder from an omitted shared resource', () => {
    const resolver = createAssetResolver({
      baseUrl: '/assets/libmedia-avp/',
      manifest,
      capabilities: { simd: true, atomic: false },
      requestedVariant: 'simd'
    })

    expect(() => resolver.getWasm('decoder', 173)).toThrowError(
      expect.objectContaining({ code: 'CODEC_NOT_INCLUDED' })
    )
    expect(() => resolver.getWasm('decoder', 999999)).toThrowError(
      expect.objectContaining({ code: 'CODEC_NOT_INCLUDED' })
    )
    expect(() => resolver.getWasm('unknown')).toThrowError(
      expect.objectContaining({ code: 'WASM_NOT_FOUND' })
    )
  })
})
