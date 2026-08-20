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

/**
 * A scripted child: puts the poi under whichever fish is swimming, follows it
 * for a moment, then lets go. Runs entirely inside the page on the fixed
 * timestep, so it is deterministic and takes no wall-clock time.
 */
const PLAY_ONE = `(function play(maxAttempts) {
  const K = window.__KINGYO__;
  const startBowl = K.snapshot().bowlCount;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (!K.snapshot().fish.some((f) => f.mode === 'swim')) break;
    for (let i = 0; i < 110; i++) {
      const snap = K.snapshot();
      const f = snap.fish.find((x) => x.mode === 'swim');
      if (!f) break;
      const p = K.aim(f.x, f.z);
      K.drive({ x: p.x, y: p.y, down: true });
      K.advance(1 / 60);
      if (K.snapshot().carrying) break;
    }
    K.drive({ x: 0, y: 0, down: false });
    for (let i = 0; i < 160; i++) {
      K.advance(1 / 60);
      if (K.snapshot().bowlCount > startBowl) break;
    }
    if (K.snapshot().bowlCount > startBowl) return true;
  }
  return K.snapshot().bowlCount > startBowl;
})`;

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
    const marks = [];
    for (let i = 0; i < 60; i++) {
      K.advance(1 / 60);
      const s = K.snapshot();
      if (s.paper.everWet && marks.length === 0) marks.push(s.time);
    }
    const wet = K.snapshot();
    return {
      state: wet.state,
      wetness: wet.paper.wetness,
      wetFront: wet.paper.wetFront,
      everWet: wet.paper.everWet,
      submerge: wet.poi.submerge,
    };
  });

  expect(result.state).toBe('first');
  expect(result.submerge).toBeGreaterThan(0.5);
  // The look of the sheet has to change on contact, not a second later: the
  // stain is what says "this tool goes in the water, and water does something
  // to it". The slower `wetness` number is the thing that eventually kills it.
  expect(result.everWet).toBe(true);
  expect(result.wetFront).toBe(1);
  expect(result.wetness).toBeGreaterThan(0.005);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('a first fish can be scooped and lands in the bowl', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);

  const result = await page.evaluate((play) => {
    const K = window.__KINGYO__;
    K.advance(2);
    const caught = eval(play)(12);
    const snap = K.snapshot();
    return {
      caught,
      bowlCount: snap.bowlCount,
      state: snap.state,
      inBowl: snap.fish.filter((f) => f.mode === 'inBowl' || f.mode === 'toBowl').length,
      wetness: snap.paper.wetness,
      seconds: snap.time,
    };
  }, PLAY_ONE);

  expect(result.caught).toBe(true);
  expect(result.bowlCount).toBeGreaterThanOrEqual(1);
  expect(result.state).toBe('free');
  expect(result.inBowl).toBeGreaterThanOrEqual(1);
  expect(result.wetness).toBeGreaterThan(0);
  // The first fish is meant to come out early. If this creeps up, the opening
  // has stopped teaching.
  expect(result.seconds).toBeLessThan(75);
  expect(errors, errors.join('\n')).toEqual([]);
});

/**
 * The design promise is "no perfect aim required": a four-year-old points
 * roughly at a fish and the soft attraction closes the gap. This drives the
 * poi to a point several centimetres off the fish, on purpose, and expects a
 * catch anyway.
 */
test('a sloppy aim still catches a fish', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);

  const result = await page.evaluate(() => {
    const K = window.__KINGYO__;
    K.advance(2);
    let attempts = 0;
    for (; attempts < 8; attempts++) {
      for (let i = 0; i < 150; i++) {
        const snap = K.snapshot();
        const f = snap.fish.find((x) => x.mode === 'swim');
        if (!f) break;
        // Aim a good 5cm behind and to the side of where the fish actually is.
        const p = K.aim(f.x - 0.05, f.z - 0.045);
        K.drive({ x: p.x, y: p.y, down: true });
        K.advance(1 / 60);
        if (K.snapshot().carrying) break;
      }
      K.drive({ x: 0, y: 0, down: false });
      for (let i = 0; i < 170; i++) {
        K.advance(1 / 60);
        if (K.snapshot().bowlCount > 0) break;
      }
      if (K.snapshot().bowlCount > 0) break;
    }
    return { attempts, bowlCount: K.snapshot().bowlCount };
  });

  expect(result.bowlCount).toBeGreaterThanOrEqual(1);
  expect(result.attempts).toBeLessThanOrEqual(4);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the first sheet is protected until the child has succeeded once', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);

  const result = await page.evaluate(() => {
    const K = window.__KINGYO__;
    K.advance(1);
    // Two minutes of thrashing the poi around the tub. A child who does this
    // may well scoop a fish by accident — that is fine, and the run stops
    // there. What must not happen is losing the very first sheet before they
    // have understood anything.
    let lostWhileLearning = false;
    let maxDamage = 0;
    let endedByCatch = false;
    for (let i = 0; i < 7200; i++) {
      const t = i * 0.05;
      const p = K.aim(Math.cos(t * 1.7) * 0.22, Math.sin(t * 2.3) * 0.34);
      K.drive({ x: p.x, y: p.y, down: true });
      K.advance(1 / 60);
      const s = K.snapshot();
      if (s.state !== 'first') {
        endedByCatch = true;
        break;
      }
      maxDamage = Math.max(maxDamage, s.paper.damage);
      if (!s.paper.hasPaper || s.changingPoi) lostWhileLearning = true;
    }
    return { lostWhileLearning, maxDamage, endedByCatch, seconds: K.snapshot().time };
  });

  expect(result.lostWhileLearning).toBe(false);
  expect(result.maxDamage).toBeLessThan(0.6);
  // It should still visibly wear: the opening is protected, not inert.
  expect(result.maxDamage).toBeGreaterThan(0.25);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('a wrecked poi is replaced and play carries on — there is no game over', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);

  const result = await page.evaluate((play) => {
    const K = window.__KINGYO__;
    K.advance(2);
    const caught = eval(play)(12);

    // Now the sheet is real. Thrash it to pieces.
    let destroyedSeen = false;
    let replaced = false;
    for (let i = 0; i < 6000; i++) {
      const t = i * 0.05;
      const p = K.aim(Math.cos(t * 1.9) * 0.34, Math.sin(t * 2.7) * 0.3);
      K.drive({ x: p.x, y: p.y, down: true });
      K.advance(1 / 60);
      const s = K.snapshot();
      if (!s.paper.hasPaper || s.changingPoi) destroyedSeen = true;
      if (destroyedSeen && s.paper.hasPaper && !s.changingPoi && s.paper.damage < 0.12) {
        replaced = true;
        break;
      }
    }
    const snap = K.snapshot();
    return {
      caught,
      destroyedSeen,
      replaced,
      poiTotal: snap.poiTotal,
      hasPaper: snap.paper.hasPaper,
      damage: snap.paper.damage,
      state: snap.state,
      fish: snap.fish.length,
    };
  }, PLAY_ONE);

  expect(result.caught).toBe(true);
  expect(result.destroyedSeen).toBe(true);
  expect(result.replaced).toBe(true);
  expect(result.poiTotal).toBeGreaterThanOrEqual(2);
  expect(result.hasPaper).toBe(true);
  expect(result.damage).toBeLessThan(0.15);
  expect(result.state).toBe('free');
  expect(result.fish).toBeGreaterThanOrEqual(6);
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
