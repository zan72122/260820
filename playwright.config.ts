import { defineConfig } from '@playwright/test';

// Cloud profile per CLAUDE.md: Chromium only, workers=1, retries=1,
// maxFailures=1, video off, screenshot on failure, trace on first retry.
export default defineConfig({
  testDir: './tests',
  workers: 1,
  retries: 1,
  maxFailures: 1,
  timeout: 90_000,
  use: {
    browserName: 'chromium',
    launchOptions: {
      executablePath: '/opt/pw-browsers/chromium',
      args: ['--enable-unsafe-swiftshader'],
    },
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    hasTouch: true,
    isMobile: true,
    baseURL: 'http://127.0.0.1:5173',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
