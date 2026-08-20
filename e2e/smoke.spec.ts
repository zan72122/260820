import { expect, test, type Page } from '@playwright/test';

/** Everything the page exposes for automation, mirrored from src/main.ts. */
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
  go(step: string): void;
  restart(seed?: number): void;
  scrub(amount?: number): void;
  sweep(amount?: number): void;
  tap(x?: number, y?: number): void;
  drag(x0: number, y0: number, x1: number, y1: number, steps?: number): void;
  frames(n?: number, dt?: number): void;
}

declare global {
  interface Window { __GEODE__: GeodeApi }
}

const URL_FAST = '/?fast=1&seed=20260820';

async function boot(page: Page, url = URL_FAST): Promise<void> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  (page as Page & { __errors?: string[] }).__errors = errors;

  await page.goto(url);
  await page.waitForFunction(() => Boolean(window.__GEODE__), null, { timeout: 60_000 });
}

function errorsOf(page: Page): string[] {
  return (page as Page & { __errors?: string[] }).__errors ?? [];
}

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

test.describe('パカッ！ひみつのジオード', () => {
  test('boots, renders, and reaches the wash step without errors', async ({ page }) => {
    await boot(page);
    expect(await read(page, (g) => g.variety)).toBeTruthy();
    // The intro is a held beat, then the game moves itself to the first verb.
    await page.waitForFunction(() => window.__GEODE__.step === 'wash', null, { timeout: 20_000 });
    expect(await read(page, (g) => g.shot)).toBe('wash');
    // The stone must start covered: the reveal depends on it.
    expect(await read(page, (g) => g.mud)).toBeGreaterThan(0.9);
    expect(errorsOf(page)).toEqual([]);
  });

  test('washing the stone uncovers it and advances to placing', async ({ page }) => {
    await boot(page);
    await page.waitForFunction(() => window.__GEODE__.step === 'wash', null, { timeout: 20_000 });

    // Real strokes across the stone, not a state poke.
    const box = await page.locator('#stage').boundingBox();
    if (!box) throw new Error('canvas has no box');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      await page.mouse.move(cx + Math.cos(a) * 46, cy + Math.sin(a) * 34);
      if (i === 0) await page.mouse.down();
      await page.mouse.move(cx + Math.cos(a + 0.6) * 46, cy + Math.sin(a + 0.6) * 34, { steps: 4 });
    }
    await page.mouse.up();

    const mudAfter = await read(page, (g) => g.mud);
    expect(mudAfter).toBeLessThan(0.98);

    // Finish the job deterministically and confirm the step hands over.
    await call(page, 'g.scrub(1);');
    await page.waitForFunction(() => window.__GEODE__.step === 'place', null, { timeout: 20_000 });
    expect(errorsOf(page)).toEqual([]);
  });

  test('plays the full loop through to the three choices', async ({ page }) => {
    await boot(page);
    await page.waitForFunction(() => window.__GEODE__.step === 'wash', null, { timeout: 20_000 });
    await call(page, 'g.scrub(1);');
    await page.waitForFunction(() => window.__GEODE__.step === 'place', null, { timeout: 20_000 });

    const box = await page.locator('#stage').boundingBox();
    if (!box) throw new Error('canvas has no box');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Carry the stone rightward into the cradle.
    await page.mouse.move(cx - 40, cy + 10);
    await page.mouse.down();
    await page.mouse.move(cx + 90, cy + 4, { steps: 14 });
    await page.mouse.up();
    await page.waitForFunction(() => window.__GEODE__.step === 'crack', null, { timeout: 20_000 });

    // Three taps to split it. The first light out of the crack is the whole game.
    for (let i = 0; i < 4; i++) {
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(650);
    }
    await page.waitForFunction(() => window.__GEODE__.step === 'open', null, { timeout: 25_000 });

    // Pull the lid the rest of the way open.
    for (let i = 0; i < 3 && await read(page, (g) => g.step) === 'open'; i++) {
      await page.mouse.move(cx, cy + 40);
      await page.mouse.down();
      await page.mouse.move(cx, cy - 150, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(400);
    }
    await page.waitForFunction(() => window.__GEODE__.step === 'dust', null, { timeout: 25_000 });
    expect(await read(page, (g) => g.open)).toBeGreaterThan(0.9);

    await call(page, 'g.sweep(1);');
    await page.waitForFunction(() => window.__GEODE__.step === 'hold', null, { timeout: 20_000 });

    // Lift, then carry across to the velvet.
    await page.mouse.move(cx, cy + 20);
    await page.mouse.down();
    await page.mouse.move(cx + 30, cy - 90, { steps: 10 });
    await page.mouse.move(cx + 150, cy - 30, { steps: 14 });
    await page.mouse.up();
    await page.waitForFunction(() => window.__GEODE__.step === 'display', null, { timeout: 25_000 });

    // The run ends on three wordless choices.
    await page.waitForFunction(() => window.__GEODE__.choicesVisible, null, { timeout: 20_000 });
    await expect(page.locator('.choice')).toHaveCount(3);
    expect(errorsOf(page)).toEqual([]);
  });

  test('the choices restart the loop and open the gallery', async ({ page }) => {
    await boot(page);
    await call(page, "g.go('display');");
    await page.waitForFunction(() => window.__GEODE__.choicesVisible, null, { timeout: 25_000 });

    await page.locator('.choice').nth(2).click();
    await expect(page.locator('.gallery')).toBeVisible();
    await page.locator('.gallery-close').click();
    await expect(page.locator('.gallery')).toHaveCount(0, { timeout: 5_000 });

    const before = await read(page, (g) => g.seed);
    await page.locator('.choice').nth(1).click();
    await page.waitForFunction(() => window.__GEODE__.step === 'intro', null, { timeout: 20_000 });
    expect(await read(page, (g) => g.seed)).not.toBe(before);
    expect(await read(page, (g) => g.mud)).toBeGreaterThan(0.9);
    expect(errorsOf(page)).toEqual([]);
  });

  test('a seed reproduces the same stone', async ({ page }) => {
    await boot(page, '/?fast=1&seed=777');
    const first = await read(page, (g) => `${g.variety}:${g.seed}`);
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__GEODE__), null, { timeout: 60_000 });
    expect(await read(page, (g) => `${g.variety}:${g.seed}`)).toBe(first);
  });

  test('survives a portrait/landscape flip', async ({ page }) => {
    await boot(page);
    await page.setViewportSize({ width: 720, height: 390 });
    await page.waitForTimeout(600);
    await page.setViewportSize({ width: 390, height: 720 });
    await page.waitForTimeout(600);
    expect(await read(page, (g) => g.step)).toBeTruthy();
    expect(errorsOf(page)).toEqual([]);
  });
});
