import { test, expect } from '@playwright/test';
import { boot, state, slide, waitPhase, setSpeed } from './helpers';

test('opening screen is wordless: no text UI, no buttons, no menus', async ({ page }) => {
  await boot(page);
  const text = await page.evaluate(() => document.body.innerText.trim());
  expect(text).toBe('');
  expect(await page.locator('button, a, input, select').count()).toBe(0);
  // one canvas, filling the screen
  expect(await page.locator('canvas').count()).toBe(1);
  const s = await state(page);
  expect(s.phase).toBe('idle');
  expect(s.lockedSide).toBe('curve'); // straight route visibly broken at open
});

test('first slide runs the full causal chain and the train takes the new route', async ({ page }) => {
  await boot(page, { fast: 3 });
  // slide towards the straight route
  await slide(page, -1);
  let s = await state(page);
  expect(['command', 'traverse']).toContain(s.phase);
  expect(s.lever).toBeLessThan(-0.9);

  // unlock happens before any girder movement
  await page.waitForFunction(() => (window as any).__mono.lockExt < 0.1);
  s = await state(page);
  expect(s.t).toBeGreaterThan(0.98); // girders have not moved yet while unlocking

  // girders traverse 1 -> 0
  await waitPhase(page, 'traverse');
  await page.waitForFunction(() => (window as any).__mono.t < 0.5);
  // lock cylinders re-seat
  await waitPhase(page, 'locking');
  await page.waitForFunction(() => (window as any).__mono.lockExt > 0.95);
  // signal, then the waiting train departs and crosses
  await waitPhase(page, 'train');
  s = await state(page);
  expect(s.lockedSide).toBe('straight');
  expect(s.t).toBeLessThan(0.01);
  // the train eventually clears; play returns without any result screen
  await waitPhase(page, 'idle', 90_000);
  s = await state(page);
  expect(s.runCount).toBe(1);
  expect(s.firstRunDone).toBe(true);
});

test('immediately reversible: second slide converts back with no train waiting', async ({ page }) => {
  await boot(page, { fast: 4 });
  await slide(page, -1);
  await waitPhase(page, 'train');
  await waitPhase(page, 'idle', 90_000);
  // straight is locked; go back to the curve
  await slide(page, 1);
  await waitPhase(page, 'traverse');
  await page.waitForFunction(() => (window as any).__mono.t > 0.5);
  await page.waitForFunction(() => ['signal', 'train', 'idle'].includes((window as any).__mono.phase), null, { timeout: 90_000 });
  const s = await state(page);
  expect(s.lockedSide).toBe('curve');
});

test('staged hints: device stir, then a gloved hand, then a track whisper', async ({ page }) => {
  await boot(page, { fast: 3 });
  await page.waitForFunction(() => (window as any).__mono.hint === 1, null, { timeout: 20_000 });
  await page.waitForFunction(() => (window as any).__mono.hint === 2, null, { timeout: 30_000 });
  await page.waitForFunction(() => (window as any).__mono.hint === 3, null, { timeout: 30_000 });
  // a touch cancels hints instantly
  await page.mouse.click(200, 400);
  const s = await state(page);
  expect(s.hint).toBe(0);
});

test('vehicle path and beam state can never disagree: lock precedes train', async ({ page }) => {
  await boot(page, { fast: 4 });
  await slide(page, -1);
  // while anything is moving, no train may be inside the switch zone
  for (let i = 0; i < 40; i++) {
    const s = await state(page);
    if (s.phase === 'traverse' || s.phase === 'command' || s.phase === 'locking') {
      expect(s.occupied).toBe(false);
    }
    if (s.phase === 'train') break;
    await page.waitForTimeout(250);
  }
  await waitPhase(page, 'train');
  const s = await state(page);
  expect(s.lockExt).toBeGreaterThan(0.95); // seated before entry
});
