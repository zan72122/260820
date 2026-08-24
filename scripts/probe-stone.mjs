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
// cheat: wind everything via winding the intro then force clear by fast circles is slow;
// instead directly set load through winding one streak
const intro = await page.evaluate(() => window.__game.introStreakScreen());
const OFF = Math.round(vp.height * 0.085);
await page.mouse.move(intro.x + 70, intro.y + OFF);
await page.mouse.down();
for (let i = 1; i <= 14; i++) {
  const a = (i / 14) * 0.8 * 2 * Math.PI;
  await page.mouse.move(intro.x + 70 * Math.cos(a), intro.y + OFF + 70 * Math.sin(a));
}
await page.waitForTimeout(2500);
await page.mouse.up();
await page.waitForTimeout(1500);
console.log('phase', await page.evaluate(() => window.__game.phase), 'load', await page.evaluate(() => window.__game.hornLoad));
const stone = await page.evaluate(() => window.__game.stoneScreen());
console.log('stone screen', stone);
await page.mouse.move(stone.x, stone.y + OFF);
await page.mouse.down();
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(300);
  console.log(JSON.stringify(await page.evaluate(() => window.__game.debug)));
}
await page.mouse.up();
console.log('load after', await page.evaluate(() => window.__game.hornLoad));
await page.screenshot({ path: process.argv[2] || '/tmp/stone.png' });
await browser.close();
