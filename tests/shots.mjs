/**
 * Visual inspection harness. Not part of the test suite — it plays the whole
 * sequence through the same gestures a player uses and writes a screenshot at
 * every beat, so framing, the crack reveal and the lift can be looked at.
 *
 *   node tests/shots.mjs [outDir] [width] [height]
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'shots';
const width = Number(process.argv[3] ?? 390);
const height = Number(process.argv[4] ?? 844);
mkdirSync(out, { recursive: true });

// The pinned Playwright build expects a newer Chromium revision than the one
// installed here, so point it at the browser that is actually present.
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({
  viewport: { width, height },
  // SwiftShader is the only rasteriser here, so keep the buffer at 1x.
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
page.setDefaultTimeout(180_000);

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto('http://localhost:4173/?quality=mid', { waitUntil: 'load' });
await page.waitForFunction(() => window.__cassava?.ready === true, null, { timeout: 60000 });
await page.waitForTimeout(1200);

let n = 0;
const state = () => page.evaluate(() => window.__cassava.state());
const step = (sec) => page.evaluate((s) => window.__cassava.step(s), sec);
const drive = (a) => page.evaluate((x) => window.__cassava.drive(x), a);

const shot = async (name) => {
  const s = await state();
  const label = String(n++).padStart(2, '0') + '-' + name;
  await page.screenshot({ path: `${out}/${label}.png`, timeout: 180_000, animations: 'disabled' });
  console.log(label.padEnd(26), s.phase.padEnd(11), 'lift=' + s.lift.toFixed(3),
    'roots=' + s.rootCount, 'rocks=' + s.rocks, 'shakes=' + s.shakes, s.archetype, s.soil);
  return s;
};

/** Wait, without touching anything. */
const idle = (sec) => step(sec);

/** Drive the current gesture until the phase changes. */
const untilPhaseChanges = async (maxSeconds = 60) => {
  const start = (await state()).phase;
  for (let t = 0; t < maxSeconds; t += 0.05) {
    await drive(1);
    await step(0.05);
    if ((await state()).phase !== start) return;
  }
  throw new Error(`stuck in phase ${start}`);
};

const ORDER = ['approach', 'seating', 'leverFirst', 'shoulder', 'section', 'rocking',
  'leverFull', 'breakFree', 'reveal', 'shakeOff', 'carry', 'handoff'];

/** Let the game run itself forward until it is at or past a phase. */
const waitForPhase = async (phase, maxSeconds = 30) => {
  const want = ORDER.indexOf(phase);
  for (let t = 0; t < maxSeconds; t += 0.2) {
    const at = ORDER.indexOf((await state()).phase);
    if (at >= want) return;
    await step(0.2);
  }
  throw new Error(`never reached ${phase}, at ${(await state()).phase}`);
};

/* ---- the opening: no roots, no words, escalating prompts ---- */
await shot('opening');
await idle(3.3);
await shot('idle-3s-stir');
await idle(3.2);
await shot('idle-6s-look');
await idle(3.4);
await shot('idle-9s-trace');

/* ---- carry the clamp to the stem base ---- */
await untilPhaseChanges();          // approach -> seating
await shot('clamp-bitten');
await waitForPhase('leverFirst');
await idle(1.4);
await shot('lever-side');

/* ---- first, tentative pull: three cracks and one root shoulder ---- */
await untilPhaseChanges();          // leverFirst -> shoulder
await shot('first-crack');
await idle(1.2);
await shot('root-shoulder');
await waitForPhase('section');
await idle(0.7);
await shot('section-cutaway');
await waitForPhase('rocking');
await idle(1.0);
await shot('rocking');

/* ---- rock the stem: one more root direction each time ---- */
await untilPhaseChanges();          // rocking -> leverFull
await idle(1.2);
await shot('rocked-loose');

/* ---- the full stroke: the cluster comes up, staggered ---- */
for (let i = 0; i < 10; i++) { await drive(0.22); await step(0.05); }
await shot('rising');
for (let i = 0; i < 10; i++) { await drive(0.22); await step(0.05); }
await shot('rising-more');
for (let i = 0; i < 30; i++) { await drive(0.5); await step(0.05); }
await waitForPhase('breakFree');
await idle(0.9);
await shot('breaking-free');
await waitForPhase('reveal');
await idle(1.4);
await shot('reveal-pullback');
await idle(2.2);
await shot('reveal');

/* ---- shake the soil off, then carry it to the basket ---- */
await waitForPhase('shakeOff');
await untilPhaseChanges();          // shakeOff -> carry
await shot('shaken-clean');
await idle(1.0);
await shot('carry-start');
await untilPhaseChanges();          // carry -> handoff
await shot('into-basket');
await idle(2.6);
await shot('next-stems');
await waitForPhase('approach');
await idle(1.6);
const s2 = await shot('plot-2-opening');
if (s2.plotIndex !== 1) throw new Error('did not advance to the second plant');

console.log('\nconsole errors:', errors.length ? errors : 'none');
await browser.close();
