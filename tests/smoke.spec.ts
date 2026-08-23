import { test, expect, Page } from '@playwright/test';

// Chromium smoke E2E (cloud profile: SwiftShader, 1 worker).
// Uses the invisible __SAM__ hooks plus real pointer drags.

declare global {
  interface Window {
    __SAM__: {
      state(): {
        state: string; stationIndex: number; letter: string | null;
        tableAngle: number; lightY: number; solved: boolean;
        solvedTable: boolean; leverUnlocked: boolean; closeness: number;
        cameraMode: string;
      };
      setTableAngle(r: number): void;
      setLever(y: number): void;
      wheel(d: number): void;
      solveActive(): void;
      swipe(): void;
      goto(i: number): Promise<void>;
      snapCamera(): void;
      snapFront(): void;
      snapReveal(): void;
      lettersReady(): boolean;
      drawCalls(): number;
    };
  }
}

async function boot(page: Page, path = '/?e2e=1'): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(path, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__SAM__ !== undefined, null, { timeout: 20000 });
  await page.waitForTimeout(800);
  return errors;
}

test('loads clean and renders the letter A machine', async ({ page }) => {
  const errors = await boot(page);
  expect(await page.locator('canvas').count()).toBe(1);
  const s = await page.evaluate(() => window.__SAM__.state());
  expect(s.letter).toBe('A');
  expect(Math.abs(s.tableAngle + 1.08)).toBeLessThan(0.01);
  expect(errors).toEqual([]);
});

test('a real one-finger drag turns the turntable', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => window.__SAM__.snapCamera());
  await page.waitForTimeout(300);
  const before = (await page.evaluate(() => window.__SAM__.state())).tableAngle;
  // drag across the lower part of the view (generous wheel fallback zone)
  await page.mouse.move(120, 700);
  await page.mouse.down();
  for (let x = 120; x <= 330; x += 15) {
    await page.mouse.move(x, 700);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);
  const after = (await page.evaluate(() => window.__SAM__.state())).tableAngle;
  expect(Math.abs(after - before)).toBeGreaterThan(0.01);
  expect(errors).toEqual([]);
});

test('wheel input drives A into its detent and the letter completes', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => window.__SAM__.snapCamera());
  // crank the wheel toward the solution through the input path
  // (closed-loop: the physical angle lags the wheel under slow headless RAF)
  for (let i = 0; i < 90; i++) {
    const s = await page.evaluate(() => window.__SAM__.state());
    if (s.solved || Math.abs(s.tableAngle) < 0.05) break;
    const d = Math.max(-0.15, Math.min(0.15, -s.tableAngle * 3.2 * 0.25));
    await page.evaluate((dd) => window.__SAM__.wheel(dd), d);
    await page.waitForTimeout(120);
  }
  await page.waitForFunction(() => window.__SAM__.state().solved, null, { timeout: 30000 });
  const s = await page.evaluate(() => window.__SAM__.state());
  expect(s.letter).toBe('A');
  expect(Math.abs(s.tableAngle)).toBeLessThan(0.01);
  expect(errors).toEqual([]);
});

test('full loop: A -> swipe -> Q -> H two-stage -> replay', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await boot(page);
  await page.evaluate(() => window.__SAM__.solveActive());
  await page.waitForFunction(() => window.__SAM__.state().state === 'awaitSwipe', null, { timeout: 90000 });
  await page.evaluate(() => window.__SAM__.swipe());
  await page.waitForFunction(() => window.__SAM__.state().state === 'operate', null, { timeout: 60000 });
  let s = await page.evaluate(() => window.__SAM__.state());
  expect(s.stationIndex).toBe(1);
  expect(s.letter).toBe('Q');
  // Q solves by rotation alone
  await page.evaluate(() => window.__SAM__.solveActive());
  await page.waitForFunction(() => window.__SAM__.state().solved, null, { timeout: 30000 });

  // H: table first, then the lever unlocks and the lamp height finishes it
  await page.evaluate(() => window.__SAM__.goto(2));
  await page.waitForTimeout(400);
  s = await page.evaluate(() => window.__SAM__.state());
  expect(s.letter).toBe('H');
  expect(s.leverUnlocked).toBe(false);
  // lever is mechanically locked before the table seats
  await page.evaluate(() => window.__SAM__.state());
  const lyBefore = s.lightY;
  await page.evaluate(() => window.__SAM__.wheel(0.01)); // touch input path alive
  await page.evaluate(() => window.__SAM__.setTableAngle(0.002));
  await page.waitForFunction(
    () => window.__SAM__.state().solvedTable && window.__SAM__.state().leverUnlocked,
    null, { timeout: 30000 },
  );
  s = await page.evaluate(() => window.__SAM__.state());
  expect(s.solved).toBe(false);
  expect(Math.abs(s.lightY - lyBefore)).toBeLessThan(0.06); // lamp untouched so far
  await page.evaluate(() => window.__SAM__.setLever(1.425));
  await page.waitForFunction(() => window.__SAM__.state().solved, null, { timeout: 30000 });

  // replay wraps to a re-scrambled A
  await page.waitForFunction(() => window.__SAM__.state().state === 'awaitSwipe', null, { timeout: 90000 });
  await page.evaluate(() => window.__SAM__.swipe());
  await page.waitForFunction(
    () => window.__SAM__.state().state === 'operate' && window.__SAM__.state().stationIndex === 0,
    null, { timeout: 60000 },
  );
  s = await page.evaluate(() => window.__SAM__.state());
  expect(s.letter).toBe('A');
  expect(s.solved).toBe(false);
  expect(Math.abs(s.tableAngle + 1.08)).toBeLessThan(0.01);
  expect(errors).toEqual([]);
});

test('rotation to landscape preserves machine state', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => window.__SAM__.setTableAngle(-0.5));
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(600);
  const s = await page.evaluate(() => window.__SAM__.state());
  expect(Math.abs(s.tableAngle + 0.5)).toBeLessThan(0.02);
  expect(s.lightY).toBeCloseTo(1.5, 2);
  expect(errors).toEqual([]);
});

test('render cost stays sane', async ({ page }) => {
  const errors = await boot(page);
  const calls = await page.evaluate(() => window.__SAM__.drawCalls());
  expect(calls).toBeGreaterThan(50);
  expect(calls).toBeLessThan(700);
  expect(errors).toEqual([]);
});
