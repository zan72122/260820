import { chromium } from '@playwright/test';
const vp = { width: 390, height: 844 };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: vp });
await page.goto('http://127.0.0.1:5173/?e2e=1&hq=1');
await page.waitForFunction(() => window.__game && window.__game.metrics.frames > 5);
await page.evaluate(() => window.__game.fastForward(8));
const intro = await page.evaluate(() => window.__game.introStreakScreen());
const OFF = Math.round(vp.height * 0.085);
const R = 60;
const cx = Math.min(Math.max(intro.x, R + 8), vp.width - R - 8);
const cy = Math.min(Math.max(intro.y + OFF, 120), vp.height - R - 8);
await page.mouse.move(cx + R, cy);
await page.mouse.down();
for (let i = 1; i <= 11; i++) {
  const a = (i / 11) * 0.8 * 2 * Math.PI;
  await page.mouse.move(cx + R * Math.cos(a), cy + R * Math.sin(a));
}
await page.waitForTimeout(900);
await page.screenshot({ path: process.argv[2] });
await page.mouse.up();
await browser.close();
