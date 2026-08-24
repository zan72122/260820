import { defineConfig } from '@playwright/test';

// Cloud/CI profile per CLAUDE.md: Chromium only, 1 worker, minimal artifacts.
export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  retries: 1,
  maxFailures: 1,
  timeout: 180_000,
  use: {
    launchOptions: {
      executablePath: '/opt/pw-browsers/chromium',
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
    baseURL: 'http://127.0.0.1:5183',
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
  },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5183',
    url: 'http://127.0.0.1:5183',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
