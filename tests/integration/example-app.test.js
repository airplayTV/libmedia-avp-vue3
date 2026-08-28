import { access, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()

describe('example application', () => {
  it('builds as a JavaScript workspace consumer through package exports', async () => {
    const result = spawnSync(process.execPath, [
      process.env.npm_execpath,
      'run',
      'example:build'
    ], {
      cwd: projectRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_PAGES: 'true'
      }
    })

    expect(`${result.stdout}\n${result.stderr}`).toContain(
      'Example JavaScript consumer: OK'
    )
    expect(result.status).toBe(0)

    const outputPath = join(projectRoot, 'example/dist/index.html')
    await expect(access(outputPath)).resolves.toBeUndefined()
    await expect(readFile(outputPath, 'utf8')).resolves.toContain(
      '<div id="app"></div>'
    )

    const html = await readFile(outputPath, 'utf8')
    expect(html).toContain('/libmedia-avp-vue3/assets/')

    const assetsPath = join(projectRoot, 'example/dist/assets')
    const scriptName = (await readdir(assetsPath)).find((fileName) => (
      fileName.endsWith('.js')
    ))
    expect(scriptName).toBeDefined()

    const script = await readFile(join(assetsPath, scriptName), 'utf8')
    expect(script).toContain('/libmedia-avp-vue3/')
    expect(script).toContain('sample.mp4')
    expect(script).toContain('hls/sample.m3u8')
    expect(script).not.toMatch(/mp4:"\/sample\.mp4"/)
    expect(script).not.toMatch(/hls:"\/hls\/sample\.m3u8"/)
    expect(script).toContain('/libmedia-avp-vue3/assets/libmedia-avp/')
  }, 120_000)
})
