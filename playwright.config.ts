import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Prefer a Chromium that is already on the machine.
 *
 * CI images here ship a pinned browser build under PLAYWRIGHT_BROWSERS_PATH,
 * and @playwright/test may want a newer revision than the one installed. Rather
 * than downloading hundreds of megabytes on every run, point at whatever real
 * binary is present and let Playwright resolve normally if none is.
 */
function resolveChromium(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;
  const candidates: string[] = [];
  for (const entry of readdirSync(root)) {
    if (!entry.startsWith('chromium')) continue;
    candidates.push(
      join(root, entry, 'chrome-linux', 'chrome'),
      join(root, entry, 'chrome-linux', 'headless_shell'),
      join(root, entry, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
    );
  }
  // A full browser beats a headless shell: the shell cannot do WebGL here.
  candidates.sort((a, b) => Number(b.endsWith('chrome')) - Number(a.endsWith('chrome')));
  return candidates.find((c) => existsSync(c));
}

const CHROMIUM = resolveChromium();

const FAST = process.env.E2E_FAST === '1' || process.env.CLAUDE_CODE_REMOTE === 'true';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: FAST ? 1 : 0,
  maxFailures: FAST ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    viewport: { width: 390, height: 664 },
    deviceScaleFactor: 1,
  },
  projects: [
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 664 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: true,
        launchOptions: {
          ...(CHROMIUM ? { executablePath: CHROMIUM } : {}),
          args: [
            '--use-gl=swiftshader',
            '--enable-unsafe-swiftshader',
            '--disable-dev-shm-usage',
            '--no-sandbox',
          ],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
