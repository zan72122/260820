import { test } from '@playwright/test';
import { boot, record } from './helpers';

const OUT = process.env.SHOT_DIR ?? 'shots';

type Api = {
  jumpTo(s: string): void;
  applyAllWax(): void;
  floodDye(i: number): void;
  traceAllInk(): void;
};
const api = (): Api => (window as never as { __nebuta: Api }).__nebuta;

test('capture reference shots', async ({ page }) => {
  const rec = record(page);
  await boot(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/01-intro.png` });

  await page.evaluate(() => {
    const g = (window as never as { __nebuta: Api }).__nebuta;
    g.jumpTo('ink');
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/02-papered.png` });

  await page.evaluate(() => {
    const g = (window as never as { __nebuta: Api }).__nebuta;
    g.traceAllInk();
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/03-ink.png` });

  await page.evaluate(() => {
    const g = (window as never as { __nebuta: Api }).__nebuta;
    g.applyAllWax();
    g.floodDye(0);
    g.jumpTo('dry');
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/04-dye.png` });

  await page.evaluate(() => {
    const g = (window as never as { __nebuta: Api }).__nebuta;
    g.jumpTo('lightUp');
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/05-dusk.png` });

  await page.evaluate(() => {
    const g = (window as never as { __nebuta: Api }).__nebuta;
    g.jumpTo('parade');
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/06-lit.png` });

  console.log('CONSOLE ERRORS:', JSON.stringify(rec.errors.slice(0, 12)));
});

