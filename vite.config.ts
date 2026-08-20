import { defineConfig } from 'vite';
import type { UserConfig } from 'vite';

const config: UserConfig & { test?: unknown } = {
  base: './',
  server: { host: '0.0.0.0', port: 5173 },
  preview: { host: '0.0.0.0', port: 4173 },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three')) return 'three';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/test/**/*.spec.ts'],
  },
};

export default defineConfig(config);
