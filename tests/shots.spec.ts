/**
 * Visual capture helper, not an assertion. Run it with SHOT_DIR set to write reference
 * frames for each chapter at a given viewport:
 *
 *   SHOT_DIR=/tmp/shots npx playwright test tests/shots.spec.ts
 */
import { test } from '@playwright/test';
import { boot, record } from './helpers';

const OUT = process.env.SHOT_DIR ?? '';

type Api = {
  jumpTo(s: string): void;
  applyAllWax(): void;
  floodDye(i: number): void;
  traceAllInk(): void;
};

const SIZES = [
  { name: 'phone-portrait', width: 390, height: 844 },
  { name: 'phone-landscape', width: 844, height: 390 },
  { name: 'tablet-portrait', width: 1024, height: 1366 },
  { name: 'tablet-landscape', width: 1366, height: 1024 },
];

for (const size of SIZES) {
  test(`reference frames at ${size.name}`, async ({ page }) => {
    test.skip(!OUT, 'set SHOT_DIR to capture reference frames');
    test.setTimeout(240_000);
    const rec = record(page);
    await page.setViewportSize({ width: size.width, height: size.height });
    await boot(page);
    const shot = (n: string) => page.screenshot({ path: `${OUT}/${size.name}-${n}.png` });
    const run = (fn: (g: Api) => void) =>
      page.evaluate(fn as never, undefined) as unknown as Promise<void>;

    await page.waitForTimeout(700);
    await shot('01-frame');

    await run(() => (window as never as { __nebuta: Api }).__nebuta.jumpTo('ink'));
    await page.waitForTimeout(1400);
    await shot('02-papered');

    await run(() => (window as never as { __nebuta: Api }).__nebuta.traceAllInk());
    await page.waitForTimeout(1200);
    await shot('03-sumi');

    await run(() => {
      const g = (window as never as { __nebuta: Api }).__nebuta;
      g.applyAllWax();
      g.floodDye(0);
      g.jumpTo('dry');
    });
    await page.waitForTimeout(1800);
    await shot('04-dyed');

    await run(() => (window as never as { __nebuta: Api }).__nebuta.jumpTo('lightUp'));
    await page.waitForTimeout(2200);
    await shot('05-dusk');

    await run(() => (window as never as { __nebuta: Api }).__nebuta.jumpTo('parade'));
    await page.waitForTimeout(4000);
    await shot('06-lit');

    console.log(`${size.name} ERRORS:`, JSON.stringify(rec.errors.slice(0, 6)));
  });
}
