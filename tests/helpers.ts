import type { Page } from '@playwright/test';

export const VIEWPORTS = [
  { name: 'iPhone portrait', width: 390, height: 844 },
  { name: 'iPhone landscape', width: 844, height: 390 },
  { name: 'iPad portrait', width: 820, height: 1180 },
  { name: 'iPad landscape', width: 1180, height: 820 },
];

interface Anchor {
  x: number;
  y: number;
}

declare global {
  interface Window {
    __game: {
      act: string;
      stats: {
        petals: number;
        coneHeight: number;
        flowers: number;
        drawCalls: number;
        fps: number;
        pixelRatio: number;
        webgl2: boolean;
      };
      errors: string[];
      seed: number;
      flowerSignature: { hash: number; samples: number };
      anchors(): { tip: Anchor; nail: Anchor; cake: Anchor; parchment: Anchor; lifter: Anchor };
      pointer(kind: 'down' | 'move' | 'up', x: number, y: number): void;
    };
  }
}

export async function boot(page: Page, seed = 12345) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`/?fast=1&seed=${seed}`);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 45_000 });
  await page.waitForTimeout(700);
  return errors;
}

export const act = (page: Page) => page.evaluate(() => window.__game.act);
export const stats = (page: Page) => page.evaluate(() => window.__game.stats);
export const anchors = (page: Page) => page.evaluate(() => window.__game.anchors());

/** Drag between two screen points as one continuous finger movement. */
export async function drag(
  page: Page,
  from: Anchor,
  to: Anchor,
  opts: { down?: boolean; up?: boolean; steps?: number; delay?: number } = {},
) {
  const { down = true, up = true, steps = 16, delay = 30 } = opts;
  await page.evaluate(
    async ([f, t, cfg]) => {
      const g = window.__game;
      const c = cfg as { down: boolean; up: boolean; steps: number; delay: number };
      const a = f as Anchor;
      const b = t as Anchor;
      if (c.down) g.pointer('down', a.x, a.y);
      for (let i = 0; i <= c.steps; i++) {
        g.pointer('move', a.x + ((b.x - a.x) * i) / c.steps, a.y + ((b.y - a.y) * i) / c.steps);
        await new Promise((r) => setTimeout(r, c.delay));
      }
      if (c.up) g.pointer('up', b.x, b.y);
    },
    [from, to, { down, up, steps, delay }] as const,
  );
  await page.waitForTimeout(120);
}

/** Press and hold, which is what makes cream come out. */
export async function press(page: Page, at: Anchor, ms: number) {
  await page.evaluate(
    async ([p, dur]) => {
      const g = window.__game;
      const a = p as Anchor;
      g.pointer('down', a.x, a.y);
      const t0 = performance.now();
      while (performance.now() - t0 < (dur as number)) {
        g.pointer('move', a.x, a.y);
        await new Promise((r) => setTimeout(r, 60));
      }
      g.pointer('up', a.x, a.y);
    },
    [at, ms] as const,
  );
  await page.waitForTimeout(200);
}

/** One petal: a short arc drawn around the flower with the finger down. */
export async function petalStroke(page: Page, centre: Anchor, radius: number, delay = 32) {
  await page.evaluate(
    async ([c, r, dl]) => {
      const g = window.__game;
      const a = c as Anchor;
      const rad = r as number;
      const pts: Array<[number, number]> = [];
      for (let k = 0; k < 9; k++) {
        const ang = -0.9 + (1.8 * k) / 8;
        pts.push([a.x + Math.sin(ang) * rad, a.y - Math.cos(ang) * rad * 0.5]);
      }
      g.pointer('down', pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length; k++) {
        g.pointer('move', pts[k][0], pts[k][1]);
        await new Promise((res) => setTimeout(res, dl as number));
      }
      g.pointer('up', pts[8][0], pts[8][1]);
    },
    [centre, radius, delay] as const,
  );
  await page.waitForTimeout(140);
}

/** Piping the core, then petals until the flower is ready to be moved. */
export async function pipeFlower(page: Page, petals = 8) {
  const a0 = await anchors(page);
  if ((await act(page)) === 'parchment') {
    await drag(page, a0.parchment, a0.nail);
    await page.waitForTimeout(500);
  }
  await press(page, (await anchors(page)).nail, 2600);
  for (let i = 0; i < petals; i++) {
    const a = await anchors(page);
    await petalStroke(page, a.nail, 36 + Math.min(2, Math.floor(i / 3)) * 14);
    if ((await act(page)) !== 'petals') break;
  }
}

/** Slide the lifter under the flower and carry it onto the cake. */
export async function carryToCake(page: Page) {
  // let the camera finish sliding to the transfer shot before aiming
  await page.waitForTimeout(1400);
  let a = await anchors(page);
  for (let leg = 0; leg < 3 && (await act(page)) === 'lift'; leg++) {
    a = await anchors(page);
    await drag(page, a.lifter, a.nail, { down: leg === 0, up: false, steps: 8 });
  }
  await page.waitForTimeout(300);
  for (let leg = 0; leg < 3; leg++) {
    a = await anchors(page);
    await drag(page, a.lifter, a.cake, { down: false, up: false, steps: 8 });
  }
  a = await anchors(page);
  await page.evaluate((c) => window.__game.pointer('up', (c as Anchor).x, (c as Anchor).y), a.cake);
  await page.waitForTimeout(1600);
}
