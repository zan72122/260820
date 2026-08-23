/**
 * Chromium smoke E2E — cloud profile: chromium only, workers=1, retries=1,
 * deterministic logical stepping via window.__lab (no FPS judgements under
 * SwiftShader).
 */
import { test, expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    __lab: {
      currentStation(): string;
      completed(): Record<string, boolean>;
      freeMode(): boolean;
      setAxis(v: number): void;
      getAxis(): number;
      pullLever(): boolean;
      loadBall(kind: string): void;
      gotoStation(i: number): void;
      ballStatus(): string;
      ballPosition(): { x: number; y: number; z: number } | null;
      measure(): Record<string, number>;
      screenPos(kind: 'handle' | 'lever'): { x: number; y: number };
      step(seconds: number): void;
      errors: string[];
    };
  }
}

const VIEWPORTS = [
  { name: 'iphone-portrait', width: 390, height: 844 },
  { name: 'iphone-landscape', width: 844, height: 390 },
  { name: 'ipad-portrait', width: 1024, height: 1366 },
  { name: 'ipad-landscape', width: 1366, height: 1024 },
];

async function boot(page: Page) {
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => window.__lab !== undefined, { timeout: 20000 });
  await page.waitForTimeout(400);
  return consoleErrors;
}

for (const vp of VIEWPORTS) {
  test(`full lab loop at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const consoleErrors = await boot(page);

    // --- Station O: fat O rejects the ball, thin O passes it -------------
    expect(await page.evaluate(() => window.__lab.currentStation())).toBe('O');
    expect(await page.evaluate(() => window.__lab.measure().counterD)).toBeLessThan(0.3);
    await page.evaluate(() => {
      window.__lab.pullLever();
      window.__lab.step(3);
    });
    expect(await page.evaluate(() => window.__lab.ballStatus())).toBe('blocked');
    await page.evaluate(() => {
      window.__lab.setAxis(0.1);
      window.__lab.step(4); // ball returns to the feeder
      window.__lab.pullLever();
      window.__lab.step(3);
    });
    expect(await page.evaluate(() => window.__lab.ballStatus())).toBe('passed');
    expect(await page.evaluate(() => window.__lab.completed().O)).toBe(true);

    // --- Station C: narrow blocks at the mouth, wide lets it loop --------
    await page.evaluate(() => {
      window.__lab.gotoStation(1);
      window.__lab.step(1);
    });
    await page.evaluate(() => {
      window.__lab.pullLever();
      window.__lab.step(3);
    });
    expect(await page.evaluate(() => window.__lab.ballStatus())).toBe('blocked');
    await page.evaluate(() => {
      window.__lab.step(2);
      window.__lab.setAxis(0.85);
      window.__lab.pullLever();
      window.__lab.step(5);
    });
    expect(await page.evaluate(() => window.__lab.ballStatus())).toBe('passed');

    // --- Station I: straight holds the ball, slant rolls it --------------
    await page.evaluate(() => {
      window.__lab.gotoStation(2);
      window.__lab.step(1);
      window.__lab.pullLever();
      window.__lab.step(2);
    });
    expect(await page.evaluate(() => window.__lab.ballStatus())).toBe('restCenter');
    await page.evaluate(() => {
      window.__lab.setAxis(-0.8);
      window.__lab.step(3);
    });
    expect(await page.evaluate(() => window.__lab.ballStatus())).toBe('restLeft');

    // --- free experiment unlocked ----------------------------------------
    await page.evaluate(() => window.__lab.step(4));
    expect(await page.evaluate(() => window.__lab.freeMode())).toBe(true);

    // a different ball changes the O result at the same weight
    await page.evaluate(() => {
      window.__lab.gotoStation(0);
      window.__lab.step(1);
      window.__lab.setAxis(0.8);
      window.__lab.loadBall('wood');
      window.__lab.pullLever();
      window.__lab.step(3);
    });
    expect(await page.evaluate(() => window.__lab.ballStatus())).toBe('passed');

    // --- no console errors, no api-captured errors ------------------------
    const apiErrors = await page.evaluate(() => window.__lab.errors);
    expect(apiErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
}

test('one-finger drag on the physical handle drives the axis', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await boot(page);
  await page.waitForTimeout(800); // let the camera settle
  const before = await page.evaluate(() => window.__lab.getAxis());
  const pos = await page.evaluate(() => window.__lab.screenPos('handle'));
  await page.mouse.move(pos.x, pos.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(pos.x + i * 14, pos.y, { steps: 1 });
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  const after = await page.evaluate(() => window.__lab.getAxis());
  expect(after).toBeLessThan(before - 0.2);
});

test('rotation keeps axis value and ball position', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  await page.evaluate(() => {
    window.__lab.setAxis(0.37);
    window.__lab.pullLever();
    window.__lab.step(3);
  });
  const before = await page.evaluate(() => ({
    axis: window.__lab.getAxis(),
    ball: window.__lab.ballPosition(),
    status: window.__lab.ballStatus(),
  }));
  await page.setViewportSize({ width: 844, height: 390 }); // rotate
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({
    axis: window.__lab.getAxis(),
    ball: window.__lab.ballPosition(),
    status: window.__lab.ballStatus(),
  }));
  expect(after.axis).toBeCloseTo(before.axis, 5);
  expect(after.status).toBe(before.status);
  expect(after.ball!.x).toBeCloseTo(before.ball!.x, 4);
  expect(after.ball!.y).toBeCloseTo(before.ball!.y, 4);
});
