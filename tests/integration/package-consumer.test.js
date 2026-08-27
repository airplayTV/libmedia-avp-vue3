import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()

describe('published package', () => {
  it('builds in a Vue 3 JavaScript-only consumer', async () => {
    const appSource = await readFile(
      join(projectRoot, 'tests/fixtures/vue-js-consumer/src/App.vue'),
      'utf8'
    )
    expect(appSource).not.toContain('lang="ts"')

    const result = spawnSync(process.execPath, [
      process.env.npm_execpath,
      'run',
      'verify:package'
    ], {
      cwd: projectRoot,
      encoding: 'utf8'
    })

    expect(`${result.stdout}\n${result.stderr}`).toContain(
      'JavaScript package consumer: OK'
    )
    expect(result.status).toBe(0)
  }, 120_000)
})
