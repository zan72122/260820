import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: true, host: true },
  build: {
    target: 'es2021',
    sourcemap: false,
    chunkSizeWarningLimit: 1200
  }
});
