import { defineConfig, devices } from '@playwright/test';

/**
 * Cloud runner profile: Chromium only, one worker, tiny artefacts.
 *
 * Nothing here judges frame rate or visual fidelity — the container has no
 * hardware GPU. This suite only proves that a full round can be played through.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 150_000,
  expect: { timeout: 20_000 },
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
      executablePath: '/opt/pw-browsers/chromium',
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--disable-lcd-text',
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },
  projects: [
    {
      name: 'iphone-portrait',
      use: { ...devices['iPhone 13'], isMobile: true, hasTouch: true },
    },
    {
      name: 'ipad-landscape',
      use: {
        viewport: { width: 1180, height: 820 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
