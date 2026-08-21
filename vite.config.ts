import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: ['es2020', 'safari15'],
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1600,
  },
  server: {
    host: true,
    port: 5173,
  },
});
