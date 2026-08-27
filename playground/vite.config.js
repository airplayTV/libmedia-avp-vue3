import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { libmediaAssets } from '../vite/index.js'

const playgroundRoot = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const mediaRoot = fileURLToPath(
  new URL('../tests/fixtures/media', import.meta.url)
)

export default defineConfig({
  root: playgroundRoot,
  publicDir: mediaRoot,
  plugins: [
    vue(),
    libmediaAssets({
      preset: 'minimal',
      codecs: ['h264', 'aac'],
      wasmVariants: ['baseline']
    })
  ],
  server: {
    fs: { allow: [projectRoot] }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
