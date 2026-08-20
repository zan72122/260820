import { expect, test } from '@playwright/test';
import { boot, drag, record } from './helpers';
import type { Page } from '@playwright/test';

type Api = {
  currentStage: string;
  debugState(): Record<string, unknown>;
  onScreen(w: 'switch' | 'nebuta' | 'hand'): { x: number; y: number; inside: boolean };
  jumpTo(s: string): void;
  traceAllInk(): void;
  applyAllWax(): void;
  floodDye(i: number): void;
};

const read = (page: Page) =>
  page.evaluate(() => (window as never as { __nebuta: Api }).__nebuta.debugState());
const stageOf = (page: Page) =>
  page.evaluate(() => (window as never as { __nebuta: Api }).__nebuta.currentStage);
const at = (page: Page, what: 'switch' | 'nebuta' | 'hand') =>
  page.evaluate((w) => (window as never as { __nebuta: Api }).__nebuta.onScreen(w as never), what);

async function waitForStage(page: Page, name: string, timeout = 60_000): Promise<void> {
  await page.waitForFunction(
    (n) => (window as never as { __nebuta: Api }).__nebuta.currentStage === n,
    name,
    { timeout },
  );
}

test('rotate, light up, pull, turn, come back and play again', async ({ page }) => {
  test.setTimeout(300_000);
  const rec = record(page);
  await boot(page);

  await page.evaluate(() => {
    const g = (window as never as { __nebuta: Api }).__nebuta;
    g.jumpTo('dye');
    g.traceAllInk();
    g.applyAllWax();
    g.floodDye(0);
    g.jumpTo('lightUp');
  });
  await page.waitForTimeout(2500);

  /* --- turn the device over and back ------------------------------------- */
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(2200);
  let s = await read(page);
  expect(s.layout).toBe('phone-landscape');
  expect((await at(page, 'switch')).inside, 'switch is reachable in landscape').toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(2200);
  s = await read(page);
  expect(s.layout).toBe('phone-portrait');
  const sw = await at(page, 'switch');
  expect(sw.inside, 'switch is reachable in portrait').toBe(true);

  /* --- the switch --------------------------------------------------------- */
  await page.mouse.click(sw.x, sw.y);
  await page.waitForTimeout(900);
  s = await read(page);
  expect(s.lampsOn, 'the lamps came on').toBe(true);

  // the moment itself must be nothing but the nebuta: no bubbles, no buttons, no confetti
  const uiOpacity = await page.evaluate(() => getComputedStyle(document.getElementById('ui')!).opacity);
  expect(Number(uiOpacity), 'the interface is out of the way').toBeLessThan(0.35);

  await waitForStage(page, 'parade', 90_000);
  s = await read(page);
  expect(Number(s.lampMaster), 'the lamps are fully up by the parade').toBeGreaterThan(0.6);

  /* --- turn them off and on again ---------------------------------------- */
  const sw2 = await at(page, 'switch');
  await page.mouse.click(sw2.x, sw2.y);
  await page.waitForTimeout(1400);
  expect((await read(page)).lampsOn, 'the switch turns them off too').toBe(false);
  const sw3 = await at(page, 'switch');
  await page.mouse.click(sw3.x, sw3.y);
  await page.waitForTimeout(1400);
  expect((await read(page)).lampsOn, 'and back on').toBe(true);

  /* --- pull the rope ------------------------------------------------------ */
  const size = page.viewportSize()!;
  const before = (await read(page)).cart as { x: number; z: number; yaw: number };
  for (let i = 0; i < 3; i++) {
    await drag(page, [size.width * 0.5, size.height * 0.82], [size.width * 0.5, size.height * 0.42], 16, 26);
  }
  await page.waitForTimeout(1200);
  const after = (await read(page)).cart as { x: number; z: number; yaw: number };
  const moved = Math.hypot(after.x - before.x, after.z - before.z);
  console.log('PARADE MOVE:', JSON.stringify({ before, after, moved }));
  expect(moved, 'pulling the rope moves the cart').toBeGreaterThan(0.15);

  /* --- swing it left and right ------------------------------------------- */
  const yawBefore = ((await read(page)).cart as { yaw: number }).yaw;
  for (let i = 0; i < 3; i++) {
    await drag(page, [size.width * 0.62, size.height * 0.72], [size.width * 0.14, size.height * 0.6], 14, 22);
  }
  await page.waitForTimeout(1200);
  const yawAfter = ((await read(page)).cart as { yaw: number }).yaw;
  console.log('PARADE TURN:', JSON.stringify({ yawBefore, yawAfter }));
  expect(Math.abs(yawAfter - yawBefore), 'swinging the rope turns it').toBeGreaterThan(0.08);

  /* --- go away and come back --------------------------------------------- */
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(1500);
  expect(await stageOf(page), 'still parading after coming back').toBe('parade');

  /* --- finish, then two taps back to light and parade -------------------- */
  await page.locator('.bigbtn.show').click({ timeout: 20_000 });
  await page.waitForFunction(() => document.querySelector('.menu.show') !== null, null, { timeout: 90_000 });
  await page.locator('.card').first().click();
  await page.waitForTimeout(2500);
  expect(await stageOf(page), 'the first card goes straight back to the switch').toBe('lightUp');
  const sw4 = await at(page, 'switch');
  expect(sw4.inside).toBe(true);
  await page.mouse.click(sw4.x, sw4.y);
  await page.waitForTimeout(1200);
  expect((await read(page)).lampsOn, 'two taps and it is lit again').toBe(true);

  expect(rec.errors, rec.errors.join('\n')).toEqual([]);
});
