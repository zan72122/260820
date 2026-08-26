import { defineConfig } from '@playwright/test';

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// Cloud profile per CLAUDE.md: Chromium only, one worker, one retry, fail fast,
// no video, screenshots only on failure. WebGL runs on SwiftShader here, so
// these tests assert behaviour and framing — never frame rate or visual quality.
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 1,
  maxFailures: 1,
  fullyParallel: false,
  reporter: [['list']],
  webServer: {
    command: 'node server.js',
    url: 'http://localhost:5173/',
    reuseExistingServer: true,
    timeout: 30_000
  },
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    launchOptions: {
      executablePath: CHROME,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    }
  }
});
