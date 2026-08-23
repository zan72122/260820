import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  retries: 1,
  workers: 1,
  maxFailures: 1,
  use: {
    baseURL: 'http://localhost:4173',
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium',
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
    },
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: true,
  },
});
