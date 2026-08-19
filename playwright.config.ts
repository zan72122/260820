import { defineConfig, devices } from '@playwright/test';

/**
 * Cloud profile: Chromium only, single worker, tiny artefacts. Anything that
 * needs a real GPU (FPS, visual regression) belongs on a hardware runner.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 1,
  maxFailures: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    launchOptions: {
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
