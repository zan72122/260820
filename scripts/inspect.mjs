/** One-off inspection pass: the debug overlay and the bed under each state. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.SMOKE_URL ?? 'http://127.0.0.1:4173';
const OUT = 'artifacts/inspect';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`${BASE}/?e2e=1&debug=1`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__lab, null, { timeout: 90000 });
await page.evaluate(() => window.__lab.pullGate(1));
await page.evaluate(() => window.__lab.step(1.2));
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/debug-overlay.png`, scale: 'css' });

// Reach the tools, then photograph each bed state from the same camera.
await page.evaluate(() => window.__lab.step(12));
for (const [id, zone] of [['feltbag','top'],['rubberball','top'],['woodcyl','top'],['minicar','top'],['steel','middle']]) {
  await page.evaluate(([o, z]) => window.__lab.place(o, z), [id, zone]);
  await page.evaluate(() => window.__lab.pullGate(1));
  await page.evaluate(() => window.__lab.step(11));
}
await page.evaluate(() => window.__lab.step(4));
console.log('layer', (await page.evaluate(() => window.__lab.state())).layer);

const bedCam = [2.55, 1.35, 1.35, 1.9, 0.72, 0];
const shoot = async (n) => {
  await page.evaluate((c) => window.__lab.camera(c[0], c[1], c[2], c[3], c[4], c[5]), bedCam);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${n}.png` });
  await page.evaluate(() => window.__lab.unfreeze());
};
await shoot('bed-morning');
await page.evaluate(() => { for (let i=0;i<60;i++){ window.__lab.tool('cloth',1.7); window.__lab.tool('cloth',2.3); window.__lab.tool('cloth',2.9); window.__lab.step(0.05);} });
await shoot('bed-dry');
await page.evaluate(() => { for (let i=0;i<60;i++){ window.__lab.tool('dropper',1.9); window.__lab.tool('dropper',2.4); window.__lab.step(0.05);} });
await shoot('bed-wet');
await page.evaluate(() => { for (let i=0;i<60;i++){ window.__lab.tool('sand',2.6); window.__lab.tool('sand',3.0); window.__lab.step(0.05);} });
await shoot('bed-sand');
await page.evaluate(() => window.__lab.tool('strip', 2.2));
await shoot('bed-strip');

// Every object on the bed, same camera.
for (const id of ['steel','rubberball','woodcyl','feltbag','minicar','icedisc','leaf','sponge']) {
  await page.evaluate((o) => window.__lab.place(o, 'top'), id);
  await page.evaluate((c) => window.__lab.camera(c[0], c[1], c[2], c[3], c[4], c[5]), [1.15, 2.28, 0.95, 0.36, 1.9, 0]);
  await page.waitForTimeout(420);
  await page.screenshot({ path: `${OUT}/obj-${id}.png` });
  await page.evaluate(() => window.__lab.unfreeze());
}
await browser.close();
