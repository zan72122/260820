import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5173/?e2e=1&fast=1&turbo=1', { waitUntil: 'load' });
await page.waitForFunction(() => window.__sd && window.__sd.ready(), null, { timeout: 90000 });
await page.click('.boot__go', { force: true });
for (const label of ['establish', 'inside']) {
  await page.waitForTimeout(label === 'establish' ? 1500 : 12000);
  const fps = await page.evaluate(() => new Promise((res) => {
    let n = 0; const t0 = performance.now();
    const tick = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res((n * 1000) / (performance.now() - t0)); };
    requestAnimationFrame(tick);
  }));
  const info = await page.evaluate(() => {
    const r = window.__sd.state();
    return r;
  });
  console.log(label, 'fps=', fps.toFixed(1), JSON.stringify(info));
}
console.log(await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return { w: c.width, h: c.height };
}));
await browser.close();
