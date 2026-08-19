import { defineConfig, devices } from '@playwright/test';

const fast = process.env.E2E_FAST === '1';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  maxFailures: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    launchOptions: {
      executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium',
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--disable-lcd-text',
      ],
    },
  },
  projects: [
    {
      name: 'portrait',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', isMobile: false, hasTouch: true },
    },
    {
      name: 'landscape',
      use: {
        ...devices['iPhone 13 landscape'],
        defaultBrowserType: 'chromium',
        isMobile: false,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: fast ? 'npm run preview' : 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
