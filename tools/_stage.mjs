import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.env.OUT ?? '/tmp/stage';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--mute-audio'] });
const vps = (process.env.VPS ?? 'iphone-portrait').split(',');
const ALL = {
  'iphone-portrait': { width: 390, height: 844 },
  'iphone-landscape': { width: 844, height: 390 },
  'ipad-portrait': { width: 820, height: 1180 },
  'ipad-landscape': { width: 1180, height: 820 },
};
for (const name of vps) {
  const vp = ALL[name];
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto('http://127.0.0.1:4173/?fast=1', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__game);
  await sleep(2000);
  await page.screenshot({ path: `${OUT}/${name}-a-establishing.png`, timeout: 120000 });
  const tips = await page.evaluate(() => window.__game.projectEarTips());
  await page.mouse.click(tips.x, tips.y);
  await sleep(5000);
  await page.screenshot({ path: `${OUT}/${name}-b-centre.png`, timeout: 120000 });
  const c = await page.evaluate(() => window.__game.projectChest(0, 0.3));
  await page.mouse.move(c.x, c.y); await page.mouse.down();
  await sleep(9000);
  await page.screenshot({ path: `${OUT}/${name}-b2-listening.png`, timeout: 120000 });
  const m = await page.evaluate(() => window.__game.projectChest(0.62, -0.36));
  await page.mouse.move(m.x, m.y, { steps: 3 });
  await sleep(3500);
  await page.screenshot({ path: `${OUT}/${name}-c-first-window.png`, timeout: 120000 });
  // Wait for the reveal to actually be inside, then catch it.
  for (let i = 0; i < 40; i++) {
    const s = await page.evaluate(() => window.__game.snapshot());
    if (s.reveal > 0.85) break;
    await sleep(400);
  }
  console.log(name, JSON.stringify(await page.evaluate(() => window.__game.snapshot())));
  for (let i = 0; i < 4; i++) {
    await page.screenshot({ path: `${OUT}/${name}-d${i}-reveal.png`, timeout: 120000 });
    await sleep(500);
  }
  await sleep(2500);
  await page.mouse.up();
  await sleep(2500);
  await page.screenshot({ path: `${OUT}/${name}-e-compare.png`, timeout: 120000 });
  console.log(name, JSON.stringify(await page.evaluate(() => window.__game.snapshot())));
  await ctx.close();
}
await browser.close();
