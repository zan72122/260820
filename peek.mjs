import { chromium } from '@playwright/test';
const OUT = '/tmp/claude-0/-home-user-260820/e983abe5-15b6-5c9a-9b2a-d2a8570f6e25/scratchpad/shots';
const W = Number(process.env.W || 390), H = Number(process.env.H || 844);
const TAG = process.env.TAG || 'k';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5173/?e2e=1&fast=1&turbo=1&jump=1', { waitUntil: 'load' });
await page.waitForFunction(() => window.__sd && window.__sd.ready(), null, { timeout: 90000 });
await page.click('.boot__go', { force: true });
await page.waitForTimeout(3500);
await page.screenshot({ path: `${OUT}/${TAG}-a-inspect.png` });
console.log('inspect', JSON.stringify(await page.evaluate(() => window.__sd.state())));
// sweep knob to reveal
const kb = await (await page.$('.knob')).boundingBox();
outer: for (let ring = 1; ring <= 5; ring++) for (let a = 0; a < 12; a++) {
  const r = (kb.width * 0.34 * ring) / 5, ang = (a / 12) * Math.PI * 2;
  await page.mouse.move(kb.x + kb.width/2, kb.y + kb.height/2);
  await page.mouse.down();
  await page.mouse.move(kb.x + kb.width/2 + Math.cos(ang)*r, kb.y + kb.height/2 + Math.sin(ang)*r, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(260);
  const s = await page.evaluate(() => window.__sd.state());
  if (s.reveal > 0.5) { await page.screenshot({ path: `${OUT}/${TAG}-b-reveal.png` }); }
  else if (s.reveal < 0.05) { await page.screenshot({ path: `${OUT}/${TAG}-b0-dark.png` }); }
  if (s.phase !== 'lightSearch') break outer;
}
await page.waitForTimeout(3200);
await page.screenshot({ path: `${OUT}/${TAG}-c-rake.png` });
console.log('rake', JSON.stringify(await page.evaluate(() => window.__sd.state())));

async function swipe(x0, y0, x1, y1, steps = 14, hold = 12) {
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (let i = 1; i <= steps; i++) { await page.mouse.move(x0 + ((x1-x0)*i)/steps, y0 + ((y1-y0)*i)/steps); await page.waitForTimeout(hold); }
  await page.mouse.up();
}
const s0 = await page.evaluate(() => window.__sd.state());
const c = s0.workScreen, lift = s0.liftPx;
// partial peel: drag and hold at the bottom so the strip is caught mid-lift
await page.mouse.move(c.x - 20, c.y + lift - 20); await page.mouse.down();
for (let i = 1; i <= 26; i++) { await page.mouse.move(c.x - 20 + i*3, c.y + lift - 20 + i * (H*0.30/26)); await page.waitForTimeout(22); }
await page.screenshot({ path: `${OUT}/${TAG}-d-peel-mid.png` });
console.log('peel-mid', JSON.stringify(await page.evaluate(() => window.__sd.state())));
await page.mouse.up();
for (let i = 0; i < 20; i++) { await swipe(c.x - 20, c.y + lift - 20, c.x + 40, c.y + lift + H*0.26, 10, 10); const s = await page.evaluate(() => window.__sd.state()); if (s.stepId !== 'peel') break; }
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/${TAG}-e-after-peel.png` });
console.log('after-peel', JSON.stringify(await page.evaluate(() => window.__sd.state())));
await browser.close();
