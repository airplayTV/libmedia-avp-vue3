import { describe, expect, it, vi } from 'vitest'
import { createDefaultController } from '../../src/core/default-controller-factory.js'
import { PlayerController } from '../../src/core/player-controller.js'

const manifest = {
  schemaVersion: 1,
  avplayerVersion: '1.3.1',
  upstreamCommit: '152f629d3021fd8013efa464fcb7b55f9fbe7753',
  preset: 'minimal',
  variants: ['baseline'],
  files: {
    'runtime/avplayer.js': { sha256: 'a', size: 1 },
    'wasm/baseline/h264.wasm': { sha256: 'b', size: 1 },
    'wasm/baseline/resample.wasm': { sha256: 'c', size: 1 },
    'wasm/baseline/stretchpitch.wasm': { sha256: 'd', size: 1 }
  }
}

describe('default controller factory', () => {
  it('loads the manifest and runtime from the configured asset base', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => manifest }))
    const importer = vi.fn(async () => ({
      default: class FakeAVPlayer {
        constructor(options) { this.options = options }
        load() {}
        play() {}
      }
    }))

    const controller = await createDefaultController({
      container: {},
      assetBaseUrl: 'https://cdn.example/libmedia/',
      wasmVariant: 'baseline'
    }, {
      fetcher,
      importer,
      globalObject: { WebAssembly: { validate: () => false } }
    })

    expect(controller).toBeInstanceOf(PlayerController)
    expect(fetcher).toHaveBeenCalledWith(
      'https://cdn.example/libmedia/manifest.json',
      expect.objectContaining({ credentials: 'same-origin' })
    )

    await controller.play()
    expect(importer).toHaveBeenCalledWith(
      'https://cdn.example/libmedia/runtime/avplayer.js'
    )
  })

  it('reports a failed manifest request as a recoverable runtime error', async () => {
    await expect(createDefaultController({ assetBaseUrl: '/missing/' }, {
      fetcher: async () => ({ ok: false, status: 404 }),
      globalObject: {}
    })).rejects.toMatchObject({
      code: 'RUNTIME_LOAD_FAILED',
      recoverable: true
    })
  })
})
