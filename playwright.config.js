import fs from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Cloud / CI profile per CLAUDE.md: chromium only, 1 worker, tight budgets.
const CLOUD = process.env.CLAUDE_CODE_REMOTE === 'true' || !!process.env.CI;

// Sandboxes ship a pre-installed Chromium that may not match the version this
// Playwright would download. Use it when it is there rather than fetching.
const PREINSTALLED = process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const executablePath = fs.existsSync(PREINSTALLED) ? PREINSTALLED : undefined;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: CLOUD ? 1 : 0,
  maxFailures: CLOUD ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    viewport: { width: 390, height: 720 },
    launchOptions: {
      executablePath,
      args: [
        '--use-gl=swiftshader',
        '--enable-unsafe-swiftshader',
        '--disable-dev-shm-usage',
        '--no-sandbox',
      ],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 720 } } }],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !CLOUD,
    timeout: 180_000,
    env: { E2E_FAST: '1' },
  },
});
