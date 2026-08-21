import { chromium } from '@playwright/test';

const OUT = process.env.OUT || '/tmp/claude-0/-home-user-260820/e983abe5-15b6-5c9a-9b2a-d2a8570f6e25/scratchpad/shots';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto('http://127.0.0.1:5173/?e2e=1&fast=1&turbo=1', { waitUntil: 'load' });
await page.waitForFunction(() => window.__sd && window.__sd.ready(), null, { timeout: 90000 }).catch((e)=>logs.push('ready timeout '+e.message));
await page.screenshot({ path: `${OUT}/00-title.png` });
await page.click('.boot__go', { force: true });
for (const [name, ms] of [['01-establish', 1200], ['02-chase', 2500], ['03-snag', 4000], ['04-deck', 3000]]) {
  await page.waitForTimeout(ms);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  logs.push(name + ' => ' + JSON.stringify(await page.evaluate(() => window.__sd.state())));
}
console.log(logs.join('\n'));
await browser.close();
