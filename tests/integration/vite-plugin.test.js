import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { build } from 'vite'
import { libmediaAssets } from '../../vite/index.js'

const temporaryDirectories = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )))
})

async function createFixture() {
  const root = await mkdtemp(join(process.cwd(), '.vite-plugin-test-'))
  temporaryDirectories.push(root)
  await writeFile(join(root, 'index.html'), '<script type="module" src="/src.js"></script>')
  await writeFile(join(root, 'src.js'), 'export const fixture = true')
  return root
}

async function listFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      files.push(...await listFiles(join(directory, entry.name), relativePath))
    } else {
      files.push(relativePath)
    }
  }
  return files.sort()
}

describe('libmediaAssets', () => {
  it('rejects invalid presets, variants and unsafe output paths', () => {
    expect(() => libmediaAssets({ preset: 'unknown' })).toThrow('INVALID_ASSET_PRESET')
    expect(() => libmediaAssets({ wasmVariants: ['turbo'] })).toThrow('INVALID_WASM_VARIANT')
    expect(() => libmediaAssets({ outputDir: '../public' })).toThrow('INVALID_OUTPUT_DIR')
    expect(() => libmediaAssets({ outputDir: 'assets\\runtime' })).toThrow('INVALID_OUTPUT_DIR')
    expect(() => libmediaAssets({ outputDir: '/absolute' })).toThrow('INVALID_OUTPUT_DIR')
  })

  it('emits a filtered manifest and only selected runtime resources', async () => {
    const root = await createFixture()
    await build({
      configFile: false,
      root,
      base: '/app/',
      logLevel: 'silent',
      plugins: [libmediaAssets({
        preset: 'minimal',
        codecs: ['h264', 'aac'],
        wasmVariants: ['baseline', 'simd']
      })]
    })

    const assetRoot = join(root, 'dist', 'assets', 'libmedia-avp')
    const files = await listFiles(assetRoot)
    const manifest = JSON.parse(await readFile(join(assetRoot, 'manifest.json'), 'utf8'))

    expect(files).toContain('runtime/avplayer.js')
    expect(files).toContain('wasm/baseline/h264.wasm')
    expect(files).toContain('wasm/simd/aac.wasm')
    expect(files).toContain('wasm/simd/resample.wasm')
    expect(files).toContain('wasm/simd/stretchpitch.wasm')
    expect(files.some((file) => file.endsWith('/mp3.wasm'))).toBe(false)
    expect(manifest.preset).toBe('minimal')
    expect(manifest.codecs).toEqual(['aac', 'h264'])
    expect(manifest.variants).toEqual(['baseline', 'simd'])
    expect(Object.keys(manifest.files).sort()).toEqual(
      files.filter((file) => file !== 'manifest.json')
    )
  })

  it('defines the deployment base but emits no assets in external mode', async () => {
    const root = await createFixture()
    await build({
      configFile: false,
      root,
      base: '/app/',
      logLevel: 'silent',
      plugins: [libmediaAssets({ externalAssets: true })]
    })

    const files = await listFiles(join(root, 'dist'))
    expect(files.some((file) => file.includes('libmedia-avp'))).toBe(false)
  })
})
