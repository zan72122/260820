import { test, expect } from '@playwright/test';
import { SCREENS, boot, state, advance, arcSwipe, upSwipe, tap, advanceWatchingFraming, expectNoErrors } from './helpers.js';

test.describe('投網の花 — core play loop', () => {
  for (const [name, size] of Object.entries(SCREENS)) {
    test(`${name}: one swipe casts, opens, sinks, hauls and returns`, async ({ page }) => {
      await page.setViewportSize(size);
      const errors = await boot(page);

      // The opening frame teaches with the scene, not with sentences.
      const s0 = await state(page);
      expect(s0.state).toBe('idle');
      expect(s0.netPhase).toBe('folded');

      await advance(page, 2.0);

      // One arc of the finger.
      await arcSwipe(page);
      const s1 = await state(page);
      expect(s1.state).toBe('cast');
      expect(s1.castCount).toBe(1);
      expect(s1.lastCast.distance).toBeGreaterThan(2.5);

      // It opens in the air: the rim is wider than the bundle ever is.
      await advance(page, 0.6);
      const bloom = await state(page);
      expect(bloom.netRadius).toBeGreaterThan(1.0);

      // It reaches the water and sinks.
      let worst = await advanceWatchingFraming(page, 3.2);
      expect(worst, 'hand and net stayed framed through the cast').toBeLessThan(0.98);
      const sunk = await state(page);
      expect(['sunk']).toContain(sunk.state);
      expect(sunk.wetness).toBeGreaterThan(0.8);

      // An upward swipe hauls it home.
      await upSwipe(page);
      expect((await state(page)).state).toBe('haul');
      worst = await advanceWatchingFraming(page, 3.4);
      expect(worst).toBeLessThan(0.98);

      const back = await state(page);
      expect(['idle', 'observe']).toContain(back.state);

      expectNoErrors(errors);
    });
  }

  test('no tutorial copy anywhere in the document', async ({ page }) => {
    await page.setViewportSize(SCREENS['iPhone portrait']);
    await boot(page);
    const text = await page.evaluate(() => document.body.innerText.trim());
    expect(text).toBe('');
  });

  test('replay costs one gesture, not a menu', async ({ page }) => {
    await page.setViewportSize(SCREENS['iPhone portrait']);
    const errors = await boot(page);
    await advance(page, 1.0);
    await arcSwipe(page);
    await advance(page, 3.6);
    await upSwipe(page);
    await advance(page, 8.0);           // covers haul, any观察 and release
    expect((await state(page)).state).toBe('idle');

    // Second cast: no button, no confirmation, just another swipe.
    await arcSwipe(page, { fromX: 0.3, fromY: 0.8, toX: 0.7, toY: 0.36 });
    const s = await state(page);
    expect(s.state).toBe('cast');
    expect(s.castCount).toBe(2);
    expectNoErrors(errors);
  });

  test('the net never fails: slow, fast and wobbly swipes all bloom', async ({ page }) => {
    await page.setViewportSize(SCREENS['iPhone portrait']);
    const errors = await boot(page);
    const results = [];
    const shapes = [
      { fromX: 0.3, fromY: 0.8, toX: 0.55, toY: 0.62, bow: 0.05, steps: 30, stepMs: 26 },  // slow and short
      { fromX: 0.15, fromY: 0.9, toX: 0.9, toY: 0.18, bow: 0.2, steps: 10, stepMs: 4 },    // fast and long
      { fromX: 0.25, fromY: 0.85, toX: 0.7, toY: 0.35, bow: 0.42, steps: 26, stepMs: 10 }  // a wandering arc
    ];
    for (const shape of shapes) {
      await advance(page, 0.5);
      await arcSwipe(page, shape);
      const s = await state(page);
      expect(s.state, 'every swipe casts').toBe('cast');
      await advance(page, 1.3);
      const bloom = await state(page);
      expect(bloom.netRadius, 'every cast opens').toBeGreaterThan(0.9);
      results.push({ d: s.lastCast.distance, petals: s.lastCast.petals, amp: s.lastCast.petalAmp, tilt: s.lastCast.tilt });
      await advance(page, 2.5);
      await page.evaluate(() => window.__toami.haul());
      await advance(page, 8.0);
    }
    // Same success, different flowers.
    const distances = results.map((r) => r.d);
    expect(Math.max(...distances) - Math.min(...distances)).toBeGreaterThan(1.5);
    expectNoErrors(errors);
  });

  test('a tap looks, it does not cast', async ({ page }) => {
    await page.setViewportSize(SCREENS['iPhone portrait']);
    const errors = await boot(page);
    await advance(page, 1.0);
    await tap(page, 0.5, 0.42);
    const s = await state(page);
    expect(s.state).toBe('idle');
    expect(s.castCount).toBe(0);
    await advance(page, 1.0);
    expectNoErrors(errors);
  });

  test('rotating the device keeps the game alive and framed', async ({ page }) => {
    await page.setViewportSize(SCREENS['iPhone portrait']);
    const errors = await boot(page);
    await advance(page, 1.0);
    await arcSwipe(page);
    await advance(page, 1.0);
    await page.setViewportSize(SCREENS['iPhone landscape']);
    await page.waitForTimeout(300);
    const worst = await advanceWatchingFraming(page, 3.0);
    expect(worst).toBeLessThan(0.98);
    const s = await state(page);
    expect(['cast', 'sunk']).toContain(s.state);
    expectNoErrors(errors);
  });

  test('shallow and deep water shape the net differently', async ({ page }) => {
    await page.setViewportSize(SCREENS['iPad portrait']);
    const errors = await boot(page);

    await page.evaluate(() => window.__toami.cast({ distance: 3.4, azimuth: 0, sharpness: 0.2, smoothness: 0.9, wobble: 0.1 }));
    await advance(page, 4.2);
    const shallow = await state(page);

    await page.evaluate(() => window.__toami.haul());
    await advance(page, 8.0);

    await page.evaluate(() => window.__toami.cast({ distance: 15, azimuth: 0, sharpness: 0.95, smoothness: 0.9, wobble: 0.1 }));
    await advance(page, 5.0);
    const deep = await state(page);

    expect(shallow.lastCast.zone).toBe('shallow');
    expect(deep.lastCast.zone).toBe('deep');
    // Over the sand the lead line cannot fall far, so the net stays a wide
    // circle; over the blue it draws itself into a deep cone.
    expect(shallow.netRadius).toBeGreaterThan(deep.netRadius);
    expect(shallow.rimY - deep.rimY, 'the cone reaches deeper over the blue').toBeGreaterThan(0.35);
    expectNoErrors(errors);
  });

  test('at least three fish silhouettes live in the water', async ({ page }) => {
    await page.setViewportSize(SCREENS['iPad landscape']);
    const errors = await boot(page);
    const kinds = new Set();
    for (let i = 0; i < 40; i++) {
      const s = await advance(page, 1.0);
      s.shoals.forEach((k) => kinds.add(k));
      if (kinds.size >= 3) break;
    }
    expect([...kinds].sort()).toEqual(['darters', 'school', 'solitary']);
    expectNoErrors(errors);
  });

  test('a caught fish is shown, then put back', async ({ page }) => {
    await page.setViewportSize(SCREENS['iPhone portrait']);
    const errors = await boot(page);
    let observed = false;
    for (let attempt = 0; attempt < 14 && !observed; attempt++) {
      await page.evaluate(() => {
        const g = window.__toami.game;
        // Aim at a shoal so the cast actually has something under it.
        const s = g.fishes.shoals.find((x) => -x.pos.z > 2.5 && -x.pos.z < 12) || g.fishes.shoals[0];
        const d = Math.hypot(s.pos.x, s.pos.z);
        const az = Math.atan2(s.pos.x, -s.pos.z);
        window.__toami.cast({ distance: d, azimuth: az, sharpness: 0.6, smoothness: 0.9, wobble: 0.15 });
      });
      await advance(page, 3.4);
      await page.evaluate(() => window.__toami.haul());
      const s = await advance(page, 3.2);
      if (s.state === 'observe') observed = true;
      await advance(page, 8.0);
    }
    expect(observed, 'a fish was caught and shown in the tub at least once').toBe(true);
    const end = await state(page);
    expect(end.state).toBe('idle');
    expect(end.tankFish, 'the fish went back to the sea').toBe(false);
    expectNoErrors(errors);
  });
});
