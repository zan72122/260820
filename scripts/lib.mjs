/** Shared driving helpers for the browser scripts. */

/**
 * Closed-loop search for the locator peak: step, read, reverse and shrink.
 * Mirrors how a person actually hunts for the strongest response.
 */
export async function seekLocator(page, page_state, width, height) {
  const s0 = await page_state();
  let x = s0.finger.x;
  let y = s0.finger.y;
  await page.mouse.move(x, y);
  await page.mouse.down();

  const sweep = async (axis, startStep, iterations) => {
    let dir = 1;
    let step = startStep;
    let prev = -1;
    for (let i = 0; i < iterations; i++) {
      const s = await page_state();
      if (s.phase !== 'detect') return s;
      if (s.signal > 0.92) {
        await page.waitForTimeout(300);
        continue;
      }
      if (s.signal < prev - 0.005) {
        dir = -dir;
        step = Math.max(3, step * 0.55);
      }
      prev = s.signal;
      if (axis === 'x') x = Math.min(width - 24, Math.max(24, x + dir * step));
      else y = Math.min(height - 24, Math.max(24, y + dir * step));
      await page.mouse.move(x, y);
      await page.waitForTimeout(320);
    }
    return page_state();
  };

  await sweep('x', 26, 34);
  await sweep('y', 20, 16);
  await sweep('x', 10, 20);
  // hold on the strongest response until the operator marks the ground
  for (let i = 0; i < 90; i++) {
    const s = await page_state();
    if (s.phase !== 'detect') break;
    await page.mouse.move(x + (i % 2 ? 0.5 : -0.5), y);
    await page.waitForTimeout(160);
  }
  await page.mouse.up();
}
