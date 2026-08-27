import { createAssetResolver } from './asset-resolver.js'
import { getDefaultAssetBase } from './default-asset-base.js'
import { loadAvPlayerRuntime } from './engine-loader.js'
import { PlayerController } from './player-controller.js'
import { PlayerError, normalizePlayerError } from './player-error.js'
import { detectWasmCapabilities } from './wasm-capabilities.js'

const SENTINEL_ORIGIN = 'https://libmedia-assets.invalid'

function manifestUrl(baseUrl) {
  const rootRelative = baseUrl.startsWith('/')
  const url = new URL('manifest.json', new URL(
    baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
    `${SENTINEL_ORIGIN}/`
  ))
  return rootRelative ? url.pathname : url.href
}

export async function createDefaultController(options, dependencies = {}) {
  const baseUrl = options.assetBaseUrl || getDefaultAssetBase()
  const fetcher = dependencies.fetcher ?? globalThis.fetch
  const globalObject = dependencies.globalObject ?? globalThis
  if (typeof fetcher !== 'function') {
    throw new PlayerError(
      'RUNTIME_LOAD_FAILED',
      'Fetch API is required to load the libmedia asset manifest'
    )
  }

  let manifest
  try {
    const response = await fetcher(manifestUrl(baseUrl), {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    })
    if (!response?.ok) {
      throw new Error(`Asset manifest request failed with HTTP ${response?.status ?? 'unknown'}`)
    }
    manifest = await response.json()
  } catch (error) {
    throw normalizePlayerError(error, {
      code: 'RUNTIME_LOAD_FAILED',
      recoverable: true
    })
  }

  const assetResolver = createAssetResolver({
    baseUrl,
    manifest,
    capabilities: detectWasmCapabilities(globalObject),
    requestedVariant: options.wasmVariant ?? 'auto'
  })

  return new PlayerController({
    container: options.container,
    source: options.source,
    engineOptions: options.engineOptions,
    loadOptions: options.loadOptions,
    assetResolver,
    onEvent: options.onEvent,
    createEngine: async (engineOptions) => {
      const AVPlayer = await loadAvPlayerRuntime({
        runtimeUrl: assetResolver.runtimeUrl,
        importer: dependencies.importer
      })
      return new AVPlayer(engineOptions)
    }
  })
}
