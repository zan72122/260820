import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4173/?fast=1', { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__game);
await sleep(2500);
const tips = await page.evaluate(() => window.__game.projectEarTips());
console.log('tips', tips);
await page.mouse.click(tips.x, tips.y);
await sleep(3500);
console.log('stage', (await page.evaluate(() => window.__game.snapshot())).stage);
const c = await page.evaluate(() => window.__game.projectChest(0, 0.3));
console.log('centre px', c);
await page.mouse.move(c.x, c.y);
await page.mouse.down();
for (let i = 0; i < 8; i++) {
  await sleep(1200);
  const s = await page.evaluate(() => window.__game.snapshot());
  console.log(i, s.stage, 'mode', s.mode, 'contact', s.contact, 'lat', s.lat, 'sup', s.sup, JSON.stringify(s.drag));
}
const m = await page.evaluate(() => window.__game.projectChest(0.62, -0.36));
console.log('mitral px', m);
await page.mouse.move(m.x, m.y, { steps: 12 });
for (let i = 0; i < 6; i++) {
  await sleep(1200);
  const s = await page.evaluate(() => window.__game.snapshot());
  console.log('drag', i, s.stage, 'lat', s.lat, 'sup', s.sup, 'area', s.area, 'contact', s.contact, JSON.stringify(s.drag));
}
await page.mouse.up();
await browser.close();
