import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: '0.0.0.0', port: 5173 },
  preview: { host: '0.0.0.0', port: 4173 },
  build: {
    target: 'es2020',
    // Single hero page: keep the bundle in one request for mobile.
    chunkSizeWarningLimit: 1200,
  },
});
