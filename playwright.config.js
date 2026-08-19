import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

// この環境には Chromium が焼き込まれている。バージョンが Playwright の期待と
// ずれていても、実体を直接指すことでダウンロード無しで動かす。
function findChromium() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    const dir = fs.readdirSync(root).find((d) => /^chromium-\d+$/.test(d));
    if (dir) {
      const exe = `${root}/${dir}/chrome-linux/chrome`;
      if (fs.existsSync(exe)) return exe;
    }
  } catch { /* 既定の解決に任せる */ }
  return undefined;
}
const executablePath = findChromium();

// Claude Code on the web / CI 向けの軽量プロファイル。
// GPU が無い環境なので SwiftShader で動かす。FPS や見た目の最終品質はここでは判定しない。
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 1,
  maxFailures: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:4173',
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    launchOptions: {
      executablePath,
      args: [
        '--enable-unsafe-swiftshader',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--disable-dev-shm-usage',
      ],
    },
  },
  projects: [
    {
      name: 'iphone-portrait',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 664 }, isMobile: false, hasTouch: true },
    },
  ],
});
