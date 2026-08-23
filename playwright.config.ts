import { defineConfig, devices } from '@playwright/test';

// Cloud profile per CLAUDE.md: Chromium only, 1 worker, minimal artifacts.
export default defineConfig({
  testDir: './tests',
  // generous: software WebGL (SwiftShader) renders slowly on CI-class runners
  timeout: 300_000,
  workers: 1,
  retries: 1,
  maxFailures: 1,
  use: {
    ...devices['iPhone 12'],
    browserName: 'chromium',
    // use the environment's pinned Chromium when present (e.g. cloud runner)
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
    viewport: { width: 390, height: 700 },
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    baseURL: 'http://localhost:4173'
  },
  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: true,
    timeout: 30_000
  }
});
