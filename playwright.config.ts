import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'

/*
 * Cloud profile: Chromium only, one worker, software GL.  There is no
 * hardware GPU on this runner, so these tests check that the game boots,
 * plays a whole round and survives rotation — never frame rate, animation
 * smoothness or visual fidelity.  Those belong on a GPU runner.
 */
const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium'
const executablePath = fs.existsSync(LOCAL_CHROMIUM) ? LOCAL_CHROMIUM : undefined

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  maxFailures: 1,
  timeout: 150_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    launchOptions: {
      executablePath,
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--no-sandbox',
      ],
    },
  },
  projects: [
    {
      name: 'portrait',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: false, hasTouch: true },
    },
    {
      name: 'landscape',
      use: { ...devices['Desktop Chrome'], viewport: { width: 844, height: 390 }, isMobile: false, hasTouch: true },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
  },
})
