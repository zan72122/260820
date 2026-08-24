import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4173/?fast=1', { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__game);
await sleep(2500);
const tips = await page.evaluate(() => window.__game.projectEarTips());
await page.mouse.click(tips.x, tips.y);
await sleep(4000);
const r = await page.evaluate(() => {
  const g = window.__game;
  const out = {};
  for (const [lat, sup] of [[0,0.3],[0.62,-0.36],[-0.44,0.68]]) {
    const p = g.projectChest(lat, sup);
    out[`${lat},${sup}`] = { p, rayAtP: g.probeRay(p.x, p.y), rayAtSurface: g.probeRay(p.x, p.y - 44) };
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
