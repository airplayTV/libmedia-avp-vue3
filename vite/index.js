import { createReadStream } from 'node:fs'
import { access, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path'

const PRESETS = Object.freeze({
  minimal: ['aac', 'h264', 'mp3'],
  standard: [
    'aac', 'ac3', 'adpcm', 'av1', 'dca', 'eac3', 'flac', 'h264',
    'hevc', 'mjpeg', 'mp3', 'mpeg2video', 'mpeg4', 'opus', 'pcm',
    'vorbis', 'vp8', 'vp9'
  ],
  full: [
    'aac', 'ac3', 'adpcm', 'av1', 'bmp', 'dca', 'dvaudio', 'dvvideo',
    'eac3', 'flac', 'gif', 'h261', 'h263', 'h264', 'hevc', 'mjpeg',
    'mp3', 'mpeg2video', 'mpeg4', 'msmpeg4', 'opus', 'pcm', 'png',
    'ra', 'rv', 'speex', 'theora', 'tiff', 'vorbis', 'vp8', 'vp9',
    'vvc', 'webp', 'wma', 'wmv'
  ]
})
const VARIANTS = Object.freeze(['baseline', 'simd', 'atomic'])
const SHARED_WASM = new Set(['resample', 'stretchpitch'])
const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url))

function pluginError(code, message) {
  return new Error(`${code}: ${message}`)
}

function normalizeOutputDir(value = 'assets/libmedia-avp') {
  if (
    typeof value !== 'string' ||
    value.trim() === '' ||
    value.includes('\\') ||
    isAbsolute(value) ||
    value.split('/').includes('..')
  ) {
    throw pluginError('INVALID_OUTPUT_DIR', 'outputDir must be a safe relative POSIX path')
  }
  const normalized = posix.normalize(value).replace(/^\.\//, '').replace(/\/$/, '')
  if (normalized === '.' || normalized.startsWith('../')) {
    throw pluginError('INVALID_OUTPUT_DIR', 'outputDir must be a safe relative POSIX path')
  }
  return normalized
}

function normalizeOptions(options) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw pluginError('INVALID_PLUGIN_OPTIONS', 'options must be an object')
  }
  const preset = options.preset ?? 'standard'
  if (!Object.hasOwn(PRESETS, preset)) {
    throw pluginError('INVALID_ASSET_PRESET', `unknown preset: ${preset}`)
  }

  const requestedCodecs = options.codecs ?? PRESETS[preset]
  if (
    !Array.isArray(requestedCodecs) ||
    requestedCodecs.length === 0 ||
    requestedCodecs.some((codec) => !PRESETS[preset].includes(codec))
  ) {
    throw pluginError('INVALID_CODEC', 'codecs must be a non-empty subset of the selected preset')
  }

  const requestedVariants = options.wasmVariants ?? VARIANTS
  if (
    !Array.isArray(requestedVariants) ||
    requestedVariants.length === 0 ||
    requestedVariants.some((variant) => !VARIANTS.includes(variant))
  ) {
    throw pluginError('INVALID_WASM_VARIANT', 'wasmVariants contains an unknown variant')
  }

  const threading = options.threading ?? 'auto'
  if (![true, false, 'auto'].includes(threading)) {
    throw pluginError('INVALID_THREADING_MODE', 'threading must be true, false or auto')
  }
  const variants = [...new Set(requestedVariants)]
    .filter((variant) => threading !== false || variant !== 'atomic')
  if (variants.length === 0) {
    throw pluginError('INVALID_WASM_VARIANT', 'threading disabled every selected variant')
  }

  return Object.freeze({
    preset,
    codecs: [...new Set(requestedCodecs)].sort(),
    wasmVariants: VARIANTS.filter((variant) => variants.includes(variant)),
    threading,
    externalAssets: options.externalAssets === true,
    outputDir: normalizeOutputDir(options.outputDir)
  })
}

async function findRuntimeAssetsDirectory() {
  const candidates = [
    resolve(MODULE_DIRECTORY, '..', 'runtime-assets'),
    resolve(MODULE_DIRECTORY, '..', '..', 'runtime-assets')
  ]
  for (const candidate of candidates) {
    try {
      await access(join(candidate, 'manifest.json'))
      return candidate
    } catch {
      // The source and packaged plugin have different directory depths.
    }
  }
  throw pluginError('RUNTIME_ASSETS_NOT_FOUND', 'runtime-assets/manifest.json is missing')
}

function selectManifest(sourceManifest, options) {
  const selectedFiles = {}
  for (const [fileName, metadata] of Object.entries(sourceManifest.files)) {
    if (fileName.startsWith('runtime/')) {
      selectedFiles[fileName] = metadata
      continue
    }
    const match = /^wasm\/([^/]+)\/([^/]+)\.wasm$/.exec(fileName)
    if (!match) continue
    const [, variant, resource] = match
    if (
      options.wasmVariants.includes(variant) &&
      (options.codecs.includes(resource) || SHARED_WASM.has(resource))
    ) {
      selectedFiles[fileName] = metadata
    }
  }

  const required = []
  for (const variant of options.wasmVariants) {
    for (const resource of [...options.codecs, ...SHARED_WASM]) {
      required.push(`wasm/${variant}/${resource}.wasm`)
    }
  }
  const missing = required.filter((fileName) => !Object.hasOwn(selectedFiles, fileName))
  if (missing.length > 0) {
    throw pluginError(
      'ASSET_NOT_AVAILABLE',
      `synchronize the requested preset before building: ${missing.join(', ')}`
    )
  }

  return {
    ...sourceManifest,
    preset: options.preset,
    variants: options.wasmVariants,
    codecs: options.codecs,
    files: Object.fromEntries(Object.entries(selectedFiles).sort(([left], [right]) => (
      left.localeCompare(right)
    )))
  }
}

function joinBase(base, outputDir) {
  const normalizedBase = typeof base === 'string' && base !== '' ? base : '/'
  return `${normalizedBase.endsWith('/') ? normalizedBase : `${normalizedBase}/`}${outputDir}/`
}

function mimeType(fileName) {
  if (fileName.endsWith('.wasm')) return 'application/wasm'
  if (fileName.endsWith('.json')) return 'application/json; charset=utf-8'
  return 'application/javascript; charset=utf-8'
}

function safeAssetPath(root, requestedPath) {
  let decoded
  try {
    decoded = decodeURIComponent(requestedPath)
  } catch {
    return null
  }
  if (decoded.includes('\\') || decoded.split('/').includes('..')) return null
  const candidate = resolve(root, ...decoded.split('/').filter(Boolean))
  const relativePath = relative(root, candidate)
  if (relativePath.startsWith('..') || isAbsolute(relativePath) || relativePath.includes(`..${sep}`)) {
    return null
  }
  return candidate
}

export function libmediaAssets(options = {}) {
  const normalized = normalizeOptions(options)
  let viteBase = '/'
  let assetBase = joinBase(viteBase, normalized.outputDir)
  let selectedManifestPromise

  async function getSelectedAssets() {
    if (!selectedManifestPromise) {
      selectedManifestPromise = (async () => {
        const root = await findRuntimeAssetsDirectory()
        const sourceManifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'))
        return { root, manifest: selectManifest(sourceManifest, normalized) }
      })()
    }
    return selectedManifestPromise
  }

  return {
    name: 'libmedia-avp-assets',
    enforce: 'pre',
    config(config) {
      viteBase = config.base ?? '/'
      assetBase = joinBase(viteBase, normalized.outputDir)
      return {
        define: {
          __LIBMEDIA_AVP_DEFAULT_BASE__: JSON.stringify(assetBase)
        }
      }
    },
    configResolved(config) {
      viteBase = config.base
      assetBase = joinBase(viteBase, normalized.outputDir)
    },
    async configureServer(server) {
      if (normalized.externalAssets) return
      const { root, manifest } = await getSelectedAssets()
      const allowedFiles = new Set([...Object.keys(manifest.files), 'manifest.json'])
      const routePrefix = assetBase.startsWith('http')
        ? new URL(assetBase).pathname
        : assetBase
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
        if (!pathname.startsWith(routePrefix)) return next()
        if (!['GET', 'HEAD'].includes(request.method ?? 'GET')) {
          response.statusCode = 405
          response.setHeader('Allow', 'GET, HEAD')
          response.end()
          return
        }
        const relativePath = pathname.slice(routePrefix.length)
        if (!allowedFiles.has(relativePath)) return next()
        response.setHeader('Content-Type', mimeType(relativePath))
        if (relativePath === 'manifest.json') {
          response.end(request.method === 'HEAD' ? undefined : `${JSON.stringify(manifest, null, 2)}\n`)
          return
        }
        const filePath = safeAssetPath(root, relativePath)
        if (!filePath) {
          response.statusCode = 400
          response.end()
          return
        }
        if (request.method === 'HEAD') {
          response.end()
          return
        }
        createReadStream(filePath).on('error', next).pipe(response)
      })
    },
    async generateBundle() {
      if (normalized.externalAssets) return
      const { root, manifest } = await getSelectedAssets()
      for (const fileName of Object.keys(manifest.files)) {
        this.emitFile({
          type: 'asset',
          fileName: `${normalized.outputDir}/${fileName}`,
          source: await readFile(join(root, ...fileName.split('/')))
        })
      }
      this.emitFile({
        type: 'asset',
        fileName: `${normalized.outputDir}/manifest.json`,
        source: `${JSON.stringify(manifest, null, 2)}\n`
      })
    }
  }
}

export default libmediaAssets
