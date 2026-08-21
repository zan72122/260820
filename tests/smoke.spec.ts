import { existsSync } from 'node:fs';
import { chromium, expect, test as base, type Page } from '@playwright/test';

/**
 * One pass through the whole loop, plus the input abuse a four year old will
 * actually inflict on it.
 *
 * Two things about how this is driven. Gestures are dispatched inside the page
 * and paced one move per animation frame, and every wait is measured in the
 * game's own clock (`?step=` gives it a fixed timestep). On a software
 * renderer a frame can take a second, so anything paced by the wall clock
 * would assert against a game that has barely moved.
 */

interface State {
  phase: string;
  round: number;
  lift: number;
  machineX: number;
  flipT: number;
  heroU: number;
  heroState: string;
  heroSoil: number;
  laid: number;
  leverScreen: [number, number];
  viewport: [number, number];
  simTime: number;
  podReveal: number;
  audio: boolean;
}

declare global {
  interface Window {
    __ur: { state: () => State; mute: (m: boolean) => void };
  }
}

/**
 * The runner's built-in browser fixture cannot start chromium in this
 * container, so the tests bring their own — same browser, same options, just
 * launched directly.
 */
const BUNDLED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const EXECUTABLE = process.env.PW_CHROMIUM ?? (existsSync(BUNDLED) ? BUNDLED : undefined);
const VIEWPORT = { width: 390, height: 844 };
const BASE = process.env.PW_BASE_URL ?? 'http://127.0.0.1:4173';

const test = base.extend<{ game: Page }>({
  game: async ({}, use) => {
    const browser = await chromium.launch({
      executablePath: EXECUTABLE,
      args: [
        '--enable-unsafe-swiftshader',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--ignore-gpu-blocklist',
        '--disable-dev-shm-usage',
        '--no-sandbox',
      ],
    });
    const ctx = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    await use(page);
    await browser.close();
  },
});

const state = (page: Page) => page.evaluate(() => window.__ur.state());

/** Run frames until the predicate holds or the game's own clock runs out. */
async function until(page: Page, src: string, budget = 30) {
  await page.evaluate(
    async ({ src, budget }) => {
      const pred = new Function('s', `return (${src})(s)`) as (s: State) => boolean;
      const t0 = window.__ur.state().simTime;
      while (!pred(window.__ur.state()) && window.__ur.state().simTime - t0 < budget) {
        await new Promise((r) => requestAnimationFrame(r));
      }
    },
    { src, budget }
  );
  return state(page);
}

const runSim = (page: Page, seconds: number) =>
  page.evaluate(async (s) => {
    const t0 = window.__ur.state().simTime;
    while (window.__ur.state().simTime - t0 < s) await new Promise((r) => requestAnimationFrame(r));
  }, seconds);

async function drag(page: Page, pts: [number, number][]) {
  await page.evaluate(async (points) => {
    const c = document.querySelector('canvas')!;
    const fire = (type: string, x: number, y: number) =>
      c.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 1,
          pointerType: 'touch',
          isPrimary: true,
          clientX: x,
          clientY: y,
          bubbles: true,
          cancelable: true,
        })
      );
    const raf = () => new Promise((r) => requestAnimationFrame(r));
    fire('pointerdown', points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      await raf();
      fire('pointermove', points[i][0], points[i][1]);
    }
    await raf();
    fire('pointerup', points[points.length - 1][0], points[points.length - 1][1]);
  }, pts);
}

async function tap(page: Page, x: number, y: number) {
  await drag(page, [
    [x, y],
    [x, y],
  ]);
}

const line = (a: [number, number], b: [number, number], n = 10): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);

const zig = (cx: number, cy: number, w: number, n = 16): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => [cx + Math.sin((i / n) * Math.PI * 4) * w, cy]);

const arc = (cx: number, cy: number, r: number, n = 12): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = Math.PI * 0.95 - (i / n) * Math.PI;
    return [cx + Math.cos(a) * r, cy - Math.sin(a) * r * 0.6 + r * 0.3];
  });

// a bigger fixed step keeps the whole loop inside a sane number of frames
// even on a software renderer that manages about one frame a second
const URL_FAST = '/?capture=1&fast=1&step=0.15';

test('lower, advance, shake, invert, reveal, and start the next ridge', async ({ game: page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto(BASE + URL_FAST);
  await page.waitForFunction(() => !!window.__ur);
  const { width: W, height: H } = page.viewportSize()!;

  // the first thing to touch is on screen before anyone has read anything
  let s = await state(page);
  expect(s.phase).toBe('idle');
  expect(s.leverScreen[0]).toBeGreaterThan(0);
  expect(s.leverScreen[0]).toBeLessThan(W);
  expect(s.leverScreen[1]).toBeGreaterThan(0);
  expect(s.leverScreen[1]).toBeLessThan(H);

  // taps and sideways jiggles must not start anything by themselves
  for (let i = 0; i < 8; i++) {
    await tap(page, W * 0.5, H * 0.5);
    await drag(page, line([W * 0.3, H * 0.5], [W * 0.36, H * 0.5], 3));
  }
  s = await state(page);
  expect(s.phase).toBe('idle');
  expect(s.lift).toBeLessThan(0.05);

  // a stroke abandoned halfway leaves the machine part way down and working,
  // never stuck: the next stroke picks up where it left off
  await drag(page, line([W * 0.5, H * 0.45], [W * 0.5, H * 0.56], 4));
  const partial = await state(page);
  expect(['idle', 'lower']).toContain(partial.phase);
  expect(partial.lift).toBeLessThan(0.9);

  // Play it the way a child would: look at what the machine is doing and make
  // the gesture that fits, over and over, until the plant comes over.
  const phasesSeen = new Set<string>();
  let podsBeforeInversion = 0;
  let reached: State | null = null;

  for (let guard = 0; guard < 40; guard++) {
    s = await state(page);
    phasesSeen.add(s.phase);
    if (s.heroState === 'standing' || s.heroState === 'convey') {
      podsBeforeInversion = Math.max(podsBeforeInversion, s.podReveal);
    }
    if (s.phase === 'reveal' || s.phase === 'survey') {
      reached = s;
      break;
    }
    switch (s.phase) {
      case 'idle':
      case 'lower':
        await drag(page, line(s.leverScreen, [s.leverScreen[0] + 8, s.leverScreen[1] + H * 0.2]));
        break;
      case 'advance':
        await drag(page, line([W * 0.5, H * 0.86], [W * 0.5, H * 0.5]));
        break;
      case 'shake':
        await drag(page, zig(W * 0.5, H * 0.6, W * 0.3));
        break;
      case 'flip':
        await drag(page, arc(W * 0.5, H * 0.6, Math.min(W, H) * 0.3));
        break;
      default:
        break;
    }
    await runSim(page, 0.4);
  }

  // every step of the chain actually happened (idle was asserted before the
  // first touch, above)
  expect([...phasesSeen]).toEqual(expect.arrayContaining(['lower', 'advance', 'shake', 'flip']));
  expect(reached, 'the plant should have been turned over').not.toBeNull();
  const done = reached!;

  // the pods were never on show before the plant came over
  expect(podsBeforeInversion).toBeLessThan(0.05);
  // and they are unmistakable now
  expect(done.podReveal).toBeGreaterThan(0.9);
  expect(done.heroState).toBe('laid');
  expect(done.heroSoil).toBeLessThan(0.6);
  expect(done.laid).toBeGreaterThan(0);
  expect(done.lift).toBeCloseTo(1, 1);
  expect(done.machineX).toBeGreaterThan(0.8);
  // all of it inside the first half minute of play
  expect(done.simTime).toBeLessThan(30);

  // the hold, then the wide shot, then a second ridge from one swipe
  s = await until(page, "(s) => s.phase === 'survey'");
  expect(s.phase).toBe('survey');
  await runSim(page, 1.4);
  await drag(page, line([W * 0.5, H * 0.85], [W * 0.5, H * 0.5]));
  s = await until(page, "(s) => s.round === 1", 40);
  expect(s.round).toBe(1);
  expect(s.phase).toBe('idle');
  expect(s.lift).toBeLessThan(0.1);
  expect(s.heroState).toBe('standing');
  expect(s.podReveal).toBe(0);

  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('rotating the device keeps the state and keeps the lever reachable', async ({ game: page }) => {
  await page.goto(BASE + URL_FAST);
  await page.waitForFunction(() => !!window.__ur);
  const size = page.viewportSize()!;

  const start = await state(page);
  await drag(page, line(start.leverScreen, [start.leverScreen[0], start.leverScreen[1] + size.height * 0.2]));
  const before = await state(page);
  expect(before.lift).toBeGreaterThan(0);

  await page.setViewportSize({ width: size.height, height: size.width });
  await runSim(page, 0.5);
  const after = await state(page);
  expect(after.phase).toBe(before.phase);
  expect(after.lift).toBeGreaterThanOrEqual(before.lift);
  expect(after.viewport[0]).toBe(size.height);
  expect(after.leverScreen[0]).toBeGreaterThan(0);
  expect(after.leverScreen[0]).toBeLessThan(size.height);
  expect(after.leverScreen[1]).toBeGreaterThan(0);
  expect(after.leverScreen[1]).toBeLessThan(size.width);
});
