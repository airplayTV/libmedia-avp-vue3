import { PlayerError } from './player-error.js'

export const LIBMEDIA_VERSION = '1.3.1'
export const LIBMEDIA_UPSTREAM_COMMIT = '152f629d3021fd8013efa464fcb7b55f9fbe7753'

const supportedVariants = new Set(['baseline', 'simd', 'atomic'])
const supportedPresets = new Set(['minimal', 'standard', 'full'])

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function versionMismatch(message) {
  return new PlayerError('RUNTIME_VERSION_MISMATCH', message)
}

function malformedManifest(message) {
  return new PlayerError('RUNTIME_LOAD_FAILED', message)
}

export function parseAssetManifest(value) {
  if (!isPlainObject(value)) {
    throw malformedManifest('Asset manifest must be an object')
  }

  if (value.schemaVersion !== 1) {
    throw versionMismatch('Unsupported asset manifest schema version')
  }

  if (value.avplayerVersion !== LIBMEDIA_VERSION) {
    throw versionMismatch('AVPlayer runtime version does not match the library')
  }

  if (value.upstreamCommit !== LIBMEDIA_UPSTREAM_COMMIT) {
    throw versionMismatch('AVPlayer upstream commit does not match the library')
  }

  if (!supportedPresets.has(value.preset)) {
    throw malformedManifest('Asset manifest contains an unknown preset')
  }

  if (
    !Array.isArray(value.variants) ||
    value.variants.length === 0 ||
    value.variants.some((variant) => !supportedVariants.has(variant))
  ) {
    throw malformedManifest('Asset manifest contains invalid WASM variants')
  }

  if (!isPlainObject(value.files)) {
    throw malformedManifest('Asset manifest files must be an object')
  }

  return Object.freeze({
    ...value,
    variants: Object.freeze([...value.variants]),
    files: Object.freeze({ ...value.files })
  })
}
