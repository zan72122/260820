import { defineConfig } from '@playwright/test';

/**
 * Cloud profile: Chromium only, one worker, a phone-sized viewport, no video.
 * The tests launch their own browser (see tests/smoke.spec.ts), so the browser
 * options live there. The full matrix belongs on a machine with a real GPU.
 */
const BASE_URL = process.env.PW_BASE_URL ?? 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests',
  timeout: 600_000,
  expect: { timeout: 30_000 },
  workers: 1,
  retries: 1,
  maxFailures: 1,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'off',
  },
  webServer: {
    command: 'npm run preview',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
