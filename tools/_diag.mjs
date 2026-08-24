import { chromium } from 'playwright';
const t0 = Date.now();
const el = () => ((Date.now() - t0) / 1000).toFixed(1);
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
console.log(el(), 'launched');
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(process.env.DPR ?? 2), hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on('console', (m) => console.log(el(), 'console.' + m.type(), m.text().slice(0, 300)));
page.on('pageerror', (e) => console.log(el(), 'PAGEERROR', e.message));
await page.goto(process.env.URL ?? 'http://127.0.0.1:4173/', { waitUntil: 'load' });
console.log(el(), 'loaded');
await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 });
console.log(el(), 'game present');
await new Promise(r => setTimeout(r, 4000));
console.log(el(), 'snapshot', JSON.stringify(await page.evaluate(() => window.__game.snapshot())));
const fps = await page.evaluate(() => new Promise(res => { let n = 0; const t = performance.now(); const l = () => { n++; if (performance.now() - t < 2000) requestAnimationFrame(l); else res(n / ((performance.now() - t) / 1000)); }; requestAnimationFrame(l); }));
console.log(el(), 'fps(swiftshader)', fps.toFixed(1));
await page.screenshot({ path: '/tmp/claude-0/-home-user-260820/87c59471-7df4-5fe0-abc2-348eb2e206d5/scratchpad/diag.png' });
console.log(el(), 'shot done');
await browser.close();
