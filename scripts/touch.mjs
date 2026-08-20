/**
 * Real-gesture check: everything here goes through the same pointer path a
 * finger uses, not through the test API. Also covers audio start-on-gesture
 * and keeping the experiment across a device rotation.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.SMOKE_URL ?? 'http://127.0.0.1:4173';
const OUT = 'artifacts';
mkdirSync(OUT, { recursive: true });
const results = [];
let failures = 0;
const check = (label, ok, detail = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
};
const info = (l) => results.push(`INFO  ${l}`);

const browser = await chromium.launch({
  executablePath: process.env.SMOKE_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-dev-shm-usage',
  ],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text());
});

await page.goto(`${BASE}/?e2e=1&fast=1`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__lab, null, { timeout: 90000 });

const state = () => page.evaluate(() => window.__lab.state());
const at = (what) => page.evaluate((w) => window.__lab.screenOf(w), what);
const settle = (ms = 600) => page.waitForTimeout(ms);

async function drag(from, to, steps = 18) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * i) / steps,
      from.y + ((to.y - from.y) * i) / steps,
    );
  }
  await page.mouse.up();
}

// --- the very first gesture: pull the lever ------------------------------
const knob = await at('gate');
check('gate lever has a reachable on-screen position', !!knob, JSON.stringify(knob));
info(`lever at ${knob.x.toFixed(0)},${knob.y.toFixed(0)} in a 390x844 viewport`);
check(
  'lever sits in the lower half of a portrait screen',
  knob.y > 844 * 0.5,
  `y=${knob.y.toFixed(0)} of 844`,
);

// A short pull should not be enough to release.
await drag(knob, { x: knob.x, y: knob.y + 25 });
await settle(500);
const nudged = await state();
check('a 25 px pull does not open the gate', nudged.phase === 'held', nudged.phase);

const knob2 = await at('gate');
await drag(knob2, { x: knob2.x, y: knob2.y + 190 });
await settle(900);
const released = await state();
check(
  'a full drag on the lever releases the object',
  released.phase !== 'held',
  `${released.phase} v=${released.speed.toFixed(2)}`,
);
check('audio starts on the first gesture', await page.evaluate(() => window.__lab.audioReady()));

await page.evaluate(() => window.__lab.step(10));
await settle(400);
const landed = await state();
check('the run completes after a real gesture', landed.phase === 'rest', `x=${landed.x?.toFixed(2)}`);

// --- drag the second object out of the trolley by hand -------------------
await page.evaluate(() => window.__lab.step(4));
await settle(600);
const slot = await at('object:feltbag');
check(
  'the offered object is inside the portrait viewport',
  !!slot && slot.x > 8 && slot.x < 382 && slot.y > 8 && slot.y < 836,
  JSON.stringify(slot),
);
const gatePoint = await at('slide:0.42');
await drag(slot, gatePoint, 24);
await settle(700);
const carried = await state();
check(
  'dragging it onto the bed arms it at the top gate',
  carried.object === 'feltbag' && carried.zone === 'top' && carried.phase === 'held',
  JSON.stringify({ object: carried.object, zone: carried.zone, phase: carried.phase }),
);
await page.screenshot({ path: `${OUT}/touch-01-placed.png`, scale: 'css' });

// --- rotate the device mid-experiment ------------------------------------
await page.setViewportSize({ width: 844, height: 390 });
await settle(900);
const rotated = await state();
check(
  'rotating the device keeps the experiment set up',
  rotated.object === 'feltbag' && rotated.zone === 'top' && rotated.phase === 'held',
  JSON.stringify({ orientation: rotated.orientation, object: rotated.object, phase: rotated.phase }),
);
check('the rig switches to the landscape framing', rotated.orientation === 'landscape');
await page.screenshot({ path: `${OUT}/touch-02-rotated.png`, scale: 'css' });

const knob3 = await at('gate');
check(
  'the lever is still reachable after rotating',
  knob3 && knob3.x > 0 && knob3.x < 844 && knob3.y > 0 && knob3.y < 390,
  JSON.stringify(knob3),
);
await drag(knob3, { x: knob3.x, y: knob3.y + 130 });
await settle(800);
const rerun = await state();
check('the lever still works in landscape', rerun.phase !== 'held', rerun.phase);
await page.evaluate(() => window.__lab.step(10));
await settle(400);

// --- drag the landing pad around -----------------------------------------
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => window.__lab.step(5));
await settle(800);
const matAt = await at('mat');
const before = await page.evaluate(() => window.__lab.state());
check('the landing pad is on screen once free play opens', !!matAt, JSON.stringify(matAt));
await drag(matAt, { x: matAt.x - 60, y: matAt.y - 40 }, 16);
await settle(500);
const moved = await at('mat');
check(
  'the pad can be dragged across the ground',
  Math.abs(moved.x - matAt.x) > 8 || Math.abs(moved.y - matAt.y) > 8,
  `${JSON.stringify(matAt)} -> ${JSON.stringify(moved)}`,
);
await page.screenshot({ path: `${OUT}/touch-03-mat.png`, scale: 'css' });
info(`stage after the whole gesture run: ${before.stage} layer ${before.layer}`);

// --- surface tools, dragged across the bed by hand -----------------------
// Getting to the third layer is done through the test API; the tool use
// itself is a real drag.
for (const [id, zone] of [
  ['rubberball', 'top'],
  ['woodcyl', 'top'],
  ['minicar', 'top'],
  ['steel', 'middle'],
]) {
  await page.evaluate(([o, z]) => window.__lab.place(o, z), [id, zone]);
  await page.evaluate(() => window.__lab.pullGate(1));
  await page.evaluate(() => window.__lab.step(10));
}
await page.evaluate(() => window.__lab.step(4));
await settle(700);
const opened = await state();
check('surface tools are reachable after the height comparison', opened.layer >= 3, `layer=${opened.layer}`);

const shaker = await at('tool:sand');
check(
  'the sand shaker is inside the viewport',
  !!shaker && shaker.x > 0 && shaker.x < 390 && shaker.y > 0 && shaker.y < 844,
  JSON.stringify(shaker),
);
const beforeSand = await page.evaluate(() => window.__lab.surface());
const bedA = await at('slide:1.1');
const bedB = await at('slide:2.1');
await drag(shaker, bedA, 10);
await settle(200);
const shaker2 = await at('tool:sand');
await drag(shaker2, bedB, 22);
await settle(400);
const afterSand = await page.evaluate(() => window.__lab.surface());
check(
  'dragging the shaker over the bed leaves grit on it',
  afterSand.sand > beforeSand.sand + 1.5,
  `${beforeSand.sand.toFixed(2)} -> ${afterSand.sand.toFixed(2)}`,
);
await page.screenshot({ path: `${OUT}/touch-04-tools.png`, scale: 'css' });

const cloth = await at('tool:cloth');
const bedC = await at('slide:2.6');
await drag(cloth, bedC, 20);
await settle(400);
const afterWipe = await page.evaluate(() => window.__lab.surface());
check(
  'dragging the cloth over the bed dries it',
  afterWipe.wet < beforeSand.wet - 1.5,
  `wet ${beforeSand.wet.toFixed(2)} -> ${afterWipe.wet.toFixed(2)}, sand ${afterSand.sand.toFixed(2)} -> ${afterWipe.sand.toFixed(2)}`,
);

check('no console errors during real gestures', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const report = results.join('\n');
writeFileSync(`${OUT}/touch-report.txt`, report + '\n');
console.log(report);
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
