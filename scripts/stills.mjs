/**
 * Fast visual pass: jumps through the session with the automation hooks and
 * captures one still per beat. Used to review framing, materials and the
 * reveal without waiting on a software renderer to survive a full playthrough.
 * Usage: node scripts/stills.mjs [name] [w] [h] [quality]
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const name = process.argv[2] ?? 'still';
const width = Number(process.argv[3] ?? 390);
const height = Number(process.argv[4] ?? 844);
const quality = process.argv[5] ?? 'medium';
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
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto(`http://127.0.0.1:4173/?q=${quality}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ba?.ready === true, null, { timeout: 60000 });
const shot = (l) => page.screenshot({ path: `${outDir}/${name}-${l}.png` });
const state = () => page.evaluate(() => window.__ba.state());
const idle = () =>
  page.waitForFunction(() => window.__ba.state().transitioning === false, null, { timeout: 40000 });

await page.waitForTimeout(900);
await shot('1-cold');

// mould off
await page.mouse.move(width / 2, height * 0.62);
await page.mouse.down();
for (let i = 0; i <= 10; i++) await page.mouse.move(width / 2, height * 0.62 - i * 24);
await page.mouse.up();
await page.waitForFunction(() => window.__ba.state().phase === 'pipe', null, { timeout: 40000 });
await idle();
await shot('2-dome');

// a couple of real strokes, then let the assist finish the coat
for (let row = 0; row < 3; row++) {
  const y = height * (0.34 + row * 0.05);
  await page.mouse.move(width * 0.22, y);
  await page.mouse.down();
  for (let i = 0; i <= 18; i++) await page.mouse.move(width * 0.22 + (width * 0.56 * i) / 18, y);
  await page.mouse.up();
  await page.waitForTimeout(120);
}
await shot('3-piping');
await page.evaluate(() => {
  window.__ba.autoPipe();
  // fast-forward the gap fill and the camera move without rendering every frame
  window.__ba.advance(9000);
});
await page.waitForFunction(() => window.__ba.state().phase === 'torchIdle', null, { timeout: 60000 });
await idle();
await shot('4-meringue');

// light it and hold the flame on the surface
const ring = await page.evaluate(() => {
  const r = document.querySelector('.ring');
  const b = r.getBoundingClientRect();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
});
await page.mouse.click(ring.x, ring.y);
await page.waitForTimeout(400);
await page.mouse.move(width * 0.3, height * 0.5);
await page.mouse.down();
for (let i = 0; i <= 16; i++) {
  await page.mouse.move(width * 0.3 + (width * 0.4 * i) / 16, height * 0.5);
  await page.waitForTimeout(30);
}
await shot('5-torch');
await page.mouse.up();

await page.evaluate(() => {
  window.__ba.autoBake(1);
  window.__ba.advance(300);
});
await page.waitForTimeout(600);
await shot('6-baked');

await page.evaluate(() => window.__ba.forcePhase('cut'));
await page.waitForTimeout(500);
await shot('7-knife');
await page.evaluate(() => window.__ba.autoCut());
await page.waitForTimeout(3000);
await shot('8-cutface');
await page.waitForFunction(() => window.__ba.state().phase === 'finish', null, { timeout: 60000 });
await page.waitForTimeout(700);
await shot('9-hero');

console.log('final   ', JSON.stringify(await state()));
console.log('errors  ', JSON.stringify(await page.evaluate(() => window.__ba.errors)));
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
