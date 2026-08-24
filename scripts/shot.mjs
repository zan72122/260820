// Screenshot helper: loads the game with ?e2e=1, optionally advances phases
// by driving real pointer gestures, saves screenshots at key moments.
import { chromium } from '@playwright/test';

const OUT = process.env.OUT_DIR || '/tmp/claude-0/-home-user-260820/7cfedd93-2d7b-53ff-b5d3-e1ed1ce7143a/scratchpad/shots';
const PORTRAIT = process.env.PORTRAIT === '1';
const STOP_AT = process.env.STOP_AT || 'free'; // phase to stop after reaching
const SEED = process.env.SEED || '1';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({
  viewport: PORTRAIT ? { width: 390, height: 844 } : { width: 844, height: 390 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
});
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

await page.goto(`http://127.0.0.1:5173/?e2e=1&seed=${SEED}`);
await page.waitForFunction(() => window.__uha && window.__uha.snapshot().phase);

const snap = () => page.evaluate(() => window.__uha.snapshot());
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const tag = PORTRAIT ? 'p' : 'l';

const PHASES = ['intro', 'inspect', 'clean', 'fill', 'cure', 'polish', 'test', 'free'];

/** Wait until the game is at (or already past) the given phase. */
async function waitPhase(phase, timeout = 30000) {
  try {
    await page.waitForFunction(
      ({ ph, order }) => order.indexOf(window.__uha.snapshot().phase) >= order.indexOf(ph),
      { ph: phase, order: PHASES },
      { timeout }
    );
    console.log('REACHED', phase);
  } catch (e) {
    console.log('TIMEOUT waiting for', phase);
    await report();
    process.exit(1);
  }
}

// drag helper using touch-like pointer events on the canvas
async function drag(points, stepMs = 40) {
  const first = points[0];
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const p of points.slice(1)) {
    await page.mouse.move(p.x, p.y, { steps: 3 });
    await page.waitForTimeout(stepMs);
  }
  await page.mouse.up();
}

// ---------- intro
await shot(`${tag}-0-intro-start`);
await page.waitForTimeout(1800);
await shot(`${tag}-1-intro-stall`);
await waitPhase('inspect', 30000);
await page.waitForTimeout(1200);
await shot(`${tag}-2-inspect-start`);
if (STOP_AT === 'inspect-start') { await report(); process.exit(0); }

// ---------- inspect: sweep the lamp tip-ward across the horn, twice
for (let pass = 0; pass < 3; pass++) {
  const s = await snap();
  if (s.cracks.every((c) => c.discovered)) break;
  const a = await page.evaluate(() => window.__uha.grooveScreen(0.1));
  const b = await page.evaluate(() => window.__uha.grooveScreen(0.9));
  if (a && b) {
    await drag([a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, b], 260);
    await drag([b, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, a], 260);
  }
  await page.waitForTimeout(700);
}
await shot(`${tag}-3-inspect-found`);
await waitPhase('clean', 30000);
await shot(`${tag}-4-clean-start`);
if (STOP_AT === 'clean-start') { await report(); process.exit(0); }

// ---------- clean: stroke along the groove until dirt gone
for (let pass = 0; pass < 14; pass++) {
  const s = await snap();
  if (s.phase !== 'clean') break;
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const t = 0.12 + (0.85 - 0.12) * (i / 6);
    const p = await page.evaluate((tt) => window.__uha.grooveScreen(tt), t);
    if (p) pts.push({ x: p.x, y: p.y + 10 }); // finger slightly below work point
  }
  if (pts.length > 2) await drag(pts, 120);
  if (pass === 2) await shot(`${tag}-5-clean-partial`);
}
await waitPhase('fill', 40000);
await shot(`${tag}-6-fill-start`);

// ---------- fill: hold on each crack
for (let i = 0; i < 3; i++) {
  const s = await snap();
  const idx = s.cracks.findIndex((c) => c.fill < 0.95);
  if (idx < 0) break;
  const p = await page.evaluate((k) => window.__uha.crackScreen(k), idx);
  if (!p) break;
  await page.mouse.move(p.x, p.y + 10);
  await page.mouse.down();
  // tiny wiggle to keep pointer "active"
  for (let j = 0; j < 30; j++) {
    await page.mouse.move(p.x + (j % 2), p.y + 10, { steps: 1 });
    await page.waitForTimeout(120);
    const s2 = await snap();
    if (s2.cracks[idx].fill >= 0.98) break;
  }
  await page.mouse.up();
  if (i === 0) await shot(`${tag}-7-fill-mid`);
}
await waitPhase('cure', 40000);
await shot(`${tag}-8-cure-start`);

// ---------- cure: hold the finger on each resin line — the sun spot
// follows the finger's position along the horn (absolute mapping)
for (let pass = 0; pass < 12; pass++) {
  const s = await snap();
  if (s.phase !== 'cure') break;
  const un = s.cracks.find((c) => c.cured < 1);
  if (!un) { await page.waitForTimeout(400); continue; }
  const p = await page.evaluate((v) => window.__uha.grooveScreen(v), un.v);
  if (!p) break;
  await page.mouse.move(p.x, p.y + 6);
  await page.mouse.down();
  for (let j = 0; j < 20; j++) {
    await page.mouse.move(p.x + (j % 2), p.y + 6, { steps: 1 });
    await page.waitForTimeout(150);
    const s2 = await snap();
    const still = s2.cracks.find((c) => c.cured < 1);
    if (!still || still.v !== un.v) break;
  }
  await page.mouse.up();
  if (pass === 1) await shot(`${tag}-9-cure-mid`);
}
await waitPhase('polish', 60000);
await shot(`${tag}-10-polish-start`);

// ---------- polish: long strokes along the horn
for (let pass = 0; pass < 16; pass++) {
  const s = await snap();
  if (s.phase !== 'polish') break;
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const t = 0.1 + 0.85 * (i / 6);
    const p = await page.evaluate((tt) => window.__uha.grooveScreen(tt), t);
    if (p) pts.push({ x: p.x, y: p.y + 10 });
  }
  if (pts.length > 2) { await drag(pts, 110); await drag(pts.reverse(), 110); }
}
await waitPhase('test', 60000);
await page.waitForTimeout(2500);
await shot(`${tag}-11-test-beam`);
await waitPhase('free', 40000);
await page.waitForTimeout(800);
await shot(`${tag}-12-free`);

// ---------- free: move the prism, tilt horn
const pp = await page.evaluate(() => window.__uha.prismScreen());
if (pp) {
  await drag([pp, { x: pp.x - 60, y: pp.y }, { x: pp.x - 120, y: pp.y }], 120);
  await page.waitForTimeout(600);
  await shot(`${tag}-13-free-prism-moved`);
}

await report();
process.exit(0);

async function report() {
  const s = await snap();
  const r = await page.evaluate(() => window.__uha.renderer());
  const errs = await page.evaluate(() => window.__uha.errors);
  console.log('FINAL_SNAPSHOT ' + JSON.stringify(s, null, 1));
  console.log('RENDERER ' + JSON.stringify(r));
  console.log('PAGE_ERRORS ' + JSON.stringify(errs));
  console.log('CONSOLE ' + JSON.stringify(consoleErrors.slice(0, 20)));
  await browser.close();
}
