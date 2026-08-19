import { defineConfig, devices } from '@playwright/test'

/**
 * Cloud profile per CLAUDE.md: Chromium only, one worker, no video, tiny surface.
 * The app runs with `?fast=1`, which pins the seed, drops the pixel ratio and
 * turns off shadows. This proves the *loop* works. It says nothing about how the
 * game looks or how fast it runs — SwiftShader cannot answer either question, so
 * those belong on a machine with a real GPU.
 */
const chromium = {
  ...devices['Desktop Chrome'],
  channel: undefined,
}

export default defineConfig({
  testDir: './e2e',
  timeout: 300_000,
  expect: { timeout: 30_000 },
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
    launchOptions: {
      // pinned to the browser this image ships; never re-download here
      executablePath: '/opt/pw-browsers/chromium',
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [
    // phone-sized surfaces run the whole cake, both ways up
    { name: 'iphone-portrait', use: { ...chromium, viewport: { width: 390, height: 844 } } },
    { name: 'iphone-landscape', use: { ...chromium, viewport: { width: 844, height: 390 } } },
    // tablet surfaces cost 2-3x the fill rate under SwiftShader, so they check
    // reachability and framing rather than replaying the full loop
    { name: 'ipad-portrait', use: { ...chromium, viewport: { width: 768, height: 1024 } } },
    { name: 'ipad-landscape', use: { ...chromium, viewport: { width: 1024, height: 768 } } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
