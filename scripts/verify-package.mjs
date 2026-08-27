import { existsSync } from 'node:fs'
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const projectRoot = resolve(import.meta.dirname, '..')
const fixtureSource = resolve(projectRoot, 'tests/fixtures/vue-js-consumer')
const temporaryRoot = await mkdtemp(resolve(projectRoot, '.package-verify-'))

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

try {
  if (existsSync(resolve(fixtureSource, 'tsconfig.json'))) {
    throw new Error('JavaScript fixture must not contain tsconfig.json')
  }
  const appSource = await readFile(resolve(fixtureSource, 'src/App.vue'), 'utf8')
  if (/lang=["']ts["']/.test(appSource)) {
    throw new Error('JavaScript fixture must not use lang="ts"')
  }

  run('npm', ['run', 'build'], { cwd: projectRoot })
  const packOutput = run('npm', [
    'pack', '--json', '--pack-destination', temporaryRoot
  ], { cwd: projectRoot, capture: true })
  const [packResult] = JSON.parse(packOutput)
  const packedFiles = packResult.files.map(({ path }) => path)
  const requiredFiles = [
    'dist/index.js',
    'dist/index.cjs',
    'dist/index.d.ts',
    'dist/style.css',
    'dist/vite/index.js',
    'dist/vite/index.cjs',
    'dist/vite/index.d.ts',
    'runtime-assets/manifest.json'
  ]
  for (const fileName of requiredFiles) {
    if (!packedFiles.includes(fileName)) {
      throw new Error(`Packed archive is missing ${fileName}`)
    }
  }
  const forbidden = packedFiles.filter((fileName) => (
    fileName.startsWith('src/') ||
    fileName.startsWith('tests/') ||
    fileName.includes('node_modules') ||
    /(?:^|\/)encode(?:\/|$)|x26[45]/i.test(fileName)
  ))
  if (forbidden.length > 0) {
    throw new Error(`Packed archive contains forbidden files: ${forbidden.join(', ')}`)
  }

  const consumerRoot = join(temporaryRoot, 'consumer')
  await cp(fixtureSource, consumerRoot, { recursive: true })
  const tarball = join(temporaryRoot, packResult.filename)
  run('npm', [
    'install', '--no-package-lock', '--ignore-scripts',
    tarball, 'vue@3.5.18', 'vite@6.2.4', '@vitejs/plugin-vue@5.2.3'
  ], { cwd: consumerRoot })
  run('npm', ['exec', '--', 'vite', 'build'], { cwd: consumerRoot })

  const emittedManifest = join(
    consumerRoot, 'dist', 'assets', 'libmedia-avp', 'manifest.json'
  )
  if (!existsSync(emittedManifest)) {
    throw new Error('Consumer build did not emit the libmedia runtime manifest')
  }
  console.log('JavaScript package consumer: OK')
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}
