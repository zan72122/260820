import { test, expect, Page } from '@playwright/test';

/**
 * One full loop of work, driven through the game's own debug surface so
 * the simulation can be advanced without waiting in real time.
 */

interface DebugState {
  state: string;
  fill: number;
  bales: number;
  standing: number;
  speed: number;
  gate: number;
  wrap: number;
  chamberRadius: number;
  fieldBales: number;
  pos: { x: number; y: number; z: number };
}

declare global {
  interface Window {
    __game: {
      debugState(): DebugState;
      testHold(v: boolean): void;
      testSwipeUp(): void;
      advance(s: number): void;
      testFastForward(s: number): void;
      testResumeLoop(): void;
      begin(): void;
    };
  }
}

async function boot(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?fast=1');
  await page.waitForFunction(() => !!window.__game, null, { timeout: 40_000 });
  return errors;
}

async function step(page: Page, seconds: number) {
  await page.evaluate((s) => window.__game.advance(s), seconds);
}

async function state(page: Page): Promise<DebugState> {
  return page.evaluate(() => window.__game.debugState());
}

test('boots, shows the title and starts on tap', async ({ page }) => {
  const errors = await boot(page);
  expect((await state(page)).state).toBe('title');
  await page.locator('#start').dispatchEvent('pointerdown');
  await page.waitForFunction(() => window.__game.debugState().state === 'drive');
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('a full cycle: harvest -> roll grows -> wrap -> eject a bale', async ({ page }) => {
  const errors = await boot(page);
  await page.locator('#start').dispatchEvent('pointerdown');
  await page.evaluate(() => window.__game.testHold(true));

  const r0 = (await state(page)).chamberRadius;

  // drive until the chamber is full
  let s = await state(page);
  for (let i = 0; i < 90 && s.fill < 1; i++) {
    await step(page, 1);
    s = await state(page);
  }
  expect(s.fill, 'chamber should fill while driving').toBeCloseTo(1, 2);
  expect(s.chamberRadius, 'the roll must physically grow').toBeGreaterThan(r0 + 0.2);
  expect(s.standing, 'rice must actually disappear').toBeLessThan(1);

  // wrap + tailgate + eject, all of which self-advance if untouched
  for (let i = 0; i < 60 && (await state(page)).bales < 1; i++) {
    await step(page, 1);
  }
  s = await state(page);
  expect(s.bales, 'a bale should have been ejected').toBeGreaterThanOrEqual(1);
  expect(s.fieldBales, 'the bale must exist in the paddy').toBeGreaterThanOrEqual(1);

  // and the machine goes back to work
  for (let i = 0; i < 40 && (await state(page)).state !== 'drive'; i++) {
    await step(page, 0.5);
  }
  expect((await state(page)).state).toBe('drive');
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('two bales back to back, no dead end', async ({ page }) => {
  const errors = await boot(page);
  await page.locator('#start').dispatchEvent('pointerdown');
  await page.evaluate(() => window.__game.testHold(true));
  for (let i = 0; i < 260 && (await state(page)).bales < 2; i++) {
    await step(page, 1);
  }
  const s = await state(page);
  expect(s.bales).toBeGreaterThanOrEqual(2);
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('landscape renders and stays playable', async ({ page }) => {
  const errors = await boot(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator('#start').dispatchEvent('pointerdown');
  await page.evaluate(() => window.__game.testHold(true));
  await step(page, 12);
  const s = await state(page);
  expect(s.state === 'drive' || s.state === 'full' || s.state === 'uturn').toBeTruthy();
  expect(s.standing).toBeLessThan(1);
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('the roll grows monotonically and resets after each bale', async ({ page }) => {
  const errors = await boot(page);
  await page.locator('#start').dispatchEvent('pointerdown');
  await page.evaluate(() => window.__game.testHold(true));

  let last = (await state(page)).chamberRadius;
  let grew = 0;
  for (let i = 0; i < 60; i++) {
    await step(page, 0.5);
    const s = await state(page);
    if (s.state !== 'drive') break;
    expect(s.chamberRadius, 'the roll must never shrink while harvesting')
      .toBeGreaterThanOrEqual(last - 1e-6);
    if (s.chamberRadius > last + 1e-4) grew++;
    last = s.chamberRadius;
  }
  expect(grew, 'the roll should visibly fatten many times over').toBeGreaterThan(8);

  // after the bale leaves, a fresh small one starts
  for (let i = 0; i < 60 && (await state(page)).bales < 1; i++) await step(page, 1);
  for (let i = 0; i < 30 && (await state(page)).state !== 'drive'; i++) await step(page, 0.5);
  const after = await state(page);
  expect(after.chamberRadius).toBeLessThan(0.3);
  expect(after.wrap).toBe(0);
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('a whole paddy can be cleared and replants itself', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await boot(page);
  await page.locator('#start').dispatchEvent('pointerdown');
  await page.evaluate(() => window.__game.testHold(true));

  let cleared = false;
  let minStanding = 1;
  for (let i = 0; i < 220; i++) {
    await page.evaluate(() => window.__game.testFastForward(3));
    const s = await state(page);
    minStanding = Math.min(minStanding, s.standing);
    if (s.state === 'cleared') { cleared = true; }
    // once it has replanted, the crop is back and work continues
    if (cleared && s.standing > 0.9 && s.state === 'drive') break;
  }
  expect(minStanding, 'the paddy should get harvested right down').toBeLessThan(0.05);
  expect(cleared, 'clearing the paddy should be celebrated').toBeTruthy();
  const s = await state(page);
  expect(s.standing, 'and then a fresh paddy is planted').toBeGreaterThan(0.9);
  await page.evaluate(() => window.__game.testResumeLoop());
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('the wrap and tailgate advance on their own if nobody presses', async ({ page }) => {
  const errors = await boot(page);
  await page.locator('#start').dispatchEvent('pointerdown');
  await page.evaluate(() => window.__game.testHold(true));
  for (let i = 0; i < 90 && (await state(page)).state !== 'full'; i++) await step(page, 1);
  expect((await state(page)).state).toBe('full');
  // release the finger: from here on nothing at all is pressed
  await page.evaluate(() => window.__game.testHold(false));
  const seen = new Set<string>();
  for (let i = 0; i < 120; i++) {
    await step(page, 0.5);
    const s = await state(page);
    seen.add(s.state);
    if (s.bales >= 1 && s.state === 'drive') break;
  }
  expect([...seen]).toEqual(expect.arrayContaining(['wrap', 'gate', 'eject']));
  expect((await state(page)).bales).toBeGreaterThanOrEqual(1);
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('plays a whole cycle through real touches: hold, drag, tap, swipe up', async ({ page }) => {
  const errors = await boot(page);
  const box = (await page.locator('#scene').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height * 0.75;

  await page.locator('#start').dispatchEvent('pointerdown');
  await page.waitForFunction(() => window.__game.debugState().state === 'drive');

  // a finger goes down and stays down: the machine must pull away
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await step(page, 1.5);
  expect((await state(page)).speed, 'holding drives the machine').toBeGreaterThan(1);

  // sliding sideways must move it onto another row
  const x0 = (await state(page)).pos.x;
  await page.mouse.move(cx + box.width * 0.3, cy, { steps: 4 });
  await step(page, 2.5);
  expect(Math.abs((await state(page)).pos.x - x0), 'dragging steers').toBeGreaterThan(0.6);
  await page.mouse.move(cx, cy, { steps: 4 });

  for (let i = 0; i < 90 && (await state(page)).state !== 'full'; i++) await step(page, 0.5);
  expect((await state(page)).state).toBe('full');
  await page.mouse.up();

  // the big button appears a beat after the camera settles
  await step(page, 1.0);
  await expect(page.locator('#action')).toHaveClass(/show/);
  await page.locator('#action').dispatchEvent('pointerdown');
  await step(page, 0.2);
  expect((await state(page)).state).toBe('wrap');
  for (let i = 0; i < 40 && (await state(page)).state !== 'gate'; i++) await step(page, 0.5);
  expect((await state(page)).state).toBe('gate');

  // an upward flick opens the back
  await page.mouse.move(cx, box.y + box.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(cx, box.y + box.height * 0.4, { steps: 6 });
  await page.mouse.up();
  await step(page, 0.2);
  expect((await state(page)).state, 'a swipe up opens the tailgate').toBe('eject');

  for (let i = 0; i < 60 && (await state(page)).bales < 1; i++) await step(page, 0.5);
  expect((await state(page)).bales).toBeGreaterThanOrEqual(1);
  expect((await state(page)).gate, 'the tailgate actually swung open').toBeGreaterThan(0.8);
  expect(errors, errors.join('\n')).toHaveLength(0);
});
