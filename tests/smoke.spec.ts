import { test, expect, Page } from '@playwright/test';

/**
 * Smoke E2E: plays the whole repair through REAL pointer gestures and
 * checks the causal rules the game is built on:
 *   - the light stalls at the first blockage,
 *   - cleaning advances water and light exactly as far as the stroke,
 *   - resin + curing + polishing let the light through,
 *   - the prism spectrum appears only after the repair,
 *   - a different seed moves the faults but obeys the same rules,
 *   - no console errors.
 */

interface Snap {
  phase: string;
  lightFront: number;
  blockFront: number;
  blocker: string;
  dirtRemaining: number;
  initialDirt: number;
  polish: number;
  cracks: {
    v: number;
    u: number;
    fill: number;
    cured: number;
    smoothed: number;
    overfill: number;
    discovered: boolean;
  }[];
  lampSweep: number;
  cureAim: number;
  prismZ: number;
}

const snap = (page: Page): Promise<Snap> =>
  page.evaluate(() => (window as any).__uha.snapshot());

const groove = (page: Page, t: number): Promise<{ x: number; y: number } | null> =>
  page.evaluate((tt) => (window as any).__uha.grooveScreen(tt), t);

const PHASE_ORDER = ['intro', 'inspect', 'clean', 'fill', 'cure', 'polish', 'test', 'free'];

/** Wait until the game is at (or already past) the given phase. */
async function waitPhase(page: Page, phase: string, timeout = 40_000) {
  await page.waitForFunction(
    ({ ph, order }) =>
      order.indexOf((window as any).__uha.snapshot().phase) >= order.indexOf(ph),
    { ph: phase, order: PHASE_ORDER },
    { timeout }
  );
}

async function drag(
  page: Page,
  points: { x: number; y: number }[],
  stepMs = 120
) {
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  for (const p of points.slice(1)) {
    await page.mouse.move(p.x, p.y, { steps: 3 });
    await page.waitForTimeout(stepMs);
  }
  await page.mouse.up();
}

async function sweepLamp(page: Page) {
  for (let pass = 0; pass < 5; pass++) {
    const s = await snap(page);
    if (s.cracks.every((c) => c.discovered)) break;
    const a = await groove(page, 0.1);
    const b = await groove(page, 0.9);
    if (a && b) {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      await drag(page, [a, mid, b], 300);
      await drag(page, [b, mid, a], 300);
    }
    await page.waitForTimeout(600);
  }
}

async function strokeGroove(page: Page, from = 0.12, to = 0.85) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = from + (to - from) * (i / 6);
    const p = await groove(page, t);
    if (p) pts.push({ x: p.x, y: p.y + 8 });
  }
  if (pts.length > 2) await drag(page, pts, 120);
}

async function fillCracks(page: Page) {
  for (let i = 0; i < 4; i++) {
    const s = await snap(page);
    const idx = s.cracks.findIndex((c) => c.fill < 0.95);
    if (idx < 0) break;
    const p = await page.evaluate((k) => (window as any).__uha.crackScreen(k), idx);
    if (!p) break;
    await page.mouse.move(p.x, p.y + 8);
    await page.mouse.down();
    for (let j = 0; j < 30; j++) {
      await page.mouse.move(p.x + (j % 2), p.y + 8, { steps: 1 });
      await page.waitForTimeout(120);
      if ((await snap(page)).cracks[idx].fill >= 0.98) break;
    }
    await page.mouse.up();
  }
}

async function cureCracks(page: Page) {
  // the sun spot follows the finger's position along the horn — hold on
  // each resin line until it sets
  for (let pass = 0; pass < 12; pass++) {
    const s = await snap(page);
    if (s.phase !== 'cure') break;
    const un = s.cracks.find((c) => c.cured < 1);
    if (!un) {
      await page.waitForTimeout(400);
      continue;
    }
    const p = await groove(page, un.v);
    if (!p) break;
    await page.mouse.move(p.x, p.y + 6);
    await page.mouse.down();
    for (let j = 0; j < 20; j++) {
      await page.mouse.move(p.x + (j % 2), p.y + 6, { steps: 1 });
      await page.waitForTimeout(150);
      const still = (await snap(page)).cracks.find((c) => c.cured < 1);
      if (!still || still.v !== un.v) break;
    }
    await page.mouse.up();
  }
}

async function polishHorn(page: Page) {
  for (let pass = 0; pass < 16; pass++) {
    if ((await snap(page)).phase !== 'polish') break;
    await strokeGroove(page, 0.1, 0.95);
    await strokeGroove(page, 0.95, 0.1);
  }
}

function setupErrorCapture(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('full repair play-through with real gestures', async ({ page }) => {
  const errors = setupErrorCapture(page);
  await page.goto('/?e2e=1&seed=1');
  await page.waitForFunction(() => (window as any).__uha?.snapshot().phase);

  // --- intro: the light must stall short of the tip, blocked by dirt
  await waitPhase(page, 'inspect');
  const s0 = await snap(page);
  expect(s0.blockFront).toBeLessThan(0.5);
  expect(s0.blocker).toBe('dirt');
  expect(s0.cracks.length).toBeGreaterThanOrEqual(2);

  // --- inspect: sweeping the lamp reveals every crack
  await sweepLamp(page);
  await waitPhase(page, 'clean');
  expect((await snap(page)).cracks.every((c) => c.discovered)).toBe(true);

  // --- clean: a PARTIAL stroke advances water/light only that far
  const before = await snap(page);
  await strokeGroove(page, 0.1, Math.min(0.42, before.cracks[0].v - 0.02));
  await page.waitForTimeout(1200);
  const mid = await snap(page);
  expect(mid.blockFront).toBeGreaterThan(before.blockFront + 0.02);
  // light chases the causal front, never passes it
  expect(mid.lightFront).toBeLessThanOrEqual(mid.blockFront + 0.02);

  // finish cleaning: now the light waits at the first crack
  for (let i = 0; i < 12; i++) {
    if ((await snap(page)).phase !== 'clean') break;
    await strokeGroove(page);
  }
  await waitPhase(page, 'fill');
  const afterClean = await snap(page);
  expect(afterClean.blocker).toBe('crack');

  // --- fill: resin lets the light pass the cracks
  await fillCracks(page);
  await waitPhase(page, 'cure');
  expect((await snap(page)).cracks.every((c) => c.fill >= 0.92)).toBe(true);

  // --- cure with the mirror
  await cureCracks(page);
  await waitPhase(page, 'polish');
  expect((await snap(page)).cracks.every((c) => c.cured >= 1)).toBe(true);

  // --- polish to a continuous sheen
  await polishHorn(page);
  await waitPhase(page, 'test', 60_000);

  // --- test: light reaches the tip; the wall spectrum blooms
  await waitPhase(page, 'free', 60_000);
  const done = await snap(page);
  expect(done.lightFront).toBeGreaterThan(0.99);
  const spectrum = await page.evaluate(() => (window as any).__uha.spectrumIntensity());
  expect(spectrum).toBeGreaterThan(0.3);

  // --- free play: dragging the prism moves it along its rail
  const pp = await page.evaluate(() => (window as any).__uha.prismScreen());
  const beforeZ = done.prismZ;
  if (pp) {
    await drag(page, [pp, { x: pp.x - 60, y: pp.y }, { x: pp.x - 120, y: pp.y }], 120);
  }
  await page.waitForTimeout(500);
  const moved = await snap(page);
  expect(Math.abs(moved.prismZ - beforeZ)).toBeGreaterThan(0.02);

  expect(errors).toEqual([]);
});

test('replay seed changes the fault layout but keeps the rules', async ({ page }) => {
  const errors = setupErrorCapture(page);
  await page.goto('/?e2e=1&seed=7');
  await page.waitForFunction(() => (window as any).__uha?.snapshot().phase);
  await waitPhase(page, 'inspect');
  const s7 = await snap(page);
  expect(s7.blocker).toBe('dirt');
  expect(s7.cracks.length).toBeGreaterThanOrEqual(2);

  await page.goto('/?e2e=1&seed=1');
  await page.waitForFunction(() => (window as any).__uha?.snapshot().phase);
  await waitPhase(page, 'inspect');
  const s1 = await snap(page);
  // different layout…
  const moved = s1.cracks.some(
    (c, i) => !s7.cracks[i] || Math.abs(c.v - s7.cracks[i].v) > 0.015
  );
  expect(moved).toBe(true);
  // …same causal setup: still stalled and repair-able
  expect(s1.blocker).toBe('dirt');
  expect(errors).toEqual([]);
});
