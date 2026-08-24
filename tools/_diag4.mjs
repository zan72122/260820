import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4173/?fast=1', { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__game);
await sleep(3000);
console.log(JSON.stringify(await page.evaluate(() => {
  const g = window.__game;
  const p = g.projectChest(0, 0.3);
  return { p, atFinger: g.probeTorso(p.x, p.y), atSurface: g.probeTorso(p.x, p.y - 44), grid: [-0.6,-0.3,0,0.3,0.6].map(dy => g.probeTorso(p.x, p.y + dy*100).hits) };
}), null, 1));
await browser.close();
