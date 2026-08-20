import { test, expect } from '@playwright/test';

// The page is loaded with the clock under test control: `step(dt)` advances the
// whole simulation one frame, so nothing here waits on wall time and nothing
// depends on how fast SwiftShader happens to be today.
const URL = '/?muted&tier=floor&dpr=1&seed=4242';

async function boot(page) {
  const problems = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(String(e)));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => globalThis.__senko?.frame > 0, null, { timeout: 120_000 });
  await page.evaluate(() => globalThis.__senko.stop());
  return problems;
}

const step = (page, n, dt = 1 / 30) =>
  page.evaluate(
    ([count, d]) => {
      for (let i = 0; i < count; i++) globalThis.__senko.step(d);
    },
    [n, dt]
  );

const state = (page) =>
  page.evaluate(() => {
    const a = globalThis.__senko;
    return {
      state: a.session.state,
      burn: a.session.burn,
      phase: a.session.phaseName,
      sparks: a.sparks.liveCount,
      sparksSeen: a.session.sparkCount,
      firstSpark: a.session.firstSparkFired,
      index: a.session.index,
      emberY: a.fireball.position.y,
      radius: a.fireball.radius,
      tier: a.quality.tier,
    };
  });

test('it starts on WebGL 2 and draws a night, not a black screen', async ({ page }) => {
  const problems = await boot(page);
  await step(page, 20);

  const info = await page.evaluate(() => {
    const a = globalThis.__senko;
    return { webgl2: a.webgl2, w: a.canvas.width, h: a.canvas.height };
  });
  expect(info.webgl2, 'the renderer must come up on WebGL 2').toBe(true);
  expect(info.w).toBeGreaterThan(0);

  const stats = await page.evaluate(() => {
    const a = globalThis.__senko;
    const c = document.createElement('canvas');
    c.width = a.canvas.width;
    c.height = a.canvas.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(a.canvas, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    let peak = 0;
    let lit = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
      sum += l;
      peak = Math.max(peak, l);
      if (l > 16) lit++;
    }
    return { mean: sum / (d.length / 4), peak, litFraction: lit / (d.length / 4) };
  });

  // Low key, but a readable scene: not a black rectangle, not a washed-out one.
  expect(stats.mean).toBeGreaterThan(4);
  expect(stats.mean).toBeLessThan(70);
  expect(stats.litFraction).toBeGreaterThan(0.15);
  expect(stats.peak).toBeGreaterThan(60);
  expect(problems).toEqual([]);
});

test('nothing happens until a finger arrives, and then everything does', async ({ page }) => {
  const problems = await boot(page);

  await step(page, 90);
  let s = await state(page);
  expect(s.state, 'it waits, indefinitely, for a first touch').toBe('waiting');
  expect(s.burn).toBe(0);
  expect(s.sparks).toBe(0);

  const box = await page.locator('#stage').boundingBox();
  // Deliberately off to the side and low: a child's finger must never have to
  // sit on top of the thing it is watching.
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.82);
  await page.mouse.down();
  await step(page, 30);

  s = await state(page);
  expect(s.state, 'a finger on the glass starts it').toBe('burning');
  expect(s.burn).toBeGreaterThan(0);

  await step(page, 300);
  s = await state(page);
  expect(s.firstSpark, 'and after a moment, one spark').toBe(true);
  expect(s.sparksSeen).toBeGreaterThan(0);
  expect(s.phase, 'still early in the burn').toMatch(/tsubomi|botan/);
  await page.mouse.up();
  expect(problems).toEqual([]);
});

test('one sparkler plays its whole arc and another is offered', async ({ page }) => {
  const problems = await boot(page);
  const box = await page.locator('#stage').boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.8);
  await page.mouse.down();

  // Shorten this one so the arc fits in a test rather than in an evening.
  await page.evaluate(() => {
    globalThis.__senko.session.duration = 7;
  });

  const seen = new Set();
  const peak = { sparks: 0, radius: 0 };
  for (let i = 0; i < 90; i++) {
    await step(page, 6);
    const s = await state(page);
    seen.add(s.phase);
    peak.sparks = Math.max(peak.sparks, s.sparks);
    peak.radius = Math.max(peak.radius, s.radius);
    if (s.state === 'falling') break;
  }

  for (const phase of ['tsubomi', 'botan', 'matsuba', 'yanagi']) {
    expect(seen, `the ${phase} stage must actually happen`).toContain(phase);
  }
  expect(peak.sparks).toBeGreaterThan(30);
  expect(peak.radius).toBeGreaterThan(0.003);

  const falling = await state(page);
  expect(falling.state).toBe('falling');

  const beforeFall = falling.emberY;
  await step(page, 20);
  expect((await state(page)).emberY, 'the bead drops').toBeLessThan(beforeFall);

  // Quiet, then a hand comes back with a fresh one. No words, no buttons.
  for (let i = 0; i < 120; i++) {
    await step(page, 6);
    if ((await state(page)).index === 1) break;
  }
  const fresh = await state(page);
  expect(fresh.index, 'this is the second sparkler').toBe(1);
  // The finger never left the glass, so the new one may already have caught;
  // either way it is a fresh sparkler at the very start of its life.
  expect(['waiting', 'offering', 'burning']).toContain(fresh.state);
  expect(fresh.burn).toBeLessThan(0.06);
  expect(fresh.radius).toBeLessThan(0.0025);

  await page.mouse.up();
  expect(problems).toEqual([]);
});

test('a small wobble is fine; only real waving unsettles the bead', async ({ page }) => {
  await boot(page);
  const box = await page.locator('#stage').boundingBox();
  const cx = box.x + box.width * 0.5;
  const cy = box.y + box.height * 0.8;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await step(page, 30);

  for (let i = 0; i < 30; i++) {
    await page.mouse.move(cx + Math.sin(i) * 3, cy + Math.cos(i) * 3);
    await step(page, 2);
  }
  const wobbly = await page.evaluate(() => globalThis.__senko.input.shake);
  expect(wobbly, 'a four-year-old is never perfectly still, and that is fine').toBeLessThan(0.35);

  for (let i = 0; i < 30; i++) {
    await page.mouse.move(cx + Math.sin(i * 2) * 130, cy);
    await step(page, 2);
  }
  const waved = await page.evaluate(() => globalThis.__senko.input.shake);
  expect(waved, 'but waving it about does register').toBeGreaterThan(wobbly);
  await page.mouse.up();
});

test('turning the phone re-frames without losing the sparkler', async ({ page }) => {
  const problems = await boot(page);
  const box = await page.locator('#stage').boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.8);
  await page.mouse.down();
  await step(page, 60);

  const framed = async () =>
    page.evaluate(() => {
      const a = globalThis.__senko;
      const p = a.fireball.position.clone().project(a.camera);
      const q = a.cordAnchor.clone().project(a.camera);
      return { bead: [p.x, p.y], pinch: [q.x, q.y], aspect: a.camera.aspect };
    });

  const portrait = await framed();
  expect(Math.abs(portrait.bead[0])).toBeLessThan(0.6);
  expect(Math.abs(portrait.bead[1])).toBeLessThan(0.9);

  await page.setViewportSize({ width: 844, height: 390 });
  // setViewportSize resolves before the page's own resize event is delivered.
  await page.waitForFunction(() => globalThis.__senko.camera.aspect > 1);
  await step(page, 90);
  const landscape = await framed();

  expect(landscape.aspect).toBeGreaterThan(1);
  expect(Math.abs(landscape.bead[0]), 'the bead stays in shot').toBeLessThan(0.85);
  expect(Math.abs(landscape.bead[1])).toBeLessThan(0.9);
  expect(landscape.pinch[1], 'and the hand is still above it').toBeGreaterThan(landscape.bead[1]);
  await page.mouse.up();
  expect(problems).toEqual([]);
});

test('sound comes up on the first touch and follows the stages down', async ({ page }) => {
  const problems = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(String(e)));
  // Note: no ?muted here. Chromium needs a gesture before it will start an
  // AudioContext, which is exactly the behaviour being checked.
  await page.goto('/?tier=floor&dpr=1&seed=8', { waitUntil: 'load' });
  await page.waitForFunction(() => globalThis.__senko?.frame > 0, null, { timeout: 120_000 });
  await page.evaluate(() => globalThis.__senko.stop());

  const box = await page.locator('#stage').boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.8);
  await page.mouse.down();
  await page.waitForFunction(() => globalThis.__senko.audio.ready === true, null, { timeout: 20_000 });

  await page.evaluate(() => {
    globalThis.__senko.session.duration = 7;
  });

  const levels = [];
  for (let i = 0; i < 70; i++) {
    await step(page, 6);
    levels.push(
      await page.evaluate(() => {
        const a = globalThis.__senko;
        return {
          burn: a.session.burn,
          hiss: a.audio._targets.hiss,
          sizzle: a.audio._targets.sizzle,
          crackle: a.audio._targets.crackle,
          running: a.audio.ctx.state,
        };
      })
    );
    if (levels[levels.length - 1].burn >= 1) break;
  }

  const at = (b) => levels.reduce((best, l) => (Math.abs(l.burn - b) < Math.abs(best.burn - b) ? l : best));
  const peak = at(0.55);
  const end = levels[levels.length - 1];

  expect(peak.running).toBe('running');
  expect(peak.crackle, 'matsuba should be busy').toBeGreaterThan(20);
  expect(peak.hiss).toBeGreaterThan(0);
  expect(at(0.06).crackle, 'the opening is nearly silent').toBeLessThan(2);
  // The point of the whole ending: when the sparks thin out, so does the sound.
  expect(end.crackle).toBeLessThan(peak.crackle * 0.25);
  expect(end.hiss).toBeLessThan(peak.hiss * 0.5);
  expect(end.sizzle).toBeLessThan(peak.sizzle * 0.5);

  await page.mouse.up();
  expect(problems).toEqual([]);
});
