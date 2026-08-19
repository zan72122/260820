import { defineConfig, devices } from '@playwright/test';

/**
 * Cloud profile (see CLAUDE.md): Chromium only, one worker, one retry, stop on
 * the first failure, no video, screenshots only when something breaks.
 * WebGL runs on SwiftShader here, so these tests assert behaviour and state —
 * never frame rate, smoothness or final visual quality.
 */
const fast = process.env.E2E_FAST !== '0';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  maxFailures: 1,
  timeout: 240_000,
  expect: { timeout: 30_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    launchOptions: {
      // The runner ships one pre-installed Chromium; use it rather than
      // downloading a second copy for this Playwright build.
      executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium',
      args: [
        // the runner is root: Chromium's zygote sandbox cannot start here
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--disable-lcd-text',
      ],
    },
  },
  // The Apple device descriptors default to WebKit; this runner only has
  // Chromium, so every project pins browserName explicitly and keeps the
  // descriptor for its viewport, touch and user-agent shape.
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
      use: {
        ...devices['iPad (gen 7)'],
        browserName: 'chromium',
        deviceScaleFactor: 1,
        viewport: { width: 810, height: 1080 },
      },
    },
    {
      name: 'ipad-landscape',
      use: {
        ...devices['iPad (gen 7) landscape'],
        browserName: 'chromium',
        deviceScaleFactor: 1,
        viewport: { width: 1080, height: 810 },
      },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 60_000,
    env: { E2E_FAST: fast ? '1' : '0' },
  },
});
