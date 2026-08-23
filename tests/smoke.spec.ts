import { test, expect, Page } from '@playwright/test';

/**
 * Smoke E2E: walks the whole casting loop with the deterministic driver
 * (same code paths as touch gestures), checks phase causality, letter
 * switching, rotation survival and console cleanliness.
 */

declare global {
  interface Window {
    __LF: {
      phase(): string; letter(): string; fill(): number; temp(): number;
      press(): number; islands(): number; errors(): string[];
      align(): void; pressDown(): void; leverUp(): void; brushAll(): void;
      pourAll(): void; openFlask(): void; pick(l: string): void;
    };
  }
}

async function boot(page: Page, w: number, h: number) {
  const consoleErrors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  await page.setViewportSize({ width: w, height: h });
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => !!window.__LF);
  return consoleErrors;
}

async function waitPhase(page: Page, phase: string, timeout = 20000) {
  await page.waitForFunction((p) => window.__LF.phase() === p, phase, { timeout });
}

async function runFullCycle(page: Page) {
  await waitPhase(page, 'ALIGN');
  await page.evaluate(() => window.__LF.align());
  await waitPhase(page, 'PRESS');
  await page.evaluate(() => window.__LF.pressDown());
  await waitPhase(page, 'RAISE');
  // the sand must be fully pressed before the pattern comes back up
  expect(await page.evaluate(() => window.__LF.press())).toBeGreaterThan(0.95);
  await page.evaluate(() => window.__LF.leverUp());
  await waitPhase(page, 'BRUSH');
  await page.evaluate(() => window.__LF.brushAll());
  await waitPhase(page, 'POUR');
  await page.evaluate(() => window.__LF.pourAll());
  // metal fills while held
  await page.waitForFunction(() => window.__LF.fill() >= 1, undefined, { timeout: 15000 });
  await waitPhase(page, 'COOL');
  await waitPhase(page, 'BREAK');
  await page.evaluate(() => window.__LF.openFlask());
  await waitPhase(page, 'REVEAL');
  await waitPhase(page, 'DONE');
}

test('O cycle end-to-end, then A via the letter rack', async ({ page }) => {
  const errors = await boot(page, 390, 844);
  expect(await page.evaluate(() => window.__LF.letter())).toBe('O');
  expect(await page.evaluate(() => window.__LF.islands())).toBe(1);
  await runFullCycle(page);

  // second letter: A (1 triangular island)
  await page.evaluate(() => window.__LF.pick('A'));
  await waitPhase(page, 'ALIGN');
  expect(await page.evaluate(() => window.__LF.letter())).toBe('A');
  expect(await page.evaluate(() => window.__LF.islands())).toBe(1);
  await runFullCycle(page);

  expect(errors).toEqual([]);
  expect(await page.evaluate(() => window.__LF.errors())).toEqual([]);
});

test('B has two islands, C has none', async ({ page }) => {
  await boot(page, 844, 390);
  await waitPhase(page, 'ALIGN');
  await runFullCycle(page);
  await page.evaluate(() => window.__LF.pick('B'));
  await waitPhase(page, 'ALIGN');
  expect(await page.evaluate(() => window.__LF.islands())).toBe(2);
  await runFullCycle(page);
  await page.evaluate(() => window.__LF.pick('C'));
  await waitPhase(page, 'ALIGN');
  expect(await page.evaluate(() => window.__LF.islands())).toBe(0);
  await runFullCycle(page);
});

test('carriage and press lever work via real pointer gestures', async ({ page }) => {
  await boot(page, 390, 844);
  await waitPhase(page, 'ALIGN');
  // drag left across the middle of the screen: carriage slides over the flask
  await page.mouse.move(330, 420);
  await page.mouse.down();
  await page.mouse.move(30, 420, { steps: 30 });
  await page.mouse.up();
  await waitPhase(page, 'PRESS', 15000);
  // vertical drag down: lever pulls, pattern presses into the sand
  await page.mouse.move(195, 180);
  await page.mouse.down();
  await page.mouse.move(195, 800, { steps: 45 });
  await page.mouse.up();
  await waitPhase(page, 'RAISE', 15000);
  expect(await page.evaluate(() => window.__LF.press())).toBeGreaterThan(0.9);
});

test('rotation mid-process keeps the phase', async ({ page }) => {
  await boot(page, 390, 844);
  await waitPhase(page, 'ALIGN');
  await page.evaluate(() => window.__LF.align());
  await waitPhase(page, 'PRESS');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__LF.phase())).toBe('PRESS');
  await page.evaluate(() => window.__LF.pressDown());
  await waitPhase(page, 'RAISE');
  await page.setViewportSize({ width: 1366, height: 1024 });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__LF.phase())).toBe('RAISE');
});
