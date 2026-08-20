import { expect, test } from '@playwright/test';
import { boot, record } from './helpers';

const SIZES = [
  { name: 'iphone-portrait', width: 390, height: 844 },
  { name: 'iphone-landscape', width: 844, height: 390 },
  { name: 'ipad-portrait', width: 1024, height: 1366 },
  { name: 'ipad-landscape', width: 1366, height: 1024 },
];

type Api = {
  jumpTo(s: string): void;
  onScreen(what: 'switch' | 'nebuta' | 'hand'): { x: number; y: number; inside: boolean };
};

for (const size of SIZES) {
  test(`switch and nebuta stay on screen at ${size.name}`, async ({ page }) => {
    const rec = record(page);
    await page.setViewportSize({ width: size.width, height: size.height });
    await boot(page);
    const out = await page.evaluate(async () => {
      const g = (window as never as { __nebuta: Api }).__nebuta;
      g.jumpTo('lightUp');
      await new Promise((r) => setTimeout(r, 900));
      const sw = g.onScreen('switch');
      const nb = g.onScreen('nebuta');
      return { sw, nb };
    });
    expect(out.sw.inside, `switch off screen at ${JSON.stringify(out.sw)}`).toBe(true);
    expect(out.nb.inside, `nebuta centre off screen at ${JSON.stringify(out.nb)}`).toBe(true);
    expect(rec.errors, rec.errors.join('\n')).toEqual([]);
  });
}
