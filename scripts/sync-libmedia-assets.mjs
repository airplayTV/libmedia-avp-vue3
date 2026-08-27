import { createHash } from 'node:crypto'
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from 'node:fs/promises'
import { dirname, join, parse, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(SCRIPT_DIRECTORY, '..')
const VERSION = '1.3.1'
const UPSTREAM_COMMIT = '152f629d3021fd8013efa464fcb7b55f9fbe7753'
const UPSTREAM_BASE_URL = new URL(
  `https://raw.githubusercontent.com/zhaohappy/libmedia/${UPSTREAM_COMMIT}/dist/`
)
const VARIANTS = ['baseline', 'simd', 'atomic']
const SHARED_RESOURCES = [
  ['resample', 'resample'],
  ['stretchpitch', 'stretchpitch']
]

function isStrictSuperset(superset, subset) {
  const supersetValues = new Set(superset)
  const subsetValues = new Set(subset)
  return supersetValues.size > subsetValues.size &&
    [...subsetValues].every((value) => supersetValues.has(value))
}

function validateCatalog(catalog) {
  for (const preset of ['minimal', 'standard', 'full']) {
    if (!Array.isArray(catalog?.[preset]) || catalog[preset].length === 0) {
      throw new Error(`Asset catalog preset ${preset} must be a non-empty array`)
    }
    if (new Set(catalog[preset]).size !== catalog[preset].length) {
      throw new Error(`Asset catalog preset ${preset} contains duplicate entries`)
    }
    if (catalog[preset].some((name) => !/^[a-z0-9]+$/.test(name))) {
      throw new Error(`Asset catalog preset ${preset} contains an invalid decoder name`)
    }
  }

  if (!isStrictSuperset(catalog.standard, catalog.minimal)) {
    throw new Error('The standard preset must be a strict superset of minimal')
  }
  if (!isStrictSuperset(catalog.full, catalog.standard)) {
    throw new Error('The full preset must be a strict superset of standard')
  }
}

function variantFileName(name, variant) {
  return variant === 'baseline' ? `${name}.wasm` : `${name}-${variant}.wasm`
}

function decoderUpstreamPath(name, variant) {
  return `decode/${variantFileName(name, variant)}`
}

function sharedUpstreamPath(directory, name, variant) {
  return `${directory}/${variantFileName(name, variant)}`
}

function assertAllowedPath(value) {
  const normalized = value.replaceAll('\\', '/').toLowerCase()
  if (normalized.includes('/encode/') || normalized.startsWith('encode/') ||
      normalized.includes('x264') || normalized.includes('x265')) {
    throw new Error(`Forbidden encoder asset path: ${value}`)
  }
}

async function requestUpstream(relativePath, method) {
  assertAllowedPath(relativePath)
  let url = new URL(relativePath, UPSTREAM_BASE_URL)

  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    if (url.hostname !== UPSTREAM_BASE_URL.hostname) {
      throw new Error(`Upstream redirect changed host for ${relativePath}`)
    }

    const response = await fetch(url, { method, redirect: 'manual' })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new Error(`Upstream redirect omitted location for ${relativePath}`)
      const redirected = new URL(location, url)
      if (redirected.hostname !== UPSTREAM_BASE_URL.hostname) {
        throw new Error(`Upstream redirect changed host for ${relativePath}`)
      }
      url = redirected
      continue
    }

    if (!response.ok) {
      throw new Error(`Upstream request failed for ${relativePath}: HTTP ${response.status}`)
    }
    return response
  }

  throw new Error(`Too many upstream redirects for ${relativePath}`)
}

async function defaultReadUpstreamAsset(relativePath) {
  const response = await requestUpstream(relativePath, 'GET')
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length === 0) {
    throw new Error(`Upstream asset is empty: ${relativePath}`)
  }
  return bytes
}

async function defaultProbeUpstreamAsset(relativePath) {
  await requestUpstream(relativePath, 'HEAD')
  return true
}

async function pathExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function mapWithConcurrency(values, concurrency, worker) {
  let cursor = 0
  const results = new Array(values.length)
  const runners = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (cursor < values.length) {
        const index = cursor
        cursor += 1
        results[index] = await worker(values[index], index)
      }
    }
  )
  await Promise.all(runners)
  return results
}

async function listFiles(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await listFiles(path, root))
    else if (entry.isFile()) files.push(relative(root, path).split(sep).join('/'))
  }
  return files.sort()
}

async function buildFileManifest(stageDirectory) {
  const files = {}
  for (const relativePath of await listFiles(stageDirectory)) {
    assertAllowedPath(relativePath)
    const bytes = await readFile(join(stageDirectory, ...relativePath.split('/')))
    files[relativePath] = {
      sha256: createHash('sha256').update(bytes).digest('hex'),
      size: bytes.length
    }
  }
  return files
}

async function replaceDirectoryAtomically(stageDirectory, outputDirectory, temporaryRoot) {
  const previousDirectory = join(temporaryRoot, 'previous')
  const hadPrevious = await pathExists(outputDirectory)
  if (hadPrevious) await rename(outputDirectory, previousDirectory)

  try {
    await rename(stageDirectory, outputDirectory)
  } catch (error) {
    if (hadPrevious && await pathExists(previousDirectory)) {
      await rename(previousDirectory, outputDirectory)
    }
    throw error
  }
}

export async function syncAssets(options = {}) {
  const runtimeSourceDir = resolve(
    options.runtimeSourceDir ?? join(
      PROJECT_ROOT,
      'node_modules/@libmedia/avplayer/dist/esm'
    )
  )
  const outputDir = resolve(options.outputDir ?? join(PROJECT_ROOT, 'runtime-assets'))
  const outputRoot = parse(outputDir).root
  if (outputDir === outputRoot || dirname(outputDir) === outputDir) {
    throw new Error('Refusing to replace a filesystem root')
  }

  const catalog = options.catalog ?? JSON.parse(
    await readFile(join(SCRIPT_DIRECTORY, 'libmedia-assets.json'), 'utf8')
  )
  const preset = options.preset ?? 'standard'
  const variants = options.variants ?? VARIANTS
  const readUpstreamAsset = options.readUpstreamAsset ?? defaultReadUpstreamAsset
  const probeUpstreamAsset = options.probeUpstreamAsset ?? defaultProbeUpstreamAsset

  validateCatalog(catalog)
  if (!Object.hasOwn(catalog, preset)) throw new Error(`Unknown asset preset: ${preset}`)
  if (variants.some((variant) => !VARIANTS.includes(variant))) {
    throw new Error('Unknown WASM variant')
  }

  const selectedCodecs = [...catalog[preset]].sort()
  const selectedSet = new Set(selectedCodecs)
  const probePaths = catalog.full
    .filter((codec) => !selectedSet.has(codec))
    .flatMap((codec) => variants.map((variant) => decoderUpstreamPath(codec, variant)))

  await mapWithConcurrency(probePaths, 8, async (relativePath) => {
    const available = await probeUpstreamAsset(relativePath)
    if (!available) throw new Error(`Upstream asset is unavailable: ${relativePath}`)
  })

  const runtimeEntries = (await readdir(runtimeSourceDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && (
      entry.name === 'avplayer.js' || /^\d+\.avplayer\.js$/.test(entry.name)
    ))
    .map((entry) => entry.name)
    .sort()
  if (!runtimeEntries.includes('avplayer.js')) {
    throw new Error('Pinned AVPlayer runtime entry avplayer.js is missing')
  }

  const outputParent = dirname(outputDir)
  await mkdir(outputParent, { recursive: true })
  const temporaryRoot = await mkdtemp(join(outputParent, `.${parse(outputDir).base}-sync-`))
  const stageDirectory = join(temporaryRoot, 'next')

  try {
    await mkdir(join(stageDirectory, 'runtime'), { recursive: true })
    for (const fileName of runtimeEntries) {
      const bytes = await readFile(join(runtimeSourceDir, fileName))
      if (bytes.length === 0) throw new Error(`Runtime file is empty: ${fileName}`)
      await writeFile(join(stageDirectory, 'runtime', fileName), bytes)
    }

    const downloads = []
    for (const variant of variants) {
      for (const codec of selectedCodecs) {
        downloads.push({
          upstreamPath: decoderUpstreamPath(codec, variant),
          outputPath: `wasm/${variant}/${codec}.wasm`
        })
      }
      for (const [directory, name] of SHARED_RESOURCES) {
        downloads.push({
          upstreamPath: sharedUpstreamPath(directory, name, variant),
          outputPath: `wasm/${variant}/${name}.wasm`
        })
      }
    }

    await mapWithConcurrency(downloads, 6, async ({ upstreamPath, outputPath }) => {
      assertAllowedPath(upstreamPath)
      assertAllowedPath(outputPath)
      const bytes = await readUpstreamAsset(upstreamPath)
      if (!bytes || bytes.length === 0) throw new Error(`Asset is empty: ${upstreamPath}`)
      const outputPathParts = outputPath.split('/')
      const destination = join(stageDirectory, ...outputPathParts)
      await mkdir(dirname(destination), { recursive: true })
      await writeFile(destination, bytes)
    })

    const files = await buildFileManifest(stageDirectory)
    const manifest = {
      schemaVersion: 1,
      runtimeVersion: VERSION,
      avplayerVersion: VERSION,
      upstreamCommit: UPSTREAM_COMMIT,
      preset,
      variants: [...variants],
      codecs: selectedCodecs,
      files
    }
    await writeFile(
      join(stageDirectory, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8'
    )
    await replaceDirectoryAtomically(stageDirectory, outputDir, temporaryRoot)
    return manifest
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : ''
if (invokedPath === fileURLToPath(import.meta.url).toLowerCase()) {
  syncAssets().then((manifest) => {
    process.stdout.write(
      `Synchronized ${Object.keys(manifest.files).length} libmedia assets (${manifest.preset}).\n`
    )
  }).catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`)
    process.exitCode = 1
  })
}
