import { defineConfig, devices } from '@playwright/test';

/**
 * Cloud profile: Chromium only, one worker, tiny budgets.
 *
 * SwiftShader renders correctly but slowly, so nothing here judges frame rate,
 * animation smoothness or final image quality. These tests check that the
 * sequence advances, that the geometry is present and varied, and that the
 * layout survives both orientations on both device classes. Performance and
 * visual regression belong on a GPU runner.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  maxFailures: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    launchOptions: {
      // The pinned Playwright build expects a newer Chromium revision than
      // the one installed in this environment.
      executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
      args: [
        // The runner is root, so Chromium's zygote sandbox cannot start.
        '--no-sandbox',
        '--enable-unsafe-swiftshader',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--disable-dev-shm-usage',
      ],
    },
  },
  // The iOS device descriptors default to WebKit, which is not installed
  // here; the profile is Chromium only, so the browser is pinned explicitly
  // and only the viewport, scale factor and touch flags are taken from them.
  projects: [
    {
      name: 'iphone-portrait',
      use: { ...devices['iPhone 13'], browserName: 'chromium', deviceScaleFactor: 1 },
    },
    {
      name: 'iphone-landscape',
      use: { ...devices['iPhone 13 landscape'], browserName: 'chromium', deviceScaleFactor: 1 },
    },
    {
      name: 'ipad-portrait',
      use: { ...devices['iPad (gen 7)'], browserName: 'chromium', deviceScaleFactor: 1 },
    },
    {
      name: 'ipad-landscape',
      use: { ...devices['iPad (gen 7) landscape'], browserName: 'chromium', deviceScaleFactor: 1 },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
