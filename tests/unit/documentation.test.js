import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

async function text(path) {
  return readFile(resolve(process.cwd(), path), 'utf8')
}

describe('package documentation', () => {
  it('documents JavaScript usage, all public surfaces and deployment constraints', async () => {
    const readme = await text('README.md')
    const cdn = await text('docs/cdn-deployment.md')
    const troubleshooting = await text('docs/troubleshooting.md')

    expect(readme).toContain("import { libmediaAssets } from 'libmedia-avp-vue3/vite'")
    expect(readme).toContain('<LibmediaPlayer')
    expect(readme).toContain('LibmediaPlayerCore')
    expect(readme).toContain('useLibmediaPlayer')
    expect(readme).toContain('minimal')
    expect(readme).toContain('standard')
    expect(readme).toContain('full')
    expect(readme).not.toContain('@latest')
    expect(cdn).toContain('Cross-Origin-Opener-Policy')
    expect(cdn).toContain('application/wasm')
    expect(cdn).toContain('Cross-Origin-Resource-Policy')
    expect(troubleshooting).toContain('RUNTIME_LOAD_FAILED')
    expect(troubleshooting).toContain('CODEC_NOT_INCLUDED')
  })

  it('records the wrapper and pinned upstream licensing boundary', async () => {
    const wrapperLicense = await text('LICENSE')
    const thirdParty = await text('THIRD_PARTY_LICENSES.md')

    expect(wrapperLicense).toContain('All rights reserved')
    expect(thirdParty).toContain('LGPL-3.0-or-later')
    expect(thirdParty).toContain('1.3.1')
    expect(thirdParty).toContain('152f629d3021fd8013efa464fcb7b55f9fbe7753')
    expect(thirdParty).toContain('x264')
    expect(thirdParty).toContain('x265')
  })
})
