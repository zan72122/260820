import { defineConfig, devices } from '@playwright/test';

// Cloud/CI profile: Chromium only, minimal parallelism, cheap artifacts.
export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  retries: 1,
  maxFailures: 1,
  timeout: 60_000,
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 960, height: 540 },
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
