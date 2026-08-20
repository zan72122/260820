import { test, expect } from '@playwright/test';

/**
 * Chromium smoke run. Under SwiftShader we never judge how it *looks* — no
 * frame rate, no visual comparison. What this proves is that every shader
 * compiles, that the causal chain actually fires end to end, and that losing
 * the paper does not end the game.
 */

const URL = '/?fast=1';

/** Fails the test on any console error or page exception. */
function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

async function boot(page) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__KINGYO__ && window.__KINGYO__.ready, null, {
    timeout: 30_000,
  });
  // Take the clock off the browser so the run is deterministic.
  await page.evaluate(() => window.__KINGYO__.pause());
}

test('boots, compiles every shader and starts in attract', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);

  const snap = await page.evaluate(() => {
    window.__KINGYO__.advance(3, true);
    return window.__KINGYO__.snapshot();
  });

  expect(snap.state).toBe('attract');
  expect(snap.fish.length).toBeGreaterThanOrEqual(6);
  expect(snap.paper.hasPaper).toBe(true);
  expect(snap.paper.wetness).toBe(0);
  expect(snap.bowlCount).toBe(0);

  const info = await page.evaluate(() => {
    window.__KINGYO__.advance(0.1, true);
    return window.__KINGYO__.renderInfo();
  });
  expect(info.triangles).toBeGreaterThan(500);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('paper changes the instant it touches water', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);

  const result = await page.evaluate(() => {
    const K = window.__KINGYO__;
    K.advance(2);
    const p = K.aim(0, 0);
    K.drive({ x: p.x, y: p.y, down: true });
    // half a second of holding the poi in the water
    for (let i = 0; i < 30; i++) K.advance(1 / 60);
    const wet = K.snapshot();
    return { state: wet.state, wetness: wet.paper.wetness, submerge: wet.poi.submerge };
  });

  expect(result.state).toBe('first');
  expect(result.submerge).toBeGreaterThan(0.5);
  expect(result.wetness).toBeGreaterThan(0.02);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('a first fish can be scooped and lands in the bowl', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);

  const result = await page.evaluate(() => {
    const K = window.__KINGYO__;
    const step = (s) => K.advance(s);
    K.advance(2);

    // Play the way a child would: put the poi under the guided fish, follow it
    // for a moment, then let go.
    for (let attempt = 0; attempt < 12; attempt++) {
      let snap = K.snapshot();
      const target = snap.fish.find((f) => f.mode === 'swim');
      if (!target) break;

      // track it under water
      for (let i = 0; i < 90; i++) {
        snap = K.snapshot();
        const f = snap.fish.find((x) => x.mode === 'swim') || target;
        const p = K.aim(f.x, f.z);
        K.drive({ x: p.x, y: p.y, down: true });
        step(1 / 60);
        if (K.snapshot().carrying) break;
      }
      // let go: the poi comes up
      K.drive({ x: 0, y: 0, down: false });
      for (let i = 0; i < 150; i++) {
        step(1 / 60);
        if (K.snapshot().bowlCount > 0) break;
      }
      if (K.snapshot().bowlCount > 0) break;
    }
    const snap = K.snapshot();
    return {
      bowlCount: snap.bowlCount,
      state: snap.state,
      inBowl: snap.fish.filter((f) => f.mode === 'inBowl' || f.mode === 'toBowl').length,
      wetness: snap.paper.wetness,
      time: snap.time,
    };
  });

  expect(result.bowlCount).toBeGreaterThanOrEqual(1);
  expect(result.state).toBe('free');
  expect(result.inBowl).toBeGreaterThanOrEqual(1);
  expect(result.wetness).toBeGreaterThan(0);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('a wrecked poi is replaced and play carries on — there is no game over', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);

  const result = await page.evaluate(() => {
    const K = window.__KINGYO__;
    K.advance(1);
    // Thrash: exactly what a four-year-old does first.
    let destroyedSeen = false;
    for (let i = 0; i < 4200; i++) {
      const t = i * 0.05;
      const p = K.aim(Math.cos(t * 1.7) * 0.3, Math.sin(t * 2.3) * 0.3);
      K.drive({ x: p.x, y: p.y, down: true });
      K.advance(1 / 60);
      const s = K.snapshot();
      if (!s.paper.hasPaper || s.changingPoi) destroyedSeen = true;
      if (destroyedSeen && s.paper.hasPaper && !s.changingPoi && s.paper.damage < 0.1) break;
    }
    const snap = K.snapshot();
    return {
      destroyedSeen,
      poiTotal: snap.poiTotal,
      hasPaper: snap.paper.hasPaper,
      damage: snap.paper.damage,
      state: snap.state,
    };
  });

  expect(result.destroyedSeen).toBe(true);
  expect(result.poiTotal).toBeGreaterThanOrEqual(2);
  expect(result.hasPaper).toBe(true);
  expect(result.damage).toBeLessThan(0.35);
  expect(['first', 'free']).toContain(result.state);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('recomposes in landscape without a reload', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);
  await page.evaluate(() => window.__KINGYO__.advance(1, true));

  await page.setViewportSize({ width: 780, height: 390 });
  const after = await page.evaluate(() => {
    window.dispatchEvent(new Event('resize'));
    window.__KINGYO__.advance(1.5, true);
    const s = window.__KINGYO__.snapshot();
    return { fish: s.fish.length, state: s.state };
  });

  expect(after.fish).toBeGreaterThanOrEqual(6);
  expect(after.state).toBe('attract');
  expect(errors, errors.join('\n')).toEqual([]);
});
