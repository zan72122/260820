import { expect, test, type Page } from '@playwright/test';

type State = {
  beat: string;
  cameraMode: string;
  revealProgress: number;
  arcs: number;
  openArcs: number;
  amplitudeDeg: number;
  omega: number;
  theta: number;
  phase: number;
  hintVisible: boolean;
  elapsed: number;
  minAmp: number;
  maxAmp: number;
  drawCalls: number;
  triangles: number;
  seatScreen: { x: number; y: number };
};

declare global {
  interface Window {
    __rainbow: {
      state: () => State;
      pump: (strength?: number, dir?: number) => void;
      advance: (seconds: number, step?: number) => void;
      render: () => void;
      restart: () => void;
      trailStats: () => {
        activeVerts: number;
        zMin: number;
        zMax: number;
        yMin: number;
        yMax: number;
        xMin: number;
        xMax: number;
        archiveFilled: number;
        visibleMeshes: number;
      };
      camera: () => { position: number[]; fov: number; aspect: number };
      settings: { seed: number; tier: string };
    };
  }
}

async function boot(page: Page): Promise<void> {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?fast=1&seed=20260821');
  await page.waitForFunction(() => !!window.__rainbow, null, { timeout: 30_000 });
  await page.waitForTimeout(400);
  (page as Page & { __errors: string[] }).__errors = errors;
}

const state = (page: Page) => page.evaluate(() => window.__rainbow.state());
const advance = (page: Page, s: number) =>
  page.evaluate((sec) => {
    window.__rainbow.advance(sec);
    window.__rainbow.render();
  }, s);

/** Pump the way a child does: swipe roughly along the way it is already going. */
async function pumpFor(page: Page, seconds: number, strength = 0.85): Promise<void> {
  const period = 1.5;
  let left = seconds;
  while (left > 0) {
    await page.evaluate((s) => window.__rainbow.pump(s), strength);
    const chunk = Math.min(period, left);
    await advance(page, chunk);
    left -= chunk;
  }
}

test('one full loop: gust, first arc, guide, big arc, weave, reveal, free play', async ({ page }, info) => {
  await boot(page);

  // --- The gust. Nobody pushed it; it is moving, barely. ---
  let s = await state(page);
  expect(s.beat).toBe('gust');
  expect(s.arcs).toBe(0);

  await advance(page, 3.0);
  s = await state(page);
  expect(s.amplitudeDeg).toBeGreaterThan(4);
  expect(s.amplitudeDeg).toBeLessThan(16);

  // --- The first faint arc appears on its own. ---
  await advance(page, 3.0);
  s = await state(page);
  expect(s.arcs).toBeGreaterThanOrEqual(1);
  expect(['wonder', 'guiding']).toContain(s.beat);
  const firstArcAmp = s.maxAmp;
  await page.screenshot({ path: info.outputPath('01-first-arc.png') });

  // --- The single guide gesture is offered. ---
  await page.waitForFunction(
    () => {
      window.__rainbow.advance(0.5);
      return window.__rainbow.state().hintVisible;
    },
    null,
    { timeout: 20_000 },
  );
  s = await state(page);
  expect(s.beat).toBe('guiding');
  await page.evaluate(() => window.__rainbow.render());
  await page.screenshot({ path: info.outputPath('02-guide.png') });

  // The guide sits clear of the point where the colour is born.
  const seat = s.seatScreen;
  const box = page.viewportSize()!;
  expect(seat.y).toBeGreaterThan(0);
  expect(seat.y).toBeLessThan(box.height * 0.8);

  // --- One gesture: the amplitude grows and the next arc is bigger. ---
  await pumpFor(page, 9, 0.95);
  s = await state(page);
  expect(s.amplitudeDeg).toBeGreaterThan(firstArcAmp * (180 / Math.PI) + 4);
  expect(s.maxAmp).toBeGreaterThan(0.3);

  // --- The guide is gone for good once the child has made a big arc. ---
  await advance(page, 3);
  s = await state(page);
  expect(s.beat).not.toBe('guiding');
  expect(s.hintVisible).toBe(false);
  await page.screenshot({ path: info.outputPath('03-big-arc.png') });

  // --- Free play: varied strokes, so inner and outer arcs both exist. ---
  await pumpFor(page, 12, 1.0);
  await advance(page, 9); // let it decay: small inner arcs
  await pumpFor(page, 9, 0.45);
  await advance(page, 6);
  await pumpFor(page, 14, 1.0);

  s = await state(page);
  expect(s.arcs).toBeGreaterThan(10);
  expect(s.maxAmp - s.minAmp).toBeGreaterThan(0.16);

  // --- The arcs are world-space ribbons, not a 2D overlay. ---
  const stats = await page.evaluate(() => window.__rainbow.trailStats());
  expect(stats.activeVerts).toBeGreaterThan(200);
  // Two threads leave the seat's left and right edges, so depth genuinely spreads.
  expect(stats.zMax - stats.zMin).toBeGreaterThan(0.3);
  expect(stats.yMax - stats.yMin).toBeGreaterThan(0.3);
  expect(stats.xMax - stats.xMin).toBeGreaterThan(1.0);
  // Old threads have been consolidated into the single archive mesh.
  expect(stats.archiveFilled).toBeGreaterThan(0);

  // --- The camera lifts, then pulls back. No cut ever happens mid-arc. ---
  await page.waitForFunction(
    () => {
      window.__rainbow.pump(0.9);
      window.__rainbow.advance(1.5);
      const st = window.__rainbow.state();
      return st.cameraMode === 'reveal' || st.cameraMode === 'free';
    },
    null,
    { timeout: 60_000 },
  );
  await page.evaluate(() => window.__rainbow.render());
  await page.screenshot({ path: info.outputPath('04-reveal-start.png') });

  await page.waitForFunction(
    () => {
      window.__rainbow.advance(1.0);
      return window.__rainbow.state().cameraMode === 'free';
    },
    null,
    { timeout: 60_000 },
  );
  s = await state(page);
  expect(s.beat).toBe('open');
  await page.evaluate(() => window.__rainbow.render());
  await page.screenshot({ path: info.outputPath('05-reveal-free.png') });

  // --- The replay control is offered, and play continues in the same space. ---
  await expect(page.locator('#replay')).toHaveClass(/on/);
  const before = (await state(page)).arcs;
  await pumpFor(page, 6, 0.9);
  expect((await state(page)).arcs).toBeGreaterThan(before);

  // --- Transparent load stays bounded. ---
  expect(s.drawCalls).toBeLessThan(110);

  // --- Replay resets the weaving but keeps the same park. ---
  await page.evaluate(() => window.__rainbow.restart());
  await advance(page, 0.2);
  s = await state(page);
  expect(s.arcs).toBe(0);
  expect(s.beat).toBe('gust');
  expect(s.cameraMode).toBe('watch');

  expect((page as Page & { __errors: string[] }).__errors).toEqual([]);
});

test('rotating the device reframes without losing the weaving', async ({ page }, info) => {
  await boot(page);
  await advance(page, 6);
  await pumpFor(page, 16, 0.95);
  const before = await state(page);
  expect(before.arcs).toBeGreaterThan(3);

  const size = page.viewportSize()!;
  await page.setViewportSize({ width: size.height, height: size.width });
  await page.waitForTimeout(450);
  await advance(page, 0.4);

  const after = await state(page);
  expect(after.arcs).toBeGreaterThanOrEqual(before.arcs);
  const stats = await page.evaluate(() => window.__rainbow.trailStats());
  expect(stats.activeVerts).toBeGreaterThan(100);

  const cam = await page.evaluate(() => window.__rainbow.camera());
  expect(cam.aspect).toBeCloseTo(size.height / size.width, 1);
  await page.screenshot({ path: info.outputPath('rotated.png') });

  expect((page as Page & { __errors: string[] }).__errors).toEqual([]);
});

test('the arc bottom is never behind the guide stroke', async ({ page }) => {
  await boot(page);
  await advance(page, 8);
  const vp = page.viewportSize()!;
  const s = await state(page);
  // The colour is born at the bottom of the arc; the guide is offered a fifth of
  // the screen below it, so a finger on the guide cannot cover the birth point.
  expect(s.seatScreen.y).toBeLessThan(vp.height * 0.72);
  expect(s.seatScreen.x).toBeGreaterThan(vp.width * 0.1);
  expect(s.seatScreen.x).toBeLessThan(vp.width * 0.9);
});

test('a real arc swipe on the canvas drives the swing, and replay is tappable', async ({ page }) => {
  await boot(page);
  await advance(page, 6);
  const before = await state(page);

  const vp = page.viewportSize()!;
  const cx = vp.width * 0.5;
  const cy = vp.height * 0.72;
  const r = Math.min(vp.width, vp.height) * 0.3;

  // Draw a broad arc with one finger, the way the guide stroke asks for.
  const sweep = async (sign: number): Promise<void> => {
    await page.mouse.move(cx - sign * r, cy);
    await page.mouse.down();
    for (let i = 1; i <= 14; i++) {
      const t = i / 14;
      await page.mouse.move(cx + sign * r * (2 * t - 1), cy - Math.sin(t * Math.PI) * r * 0.42);
    }
    await page.mouse.up();
  };

  for (let i = 0; i < 6; i++) {
    await sweep(i % 2 === 0 ? 1 : -1);
    await advance(page, 1.6);
  }

  const after = await state(page);
  expect(after.amplitudeDeg).toBeGreaterThan(before.amplitudeDeg + 5);
  expect(after.playerEnergy).toBeGreaterThan(0);

  // A second finger must never become a gesture.
  const energyMark = (await state(page)).playerEnergy;
  await page.touchscreen.tap(cx, cy).catch(() => undefined);
  await advance(page, 0.3);
  expect((await state(page)).playerEnergy).toBeLessThanOrEqual(energyMark + 0.01);

  // The replay control still receives its own tap through the input layer.
  await page.evaluate(() => document.getElementById('replay')!.classList.add('on'));
  await page.locator('#replay').click();
  await advance(page, 0.2);
  expect((await state(page)).arcs).toBe(0);

  expect((page as Page & { __errors: string[] }).__errors).toEqual([]);
});
