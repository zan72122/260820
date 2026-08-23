import { defineConfig } from '@playwright/test';

// Cloud/CI profile per CLAUDE.md: Chromium only, 1 worker, small viewport,
// no video, trace on first retry. The full suite belongs in CI.
export default defineConfig({
  testDir: './tests',
  workers: 1,
  retries: 1,
  maxFailures: 1,
  timeout: 120_000,
  use: {
    browserName: 'chromium',
    viewport: { width: 640, height: 360 },
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium',
      args: ['--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'npm run dev -- --port 5199',
    port: 5199,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
