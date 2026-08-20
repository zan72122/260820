/** Quick visual pass: a handful of small screenshots for eyeballing. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SMOKE_URL ?? 'http://127.0.0.1:4173';
const OUT = 'artifacts/shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.SMOKE_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});

for (const vp of [
  { name: 'portrait', width: 390, height: 844 },
  { name: 'landscape', width: 844, height: 390 },
]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
  await page.goto(`${BASE}/?e2e=1&fast=1`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!window.__lab, null, { timeout: 60000 });
  const shot = async (n) => {
    await page.waitForTimeout(260);
    await page.screenshot({ path: `${OUT}/${vp.name}-${n}.png`, scale: 'css' });
  };
  await shot('1-gate');
  await page.evaluate(() => window.__lab.pullGate(1));
  await page.evaluate(() => window.__lab.step(0.9));
  await shot('2-sliding');
  await page.evaluate(() => window.__lab.step(0.8));
  await shot('3-late');
  await page.evaluate(() => window.__lab.step(9));
  await shot('4-overview');
  await page.evaluate(() => window.__lab.place('feltbag', 'top'));
  await page.evaluate(() => window.__lab.pullGate(1));
  await page.evaluate(() => window.__lab.step(4));
  await shot('5-felt-stops');
  await page.evaluate(() => window.__lab.step(8));
  await shot('6-free');
  console.log(vp.name, JSON.stringify(await page.evaluate(() => window.__lab.state())));
  await ctx.close();
}
await browser.close();
