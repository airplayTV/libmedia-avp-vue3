import { copyFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')

await mkdir(resolve(projectRoot, 'dist/vite'), { recursive: true })
await Promise.all([
  copyFile(
    resolve(projectRoot, 'src/index.d.ts'),
    resolve(projectRoot, 'dist/index.d.ts')
  ),
  copyFile(
    resolve(projectRoot, 'vite/index.d.ts'),
    resolve(projectRoot, 'dist/vite/index.d.ts')
  )
])
