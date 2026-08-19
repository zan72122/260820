import { defineConfig, devices } from '@playwright/test'

/**
 * Cloud/CI profile per CLAUDE.md: Chromium only, one worker, one retry, stop on
 * the first failure, no video, screenshots only when something breaks.
 * PW_CHROMIUM lets a pre-installed Chromium be used instead of a download.
 */
const executablePath = process.env.PW_CHROMIUM || undefined

export default defineConfig({
  testDir: './tests',
  timeout: 15 * 60 * 1000,
  expect: { timeout: 15_000 },
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
      executablePath,
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
