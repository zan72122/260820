import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto('http://localhost:4173/?debug=1', { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('#start-btn')?.classList.contains('ready'), null, { timeout: 90000 });
await page.locator('#start-btn').dispatchEvent('click');
await page.waitForTimeout(6500);
const h = await page.evaluate(() => window.__probe.handleScreen());
await page.mouse.move(h.x, h.y);
await page.mouse.down();
for (let i = 1; i <= 16; i++) { await page.mouse.move(h.x, h.y - i * 10); await page.waitForTimeout(30); }
await page.mouse.up();
// wait for the tool dock
for (let i = 0; i < 60; i++) {
  const s = await page.evaluate(() => window.__probe.state());
  if (s.toolsShown) break;
  await page.waitForTimeout(500);
}
const info = await page.evaluate(() => window.__probe.state());
const grid = [];
const N = 26;
for (let i = 0; i <= N; i++) {
  const t = i / N;
  grid.push([
    info.hollowU + (info.pondU - info.hollowU) * t,
    info.hollowV + (info.pondV - 0.04 - info.hollowV) * t,
  ]);
}
const proj = (uv) => page.evaluate(([a, b]) => window.__probe.project(a, b), uv);
for (let pass = 0; pass < 2; pass++) {
  const p0 = await proj(grid[0]);
  await page.mouse.move(p0.x, p0.y);
  await page.mouse.down();
  for (const uv of grid.slice(1)) {
    const p = await proj(uv);
    await page.mouse.move(p.x, p.y);
    if (pass === 0 && uv === grid[grid.length - 1]) console.log('last point', JSON.stringify(p));
    await page.waitForTimeout(25);
  }
  await page.mouse.up();
  await page.waitForTimeout(400);
}
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(5000);
  const s = await page.evaluate(() => window.__probe.state());
  console.log(i * 5 + 's', 'pondFill', s.pondFill, 'pondDepth', s.pondDepth, 'Q', s.gateFlow, 'wet', s.wetCells, 'arrived', s.arrived, 'boat', s.boatAfloat);
  if (s.arrived) break;
}
await page.screenshot({ path: (process.env.OUT || '.') + '/flow-final.png' });
await browser.close();
