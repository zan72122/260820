import { defineConfig, devices } from '@playwright/test';

/**
 * クラウド実行プロファイル: Chromium のみ / workers=1 / retries=1 /
 * maxFailures=1 / video off / screenshot only-on-failure / trace on-first-retry
 */
export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  retries: 1,
  maxFailures: 1,
  timeout: 90_000,
  use: {
    ...devices['Desktop Chrome'],
    // 実行環境に事前インストール済みの Chromium を使う(再ダウンロード禁止)
    launchOptions: { executablePath: '/opt/pw-browsers/chromium' },
    baseURL: 'http://127.0.0.1:4173',
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    viewport: { width: 390, height: 844 },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
