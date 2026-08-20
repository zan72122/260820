// Targeted robustness checks: orientation persistence, input abuse, WebGL health.
import { chromium, devices } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
});
const ctx = await browser.newContext({
  ...devices['iPhone 13'],
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const results = [];
const check = (name, ok, detail = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__dig, null, { timeout: 30000 });

const state = () =>
  page.evaluate(() => ({
    phase: window.__dig.phase(),
    site: window.__dig.site(),
    depth: window.__dig.maxDepth(),
    exposure: window.__dig.exposure(),
    signal: window.__dig.signal(),
    portrait: window.__dig.portrait(),
    finger: window.__dig.finger(),
    route: window.__dig.route(),
  }));

// 1. nothing is given away at launch
const boot = await state();
check('starts before any pipe is exposed', boot.exposure === 0 && boot.depth === 0, `phase=${boot.phase}`);

await page.mouse.move(195, 420);
await page.mouse.down();
await page.mouse.up();
await page.waitForTimeout(1500);

// 2. hammering the screen during a tool handover must not corrupt state
for (let i = 0; i < 60; i++) {
  await page.mouse.move(120 + (i % 7) * 30, 380 + (i % 5) * 26);
  await page.mouse.down();
  await page.mouse.up();
}
await page.waitForTimeout(900);
const afterSpam = await state();
check(
  'survives rapid tapping during handover',
  ['intro', 'detect', 'mark', 'water', 'vacuum'].includes(afterSpam.phase) && errors.length === 0,
  `phase=${afterSpam.phase}`
);

// 3. locator response must be monotone in position, not random
await page.waitForFunction(() => window.__dig.phase() === 'detect', null, { timeout: 40000 });
const samples = [];
const y0 = (await state()).finger.y;
await page.mouse.move(60, y0);
await page.mouse.down();
for (let x = 60; x <= 330; x += 15) {
  await page.mouse.move(x, y0);
  await page.waitForTimeout(90);
  const s = await state();
  samples.push([x, s.signal]);
}
let peak = 0;
let peakX = 0;
samples.forEach(([x, v]) => {
  if (v > peak) {
    peak = v;
    peakX = x;
  }
});
const beforePeak = samples.filter(([x]) => x < peakX);
const afterPeak = samples.filter(([x]) => x > peakX);
const rising = beforePeak.every((s, i) => i === 0 || s[1] >= beforePeak[i - 1][1] - 0.02);
const falling = afterPeak.every((s, i) => i === 0 || s[1] <= afterPeak[i - 1][1] + 0.02);
check('locator signal rises and falls with position', peak > 0.8 && rising && falling, `peak=${peak.toFixed(2)}`);

// hold on the strongest response until the operator marks the ground
await page.mouse.move(peakX, y0);
for (let i = 0; i < 200; i++) {
  const cur = await state();
  if (cur.phase !== 'detect') break;
  await page.mouse.move(peakX + (i % 2 ? 0.5 : -0.5), y0);
  await page.waitForTimeout(80);
}
await page.mouse.up();

// 4. dry ground resists the nozzle; wet ground yields
await page.waitForFunction(() => window.__dig.phase() === 'water', null, { timeout: 120000 });
let s = await state();
await page.mouse.move(s.finger.x, s.finger.y);
await page.mouse.down();
for (let i = 0; i < 140; i++) {
  const cur = await state();
  if (cur.phase !== 'water') break;
  await page.mouse.move(cur.finger.x + (i % 2 ? 2 : -2), cur.finger.y);
  await page.waitForTimeout(70);
}
await page.mouse.up();
await page.waitForFunction(() => window.__dig.phase() === 'vacuum', null, { timeout: 60000 });
s = await state();
const dryStart = s.depth;
// scrub well away from the wetted spot: this ground was never watered
await page.mouse.move(s.finger.x + 120, s.finger.y + 60);
await page.mouse.down();
for (let i = 0; i < 24; i++) {
  await page.mouse.move(s.finger.x + 118 + (i % 3) * 4, s.finger.y + 58 + (i % 4) * 3);
  await page.waitForTimeout(70);
}
await page.mouse.up();
const dryEnd = (await state()).depth;
check('dry ground barely yields to suction', dryEnd - dryStart < 0.06, `+${(dryEnd - dryStart).toFixed(3)}m`);

// 5. rotation must keep the excavation
s = await state();
await page.mouse.move(s.finger.x, s.finger.y);
await page.mouse.down();
for (let i = 0; i < 110; i++) {
  const cur = await state();
  if (cur.phase !== 'vacuum' || cur.depth > 0.14) break;
  const [a, b] = cur.route;
  const t = (Math.sin(i * 0.2) + 1) / 2;
  await page.mouse.move(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  await page.waitForTimeout(65);
}
await page.mouse.up();
const beforeRotate = await state();
await page.setViewportSize({ width: 844, height: 390 });
await page.waitForTimeout(900);
const landscape = await state();
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(900);
const backToPortrait = await state();
check(
  'rotation preserves excavation depth',
  Math.abs(landscape.depth - beforeRotate.depth) < 0.02 && landscape.portrait === false,
  `${beforeRotate.depth.toFixed(3)} -> ${landscape.depth.toFixed(3)} -> ${backToPortrait.depth.toFixed(3)}`
);
check('rotation restores portrait framing', backToPortrait.portrait === true);

// 6. WebGL context health
const gl = await page.evaluate(() => {
  const c = document.getElementById('scene');
  const ctx2 = c.getContext('webgl2') || c.getContext('webgl');
  return { lost: ctx2 ? ctx2.isContextLost() : true, err: ctx2 ? ctx2.getError() : -1 };
});
check('WebGL context healthy', gl.lost === false && gl.err === 0, JSON.stringify(gl));
check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(results.join('\n'));
await browser.close();
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
