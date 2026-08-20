import { defineConfig, devices } from '@playwright/test';

// CLAUDE.md のクラウドプロファイルに合わせた設定
const FAST = process.env.E2E_FAST === '1';
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 1,
  maxFailures: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    launchOptions: {
      executablePath: CHROME,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
  projects: [
    {
      name: 'mobile-portrait',
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
    },
    {
      name: 'mobile-landscape',
      use: { ...devices['Pixel 5'], viewport: { width: 780, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: 'node scripts/serve.js',
    url: 'http://localhost:5173/',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
