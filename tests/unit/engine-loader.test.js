import { describe, expect, it } from 'vitest'
import { loadAvPlayerRuntime } from '../../src/core/engine-loader.js'

describe('AVPlayer runtime loader', () => {
  it('shares one in-flight import for the same runtime URL', async () => {
    let imports = 0
    class AVPlayer {}
    const importer = async () => {
      imports += 1
      return { default: AVPlayer }
    }

    const [first, second] = await Promise.all([
      loadAvPlayerRuntime({ runtimeUrl: '/runtime/shared.avplayer.js', importer }),
      loadAvPlayerRuntime({ runtimeUrl: '/runtime/shared.avplayer.js', importer })
    ])

    expect(first).toBe(AVPlayer)
    expect(second).toBe(AVPlayer)
    expect(imports).toBe(1)
  })

  it('does not cache a failed import', async () => {
    let imports = 0
    class AVPlayer {}
    const importer = async () => {
      imports += 1
      if (imports === 1) {
        throw new Error('network failure')
      }
      return { default: AVPlayer }
    }
    const options = { runtimeUrl: '/runtime/retry.avplayer.js', importer }

    await expect(loadAvPlayerRuntime(options)).rejects.toMatchObject({
      code: 'RUNTIME_LOAD_FAILED',
      recoverable: true
    })
    await expect(loadAvPlayerRuntime(options)).resolves.toBe(AVPlayer)
    expect(imports).toBe(2)
  })

  it('rejects a module without an AVPlayer constructor', async () => {
    await expect(loadAvPlayerRuntime({
      runtimeUrl: '/runtime/invalid.avplayer.js',
      importer: async () => ({ default: {} })
    })).rejects.toMatchObject({ code: 'RUNTIME_LOAD_FAILED' })
  })
})
