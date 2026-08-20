import { expect, test, type Page } from '@playwright/test';

/**
 * Everything the page exposes for automation, mirrored from src/main.ts.
 *
 * The suite drives the simulation through `frames()` rather than waiting on
 * wall-clock time: under SwiftShader the renderer manages a couple of frames a
 * second, and a test that waits for real seconds measures the CI runner rather
 * than the game.
 */
interface GeodeApi {
  readonly step: string;
  readonly quality: string;
  readonly mud: number;
  readonly powder: number;
  readonly variety: string;
  readonly seed: number;
  readonly shot: string;
  readonly open: number;
  readonly choicesVisible: boolean;
  readonly pos: { x: number; y: number };
  go(step: string): void;
  restart(seed?: number): void;
  scrub(amount?: number): void;
  sweep(amount?: number): void;
  tap(x?: number, y?: number): void;
  drag(x0: number, y0: number, x1: number, y1: number, steps?: number): void;
  press(x: number, y: number): void;
  move(x: number, y: number, steps?: number): void;
  release(x?: number, y?: number): void;
  rub(cx: number, cy: number, rx?: number, ry?: number, laps?: number, samples?: number): void;
  frames(n?: number, dt?: number): void;
}

declare global {
  interface Window { __GEODE__: GeodeApi }
}

const FAST_URL = '/?fast=1&seed=20260820';

async function boot(page: Page, url = FAST_URL): Promise<void> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  (page as Page & { __errors?: string[] }).__errors = errors;

  await page.goto(url);
  await page.waitForFunction(() => Boolean(window.__GEODE__), null, { timeout: 60_000 });
}

const errorsOf = (page: Page): string[] =>
  (page as Page & { __errors?: string[] }).__errors ?? [];

/** Read one value out of the page's automation API. */
const read = <T>(page: Page, fn: (g: GeodeApi) => T): Promise<T> =>
  page.evaluate<T, string>(
    (src) => (new Function(`return (${src})(window.__GEODE__)`) as () => T)(),
    fn.toString(),
  );

/** Run a statement against the automation API (`g` is bound to it). */
const call = (page: Page, body: string): Promise<void> =>
  page.evaluate<void, string>(
    (src) => { (new Function(`const g = window.__GEODE__; ${src}`) as () => void)(); },
    body,
  );

/** Advance the simulation until the named step is current. */
async function advanceTo(page: Page, step: string, budget = 300): Promise<void> {
  for (let i = 0; i < budget; i++) {
    if (await read(page, (g) => g.step) === step) return;
    await call(page, 'g.frames(10);');
  }
  throw new Error(`never reached "${step}" (stuck in "${await read(page, (g) => g.step)}")`);
}

test.describe('パカッ！ひみつのジオード', () => {
  test('boots and reaches the first verb with the stone still covered', async ({ page }) => {
    await boot(page);
    expect(await read(page, (g) => g.variety)).toBeTruthy();
    await advanceTo(page, 'wash');
    expect(await read(page, (g) => g.shot)).toBe('wash');
    // The whole reveal depends on the stone starting as an anonymous lump.
    expect(await read(page, (g) => g.mud)).toBeGreaterThan(0.9);
    expect(errorsOf(page)).toEqual([]);
  });

  test('rubbing the stone actually takes the mud off', async ({ page }) => {
    await boot(page);
    await advanceTo(page, 'wash');

    const before = await read(page, (g) => g.mud);
    await call(page, 'const p = g.pos; g.rub(p.x, p.y, 52, 40, 2);');
    const after = await read(page, (g) => g.mud);

    // One pass over the visible face should be unmistakable progress, not a
    // rounding error — this is the moment the stone stops being a rock.
    expect(after).toBeLessThan(before - 0.25);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a real gesture on the canvas reaches the game', async ({ page }) => {
    await boot(page);
    await advanceTo(page, 'wash');

    const box = await page.locator('#stage').boundingBox();
    if (!box) throw new Error('canvas has no box');
    const c = await read(page, (g) => g.pos);
    const before = await read(page, (g) => g.mud);

    await page.mouse.move(box.x + c.x, box.y + c.y);
    await page.mouse.down();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      await page.mouse.move(box.x + c.x + Math.cos(a) * 46, box.y + c.y + Math.sin(a) * 34);
    }
    await page.mouse.up();

    expect(await read(page, (g) => g.mud)).toBeLessThan(before);
    expect(errorsOf(page)).toEqual([]);
  });

  test('plays the whole loop through to the three choices', async ({ page }) => {
    await boot(page);

    // --- wash ---
    await advanceTo(page, 'wash');
    for (let i = 0; i < 10 && await read(page, (g) => g.step) === 'wash'; i++) {
      await call(page, `const p = g.pos; g.rub(p.x + ${i % 2 ? 18 : -18}, p.y, 56, 42, 3); g.frames(20);`);
    }
    await advanceTo(page, 'place');

    // --- place: carry it to the cradle ---
    await call(page, 'const p = g.pos; g.drag(p.x, p.y, p.x + 220, p.y - 10, 26);');
    await advanceTo(page, 'crack');

    // --- crack: the stone must give within a handful of taps ---
    let taps = 0;
    while (await read(page, (g) => g.shot) !== 'crack' && taps < 8) {
      await call(page, 'const p = g.pos; g.tap(p.x, p.y); g.frames(45);');
      taps++;
    }
    expect(taps, 'the stone should split within a few taps').toBeLessThanOrEqual(6);
    await advanceTo(page, 'open');

    // --- open: pull the lid off ---
    for (let i = 0; i < 6 && await read(page, (g) => g.step) === 'open'; i++) {
      await call(page, 'const p = g.pos; g.drag(p.x, p.y + 50, p.x, p.y - 190, 22); g.frames(30);');
    }
    await advanceTo(page, 'dust');
    expect(await read(page, (g) => g.open)).toBeGreaterThan(0.9);

    // --- dust ---
    await call(page, 'g.sweep(1);');
    await advanceTo(page, 'hold');

    // --- hold, then set it on the velvet in one gesture ---
    await call(page, `const p = g.pos;
      g.press(p.x, p.y + 30);
      g.move(p.x, p.y - 170, 26);
      g.frames(30);
      const q = g.pos;
      g.move(q.x + 260, q.y + 80, 30);
      g.release();`);
    await advanceTo(page, 'display');

    // --- the run ends on three wordless choices ---
    for (let i = 0; i < 200 && !await read(page, (g) => g.choicesVisible); i++) {
      await call(page, 'g.frames(10);');
    }
    expect(await read(page, (g) => g.choicesVisible)).toBe(true);
    await expect(page.locator('.choice')).toHaveCount(3);
    // No words anywhere on screen — the choices are pictures.
    for (const btn of await page.locator('.choice').all()) {
      expect((await btn.innerText()).trim()).toBe('');
    }
    expect(errorsOf(page)).toEqual([]);
  });

  test('the choices open the gallery and start a fresh stone', async ({ page }) => {
    await boot(page);
    await call(page, "g.go('display');");
    for (let i = 0; i < 200 && !await read(page, (g) => g.choicesVisible); i++) {
      await call(page, 'g.frames(10);');
    }

    await page.locator('.choice').nth(2).click();
    await expect(page.locator('.gallery')).toBeVisible();
    await page.locator('.gallery-close').click();
    await expect(page.locator('.gallery')).toHaveCount(0, { timeout: 5_000 });

    const before = await read(page, (g) => g.seed);
    await page.locator('.choice').nth(1).click();
    await advanceTo(page, 'intro');
    expect(await read(page, (g) => g.seed)).not.toBe(before);
    // A new stone starts caked again, or there is nothing to discover.
    expect(await read(page, (g) => g.mud)).toBeGreaterThan(0.9);
    expect(errorsOf(page)).toEqual([]);
  });

  test('replaying the same stone keeps its identity', async ({ page }) => {
    await boot(page);
    const first = await read(page, (g) => `${g.variety}:${g.seed}`);
    await call(page, 'g.scrub(1);');
    await call(page, 'g.restart();');
    await advanceTo(page, 'intro');
    expect(await read(page, (g) => `${g.variety}:${g.seed}`)).toBe(first);
    expect(await read(page, (g) => g.mud)).toBeGreaterThan(0.9);
  });

  test('a seed reproduces the same stone across loads', async ({ page }) => {
    await boot(page, '/?fast=1&seed=777');
    const first = await read(page, (g) => `${g.variety}:${g.seed}`);
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__GEODE__), null, { timeout: 60_000 });
    expect(await read(page, (g) => `${g.variety}:${g.seed}`)).toBe(first);
  });

  test('survives a portrait / landscape flip', async ({ page }) => {
    await boot(page);
    await advanceTo(page, 'wash');
    await page.setViewportSize({ width: 720, height: 390 });
    await call(page, 'g.frames(20);');
    await page.setViewportSize({ width: 390, height: 720 });
    await call(page, 'g.frames(20);');
    // The stone must still be somewhere sane on screen after a reflow.
    const p = await read(page, (g) => g.pos);
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(390);
    expect(p.y).toBeGreaterThan(0);
    expect(p.y).toBeLessThan(720);
    expect(errorsOf(page)).toEqual([]);
  });
});
