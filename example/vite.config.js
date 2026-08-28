import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { libmediaAssets } from 'libmedia-avp-vue3/vite'

const mediaRoot = fileURLToPath(
  new URL('../tests/fixtures/media', import.meta.url)
)
const base = process.env.GITHUB_PAGES === 'true'
  ? '/libmedia-avp-vue3/'
  : '/'

export default defineConfig({
  base,
  publicDir: mediaRoot,
  plugins: [
    vue(),
    libmediaAssets({
      preset: 'minimal',
      codecs: ['h264', 'aac'],
      wasmVariants: ['baseline'],
      threading: false
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
