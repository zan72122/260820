import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 200)));
await page.goto('http://127.0.0.1:5173/?e2e=1&noshadow=1');
await page.waitForFunction(() => window.__game && window.__game.metrics.frames > 5);
await page.evaluate(() => window.__game.fastForward(8));
const info = await page.evaluate(() => {
  const g = window.__game;
  return { streaks: g.streakScreens(), phase: g.phase };
});
console.log(JSON.stringify(info, null, 1));
await page.screenshot({ path: process.argv[2] || 'murk-dbg.png' });
await browser.close();
