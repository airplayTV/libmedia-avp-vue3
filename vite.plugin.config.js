import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: 'vite/index.js',
      formats: ['es', 'cjs'],
      fileName: (format) => format === 'es' ? 'index.js' : 'index.cjs'
    },
    outDir: 'dist/vite',
    rollupOptions: {
      external: [/^node:/],
      output: { exports: 'named' }
    }
  }
})
