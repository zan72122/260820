import { chromium } from '@playwright/test';
const vp = { width: 390, height: 844 };
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: vp });
await page.goto('http://127.0.0.1:5173/?e2e=1');
await page.waitForFunction(() => window.__game && window.__game.metrics.frames > 5);
await page.evaluate(() => window.__game.fastForward(8));
const intro = await page.evaluate(() => window.__game.introStreakScreen());
console.log('intro', intro);
const cx = intro.x;
const cy = intro.y + Math.round(vp.height * 0.085);
const r = 70;
await page.mouse.move(cx + r, cy);
await page.mouse.down();
const samples = [];
const steps = 40;
for (let i = 1; i <= steps; i++) {
  const a = (i / steps) * 1.2 * 2 * Math.PI;
  await page.mouse.move(cx + r * Math.cos(a), cy + r * Math.sin(a));
  await page.waitForTimeout(25);
  if (i % 5 === 0) samples.push(await page.evaluate(() => window.__game.debug));
}
await page.mouse.up();
for (const s of samples) console.log(JSON.stringify(s));
console.log('phase', await page.evaluate(() => window.__game.phase));
await browser.close();
