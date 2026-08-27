import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { build } from 'vite'
import libraryConfig from '../../vite.lib.config.js'

let outputDirectory

afterEach(async () => {
  if (outputDirectory) {
    await rm(outputDirectory, { recursive: true, force: true })
    outputDirectory = undefined
  }
})

describe('library build', () => {
  it('emits the documented style.css entry', async () => {
    outputDirectory = await mkdtemp(join(tmpdir(), 'libmedia-avp-vue3-build-'))

    await build({
      ...libraryConfig,
      configFile: false,
      build: {
        ...libraryConfig.build,
        outDir: outputDirectory,
        emptyOutDir: true
      }
    })

    expect(existsSync(join(outputDirectory, 'style.css'))).toBe(true)
  })
})
