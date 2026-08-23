import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

// prefer the runner image's pre-installed Chromium over a downloaded one
const localChromium = '/opt/pw-browsers/chromium';

// Cloud profile per CLAUDE.md: chromium only, 1 worker, minimal artifacts.
export default defineConfig({
  testDir: './tests',
  workers: 1,
  retries: 1,
  maxFailures: 1,
  timeout: 120_000,
  use: {
    browserName: 'chromium',
    baseURL: 'http://localhost:4173',
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    launchOptions: existsSync(localChromium) ? { executablePath: localChromium } : {},
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
