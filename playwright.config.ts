import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  workers: 1,
  retries: 1,
  maxFailures: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/?e2e=1`,
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    launchOptions: {
      executablePath: '/opt/pw-browsers/chromium',
      args: [
        '--no-sandbox',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
      ],
    },
  },
  projects: [
    {
      name: 'iphone-portrait',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium', // WebKit is not installed in this runner
        deviceScaleFactor: 1,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'npx vite preview --port 4173',
    port: PORT,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
