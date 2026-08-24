import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.env.OUT ?? '/tmp/reveal';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4173/?fast=1&holdreveal=26' + (process.env.EXTRA ?? '') + '', { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__game);
await sleep(2000);
const tips = await page.evaluate(() => window.__game.projectEarTips());
await page.mouse.click(tips.x, tips.y);
await sleep(5000);
const c = await page.evaluate(() => window.__game.projectChest(0, 0.3));
await page.mouse.move(c.x, c.y); await page.mouse.down();
await sleep(9000);
const m = await page.evaluate(() => window.__game.projectChest(0.62, -0.36));
await page.mouse.move(m.x, m.y, { steps: 3 });
for (let i = 0; i < 60; i++) {
  const s = await page.evaluate(() => window.__game.snapshot());
  if (s.reveal > 0.99) { console.log('cam', JSON.stringify(s.cam)); break; }
  await sleep(400);
}
await sleep(2500);
for (let i = 0; i < 3; i++) {
  console.log('cam', JSON.stringify((await page.evaluate(() => window.__game.snapshot())).cam));
  await page.screenshot({ path: `${OUT}/reveal-${i}.png`, timeout: 120000 });
  await sleep(1200);
}
await browser.close();
