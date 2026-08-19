/**
 * Ad-hoc browser driver: loads the built game at a given viewport, drives the
 * whole session with real pointer input and writes screenshots + a log.
 * Usage: node scripts/inspect.mjs [name] [width] [height]
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const name = process.argv[2] ?? 'iphone-portrait';
const width = Number(process.argv[3] ?? 390);
const height = Number(process.argv[4] ?? 844);
const outDir = process.env.SHOT_DIR ?? '.shots';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 1,
  hasTouch: true,
  isMobile: true,
});

const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

const query = process.env.GAME_QUERY ?? '?fast=1';
await page.goto(`http://127.0.0.1:4173/${query}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ba?.ready === true, null, { timeout: 30000 });

const shot = async (label) => {
  await page.screenshot({ path: `${outDir}/${name}-${label}.png` });
};

const state = () => page.evaluate(() => window.__ba.state());
const waitIdle = async () => {
  await page.waitForFunction(() => window.__ba.state().transitioning === false, null, {
    timeout: 20000,
  });
  await page.waitForTimeout(250);
};

await page.waitForTimeout(600);
console.log('start   ', JSON.stringify(await state()));
await shot('01-cold');

// --- lift the mould: swipe up
const cx = width / 2;
await page.mouse.move(cx, height * 0.62);
await page.mouse.down();
for (let i = 0; i <= 10; i++) await page.mouse.move(cx, height * 0.62 - i * 22);
await page.mouse.up();
await page.waitForTimeout(2200);
await waitIdle();
console.log('mould   ', JSON.stringify(await state()));
await shot('02-dome');

// --- pipe: a few thick horizontal passes down the dome
for (let row = 0; row < 6; row++) {
  const y = height * (0.34 + row * 0.045);
  await page.mouse.move(cx - width * 0.30, y);
  await page.mouse.down();
  for (let i = 0; i <= 24; i++) {
    await page.mouse.move(cx - width * 0.30 + (width * 0.60 * i) / 24, y);
  }
  await page.mouse.up();
  await page.waitForTimeout(120);
}
await page.waitForTimeout(2500);
await waitIdle();
console.log('piped   ', JSON.stringify(await state()));
await shot('03-meringue');

// --- torch: tap the igniter ring, then trace
const ring = await page.evaluate(() => {
  const r = document.querySelector('.ring');
  if (!r || !r.classList.contains('is-on')) return null;
  const b = r.getBoundingClientRect();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
});
console.log('ring    ', JSON.stringify(ring));
if (ring) await page.mouse.click(ring.x, ring.y);
await page.waitForTimeout(400);
console.log('lit     ', JSON.stringify(await state()));
await shot('04-lit');

for (let row = 0; row < 8; row++) {
  const y = height * (0.40 + row * 0.035);
  await page.mouse.move(cx - width * 0.28, y);
  await page.mouse.down();
  for (let i = 0; i <= 22; i++) {
    await page.mouse.move(cx - width * 0.28 + (width * 0.56 * i) / 22, y);
    await page.waitForTimeout(12);
  }
  await page.mouse.up();
  await page.waitForTimeout(60);
  const s = await state();
  if (s.phase !== 'torch') break;
}
await page.waitForTimeout(500);
console.log('baked   ', JSON.stringify(await state()));
await shot('05-baked');

await page.waitForTimeout(2200);
await waitIdle();
console.log('precut  ', JSON.stringify(await state()));

// --- cut: swipe down
await page.mouse.move(cx, height * 0.32);
await page.mouse.down();
for (let i = 0; i <= 20; i++) await page.mouse.move(cx, height * 0.32 + i * (height * 0.02));
await page.mouse.up();
await page.waitForTimeout(1200);
await shot('06-cutting');
await page.waitForTimeout(5200);
console.log('final   ', JSON.stringify(await state()));
await shot('07-finish');

console.log('--- console ---');
console.log(logs.slice(0, 60).join('\n'));
const errs = await page.evaluate(() => window.__ba.errors);
console.log('errors  ', JSON.stringify(errs));

await browser.close();
