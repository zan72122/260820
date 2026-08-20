import { defineConfig } from 'vite';

export default defineConfig({
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
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
  },
  // Unit tests only. The browser suite is Playwright's, and vitest picking up
  // `*.spec.js` under tests/e2e makes it fail to collect.
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
  },
});
