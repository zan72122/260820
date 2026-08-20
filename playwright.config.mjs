import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// 環境に用意済みの Chromium を使う（"playwright install" は走らせない方針）。
const PREINSTALLED = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
].find((p) => p && existsSync(p));

// Claude Code on the web / 小さな CI ランナー向けのプロファイル。
const CLOUD = process.env.CLAUDE_CODE_REMOTE === 'true' || process.env.CI === 'true';

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  workers: 1,
  retries: 1,
  maxFailures: CLOUD ? 1 : undefined,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    viewport: { width: 812, height: 375 },   // 横画面（iPhone 相当の最小実用サイズ）
    deviceScaleFactor: 1,
    launchOptions: {
      ...(PREINSTALLED ? { executablePath: PREINSTALLED } : {}),
      args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
    },
  },
  projects: [
    { name: 'chromium-landscape', use: { ...devices['Desktop Chrome'], viewport: { width: 812, height: 375 }, deviceScaleFactor: 1 } },
    { name: 'chromium-portrait', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: false } },
  ],
  webServer: {
    command: 'node server.mjs',
    url: 'http://127.0.0.1:5173/',
    reuseExistingServer: true,
    timeout: 20_000,
  },
});
