/** Debug-only close-ups of individual mechanisms and materials. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SMOKE_URL ?? 'http://127.0.0.1:4173';
const OUT = 'artifacts/closeups';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const ctx = await browser.newContext({ viewport: { width: 640, height: 640 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`${BASE}/?e2e=1`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__lab, null, { timeout: 60000 });

const views = [
  ['gate', [1.4, 2.35, 1.25], [0.45, 1.85, 0]],
  ['console', [4.15, 1.35, 3.35], [3.3, 0.72, 2.45]],
  ['wagon', [6.4, 1.15, 4.35], [6.35, 0.55, 3.05]],
  ['bed-wet', [2.9, 1.55, 1.5], [2.6, 0.75, 0]],
  ['landing', [7.4, 0.75, 2.1], [6.4, 0.1, 0]],
  ['wide', [11.5, 5.2, 6.4], [4.2, 0.7, 0]],
];

for (const [name, pos, look] of views) {
  await page.evaluate(([p, l]) => window.__lab.camera(p[0], p[1], p[2], l[0], l[1], l[2]), [pos, look]);
  await page.waitForTimeout(420);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

// Put the whole collection out on the bed so every material is in one frame.
await page.evaluate(() => window.__lab.unfreeze());
await page.evaluate(() => window.__lab.pullGate(1));
await page.evaluate(() => window.__lab.step(12));
await page.evaluate(() => window.__lab.place('feltbag', 'top'));
await page.evaluate(() => window.__lab.pullGate(1));
await page.evaluate(() => window.__lab.step(12));
for (const id of ['rubberball', 'woodcyl', 'minicar', 'icedisc', 'leaf', 'sponge']) {
  await page.evaluate((o) => window.__lab.place(o, 'top'), id);
  await page.evaluate(() => window.__lab.camera(1.35, 2.3, 1.15, 0.5, 1.85, 0));
  await page.waitForTimeout(360);
  await page.screenshot({ path: `${OUT}/object-${id}.png` });
  await page.evaluate(() => window.__lab.unfreeze());
}
console.log(JSON.stringify(await page.evaluate(() => window.__lab.state())));
await browser.close();
