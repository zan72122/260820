import { test, expect, type Page } from '@playwright/test';

/**
 * Plays the game the way a child does: real pointer events on the canvas,
 * no back doors. `window.__ume` is used only to read state and to look up
 * where a prop currently is on screen.
 */

const PHONE = { width: 390, height: 844 };
const PHONE_LAND = { width: 844, height: 390 };

async function boot(page: Page, stage?: string): Promise<void> {
  await page.goto(stage ? `/?fast=1&manual=1&stage=${stage}` : '/?fast=1&manual=1');
  await page.waitForFunction(() => Boolean(window.__ume?.ready), null, { timeout: 45_000 });
  await page.evaluate(() => window.__ume!.advanceTime(0.6));
}

type Pt = { x: number; y: number };

async function spot(page: Page, name: string): Promise<Pt> {
  const p = await page.evaluate((n) => window.__ume!.hotspot(n), name);
  expect(p, `hotspot ${name}`).not.toBeNull();
  return p as Pt;
}

/** A slow, curved, human drag -- not a teleport. */
async function drag(page: Page, from: Pt, to: Pt, steps = 12): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(
      from.x + (to.x - from.x) * t,
      from.y + (to.y - from.y) * t + Math.sin(t * Math.PI) * 6,
    );
    // Software rasterising is slow, so the clock is advanced every other
    // sample rather than every one; the gesture is unchanged.
    if (i % 2 === 0) await page.evaluate(() => window.__ume!.advanceTime(1 / 30));
  }
  await page.mouse.up();
  await page.evaluate(() => window.__ume!.advanceTime(0.2));
}

async function tap(page: Page, at: Pt): Promise<void> {
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.evaluate(() => window.__ume!.advanceTime(1 / 30));
  await page.mouse.up();
  await page.evaluate(() => window.__ume!.advanceTime(0.3));
}

/**
 * Fails loudly if a control has drifted off the screen -- or so close to the
 * edge that a finger could not land on it. Camera moves kept pushing props
 * out of frame during development, so this is checked at every use.
 */
const EDGE = 26;
function onScreen(p: Pt, w: number, h: number, what: string): void {
  const where = `${what} is off screen: ${JSON.stringify(p)} in ${w}x${h}`;
  expect(p.x, where).toBeGreaterThan(EDGE);
  expect(p.x, where).toBeLessThan(w - EDGE);
  expect(p.y, where).toBeGreaterThan(EDGE);
  expect(p.y, where).toBeLessThan(h - EDGE);
}

/** One swing of the stake's shadow around the stake, by hand. */
async function swingOnce(page: Page, dir = 1): Promise<void> {
  const stake = await spot(page, 'stake');
  const shadow = await spot(page, 'shadow');
  const vp = await page.evaluate(() => window.__ume!.viewport());
  onScreen(shadow, vp.width, vp.height, 'the sun control');
  const r = Math.max(36, Math.hypot(shadow.x - stake.x, shadow.y - stake.y));
  const a0 = Math.atan2(shadow.y - stake.y, shadow.x - stake.x);
  await page.mouse.move(shadow.x, shadow.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    const a = a0 + dir * (i / 12) * Math.PI * 0.8;
    // Stay on the near side of the stake so the drag never projects behind
    // the camera, exactly as a finger on the ground would.
    const y = Math.max(stake.y - r * 0.35, stake.y + Math.sin(a) * r);
    await page.mouse.move(stake.x + Math.cos(a) * r, y);
    if (i % 2 === 0) await page.evaluate(() => window.__ume!.advanceTime(1 / 30));
  }
  await page.mouse.up();
  await page.evaluate(() => window.__ume!.advanceTime(0.35));
}

/**
 * Keeps swinging until the world reports the sun has actually moved. Screen
 * arcs foreshorten differently at every camera angle, so this is the same
 * forgiving "keep going until it looks right" loop a child performs.
 */
async function swingShadow(page: Page, target: number, maxSwings = 14): Promise<number> {
  let sunT = (await page.evaluate(() => window.__ume!.probe())).sunT ?? 0;
  for (let i = 0; i < maxSwings && sunT < target; i++) {
    await swingOnce(page, i % 2 === 0 ? 1 : -1);
    sunT = (await page.evaluate(() => window.__ume!.probe())).sunT ?? 0;
  }
  return sunT;
}

test.describe('a whole round, played by hand', () => {
  test('orchard: net, sun and gathering all respond to the finger', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await boot(page);
    expect(await page.evaluate(() => window.__ume!.step())).toBe('spreadNet');

    // Pull the rolled edge across the ground.
    for (let i = 0; i < 4; i++) {
      const roll = await spot(page, 'roll');
      await drag(page, roll, { x: roll.x + 150, y: roll.y + 20 });
    }
    expect((await page.evaluate(() => window.__ume!.probe())).spread).toBeGreaterThan(0.95);
    expect(await page.evaluate(() => window.__ume!.step())).toBe('callSun');

    // Swing the shadow: the hour moves and ripe fruit come down on their own.
    await swingShadow(page, 0.95);
    await page.evaluate(() => window.__ume!.advanceTime(7));
    const afterSun = await page.evaluate(() => window.__ume!.probe());
    expect(afterSun.sunT).toBeGreaterThan(0.9);
    expect(afterSun.landed).toBeGreaterThan(5);
    expect(await page.evaluate(() => window.__ume!.step())).toBe('gather');

    // Lift the rim: everything rolls to the middle. A child lifts repeatedly
    // until it looks right, so the test does too.
    let phase = await page.evaluate(() => window.__ume!.phase());
    for (let i = 0; i < 10 && phase !== 'freeplay'; i++) {
      const edge = await spot(page, 'netEdge');
      await drag(page, edge, { x: edge.x - 30, y: edge.y - 230 }, 16);
      await page.evaluate(() => window.__ume!.advanceTime(1.8));
      phase = await page.evaluate(() => window.__ume!.phase());
    }
    const gathered = await page.evaluate(() => window.__ume!.probe());
    expect(gathered.near, `gathered ${JSON.stringify(gathered)}`).toBeGreaterThan(4);
    expect(phase).toBe('freeplay');

    // Free play first: the basket only offers itself after a while, and the
    // child keeps playing until they choose to take it.
    await page.evaluate(() => window.__ume!.advanceTime(11));
    const basket = await spot(page, 'basket');
    // An affordance the child cannot see is not an affordance.
    onScreen(basket, PHONE.width, PHONE.height, 'the basket');
    await tap(page, basket);
    await page.evaluate(() => window.__ume!.advanceTime(1.5));
    expect(await page.evaluate(() => window.__ume!.stage())).toBe('pickling');
  });

  test('pickling: salt lands, days pass, the level climbs', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await boot(page, 'pickling');
    expect(await page.evaluate(() => window.__ume!.step())).toBe('pourSalt');

    // Carry the scoop over the jar; it tips as it arrives, and pouring
    // continues while the hand keeps moving over the fruit.
    for (let i = 0; i < 5; i++) {
      const scoop = await spot(page, 'scoop');
      const jar = await spot(page, 'jar');
      await drag(page, scoop, jar, 16);
      await page.evaluate(() => window.__ume!.advanceTime(0.8));
      const bowl = await spot(page, 'bowl');
      await drag(page, await spot(page, 'scoop'), bowl, 10);
      await page.evaluate(() => window.__ume!.advanceTime(1.2));
    }
    const afterSalt = await page.evaluate(() => window.__ume!.probe());
    expect(afterSalt.salt).toBeGreaterThan(0.3);
    // Grains are physical objects in the jar, not a decal.
    expect(afterSalt.grains).toBeGreaterThan(20);
    // Critically: no juice yet. It cannot appear without time passing.
    expect(afterSalt.level).toBeLessThan(0.02);
    expect(await page.evaluate(() => window.__ume!.step())).toBe('passDays');

    // Drag the shaft of light across the bench: days go by, juice gathers.
    let phase = await page.evaluate(() => window.__ume!.phase());
    for (let i = 0; i < 14 && phase !== 'freeplay'; i++) {
      const light = await spot(page, 'light');
      await drag(page, light, { x: light.x + (i % 2 ? -95 : 95), y: light.y }, 12);
      await page.evaluate(() => window.__ume!.advanceTime(0.9));
      phase = await page.evaluate(() => window.__ume!.phase());
    }
    await page.evaluate(() => window.__ume!.advanceTime(4));
    const afterDays = await page.evaluate(() => window.__ume!.probe());
    expect(afterDays.day).toBeGreaterThan(2);
    expect(afterDays.level).toBeGreaterThan(0.25);
    expect(afterDays.wetness).toBeGreaterThan(0.3);
    expect(phase, `after days ${JSON.stringify(afterDays)}`).toBe('freeplay');

    // More free play is always allowed before the lid is offered.
    await page.evaluate(() => window.__ume!.advanceTime(12));
    const lid = await spot(page, 'lid');
    onScreen(lid, PHONE.width, PHONE.height, 'the lid');
    await tap(page, lid);
    await page.evaluate(() => window.__ume!.advanceTime(1.5));
    expect(await page.evaluate(() => window.__ume!.stage())).toBe('drying');
  });

  test('drying: fruit are laid out, sun dries them, a swipe turns them', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await boot(page, 'drying');
    expect(await page.evaluate(() => window.__ume!.step())).toBe('placeUme');

    for (let i = 0; i < 8; i++) {
      const fruit = await spot(page, 'looseFruit');
      const tray = await spot(page, 'tray');
      await drag(page, fruit, { x: tray.x + ((i % 3) - 1) * 22, y: tray.y + (i % 4) * 14 - 20 }, 12);
    }
    expect((await page.evaluate(() => window.__ume!.probe())).placed).toBeGreaterThanOrEqual(8);
    expect(await page.evaluate(() => window.__ume!.step())).toBe('sunDry');

    await swingShadow(page, 0.8);
    await page.evaluate(() => window.__ume!.advanceTime(3));
    const dried = await page.evaluate(() => window.__ume!.probe());
    expect(dried.sunT).toBeGreaterThan(0.7);
    expect(dried.dryA).toBeGreaterThan(0.4);
    expect(await page.evaluate(() => window.__ume!.phase())).toBe('freeplay');

    // A quick horizontal flick turns a fruit over: the pale side comes up.
    const placed = await spot(page, 'placedFruit');
    await page.mouse.move(placed.x, placed.y);
    await page.mouse.down();
    // A flick: quick, horizontal, no pause. Nothing is stepped in between,
    // because a real flick does not wait for frames either.
    for (let i = 1; i <= 5; i++) await page.mouse.move(placed.x + i * 9, placed.y);
    await page.mouse.up();
    await page.evaluate(() => window.__ume!.advanceTime(1.5));
    // More sun, now falling on the face that was underneath.
    await swingOnce(page, 1);
    await swingOnce(page, -1);
    await page.evaluate(() => window.__ume!.advanceTime(3));
    const turned = await page.evaluate(() => window.__ume!.probe());
    expect(turned.turned, `after turning ${JSON.stringify(turned)}`).toBeGreaterThan(0);
    expect(turned.dryBMax, `after turning ${JSON.stringify(turned)}`).toBeGreaterThan(0.2);

    // And the whole thing loops straight back to a fresh orchard.
    await page.evaluate(() => window.__ume!.advanceTime(13));
    const plate = await spot(page, 'plate');
    onScreen(plate, PHONE.width, PHONE.height, 'the finishing plate');
    await tap(page, plate);
    await page.evaluate(() => window.__ume!.advanceTime(2));
    expect(await page.evaluate(() => window.__ume!.stage())).toBe('orchard');
    expect(await page.evaluate(() => window.__ume!.step())).toBe('spreadNet');
  });
});

test.describe('robustness', () => {
  test('rotation reframes without rewinding a single step', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await boot(page, 'pickling');
    for (let i = 0; i < 5; i++) {
      const scoop = await spot(page, 'scoop');
      const jar = await spot(page, 'jar');
      await drag(page, scoop, jar, 16);
      await page.evaluate(() => window.__ume!.advanceTime(0.8));
      await drag(page, await spot(page, 'scoop'), await spot(page, 'bowl'), 10);
    }
    const before = await page.evaluate(() => ({
      step: window.__ume!.step(),
      progress: window.__ume!.progress(),
      probe: window.__ume!.probe(),
    }));
    expect(before.probe.salt).toBeGreaterThan(0.2);

    await page.setViewportSize(PHONE_LAND);
    await page.evaluate(() => window.__ume!.advanceTime(1));
    const after = await page.evaluate(() => ({
      step: window.__ume!.step(),
      progress: window.__ume!.progress(),
      probe: window.__ume!.probe(),
    }));
    expect(after.step).toBe(before.step);
    expect(after.progress.pourSalt).toBeGreaterThanOrEqual(before.progress.pourSalt);
    expect(after.probe.salt).toBeGreaterThanOrEqual(before.probe.salt);
    expect(after.probe.day).toBeGreaterThanOrEqual(before.probe.day);

    await page.setViewportSize(PHONE);
    await page.evaluate(() => window.__ume!.advanceTime(1));
    const back = await page.evaluate(() => window.__ume!.probe());
    expect(back.salt).toBeGreaterThanOrEqual(after.probe.salt);
  });

  test('mashing, reverse drags and lifted fingers never stall the game', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewportSize(PHONE);
    await boot(page);

    // Mash the screen.
    for (let i = 0; i < 24; i++) {
      await page.mouse.move(120 + (i % 5) * 30, 420 + (i % 7) * 20);
      await page.mouse.down();
      await page.mouse.up();
    }
    await page.evaluate(() => window.__ume!.advanceTime(0.5));

    // Drag the net the wrong way: progress must not go backwards.
    const roll = await spot(page, 'roll');
    await drag(page, roll, { x: roll.x + 140, y: roll.y });
    const mid = await page.evaluate(() => window.__ume!.probe());
    const back = await spot(page, 'roll');
    await drag(page, back, { x: back.x - 220, y: back.y });
    const afterReverse = await page.evaluate(() => window.__ume!.probe());
    expect(afterReverse.spread).toBeGreaterThanOrEqual(mid.spread);

    // Start a drag and have the pointer taken away mid-gesture.
    const now = await spot(page, 'roll');
    await page.mouse.move(now.x, now.y);
    await page.mouse.down();
    await page.mouse.move(now.x + 40, now.y - 10);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
    });
    await page.evaluate(() => window.__ume!.advanceTime(0.5));
    await page.mouse.up();

    // And it still plays.
    for (let i = 0; i < 4; i++) {
      const r = await spot(page, 'roll');
      await drag(page, r, { x: r.x + 150, y: r.y });
    }
    expect((await page.evaluate(() => window.__ume!.probe())).spread).toBeGreaterThan(0.95);
    expect(await page.evaluate(() => window.__ume!.frames())).toBeGreaterThan(10);
    expect(errors.join('\n')).toBe('');
  });

  test('a WebGL context loss is survived and play continues', async ({ page }) => {
    await page.setViewportSize(PHONE);
    // This one needs the real animation loop, to prove it restarts.
    await page.goto('/?fast=1&stage=pickling');
    await page.waitForFunction(() => Boolean(window.__ume?.ready), null, { timeout: 45_000 });
    await page.evaluate(() => window.__ume!.advanceTime(0.6));
    const before = await page.evaluate(() => window.__ume!.probe());

    const restored = await page.evaluate(async () => {
      const canvas = document.getElementById('gl') as HTMLCanvasElement;
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      const ext = (gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context');
      if (!ext) return 'no-extension';
      ext.loseContext();
      await new Promise((r) => setTimeout(r, 120));
      ext.restoreContext();
      await new Promise((r) => setTimeout(r, 700));
      return 'ok';
    });
    if (restored === 'no-extension') test.skip();

    await page.evaluate(() => window.__ume!.advanceTime(1));
    const framesA = await page.evaluate(() => window.__ume!.frames());
    await page.waitForTimeout(500);
    const framesB = await page.evaluate(() => window.__ume!.frames());
    expect(framesB).toBeGreaterThan(framesA);
    const after = await page.evaluate(() => window.__ume!.probe());
    expect(after.salt).toBeGreaterThanOrEqual(before.salt);
    expect(await page.evaluate(() => window.__ume!.stage())).toBe('pickling');
  });
});
