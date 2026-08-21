import { defineConfig } from '@playwright/test';

/**
 * Cloud runner profile: Chromium only, one worker, tiny artefacts.
 *
 * Nothing here judges frame rate or visual fidelity — the container has no
 * hardware GPU. This suite only proves that a full round can be played through.
 */
export default defineConfig({
  testDir: './tests',
  // A full round is a real play-through; on a software rasteriser it is slow.
  timeout: 900_000,
  expect: { timeout: 30_000 },
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
      args: [
        // Containers commonly run this as root, where the Chromium sandbox
        // refuses to start; this browser only ever loads our own dev server.
        '--no-sandbox',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--disable-lcd-text',
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },
  // Chromium only, at the two shapes the game is designed around. The device
  // presets are not used because they would pull in WebKit, which cannot be
  // driven from this container.
  projects: [
    {
      name: 'iphone-portrait',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'ipad-landscape',
      use: {
        browserName: 'chromium',
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
