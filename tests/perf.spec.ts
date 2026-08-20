import { expect, test } from '@playwright/test';
import { boot, drag, record } from './helpers';
import type { Page } from '@playwright/test';

type Api = {
  debugState(): Record<string, unknown>;
  jumpTo(s: string): void;
};

const read = (page: Page) =>
  page.evaluate(() => (window as never as { __nebuta: Api }).__nebuta.debugState());

test('drawing never grows the draw call count or leaks geometry', async ({ page }) => {
  test.setTimeout(180_000);
  const rec = record(page);
  await boot(page);
  const size = page.viewportSize()!;

  await page.evaluate(() => (window as never as { __nebuta: Api }).__nebuta.jumpTo('dye'));
  await page.waitForTimeout(2200);
  const before = await read(page);

  // scribble hard: hundreds of dabs across the whole fish
  for (let i = 0; i < 8; i++) {
    await drag(
      page,
      [size.width * 0.2, size.height * (0.35 + i * 0.03)],
      [size.width * 0.8, size.height * (0.45 + i * 0.03)],
      16,
      8,
    );
  }
  await page.waitForTimeout(1500);
  const after = await read(page);

  console.log(
    'PERF:',
    JSON.stringify({
      drawCalls: [before.drawCalls, after.drawCalls],
      geometries: [before.geometries, after.geometries],
      textures: [before.textures, after.textures],
      programs: [before.programs, after.programs],
      triangles: [before.triangles, after.triangles],
      dyeCoverage: after.dyeCoverage,
      fps: after.fps,
    }),
  );

  expect(after.dyeCoverage as number, 'the scribbling actually landed').toBeGreaterThan(0);
  expect(after.drawCalls as number, 'draw calls stay flat while painting').toBeLessThanOrEqual(
    (before.drawCalls as number) + 2,
  );
  expect(after.geometries as number, 'no geometry is created per stroke').toBeLessThanOrEqual(
    (before.geometries as number) + 2,
  );
  expect(after.textures as number, 'no texture is created per stroke').toBeLessThanOrEqual(
    (before.textures as number) + 2,
  );
  expect(rec.errors, rec.errors.join('\n')).toEqual([]);
});

test('the parade stays inside the yard however hard it is pulled', async ({ page }) => {
  test.setTimeout(180_000);
  const rec = record(page);
  await boot(page);
  const size = page.viewportSize()!;
  await page.evaluate(() => (window as never as { __nebuta: Api }).__nebuta.jumpTo('parade'));
  await page.waitForTimeout(2500);

  for (let i = 0; i < 10; i++) {
    await drag(
      page,
      [size.width * (0.2 + (i % 3) * 0.3), size.height * 0.85],
      [size.width * (0.15 + (i % 4) * 0.25), size.height * 0.3],
      10,
      14,
    );
  }
  await page.waitForTimeout(1500);
  const s = await read(page);
  const cart = s.cart as { x: number; z: number };
  const r = Math.hypot(cart.x, cart.z);
  console.log('YARD BOUND:', JSON.stringify({ cart, r, fps: s.fps, drawCalls: s.drawCalls }));
  expect(r, 'the teacher keeps it inside the yard').toBeLessThan(11);
  expect(rec.errors, rec.errors.join('\n')).toEqual([]);
});
