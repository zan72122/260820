import { defineConfig } from '@playwright/test'

// Cloud/CI profile per CLAUDE.md: Chromium only, single worker, minimal
// artifacts, small viewport. WebGL runs on SwiftShader in headless
// environments, so specs must only assert logic/state — never visual quality.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  workers: 1,
  retries: 1,
  maxFailures: 1,
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 640, height: 360 },
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    launchOptions: {
      // Allow software WebGL (SwiftShader) in headless containers.
      args: ['--enable-unsafe-swiftshader'],
      // Cloud runners pre-install Chromium outside Playwright's registry;
      // PW_CHROMIUM_PATH points at that binary (see README).
      ...(process.env.PW_CHROMIUM_PATH
        ? { executablePath: process.env.PW_CHROMIUM_PATH }
        : {}),
    },
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 240_000,
  },
})
