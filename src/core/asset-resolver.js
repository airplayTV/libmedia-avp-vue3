import { parseAssetManifest } from './asset-manifest.js'
import { getCodecResource } from './codec-map.js'
import { PlayerError } from './player-error.js'
import { selectWasmVariant } from './wasm-capabilities.js'

const SENTINEL_ORIGIN = 'https://libmedia-assets.invalid'
const sharedResources = Object.freeze({
  resampler: 'resample',
  stretchpitcher: 'stretchpitch'
})

function normalizeBaseUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new PlayerError('INVALID_SOURCE', 'Asset base URL must be a non-empty URL')
  }

  const rawValue = value.trim()
  const rootRelative = rawValue.startsWith('/')
  let url

  try {
    url = new URL(rawValue, `${SENTINEL_ORIGIN}/`)
  } catch (cause) {
    throw new PlayerError('INVALID_SOURCE', 'Asset base URL is invalid', { cause })
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new PlayerError('INVALID_SOURCE', 'Asset base URL must use HTTP or HTTPS')
  }

  url.search = ''
  url.hash = ''
  if (!url.pathname.endsWith('/')) {
    url.pathname += '/'
  }

  return { url, rootRelative }
}

function resolveUrl(relativePath, normalizedBase) {
  const url = new URL(relativePath, normalizedBase.url)
  if (normalizedBase.rootRelative) {
    return `${url.pathname}${url.search}${url.hash}`
  }

  return url.href
}

export function createAssetResolver({
  baseUrl,
  manifest: manifestValue,
  capabilities = {},
  requestedVariant = 'auto'
}) {
  const manifest = parseAssetManifest(manifestValue)
  const normalizedBase = normalizeBaseUrl(baseUrl)
  const variant = selectWasmVariant({
    requested: requestedVariant,
    simd: capabilities.simd === true,
    atomic: capabilities.atomic === true,
    available: manifest.variants
  })

  function getWasm(type, codecId) {
    let resourceName
    let missingCode = 'WASM_NOT_FOUND'

    if (type === 'decoder') {
      resourceName = getCodecResource(codecId)
      missingCode = 'CODEC_NOT_INCLUDED'
    } else {
      resourceName = sharedResources[type]
    }

    if (!resourceName) {
      throw new PlayerError(missingCode, 'Requested WASM resource is not available', {
        details: { type, codecId }
      })
    }

    const relativePath = `wasm/${variant}/${resourceName}.wasm`
    if (!Object.hasOwn(manifest.files, relativePath)) {
      throw new PlayerError(missingCode, 'Requested WASM resource is not included', {
        details: { type, codecId, variant }
      })
    }

    return resolveUrl(relativePath, normalizedBase)
  }

  return Object.freeze({
    variant,
    runtimeUrl: resolveUrl('runtime/avplayer.js', normalizedBase),
    getWasm
  })
}
