// 各フェーズの絵を撮って、実際の見た目を確認するための道具。
// 使い方: node scripts/shots.mjs [landscape|portrait]
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const MODE = process.argv[2] || 'portrait';
const OUT = `shots/${MODE}`;
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const viewport = MODE === 'landscape' ? { width: 844, height: 390 } : { width: 390, height: 844 };

const exe = (() => {
  const root = '/opt/pw-browsers';
  const d = fs.readdirSync(root).find((x) => /^chromium-\d+$/.test(x));
  return d ? `${root}/${d}/chrome-linux/chrome` : undefined;
})();

const browser = await chromium.launch({
  executablePath: exe,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()); });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

const st = () => page.evaluate(() => window.__TAKENOKO__.state());
const adv = (s) => page.evaluate((x) => window.__TAKENOKO__.advance(x), s);
const scr = (i) => page.evaluate((n) => window.__TAKENOKO__.siteScreen(n), i);
const rad = (i) => page.evaluate((n) => window.__TAKENOKO__.siteRadiusPx(n), i);
const focus = () => page.evaluate(() => window.__TAKENOKO__.focusScreen());
let n = 0;
const shot = async (name) => {
  await page.waitForTimeout(120);
  const f = `${OUT}/${String(++n).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: f });
  console.log('  ->', f, JSON.stringify(await st()));
};

await page.goto(process.env.BASE_URL || 'http://127.0.0.1:4173/');
await page.waitForFunction(() => window.__TAKENOKO__ && window.__TAKENOKO__.ready, null, { timeout: 30000 });
await page.waitForTimeout(600);

await shot('intro-start');
await adv(2.4);
await shot('intro-mid');
await adv(4.4);
await shot('survey');
console.log('info', JSON.stringify(await page.evaluate(() => window.__TAKENOKO__.info())));

// あやしい場所へ
let p = await scr(0);
await page.mouse.move(p.x, p.y);
await page.mouse.down();
await page.mouse.up();
await adv(0.9);
await shot('approach');
await adv(1.4);
await shot('brush-before');

// はっぱを払う
for (let pass = 0; pass < 8; pass++) {
  const c = await scr(0);
  const r = (await rad(0)) * 1.6;
  await page.mouse.move(c.x - r, c.y - r * 0.5 + pass * r * 0.16);
  await page.mouse.down();
  for (let i = 0; i <= 14; i++) await page.mouse.move(c.x - r + (2 * r * i) / 14, c.y - r * 0.5 + pass * r * 0.16 + Math.sin(i) * 4);
  await page.mouse.up();
  if (pass === 2) await shot('brush-mid');
  if ((await st()).state !== 'brush') break;
}
await adv(1.6);
await shot('dig-start');

// ぐるぐる掘る
const circle = async (turns) => {
  const c = await scr(0);
  const r = await rad(0);
  await page.mouse.move(c.x + r, c.y);
  await page.mouse.down();
  for (let i = 1; i <= turns * 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    await page.mouse.move(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 0.6);
  }
  await page.mouse.up();
};
await circle(0.6);
await shot('dig-mid');
let guard = 0;
while ((await st()).state === 'dig' && guard++ < 14) {
  const s = await st();
  if (s.locked) { await adv(0.4); continue; }
  await circle(0.6);
  await adv(0.2);
  if ((await st()).state === 'cross') break;
}
// 断面
guard = 0;
let crossShot = false;
while ((await st()).state === 'cross' && guard++ < 40) {
  await adv(0.2);
  if (!crossShot && guard >= 10) { await shot('cross-section'); crossShot = true; }
}
await shot('after-cross');
guard = 0;
while (!['cut', 'pull'].includes((await st()).state) && guard++ < 20) {
  const s = await st();
  if (s.locked) { await adv(0.35); continue; }
  await circle(1);
  await adv(0.25);
}
await adv(2.2);
await shot('cut-closeup');

// 切る
guard = 0;
while ((await st()).state === 'cut' && guard++ < 8) {
  const s = await st();
  if (s.locked) { await adv(0.3); continue; }
  const c = await focus();
  const w = viewport.width * 0.62;
  await page.mouse.move(c.x - w / 2, c.y);
  await page.mouse.down();
  for (let i = 1; i <= 18; i++) await page.mouse.move(c.x - w / 2 + (w * i) / 18, c.y);
  await page.mouse.up();
  if (guard === 1) await shot('cut-mid');
  await adv(0.2);
}
await adv(1.8);
await shot('pull-ready');

// ひっぱる
guard = 0;
while ((await st()).state === 'pull' && guard++ < 8) {
  const s = await st();
  if (s.locked) { await adv(0.3); continue; }
  const c = await focus();
  const h = Math.min(viewport.height * 0.45, 320);
  await page.mouse.move(c.x, c.y + h / 2);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(c.x, c.y + h / 2 - (h * i) / 20);
  await page.mouse.up();
  await adv(0.1);
}
await shot('pop');
await adv(0.7);
await shot('reveal');
await adv(1.6);
await shot('collect');
await adv(2.6);
await shot('survey-again');
console.log('final', JSON.stringify(await st()));
await browser.close();
