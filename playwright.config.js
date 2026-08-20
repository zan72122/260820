import { defineConfig, devices } from '@playwright/test';

// Cloud profile from CLAUDE.md: Chromium only, one worker, fail fast, no video,
// smallest practical viewport. The GPU here is SwiftShader, so this suite checks
// that the thing runs and behaves -- never how it looks or how fast it is.
const CHROMIUM = process.env.PW_CHROMIUM || undefined;

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 1,
  maxFailures: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        hasTouch: true,
        launchOptions: {
          executablePath: CHROMIUM,
          args: [
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
          ],
        },
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
