// Focused probe: does watering actually wet the soil, and does it show?
import { chromium, devices } from 'playwright';
import { seekLocator } from './lib.mjs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
});
const ctx = await browser.newContext({
  ...devices['iPhone 13'],
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__dig);
await page.mouse.move(195, 420);
await page.mouse.down();
await page.mouse.up();
await page.waitForTimeout(1500);

const st = () => page.evaluate(() => ({ p: window.__dig.phase(), w: window.__dig.wet(), f: window.__dig.finger() }));
await page.waitForFunction(() => window.__dig.phase() === 'detect', null, { timeout: 60000 });

const state = () =>
  page.evaluate(() => ({ phase: window.__dig.phase(), signal: window.__dig.signal(), finger: window.__dig.finger() }));
await seekLocator(page, state, 390, 844);
await page.waitForFunction(() => window.__dig.phase() === 'water', null, { timeout: 60000 });


let s = await st();
await page.mouse.move(s.f.x, s.f.y);
await page.mouse.down();
for (let i = 0; i < 55; i++) {
  s = await st();
  if (s.p !== 'water') break;
  await page.mouse.move(s.f.x + (i % 2 ? 1 : -1), s.f.y);
  await page.waitForTimeout(80);
  if (i === 30) {
    console.log('peak wetness while spraying:', (await st()).w.toFixed(3));
    await page.screenshot({ path: 'shots-probe/wet.png', timeout: 120000 });
  }
}
await page.mouse.up();
console.log('peak wetness after release:', (await st()).w.toFixed(3));
await browser.close();
