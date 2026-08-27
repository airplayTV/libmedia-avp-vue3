import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { syncAssets } from '../../scripts/sync-libmedia-assets.mjs'

let fixtureRoot

afterEach(async () => {
  if (fixtureRoot) {
    await rm(fixtureRoot, { recursive: true, force: true })
    fixtureRoot = undefined
  }
})

function digest(value) {
  return createHash('sha256').update(value).digest('hex')
}

describe('libmedia asset synchronization', () => {
  it('copies runtime chunks, resolves variants and writes a deterministic manifest', async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), 'libmedia-sync-'))
    const runtimeSourceDir = join(fixtureRoot, 'runtime-source')
    const outputDir = join(fixtureRoot, 'runtime-assets')
    await mkdir(runtimeSourceDir)
    await writeFile(join(runtimeSourceDir, 'avplayer.js'), 'main-runtime')
    await writeFile(join(runtimeSourceDir, '123.avplayer.js'), 'dynamic-runtime')
    await writeFile(join(runtimeSourceDir, 'ignore.js'), 'not-a-runtime-chunk')
    await mkdir(outputDir)
    await writeFile(join(outputDir, 'stale.txt'), 'stale')

    const catalog = {
      minimal: ['h264'],
      standard: ['aac', 'h264'],
      full: ['aac', 'h264', 'mp3']
    }
    const readUpstreamAsset = async (relativePath) => Buffer.from(relativePath)
    const probeUpstreamAsset = async () => true
    const options = {
      runtimeSourceDir,
      outputDir,
      catalog,
      preset: 'standard',
      readUpstreamAsset,
      probeUpstreamAsset
    }

    const manifest = await syncAssets(options)

    expect(manifest).toMatchObject({
      schemaVersion: 1,
      runtimeVersion: '1.3.1',
      avplayerVersion: '1.3.1',
      upstreamCommit: '152f629d3021fd8013efa464fcb7b55f9fbe7753',
      preset: 'standard',
      variants: ['baseline', 'simd', 'atomic'],
      codecs: ['aac', 'h264']
    })
    expect(manifest.files['runtime/avplayer.js']).toEqual({
      sha256: digest('main-runtime'),
      size: 12
    })
    expect(manifest.files['runtime/123.avplayer.js']).toEqual({
      sha256: digest('dynamic-runtime'),
      size: 15
    })
    expect(manifest.files['wasm/simd/h264.wasm'].sha256)
      .toMatch(/^[a-f0-9]{64}$/)
    expect(await readFile(join(outputDir, 'wasm/simd/h264.wasm'), 'utf8'))
      .toBe('decode/h264-simd.wasm')
    await expect(readFile(join(outputDir, 'stale.txt'))).rejects.toMatchObject({
      code: 'ENOENT'
    })

    const firstManifest = await readFile(join(outputDir, 'manifest.json'), 'utf8')
    await syncAssets(options)
    const secondManifest = await readFile(join(outputDir, 'manifest.json'), 'utf8')
    expect(secondManifest).toBe(firstManifest)
    expect(Object.keys(JSON.parse(secondManifest).files)).toEqual(
      [...Object.keys(JSON.parse(secondManifest).files)].sort()
    )
  })

  it('rejects catalogs whose presets are not strict supersets', async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), 'libmedia-sync-invalid-'))
    const runtimeSourceDir = join(fixtureRoot, 'runtime-source')
    await mkdir(runtimeSourceDir)
    await writeFile(join(runtimeSourceDir, 'avplayer.js'), 'runtime')

    await expect(syncAssets({
      runtimeSourceDir,
      outputDir: join(fixtureRoot, 'runtime-assets'),
      catalog: {
        minimal: ['h264'],
        standard: ['h264'],
        full: ['h264', 'mp3']
      },
      readUpstreamAsset: async () => Buffer.from('wasm'),
      probeUpstreamAsset: async () => true
    })).rejects.toThrow('strict superset')
  })
})
