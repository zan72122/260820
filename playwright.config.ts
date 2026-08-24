import { defineConfig } from '@playwright/test';

/**
 * Cloud profile (see CLAUDE.md): Chromium only, 1 worker, minimal artifacts.
 * The suite drives the real pointer path through the whole repair, so it
 * doubles as the play-through regression test.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 240_000,
  workers: 1,
  retries: 1,
  maxFailures: 1,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [
    {
      name: 'iphone-landscape',
      use: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
    },
    {
      name: 'iphone-portrait',
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
