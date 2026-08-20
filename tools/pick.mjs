import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:4173/?debug=1', { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('#boot > i')?.style.width === '100%', null, { timeout: 90000 });
await page.locator('#start-btn').dispatchEvent('click');
await page.waitForTimeout(2600);
for (const [x, y] of [[195, 665], [195, 500], [100, 665]]) {
  console.log(x, y, JSON.stringify(await page.evaluate(([a,b]) => window.__probe.pickAny(a,b), [x, y])));
}
await browser.close();
