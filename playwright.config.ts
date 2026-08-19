import { defineConfig, devices } from '@playwright/test';

/** Cloud profile: Chromium only, one worker, tiny viewport, no video. */
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
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
      // The image ships Chromium 1194; use it rather than downloading one.
      executablePath: '/opt/pw-browsers/chromium',
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
      name: 'iphone-portrait',
      use: {
        ...devices['iPhone 13'],
        // Cloud policy: Chromium only, with the iPhone's viewport metrics.
        browserName: 'chromium',
        defaultBrowserType: 'chromium',
      },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
