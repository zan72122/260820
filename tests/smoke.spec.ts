import { expect, test, type Page } from '@playwright/test';

interface Snapshot {
  phase: string;
  round: number;
  seam: number;
  defect: string | null;
  steps: string[];
  stepIndex: number;
  stepId: string | null;
  stepProgress: number;
  reveal: number;
  crawlerU: number;
  dropU: number;
  quality: number;
  workScreen: { x: number; y: number };
  liftPx: number;
  driveDir: { x: number; y: number };
}

const APP = '/?e2e=1&fast=1&turbo=1';

const state = (page: Page): Promise<Snapshot> =>
  page.evaluate(() => (window as unknown as { __sd: { state(): Snapshot } }).__sd.state());

async function until(
  page: Page,
  pred: (s: Snapshot) => boolean,
  label: string,
  ms = 120_000,
): Promise<Snapshot> {
  const t0 = Date.now();
  for (;;) {
    const s = await state(page);
    if (pred(s)) return s;
    if (Date.now() - t0 > ms) throw new Error(`timed out waiting for ${label}: ${JSON.stringify(s)}`);
    await page.waitForTimeout(350);
  }
}

async function swipe(
  page: Page,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  steps = 12,
  hold = 10,
): Promise<void> {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
    await page.waitForTimeout(hold);
  }
  await page.mouse.up();
}

async function boot(page: Page): Promise<{ w: number; h: number }> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(APP, { waitUntil: 'load' });
  await page.waitForFunction(
    () => (window as unknown as { __sd?: { ready(): boolean } }).__sd?.ready() === true,
    null,
    { timeout: 120_000 },
  );
  await page.click('.boot__go', { force: true });
  const size = page.viewportSize() ?? { width: 390, height: 844 };
  expect(errors, `page errors: ${errors.join(' | ')}`).toEqual([]);
  return { w: size.width, h: size.height };
}

/** Pushes the crawler down the flume with repeated swipes towards the mouth. */
async function driveIn(page: Page, w: number, h: number): Promise<void> {
  await until(page, (s) => s.phase === 'drive', 'drive');
  for (let i = 0; i < 90; i++) {
    const s = await state(page);
    if (s.phase !== 'drive') break;
    const len = Math.min(w, h) * 0.34;
    const cx = w * 0.5;
    const cy = h * 0.55;
    await swipe(
      page,
      cx - s.driveDir.x * len * 0.5,
      cy - s.driveDir.y * len * 0.5,
      cx + s.driveDir.x * len * 0.5,
      cy + s.driveDir.y * len * 0.5,
      10,
      8,
    );
    await page.waitForTimeout(90);
  }
  await until(page, (s) => s.phase === 'lightSearch', 'lightSearch');
}

/** Sweeps the lamp knob across its travel until the fault is exposed. */
async function findFault(page: Page): Promise<void> {
  const box = await page.locator('.knob').boundingBox();
  if (!box) throw new Error('lamp knob is not on screen');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const r = box.width * 0.34;
  outer: for (let iy = 0; iy < 7; iy++) {
    for (let ix = 0; ix < 5; ix++) {
      const kx = -0.6 + (1.2 * ix) / 4;
      const ky = -1 + (2 * iy) / 6;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + kx * r, cy - ky * r, { steps: 3 });
      await page.mouse.up();
      await page.waitForTimeout(220);
      if ((await state(page)).phase !== 'lightSearch') break outer;
    }
  }
  await until(page, (s) => s.phase !== 'lightSearch', 'fault revealed');
}

/**
 * Performs one treatment gesture, re-checking between strokes so a step that
 * finishes early does not have the next step's strokes thrown at it.
 */
async function runStep(page: Page, s: Snapshot, w: number, h: number): Promise<void> {
  const c = s.workScreen;
  const y = c.y + s.liftPx;
  const id = s.stepId;
  const busy = async (): Promise<boolean> => (await state(page)).stepId === id;
  switch (id) {
    case 'peel':
      for (let i = 0; i < 8 && (await busy()); i++) {
        await swipe(page, c.x - 20, y - 30, c.x + 30, y + h * 0.24, 10, 8);
      }
      break;
    case 'brush':
      for (let i = 0; i < 12 && (await busy()); i++) {
        const off = ((i % 3) - 1) * 16;
        await swipe(page, c.x - w * 0.3, y + off, c.x + w * 0.3, y + off, 10, 8);
      }
      break;
    case 'fill':
      for (let i = 0; i < 6 && (await busy()); i++) {
        await swipe(page, c.x - w * 0.34, y, c.x + w * 0.34, y, 20, 14);
      }
      break;
    case 'smooth':
      for (let i = 0; i < 6 && (await busy()); i++) {
        await swipe(page, c.x - w * 0.36, y, c.x + w * 0.36, y, 18, 10);
      }
      break;
    case 'polish':
      for (let i = 0; i < 8 && (await busy()); i++) {
        const r = Math.min(w, h) * 0.16;
        await page.mouse.move(c.x + r, y);
        await page.mouse.down();
        for (let k = 1; k <= 26; k++) {
          const a = (k / 26) * Math.PI * 4;
          await page.mouse.move(c.x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6);
          await page.waitForTimeout(6);
        }
        await page.mouse.up();
      }
      break;
    default:
      await page.waitForTimeout(300);
  }
}

async function treatFault(page: Page, w: number, h: number): Promise<string[]> {
  const finished: string[] = [];
  for (let guard = 0; guard < 50; guard++) {
    const s = await state(page);
    if (s.phase === 'dropTest') break;
    if (s.phase === 'toolPick') {
      await page.click(`.tray__btn[data-tool="${s.steps[s.stepIndex]}"]`, { force: true });
      await page.waitForTimeout(350);
      continue;
    }
    if (s.phase !== 'treat' || !s.stepId) {
      await page.waitForTimeout(350);
      continue;
    }
    const id = s.stepId;
    await runStep(page, s, w, h);
    await page.waitForTimeout(450);
    const after = await state(page);
    if (after.stepId !== id) finished.push(id);
  }
  await until(page, (s) => s.phase === 'dropTest', 'water test offered');
  return finished;
}

async function pullLever(page: Page): Promise<void> {
  const box = await page.locator('.lever').boundingBox();
  if (!box) throw new Error('water lever is not on screen');
  await swipe(
    page,
    box.x + box.width / 2,
    box.y + box.height * 0.2,
    box.x + box.width / 2,
    box.y + box.height * 0.9,
    10,
    20,
  );
}

test.describe('slider doctor', () => {
  test('a whole round can be played, proved and replayed', async ({ page }) => {
    const { w, h } = await boot(page);

    // The mystery and the first thing to do must both land quickly.
    const opening = await until(
      page,
      (s) => s.phase === 'introSnag' || s.phase === 'drive',
      'droplet stops at the joint',
      30_000,
    );
    expect(opening.defect).toBe('step');

    await driveIn(page, w, h);
    const parked = await state(page);
    expect(parked.crawlerU).toBeGreaterThan(0.05);

    await findFault(page);
    expect((await state(page)).reveal).toBeGreaterThan(0.6);

    const done = await treatFault(page, w, h);
    expect(done).toEqual(['peel', 'brush', 'fill', 'smooth', 'polish']);
    expect((await state(page)).quality).toBeGreaterThan(0.6);

    // The proving droplet must run the joint without catching.
    await pullLever(page);
    const watching = await until(page, (s) => s.phase === 'dropWatch', 'droplet released');
    expect(watching.dropU).toBeLessThan(0.2);
    await until(page, (s) => s.phase === 'raftTest', 'raft test');
    await until(page, (s) => s.phase === 'roundEnd', 'round complete');

    // One tap must be enough to see the water again.
    await expect(page.locator('.endbar')).toHaveClass(/on/, { timeout: 20_000 });
    await page.click('.endbar__btn--water', { force: true });
    await until(page, (s) => s.phase === 'dropTest', 'water test offered again');
  });

  test('the second fault is a different kind and asks for fewer tools', async ({ page }) => {
    const { w, h } = await boot(page);
    await driveIn(page, w, h);
    await findFault(page);
    await treatFault(page, w, h);
    await pullLever(page);
    await until(page, (s) => s.phase === 'roundEnd', 'round one complete');
    await expect(page.locator('.endbar')).toHaveClass(/on/, { timeout: 20_000 });

    await page.click('.endbar__btn--next', { force: true });
    const second = await until(page, (s) => s.round === 1, 'second fault');
    expect(second.defect).toBe('cloudy');
    expect(second.steps).toEqual(['brush', 'polish']);
    expect(second.seam).toBeGreaterThan(0);
  });

  test('turning the device keeps the repair and re-frames the shot', async ({ page }) => {
    const { w, h } = await boot(page);
    await driveIn(page, w, h);
    await findFault(page);
    const before = await until(page, (s) => s.phase === 'treat', 'first treatment');

    // Do part of the work, then turn the device.
    await runStep(page, before, w, h);
    const mid = await state(page);

    await page.setViewportSize({ width: h, height: w });
    await page.waitForTimeout(1500);
    const after = await state(page);

    expect(after.round).toBe(mid.round);
    expect(after.seam).toBe(mid.seam);
    expect(after.stepIndex).toBe(mid.stepIndex);
    expect(after.quality).toBeCloseTo(mid.quality, 2);
    // The joint has to still be on screen in the new framing.
    expect(after.workScreen.x).toBeGreaterThan(0);
    expect(after.workScreen.x).toBeLessThan(h);
    expect(after.workScreen.y).toBeGreaterThan(0);
    expect(after.workScreen.y).toBeLessThan(w * 0.85);
  });

  test('controls stay clear of the work and the canvas fills the viewport', async ({ page }) => {
    const { w, h } = await boot(page);
    await driveIn(page, w, h);

    const canvas = await page.locator('#stage').boundingBox();
    expect(canvas?.width).toBeCloseTo(w, 0);
    expect(canvas?.height).toBeCloseTo(h, 0);

    // While the lamp knob is up it must not sit on top of the joint being read.
    const knob = await page.locator('.knob').boundingBox();
    const s = await state(page);
    expect(knob).not.toBeNull();
    if (knob) {
      const overlaps =
        s.workScreen.x > knob.x &&
        s.workScreen.x < knob.x + knob.width &&
        s.workScreen.y > knob.y &&
        s.workScreen.y < knob.y + knob.height;
      expect(overlaps, 'the lamp knob overlaps the joint').toBe(false);
    }

    await findFault(page);
    const work = await state(page);
    expect(work.workScreen.y).toBeLessThan(h * 0.8);
    expect(work.workScreen.y).toBeGreaterThan(0);
    expect(work.workScreen.x).toBeGreaterThan(0);
    expect(work.workScreen.x).toBeLessThan(w);
  });
});
