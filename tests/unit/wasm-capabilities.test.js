import { describe, expect, it, vi } from 'vitest'
import {
  detectWasmCapabilities,
  selectWasmVariant
} from '../../src/core/wasm-capabilities.js'

describe('WASM capability selection', () => {
  it('selects the strongest available and supported automatic variant', () => {
    expect(selectWasmVariant({
      requested: 'auto',
      simd: true,
      atomic: false,
      available: ['baseline', 'simd']
    })).toBe('simd')

    expect(selectWasmVariant({
      requested: 'auto',
      simd: false,
      atomic: false,
      available: ['baseline', 'simd']
    })).toBe('baseline')
  })

  it('falls back safely when an explicitly requested variant is unsupported', () => {
    expect(selectWasmVariant({
      requested: 'atomic',
      simd: true,
      atomic: false,
      available: ['baseline', 'simd', 'atomic']
    })).toBe('simd')
  })

  it('rejects selection when no runnable variant is available', () => {
    expect(() => selectWasmVariant({
      requested: 'simd',
      simd: false,
      atomic: false,
      available: ['simd']
    })).toThrowError(expect.objectContaining({ code: 'WASM_UNSUPPORTED' }))
  })
})

describe('WASM capability detection', () => {
  it('requires cross-origin isolation, SharedArrayBuffer and validation for atomic', () => {
    const validate = vi.fn().mockReturnValue(true)
    const capabilities = detectWasmCapabilities({
      crossOriginIsolated: false,
      SharedArrayBuffer: class SharedArrayBuffer {},
      WebAssembly: { validate }
    })

    expect(capabilities).toEqual({ simd: true, atomic: false })
    expect(validate).toHaveBeenCalledTimes(1)
  })

  it('reports atomic only when its shared-memory module validates', () => {
    const validate = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(true)
    const capabilities = detectWasmCapabilities({
      crossOriginIsolated: true,
      SharedArrayBuffer: class SharedArrayBuffer {},
      WebAssembly: { validate }
    })

    expect(capabilities).toEqual({ simd: true, atomic: true })
    expect(validate).toHaveBeenCalledTimes(2)
  })
})
