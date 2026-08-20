import { defineConfig, devices } from '@playwright/test'

/**
 * Cloud profile: Chromium only, one worker, minimal artefacts. Anything that
 * judges frame rate or final visual quality belongs on hardware-accelerated
 * runners, not here.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 1,
  maxFailures: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    launchOptions: {
      // The image ships one Chromium build; use it rather than downloading.
      executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--disable-lcd-text',
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
