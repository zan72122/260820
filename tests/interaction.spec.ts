import { test, expect, type Page } from '@playwright/test';

/**
 * Real pointer-path tests: dragging the letter with a finger-like gesture,
 * pressing the valve wheel, swiping to the next pair.
 */

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?e2e');
  await page.waitForFunction(() => !!window.__kc);
  await page.evaluate(() => {
    window.__kc!.pause();
  });
  return errors;
}

test('dragging the letter on screen changes the spacing 1:1', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const errors = await boot(page);
  await page.evaluate(() => window.__kc!.step(16)); // demo completes, adjust/result reachable

  const before = await page.evaluate(() => window.__kc!.state().spacing);
  const pos = await page.evaluate(() => window.__kc!.letterScreenPos());
  await page.mouse.move(pos.x, pos.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(pos.x - i * 12, pos.y, { steps: 1 });
  }
  await page.mouse.up();
  const after = await page.evaluate(() => window.__kc!.state().spacing);
  expect(after).toBeLessThan(before - 0.2); // moved left by a real amount

  expect(errors).toEqual([]);
});

test('valve wheel press starts a test; swipe advances after clearing', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const errors = await boot(page);
  await page.evaluate(() => window.__kc!.step(16));

  // put the pair into the good range, then press the physical valve control
  await page.evaluate(() => window.__kc!.setSpacing(-0.08));
  await page.locator('button[aria-label="water valve"]').dispatchEvent('pointerdown');
  await page.evaluate(() => window.__kc!.step(0.2));
  let s = await page.evaluate(() => window.__kc!.state());
  expect(s.phase).toBe('test');
  await page.evaluate(() => window.__kc!.step(14));
  s = await page.evaluate(() => window.__kc!.state());
  expect(s.outcome).toBe('captured');
  expect(s.cleared).toBe(true);

  // horizontal swipe on empty canvas advances to the next pair
  await page.mouse.move(600, 120);
  await page.mouse.down();
  await page.mouse.move(420, 124, { steps: 6 });
  await page.mouse.up();
  await page.evaluate(() => window.__kc!.step(8));
  s = await page.evaluate(() => window.__kc!.state());
  expect(s.pairId).toBe('OO');

  expect(errors).toEqual([]);
});
