import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { libmediaAssets } from 'libmedia-avp-vue3/vite'

export default defineConfig({
  plugins: [
    vue(),
    libmediaAssets({ preset: 'minimal', codecs: ['h264', 'aac'] })
  ]
})
