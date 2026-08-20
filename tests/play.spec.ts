import { expect, test, type Page } from '@playwright/test';

/**
 * The completion checklist, driven through real pointer input.
 *
 * Every gesture below is a genuine pointerdown / pointermove / pointerup on
 * the canvas — the tests never call the game's own advance hook — so what is
 * verified is the path a player actually takes. The scripted hook is used only
 * to read state and to step simulation time without waiting for real frames,
 * because the cloud runner rasterises in software.
 *
 * Nothing here judges frame rate, animation smoothness or image quality:
 * SwiftShader cannot speak to any of those. Those belong on a GPU runner.
 */

type State = {
  phase: string;
  plotIndex: number;
  clampAttached: boolean;
  leverStage1: number;
  leverStage2: number;
  rocks: number;
  shakes: number;
  lift: number;
  cracksOpen: number;
  crackOpen: number;
  shoulderY: number;
  rootCount: number;
  archetype: string;
  soil: string;
  fps: number;
  tier: string;
};

const PHASES = [
  'approach',
  'seating',
  'leverFirst',
  'shoulder',
  'section',
  'rocking',
  'leverFull',
  'breakFree',
  'reveal',
  'shakeOff',
  'carry',
  'handoff',
];

async function boot(page: Page): Promise<void> {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  (page as Page & { __errors?: string[] }).__errors = errors;

  await page.goto('/?quality=low', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__cassava?.ready === true, null, { timeout: 90_000 });
  await step(page, 0.5);
}

function errorsOf(page: Page): string[] {
  return (page as Page & { __errors?: string[] }).__errors ?? [];
}

const state = (page: Page): Promise<State> =>
  page.evaluate(() => window.__cassava!.state() as unknown as State);

const gesture = (page: Page) =>
  page.evaluate(() => window.__cassava!.gesture());

const step = (page: Page, seconds: number): Promise<void> =>
  page.evaluate((s) => window.__cassava!.step(s), seconds);

/** A single-finger drag along a straight line, in a handful of moves. */
async function swipe(
  page: Page,
  rawFrom: [number, number],
  to: [number, number],
  moves = 14,
  settle = 0.02,
): Promise<void> {
  const vp = page.viewportSize()!;
  // A finger can only land on the screen, so the press point is clamped even
  // when the thing being prompted has been dragged out of view.
  const from: [number, number] = [
    Math.min(vp.width - 4, Math.max(4, rawFrom[0])),
    Math.min(vp.height - 4, Math.max(4, rawFrom[1])),
  ];
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  for (let i = 1; i <= moves; i++) {
    const t = i / moves;
    await page.mouse.move(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t);
    await step(page, settle);
  }
  await page.mouse.up();
  await step(page, 0.05);
}

/** Drag toward the prompted destination until the phase moves on. */
async function performPrompted(page: Page, tries = 14): Promise<void> {
  const start = (await state(page)).phase;
  for (let i = 0; i < tries; i++) {
    const g = await gesture(page);
    await swipe(page, g.from, g.to);
    await step(page, 0.4);
    if ((await state(page)).phase !== start) return;
  }
  throw new Error(`gesture did not advance phase ${start}`);
}

/** Rock side to side until the phase moves on. */
async function rock(page: Page, strokes = 10): Promise<void> {
  const start = (await state(page)).phase;
  const box = (await page.locator('canvas').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height * 0.62;
  const reach = box.width * 0.22;
  for (let i = 0; i < strokes; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    await swipe(page, [cx - dir * reach, cy], [cx + dir * reach, cy], 10);
    await step(page, 0.5);
    if ((await state(page)).phase !== start) return;
  }
  throw new Error(`rocking did not advance phase ${start}`);
}

/**
 * Push the lever handle down until the phase moves on. The press lands on the
 * handle when it is in frame and, when it is not, wherever a hand could
 * plausibly reach — the drag has to have room to travel downward either way.
 */
async function pushLever(page: Page, tries = 12): Promise<void> {
  const start = (await state(page)).phase;
  const vp = page.viewportSize()!;
  for (let i = 0; i < tries; i++) {
    const g = await gesture(page);
    const onScreen =
      g.from[0] > 8 && g.from[0] < vp.width - 8 && g.from[1] > 8 && g.from[1] < vp.height * 0.72;
    const from: [number, number] = onScreen ? g.from : [vp.width * 0.5, vp.height * 0.45];
    await swipe(page, from, [from[0], Math.min(vp.height - 6, from[1] + vp.height * 0.32)], 16);
    await step(page, 0.4);
    if ((await state(page)).phase !== start) return;
  }
  throw new Error(`lever did not advance phase ${start}`);
}

/** Run one plant from first touch to the basket, using real input only. */
async function harvestOnePlant(page: Page): Promise<void> {
  await performPrompted(page); // clamp on to the stem base
  await waitFor(page, 'leverFirst');
  await pushLever(page); // first, tentative pull
  await waitFor(page, 'rocking', 25);
  await rock(page); // loosen
  await waitFor(page, 'leverFull');
  await pushLever(page); // full stroke
  await waitFor(page, 'shakeOff', 40);
  await rock(page); // shake the soil off
  await waitFor(page, 'carry', 20);
  await performPrompted(page); // into the basket
  await waitFor(page, 'handoff', 20);
}

/** Step until the row has moved on to the next plant. */
async function waitForNextPlant(page: Page, from: number, maxSeconds = 30): Promise<void> {
  for (let t = 0; t < maxSeconds; t += 0.25) {
    const s = await state(page);
    if (s.plotIndex !== from && s.phase === 'approach') return;
    await step(page, 0.25);
  }
  throw new Error(`never left plant ${from}; at ${(await state(page)).phase}`);
}

async function waitFor(page: Page, phase: string, maxSeconds = 30): Promise<void> {
  const want = PHASES.indexOf(phase);
  for (let t = 0; t < maxSeconds; t += 0.25) {
    if (PHASES.indexOf((await state(page)).phase) >= want) return;
    await step(page, 0.25);
  }
  throw new Error(`never reached ${phase}; at ${(await state(page)).phase}`);
}

/* ------------------------------------------------------------------ */

test('the opening withholds the roots, and the tool is the only affordance', async ({ page }) => {
  await boot(page);
  const s = await state(page);
  expect(s.phase).toBe('approach');
  expect(s.lift).toBe(0);
  expect(s.cracksOpen).toBe(0);
  expect(s.clampAttached).toBe(false);

  // No text of any kind is rendered: the page is a canvas and nothing else.
  const text = (await page.locator('body').innerText()).trim();
  expect(text).toBe('');
});

test('the wordless prompt ladder escalates only while nothing is touched', async ({ page }) => {
  await boot(page);
  await step(page, 2.0);
  const before = await gesture(page);
  await step(page, 8.0); // past 3 s, 6 s and 9 s
  const after = await gesture(page);
  // The prompt keeps pointing at the same move; it never changes the task.
  expect(Math.hypot(after.to[0] - before.to[0], after.to[1] - before.to[1])).toBeLessThan(40);
  expect(errorsOf(page)).toEqual([]);
});

test('first lever pull cracks the ground and shows a root shoulder', async ({ page }) => {
  await boot(page);
  await performPrompted(page);
  await waitFor(page, 'leverFirst');

  let s = await state(page);
  expect(s.clampAttached).toBe(true);
  // The clamp is on but nothing has been levered yet: the ground is still shut.
  expect(s.lift).toBeLessThan(0.02);
  expect(s.crackOpen).toBeLessThan(0.08);
  const shoulderBefore = s.shoulderY;
  expect(shoulderBefore).toBeLessThan(0);

  await pushLever(page);
  await waitFor(page, 'shoulder');
  s = await state(page);
  // The ground has split, only the first wave of cracks is open, and the
  // plant has come up by a few centimetres.
  expect(s.cracksOpen).toBe(1);
  expect(s.crackOpen).toBeGreaterThan(0.2);
  expect(s.lift).toBeGreaterThan(0.04);
  expect(s.lift).toBeLessThan(0.11);
  // The thickest root's shoulder has reached the soil line, so the pale skin
  // is showing in the split rather than being described in text.
  expect(s.shoulderY).toBeGreaterThan(shoulderBefore + 0.04);
  expect(s.shoulderY).toBeGreaterThan(-0.03);
});

test('the cluster never appears at once: rocking, then a staggered lift', async ({ page }) => {
  await boot(page);
  await performPrompted(page);
  await waitFor(page, 'leverFirst');
  await pushLever(page);
  await waitFor(page, 'rocking', 25);

  await rock(page);
  const rocked = await state(page);
  expect(rocked.rocks).toBeGreaterThanOrEqual(3);
  expect(rocked.cracksOpen).toBe(2);

  // Sample the lift through the full stroke; it has to climb, not jump.
  await waitFor(page, 'leverFull');
  const box = (await page.locator('canvas').boundingBox())!;
  const samples: number[] = [];
  for (let i = 0; i < 6; i++) {
    const g = await gesture(page);
    await swipe(page, g.from, [g.from[0], g.from[1] + box.height * 0.10], 6);
    await step(page, 0.15);
    samples.push((await state(page)).lift);
  }
  for (let i = 1; i < samples.length; i++) {
    expect(samples[i]!).toBeGreaterThanOrEqual(samples[i - 1]! - 1e-6);
    // No single step may teleport the plant out of the ground.
    expect(samples[i]! - samples[i - 1]!).toBeLessThan(0.28);
  }
});

test('a whole plant, first touch to basket, then straight on to the next', async ({ page }) => {
  test.slow();
  await boot(page);
  const first = await state(page);
  await harvestOnePlant(page);

  await waitForNextPlant(page, first.plotIndex);
  const second = await state(page);
  expect(second.plotIndex).toBe(1);
  // The next plant is a different plant, but the rules did not change.
  expect(second.archetype).not.toBe(first.archetype);
  expect(second.lift).toBe(0);
  expect(second.cracksOpen).toBe(0);
  expect(second.clampAttached).toBe(false);
  expect(errorsOf(page)).toEqual([]);
});

test('plants differ in root count and shape while the rules stay put', async ({ page }) => {
  test.slow();
  await boot(page);
  // Walk the row, finishing plants and recording what turns up under each stem.
  const found: { roots: number; archetype: string; soil: string }[] = [];
  for (let i = 0; i < 2; i++) {
    const s = await state(page);
    found.push({ roots: s.rootCount, archetype: s.archetype, soil: s.soil });
    await harvestOnePlant(page);
    await waitForNextPlant(page, s.plotIndex);
  }
  expect(new Set(found.map((f) => f.archetype)).size).toBe(2);
  expect(found.every((f) => f.roots >= 4 && f.roots <= 9)).toBe(true);
});

test('mashing and wrong-way drags never break the sequence', async ({ page }) => {
  await boot(page);
  const box = (await page.locator('canvas').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Rapid taps everywhere.
  for (let i = 0; i < 12; i++) {
    await page.mouse.move(cx + (i % 5) * 20 - 40, cy + (i % 3) * 25 - 25);
    await page.mouse.down();
    await page.mouse.up();
    await step(page, 0.03);
  }
  expect((await state(page)).phase).toBe('approach');

  await performPrompted(page);
  await waitFor(page, 'leverFirst');

  // Drag the lever the wrong way, hard, repeatedly.
  for (let i = 0; i < 4; i++) {
    const g = await gesture(page);
    await swipe(page, g.from, [g.from[0], g.from[1] - box.height * 0.25], 10);
    await step(page, 0.3);
  }
  let s = await state(page);
  expect(s.phase).toBe('leverFirst');
  expect(s.lift).toBeGreaterThanOrEqual(0);
  expect(s.clampAttached).toBe(true);

  // Now the right way, in stutters, stopping part-way each time.
  await pushLever(page);
  await waitFor(page, 'shoulder');
  s = await state(page);
  expect(s.cracksOpen).toBe(1);
  expect(errorsOf(page)).toEqual([]);
});

test('rotating the device mid-gesture keeps every bit of progress', async ({ page }) => {
  await boot(page);
  await performPrompted(page);
  await waitFor(page, 'leverFirst');
  await pushLever(page);
  await waitFor(page, 'shoulder');
  await waitFor(page, 'rocking', 25);

  const before = await state(page);
  const size = page.viewportSize()!;

  // Rotate mid-rock, with the finger still down.
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6);
  await page.setViewportSize({ width: size.height, height: size.width });
  await step(page, 0.4);
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.6);
  await page.mouse.up();
  await step(page, 0.4);

  const after = await state(page);
  expect(after.clampAttached).toBe(true);
  expect(after.cracksOpen).toBeGreaterThanOrEqual(before.cracksOpen);
  expect(after.lift).toBeGreaterThanOrEqual(before.lift - 1e-6);
  expect(PHASES.indexOf(after.phase)).toBeGreaterThanOrEqual(PHASES.indexOf(before.phase));

  // And the game keeps working in the new orientation.
  await rock(page);
  expect((await state(page)).rocks).toBeGreaterThanOrEqual(3);
  expect(errorsOf(page)).toEqual([]);

  await page.setViewportSize(size);
  await step(page, 0.3);
});

test('the lifted cluster stays inside the frame in both orientations', async ({ page }) => {
  test.slow();
  await boot(page);
  await performPrompted(page);
  await waitFor(page, 'leverFirst');
  await pushLever(page);
  await waitFor(page, 'rocking', 25);
  await rock(page);
  await waitFor(page, 'leverFull');
  await pushLever(page);
  await waitFor(page, 'reveal', 40);
  await step(page, 3.0);

  const size = page.viewportSize()!;
  for (const vp of [size, { width: size.height, height: size.width }]) {
    await page.setViewportSize(vp);
    await step(page, 1.5);
    const fit = await page.evaluate(() => window.__cassava!.clusterOnScreen());
    // Every extremity of the cluster projects inside the viewport.
    expect(fit.minX).toBeGreaterThan(0);
    expect(fit.maxX).toBeLessThan(1);
    expect(fit.minY).toBeGreaterThan(0);
    expect(fit.maxY).toBeLessThan(1);
  }
  await page.setViewportSize(size);
});
