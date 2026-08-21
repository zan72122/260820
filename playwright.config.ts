import { defineConfig, devices } from '@playwright/test';

const fast = process.env.E2E_FAST === '1';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: fast ? 1 : 0,
  maxFailures: fast ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
      ],
    },
  },
  projects: [
    {
      name: 'iphone-portrait',
      use: { ...devices['iPhone 13'], browserName: 'chromium', defaultBrowserType: 'chromium', deviceScaleFactor: 2 },
    },
    {
      name: 'iphone-landscape',
      use: {
        ...devices['iPhone 13 landscape'],
        browserName: 'chromium',
        defaultBrowserType: 'chromium',
        deviceScaleFactor: 2,
      },
    },
    {
      name: 'ipad-portrait',
      use: { ...devices['iPad (gen 7)'], browserName: 'chromium', defaultBrowserType: 'chromium', deviceScaleFactor: 2 },
    },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
