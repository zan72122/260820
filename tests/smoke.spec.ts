import { test, expect, type Page } from '@playwright/test';

/**
 * Behavioural smoke run. SwiftShader renders these frames, so nothing here
 * judges frame rate, smoothness or final visual quality — only that the game
 * boots, that one finger drives the whole session, and that the flame can
 * never be left running.
 *
 * Every beat is opened with a real pointer gesture (that is the thing under
 * test) and then fast-forwarded with the simulation hook, because a software
 * renderer cannot deliver two minutes of gameplay in real time.
 */

interface Snapshot {
  phase: string;
  coverage: number;
  frontCoverage: number;
  bakedFraction: number;
  flameLit: boolean;
  flameLevel: number;
  cutProgress: number;
  sliceOut: number;
  portrait: boolean;
  transitioning: boolean;
  drawCalls: number;
  triangles: number;
}

declare global {
  interface Window {
    __ba: {
      ready: boolean;
      errors: string[];
      state: () => Snapshot;
      advance: (ms: number, step?: number, render?: boolean) => void;
      autoPipe: () => void;
      autoBake: (amount?: number) => void;
      autoCut: () => void;
      forcePhase: (p: string) => void;
    };
  }
}

const state = (page: Page) => page.evaluate(() => window.__ba.state());
const errors = (page: Page) => page.evaluate(() => window.__ba.errors);
const advance = (page: Page, ms: number) =>
  page.evaluate((n) => window.__ba.advance(n), ms);

async function boot(page: Page) {
  await page.goto('/?fast=1');
  await page.waitForFunction(() => window.__ba?.ready === true, null, { timeout: 60_000 });
  await page.waitForTimeout(300);
}

async function size(page: Page) {
  return page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
}

async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 8,
) {
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

/** Swipe the mould off and settle the camera. */
async function liftMould(page: Page) {
  const { w, h } = await size(page);
  await drag(page, { x: w / 2, y: h * 0.62 }, { x: w / 2, y: h * 0.34 }, 6);
  await advance(page, 4000);
  await page.waitForFunction(() => window.__ba.state().phase === 'pipe', null, { timeout: 30_000 });
}

async function coatDome(page: Page) {
  await page.evaluate(() => {
    window.__ba.autoPipe();
    window.__ba.advance(9000);
  });
  await page.waitForFunction(() => window.__ba.state().phase === 'torchIdle', null, {
    timeout: 30_000,
  });
  await advance(page, 2500);
}

async function igniterPoint(page: Page) {
  return page.evaluate(() => {
    const r = document.querySelector('.ring');
    if (!r || !r.classList.contains('is-on')) return null;
    const b = r.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
}

async function tapIgniter(page: Page) {
  await page.waitForFunction(() => window.__ba.state().transitioning === false, null, {
    timeout: 30_000,
  });
  // The ring is drawn by the render loop; on a software renderer a frame can
  // take a while, so wait for it rather than for the clock.
  await page.waitForFunction(
    () => !!document.querySelector('.ring')?.classList.contains('is-on'),
    null,
    { timeout: 30_000 },
  );
  const p = await igniterPoint(page);
  expect(p, 'igniter target ring is on screen').not.toBeNull();
  const vp = page.viewportSize()!;
  expect(p!.x, 'ring is inside the viewport').toBeGreaterThan(0);
  expect(p!.x).toBeLessThan(vp.width);
  expect(p!.y).toBeGreaterThan(0);
  expect(p!.y).toBeLessThan(vp.height);
  await page.mouse.click(p!.x, p!.y);
  await advance(page, 400);
}

test.describe('Fire & Ice: Baked Alaska', () => {
  test('boots into a live 3D stage with no errors', async ({ page }) => {
    await boot(page);
    const s = await state(page);
    expect(s.drawCalls).toBeGreaterThan(5);
    // real geometry, not a CSS mock-up
    expect(s.triangles).toBeGreaterThan(2000);
    await expect(page.locator('#stage')).toBeVisible();
    const canvas = await page.evaluate(() => {
      const c = document.getElementById('stage') as HTMLCanvasElement;
      return { w: c.width, h: c.height };
    });
    expect(canvas.w).toBeGreaterThan(100);
    expect(canvas.h).toBeGreaterThan(100);
    expect(await errors(page)).toEqual([]);
  });

  test('one finger drives mould, meringue, torch, cut and replay', async ({ page }) => {
    await boot(page);

    // 1. lift the mould with a swipe
    await liftMould(page);
    expect((await state(page)).phase).toBe('pipe');

    // 2. meringue appears where the finger goes
    const { w, h } = await size(page);
    const before = await state(page);
    await drag(page, { x: w * 0.28, y: h * 0.4 }, { x: w * 0.72, y: h * 0.4 }, 10);
    await advance(page, 400);
    const oneStroke = await state(page);
    expect(oneStroke.coverage).toBeGreaterThan(before.coverage);

    await coatDome(page);
    const piped = await state(page);
    expect(piped.coverage).toBeGreaterThan(0.9);
    expect(piped.phase).toBe('torchIdle');

    // 3. tap lights the torch
    await tapIgniter(page);
    const lit = await state(page);
    expect(lit.phase).toBe('torch');
    expect(lit.flameLit).toBe(true);

    // 4. browning follows the finger and only the finger
    await page.mouse.move(w * 0.3, h * 0.46);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(w * (0.3 + 0.04 * i), h * (0.46 + (i % 3) * 0.012));
      await advance(page, 120);
    }
    await page.mouse.up();
    await advance(page, 300);
    const traced = await state(page);
    expect(traced.bakedFraction).toBeGreaterThan(0);

    // browning is remembered once the finger has gone
    await advance(page, 1500);
    const remembered = await state(page);
    expect(remembered.bakedFraction).toBeGreaterThanOrEqual(traced.bakedFraction - 0.001);

    // 5. finish the bake and stop the flame
    await page.evaluate(() => {
      window.__ba.autoBake(1);
      window.__ba.advance(1500);
    });
    await page.waitForFunction(() => window.__ba.state().phase === 'cut', null, { timeout: 30_000 });
    expect((await state(page)).flameLit).toBe(false);
    await advance(page, 2500);

    // 6. cut with a downward swipe
    await drag(page, { x: w * 0.5, y: h * 0.28 }, { x: w * 0.5, y: h * 0.8 }, 12);
    await advance(page, 500);
    const cut = await state(page);
    expect(cut.cutProgress).toBeGreaterThan(0.9);
    expect(['reveal', 'finish']).toContain(cut.phase);

    // 7. the reveal plays out and the slice travels
    await advance(page, 9000);
    await page.waitForFunction(() => window.__ba.state().phase === 'finish', null, {
      timeout: 30_000,
    });
    const done = await state(page);
    expect(done.sliceOut).toBeGreaterThan(0.8);
    await expect(page.locator('.finish')).toHaveClass(/is-on/);

    // 8. replay is one tap; the flavour swatch is the optional second
    await page.locator('.flavor').nth(1).click();
    await page.locator('.finish .replay').click();
    await advance(page, 600);
    const replayed = await state(page);
    expect(replayed.coverage).toBeLessThan(0.05);
    expect(replayed.bakedFraction).toBe(0);
    expect(['mold', 'intro']).toContain(replayed.phase);

    expect(await errors(page)).toEqual([]);
  });

  test('the flame can never be left running', async ({ page }) => {
    await boot(page);
    await liftMould(page);
    await coatDome(page);

    // pointercancel mid-drag
    await tapIgniter(page);
    expect((await state(page)).flameLit).toBe(true);
    const { w, h } = await size(page);
    await page.mouse.move(w * 0.5, h * 0.5);
    await page.mouse.down();
    await advance(page, 200);
    await page.evaluate(() => {
      window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true }));
    });
    await advance(page, 300);
    expect((await state(page)).flameLit).toBe(false);
    await page.mouse.up();
    await advance(page, 200);

    // tab hidden
    await tapIgniter(page);
    expect((await state(page)).flameLit).toBe(true);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => window.__ba.state().flameLit === false, null, {
      timeout: 30_000,
    });
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(400);

    // orientation change
    await tapIgniter(page);
    expect((await state(page)).flameLit).toBe(true);
    const vp = page.viewportSize()!;
    await page.setViewportSize({ width: vp.height, height: vp.width });
    await page.waitForFunction(() => window.__ba.state().flameLit === false, null, {
      timeout: 30_000,
    });
    expect((await state(page)).flameLit).toBe(false);

    expect(await errors(page)).toEqual([]);
  });

  test('browning survives a rotation and both orientations stay playable', async ({ page }) => {
    await boot(page);
    await liftMould(page);
    await coatDome(page);
    await page.evaluate(() => {
      window.__ba.forcePhase('torch');
      window.__ba.autoBake(1);
      window.__ba.advance(400);
    });
    const before = await state(page);
    expect(before.bakedFraction).toBeGreaterThan(0.5);

    const vp = page.viewportSize()!;
    await page.setViewportSize({ width: vp.height, height: vp.width });
    await page.waitForFunction(
      (wasPortrait) => window.__ba.state().portrait !== wasPortrait,
      before.portrait,
      { timeout: 30_000 },
    );
    const after = await state(page);
    expect(after.bakedFraction).toBeCloseTo(before.bakedFraction, 3);
    expect(after.drawCalls).toBeGreaterThan(5);

    // and the working input still lands on the cake in the new orientation
    const s2 = await size(page);
    await page.evaluate(() => window.__ba.forcePhase('pipe'));
    const cov = (await state(page)).coverage;
    await drag(page, { x: s2.w * 0.3, y: s2.h * 0.45 }, { x: s2.w * 0.7, y: s2.h * 0.45 }, 8);
    await advance(page, 400);
    expect((await state(page)).coverage).toBeGreaterThanOrEqual(cov);

    await page.setViewportSize(vp);
    await page.waitForFunction(
      (wasPortrait) => window.__ba.state().portrait === wasPortrait,
      before.portrait,
      { timeout: 30_000 },
    );
    expect((await state(page)).bakedFraction).toBeCloseTo(before.bakedFraction, 3);
    expect(await errors(page)).toEqual([]);
  });
});
