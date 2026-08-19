import { expect, test } from '@playwright/test';
import { VIEWPORTS, act, boot, carryToCake, pipeFlower, stats } from './helpers';

/**
 * One complete round on each representative iPhone and iPad screen: place the
 * parchment, pipe the core, draw petals, carry the flower to the cake.
 */
for (const vp of VIEWPORTS) {
  test(`full round on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const errors = await boot(page, 20260819);

    expect((await stats(page)).webgl2).toBe(true);

    await pipeFlower(page, 8);
    expect((await stats(page)).coneHeight).toBeGreaterThan(0.012);
    expect((await stats(page)).petals).toBeGreaterThanOrEqual(6);

    if ((await act(page)) === 'petals') await page.click('.done');
    await page.waitForTimeout(400);
    expect(await act(page)).toBe('lift');

    await carryToCake(page);
    expect(await act(page)).toBe('done');
    expect((await stats(page)).flowers).toBe(1);

    expect(errors).toEqual([]);
  });
}
