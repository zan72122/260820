import { defineConfig, devices } from '@playwright/test';

const FAST = process.env.E2E_FAST === '1' || process.env.CLAUDE_CODE_REMOTE === 'true';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: FAST ? 1 : 0,
  maxFailures: FAST ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    viewport: { width: 390, height: 664 },
    deviceScaleFactor: 1,
  },
  projects: [
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 664 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: true,
        launchOptions: {
          args: [
            '--use-gl=swiftshader',
            '--enable-unsafe-swiftshader',
            '--disable-dev-shm-usage',
            '--no-sandbox',
          ],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
