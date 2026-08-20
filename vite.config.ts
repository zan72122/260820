/// <reference types="vitest" />
import { defineConfig } from 'vite'

export default defineConfig({
  // Playwright owns e2e/; vitest must not try to collect it.
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
})
