import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const matrix = [
  { vite: '5.4.19', pluginVue: '5.2.3' },
  { vite: '6.2.4', pluginVue: '5.2.3' },
  { vite: '7.1.0', pluginVue: '6.0.1' }
]

function run(command, args, options = {}) {
  const npmViaNode = command === 'npm' && process.env.npm_execpath
  const executable = npmViaNode ? process.execPath : command
  const commandArgs = npmViaNode ? [process.env.npm_execpath, ...args] : args
  const result = spawnSync(executable, commandArgs, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit'
  })
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed with exit code ${result.status}: ${result.error?.message ?? ''}`
    )
  }
  return result.stdout
}

const projectRoot = resolve(import.meta.dirname, '..')
const temporaryRoot = await mkdtemp(join(tmpdir(), 'libmedia-avp-matrix-'))

try {
  run('npm', ['run', 'build:lib'], { cwd: projectRoot })
  run('npm', ['run', 'build:plugin'], { cwd: projectRoot })
  const packOutput = run('npm', [
    'pack', '--json', '--pack-destination', temporaryRoot
  ], { cwd: projectRoot, capture: true })
  const [{ filename }] = JSON.parse(packOutput)
  const tarball = join(temporaryRoot, filename)

  for (const row of matrix) {
    const fixtureRoot = join(temporaryRoot, `vite-${row.vite}`)
    await mkdir(join(fixtureRoot, 'src'), { recursive: true })
    await writeFile(join(fixtureRoot, 'package.json'), JSON.stringify({
      private: true,
      type: 'module'
    }, null, 2))
    await writeFile(join(fixtureRoot, 'index.html'), '<div id="app"></div><script type="module" src="/src/main.js"></script>')
    await writeFile(join(fixtureRoot, 'src', 'main.js'), 'document.querySelector("#app").textContent = "ok"')
    await writeFile(join(fixtureRoot, 'vite.config.js'), `
import { defineConfig } from 'vite'
import { libmediaAssets } from 'libmedia-avp-vue3/vite'

export default defineConfig({
  plugins: [libmediaAssets({ preset: 'minimal', codecs: ['h264', 'aac'] })]
})
`)

    run('npm', [
      'install', '--no-package-lock', '--ignore-scripts',
      tarball, `vite@${row.vite}`, `@vitejs/plugin-vue@${row.pluginVue}`,
      'vue@3.5.18'
    ], { cwd: fixtureRoot })
    run('npm', ['exec', '--', 'vite', 'build'], { cwd: fixtureRoot })

    const manifestPath = join(
      fixtureRoot, 'dist', 'assets', 'libmedia-avp', 'manifest.json'
    )
    if (!existsSync(manifestPath)) {
      throw new Error(`Vite ${row.vite} did not emit ${manifestPath}`)
    }
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    if (manifest.avplayerVersion !== '1.3.1') {
      throw new Error(`Vite ${row.vite} emitted an unexpected manifest version`)
    }
    console.log(`Vite ${row.vite} + plugin-vue ${row.pluginVue}: OK (${basename(tarball)})`)
  }
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}
