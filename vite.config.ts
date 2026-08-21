import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: {
    target: ['es2020', 'safari15'],
    assetsInlineLimit: 8192,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined),
      },
    },
  },
})
