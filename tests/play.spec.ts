import { expect, test } from '@playwright/test';
import { act, anchors, boot, carryToCake, drag, petalStroke, pipeFlower, press, stats } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

test('the piping tip is drawn above the finger, never under it', async ({ page }) => {
  await boot(page);
  const a0 = await anchors(page);
  await drag(page, a0.parchment, a0.nail);
  await page.waitForTimeout(500);
  await press(page, (await anchors(page)).nail, 2600);
  expect(await act(page)).toBe('petals');

  const probe = await page.evaluate(async () => {
    const g = window.__game;
    const start = g.anchors().nail;
    g.pointer('down', start.x, start.y);
    for (let i = 0; i < 12; i++) {
      g.pointer('move', start.x + i, start.y);
      await new Promise((r) => setTimeout(r, 60));
    }
    const tip = g.anchors().tip;
    const finger = { x: start.x + 11, y: start.y };
    g.pointer('up', finger.x, finger.y);
    return { finger: finger.y, tip: tip.y };
  });
  const lift = probe.finger - probe.tip;
  expect(lift).toBeGreaterThan(40);
  expect(lift).toBeLessThan(75);
});

test('cream only flows while the finger is down', async ({ page }) => {
  await boot(page);
  const a = await anchors(page);
  await page.evaluate((p) => window.__game.pointer('down', (p as { x: number }).x, (p as { y: number }).y), a.parchment);
  await page.evaluate((p) => window.__game.pointer('up', (p as { x: number }).x, (p as { y: number }).y), a.nail);
  await page.waitForTimeout(600);
  await press(page, (await anchors(page)).nail, 1200);
  const grown = (await stats(page)).coneHeight;
  expect(grown).toBeGreaterThan(0.004);
  await page.waitForTimeout(1200);
  expect((await stats(page)).coneHeight).toBeCloseTo(grown, 4);
});

test('petals survive an orientation change', async ({ page }) => {
  await boot(page);
  await pipeFlower(page, 5);
  const before = await stats(page);
  const sigBefore = await page.evaluate(() => window.__game.flowerSignature);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(700);
  const after = await stats(page);
  const sigAfter = await page.evaluate(() => window.__game.flowerSignature);
  expect(after.petals).toBe(before.petals);
  expect(sigAfter.hash).toBe(sigBefore.hash);
  expect(sigAfter.samples).toBeGreaterThan(0);
});

test('a second flower in the same colour is never identical', async ({ page }) => {
  const errors = await boot(page, 777);
  await pipeFlower(page, 7);
  if ((await act(page)) === 'petals') await page.click('.done');
  await carryToCake(page);
  expect(await act(page)).toBe('done');
  const first = await page.evaluate(() => window.__game.flowerSignature);

  // "same colour again" is the left choice
  await page.click('.choices button[data-same="1"]');
  await page.waitForTimeout(600);
  expect(await act(page)).toBe('core');

  await press(page, (await anchors(page)).nail, 2400);
  for (let i = 0; i < 7; i++) {
    const a = await anchors(page);
    await petalStroke(page, a.nail, 36 + Math.min(2, Math.floor(i / 3)) * 14);
    if ((await act(page)) !== 'petals') break;
  }
  const second = await page.evaluate(() => window.__game.flowerSignature);
  expect(second.samples).toBeGreaterThan(0);
  expect(second.hash).not.toBe(first.hash);
  expect(errors).toEqual([]);
});
