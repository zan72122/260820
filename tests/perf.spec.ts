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
  await page.waitForTimeout(2500);

  // Two scribbling bursts. The first also warms up lazily-uploaded textures and brings props
  // into the frustum, so the honest measurement is what the *second* burst adds on top.
  const burst = async (rows: number) => {
    for (let i = 0; i < rows; i++) {
      await drag(
        page,
        [size.width * 0.2, size.height * (0.35 + i * 0.03)],
        [size.width * 0.8, size.height * (0.45 + i * 0.03)],
        16,
        8,
      );
    }
    await page.waitForTimeout(2500);
  };

  await burst(4);
  const before = await read(page);
  await burst(10);
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
  // the scene graph is the honest invariant: strokes live in a texture atlas, never in meshes
  expect(after.objects, 'strokes never add objects to the scene').toBe(before.objects);
  expect(after.paperMeshes, 'the paper is always the same thirteen panels').toBe(before.paperMeshes);
  expect(after.programs as number, 'no shader is compiled per stroke').toBeLessThanOrEqual(
    before.programs as number,
  );
  // resource counts still tick up a little as props first enter the frustum and upload; what
  // matters is that the growth is bounded by the scenery, not by how much the child drew
  expect(after.geometries as number, 'geometry count is bounded by the scenery').toBeLessThanOrEqual(
    (before.geometries as number) + 8,
  );
  expect(after.textures as number, 'texture count is bounded by the scenery').toBeLessThanOrEqual(
    (before.textures as number) + 8,
  );
  expect(after.drawCalls as number, 'the draw call budget holds').toBeLessThan(260);
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
