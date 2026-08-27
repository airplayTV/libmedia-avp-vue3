import { access, readFile } from 'node:fs/promises'
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
      encoding: 'utf8'
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
  }, 120_000)
})
