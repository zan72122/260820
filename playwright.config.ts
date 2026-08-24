import { defineConfig } from '@playwright/test'

// Cloud profile: Chromium only, 1 worker, minimal artifacts.
export default defineConfig({
  testDir: './tests',
  timeout: 180_000,
  retries: 1,
  workers: 1,
  maxFailures: 1,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' },
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    viewport: { width: 390, height: 844 }
  }
})
