import { expect, test } from '@playwright/test';
import { boot, record } from './helpers';

const SIZES = [
  { name: 'iphone-portrait', width: 390, height: 844 },
  { name: 'iphone-landscape', width: 844, height: 390 },
  { name: 'ipad-portrait', width: 1024, height: 1366 },
  { name: 'ipad-landscape', width: 1366, height: 1024 },
];

type Api = { jumpTo(s: string): void; floodDye(i: number): void };

for (const size of SIZES) {
  test(`controls fit and never overlap at ${size.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    const rec = record(page);
    await page.setViewportSize({ width: size.width, height: size.height });
    await boot(page);
    await page.evaluate(() => {
      const g = (window as never as { __nebuta: Api }).__nebuta;
      g.jumpTo('dye');
      g.floodDye(0);
    });
    await page.waitForSelector('.palette.show', { timeout: 30_000 });
    await page.waitForSelector('.bigbtn.show', { timeout: 60_000 });
    // the tray slides in on a CSS transition; measure only once it has stopped moving
    await page.waitForFunction(
      () => {
        const w = window as never as { __last?: number; __same?: number };
        const r = document.querySelector('.palette')!.getBoundingClientRect().right;
        w.__same = w.__last !== undefined && Math.abs(w.__last - r) < 0.01 ? (w.__same ?? 0) + 1 : 0;
        w.__last = r;
        return (w.__same ?? 0) >= 3;
      },
      null,
      { timeout: 30_000, polling: 150 },
    );

    const report = await page.evaluate(() => {
      const rects = (sel: string) =>
        [...document.querySelectorAll(sel)].map((e) => {
          const r = e.getBoundingClientRect();
          return { sel, x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
        });
      const swatches = [...document.querySelectorAll<HTMLElement>('.swatch')].map((e) => {
        const r = e.getBoundingClientRect();
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        const hit = document.elementFromPoint(cx, cy);
        return {
          label: e.getAttribute('aria-label'),
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
          right: r.right,
          bottom: r.bottom,
          // the expanded ::after gives at least a 72px target even when the circle is smaller
          target: r.width + 18,
          reachable: hit === e || e.contains(hit),
        };
      });
      return {
        vw: window.innerWidth,
        vh: window.innerHeight,
        swatches,
        button: rects('.bigbtn')[0],
        hint: rects('.hint')[0],
        steps: rects('.steps')[0],
        mute: rects('.corner')[0],
      };
    });

    console.log(`LAYOUT ${size.name}:`, JSON.stringify(report));
    for (const sw of report.swatches) {
      expect(sw.x, `${sw.label} runs off the left`).toBeGreaterThanOrEqual(0);
      expect(sw.right, `${sw.label} runs off the right`).toBeLessThanOrEqual(report.vw);
      expect(sw.y, `${sw.label} runs off the top`).toBeGreaterThanOrEqual(0);
      expect(sw.bottom, `${sw.label} runs off the bottom`).toBeLessThanOrEqual(report.vh);
      expect(sw.target, `${sw.label} touch target is under 72px`).toBeGreaterThanOrEqual(72);
      expect(sw.reachable, `${sw.label} is covered by something else`).toBe(true);
    }

    const overlaps = (
      a: { x: number; y: number; right: number; bottom: number },
      b: { x: number; y: number; right: number; bottom: number },
    ) => a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;

    console.log(`LAYOUT ${size.name}:`, JSON.stringify(report));
    for (const sw of report.swatches) {
      expect(overlaps(report.button, sw), `the big button covers ${sw.label}`).toBe(false);
    }
    // an absolutely positioned control with both edges pinned silently stretches: catch it
    expect(report.button.w, 'the big button stretched across the screen').toBeLessThan(
      report.vw * 0.6,
    );
    expect(report.mute.w, 'the sound button stretched across the screen').toBeLessThan(160);
    expect(overlaps(report.hint, report.steps), 'the hint covers the step dots').toBe(false);
    expect(overlaps(report.hint, report.mute), 'the hint covers the sound button').toBe(false);
    expect(rec.errors, rec.errors.join('\n')).toEqual([]);
  });
}
