import { defineConfig } from '@playwright/test';

// Cloud profile: Chromium only, one worker, minimal artefacts.
// FPS, smoothness and final visual quality must never be judged from this run —
// it executes on a software rasteriser.
export default defineConfig({
  testDir: './tests',
  timeout: 300_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 1,
  maxFailures: 1,
  reporter: [['list']],
  use: {
    browserName: 'chromium',
    // smallest practical phone-sized viewport, device pixel ratio 1
    viewport: { width: 390, height: 780 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    baseURL: 'http://127.0.0.1:4173',
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    launchOptions: {
      // the runner ships its own Chromium build; use it instead of downloading
      executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium',
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
        '--disable-dev-shm-usage',
      ],
    },
  },
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
