import { test, expect } from '@playwright/test';
import { boot, state, slide, waitPhase } from './helpers';

test('short or diagonal swipes spring back safely without commanding', async ({ page }) => {
  await boot(page);
  // short swipe: not enough to reach the detent
  await slide(page, -1, { frac: 0.12 });
  await page.waitForFunction(() => (window as any).__mono.lever > 0.9, null, { timeout: 5_000 });
  let s = await state(page);
  expect(s.phase).toBe('idle'); // sprang back to the curve detent, no command

  // heavily diagonal swipe still projects onto the handle axis
  await slide(page, -1, { frac: 0.5, diagonal: 220 });
  s = await state(page);
  expect(['command', 'traverse']).toContain(s.phase);
});

test('mashing, mid-release and reverse input cannot double-drive the machine', async ({ page }) => {
  await boot(page, { fast: 4 });
  await slide(page, -1);
  await waitPhase(page, 'traverse');
  // opposite input mid-traverse: the interlocked handle only jiggles
  await slide(page, 1);
  let s = await state(page);
  expect(s.phase).not.toBe('command');
  expect(Math.abs(s.lever - -1)).toBeLessThan(0.35);
  // rapid taps everywhere
  for (let i = 0; i < 8; i++) await page.mouse.click(60 + i * 40, 300 + (i % 3) * 90);
  s = await state(page);
  expect(['traverse', 'locking', 'signal', 'train']).toContain(s.phase);
  // the run still completes exactly once
  await waitPhase(page, 'train', 90_000);
  s = await state(page);
  expect(s.runCount).toBe(1);
  expect(s.t).toBeLessThan(0.01);
});

test('interrupted drags leave the machine in a sane state', async ({ page }) => {
  await boot(page);
  const vp = page.viewportSize()!;
  // start a drag, wander, abandon mid-screen
  await page.mouse.move(vp.width / 2, vp.height / 2);
  await page.mouse.down();
  await page.mouse.move(vp.width * 0.3, vp.height * 0.45, { steps: 6 });
  await page.mouse.move(vp.width * 0.42, vp.height * 0.6, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  const s = await state(page);
  expect(s.phase).toBe('idle');
  expect(Math.abs(s.lever)).toBeGreaterThan(0.9); // parked on a detent
  expect(s.t).toBeGreaterThan(0.99); // girders untouched
});

test('rotation mid-traverse preserves the switch state', async ({ page }) => {
  await boot(page, { fast: 2 });
  await slide(page, -1);
  await waitPhase(page, 'traverse');
  await page.waitForFunction(() => (window as any).__mono.t < 0.8);
  const before = await state(page);
  await page.setViewportSize({ width: 844, height: 390 }); // rotate to landscape
  await page.waitForTimeout(400);
  const after = await state(page);
  expect(['traverse', 'locking']).toContain(after.phase);
  expect(after.t).toBeLessThanOrEqual(before.t + 0.001);
  await page.setViewportSize({ width: 390, height: 844 }); // and back
  await page.waitForFunction(() => ['signal', 'train', 'idle'].includes((window as any).__mono.phase), null, { timeout: 90_000 });
  const done = await state(page);
  expect(done.lockedSide).toBe('straight');
});

test('background/foreground cycle does not jump the simulation', async ({ page }) => {
  await boot(page, { fast: 2 });
  await slide(page, -1);
  await waitPhase(page, 'traverse');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(300);
  const s = await state(page);
  expect(s.t).toBeGreaterThanOrEqual(0);
  expect(s.t).toBeLessThanOrEqual(1);
  await page.waitForFunction(() => ['signal', 'train', 'idle'].includes((window as any).__mono.phase), null, { timeout: 90_000 });
});
