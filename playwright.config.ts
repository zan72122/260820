import { defineConfig, devices } from '@playwright/test';

/**
 * Cloud profile: Chromium only, one worker, minimal artefacts. The full
 * matrix belongs on a machine with a real GPU -- see README.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 240_000,
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
      // The image ships Chromium 1194; this @playwright/test build looks for a
      // newer revision, so point it at the one that is actually installed.
      executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium',
      args: [
        '--use-gl=swiftshader',
        '--enable-unsafe-swiftshader',
        '--disable-dev-shm-usage',
        '--no-sandbox',
      ],
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
