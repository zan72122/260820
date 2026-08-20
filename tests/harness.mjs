import { chromium } from 'playwright';
import fs from 'node:fs';

export const SIZES = {
  phone: { width: 390, height: 844, dpr: 2, mobile: true },
  phoneLand: { width: 844, height: 390, dpr: 2, mobile: true },
  pad: { width: 820, height: 1180, dpr: 2, mobile: true },
  padLand: { width: 1180, height: 820, dpr: 2, mobile: true },
  desk: { width: 1280, height: 800, dpr: 1, mobile: false },
};

export async function open(sizeName = 'desk', { fast = true, dpr } = {}) {
  const size = SIZES[sizeName];
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: dpr ?? (fast ? 1 : size.dpr),
    isMobile: size.mobile,
    hasTouch: size.mobile,
  });
  const page = await context.newPage();
  const logs = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  await page.goto(`http://localhost:5173/${fast ? '?fast=1' : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__imo, null, { timeout: 60000 });
  await page.evaluate(() => window.__imo.manual(true));

  const api = {
    page,
    browser,
    context,
    logs,
    size,
    async sim(seconds, render = false) {
      await page.evaluate(
        ([s, r]) => {
          const steps = Math.round(s * 60);
          for (let i = 0; i < steps; i++) window.__imo.tick(1 / 60, r && i === steps - 1);
        },
        [seconds, render],
      );
    },
    state: () => page.evaluate(() => window.__imo.state()),
    async shot(name) {
      fs.mkdirSync('shots', { recursive: true });
      await page.evaluate(() => window.__imo.tick(1 / 60, true));
      await page.screenshot({ path: `shots/${name}.png` });
    },
    /** Press, move through `pts` one simulated frame at a time, release. */
    async drag(pts, { hold = 0, framesPerPoint = 2, release = true } = {}) {
      // a finger cannot leave the glass: keep every sample on screen
      const m = 6;
      pts = pts.map((p) => ({
        x: Math.min(size.width - m, Math.max(m, p.x)),
        y: Math.min(size.height - m, Math.max(m, p.y)),
      }));
      await page.mouse.move(pts[0].x, pts[0].y);
      await page.mouse.down();
      await api.sim(1 / 60);
      for (let i = 1; i < pts.length; i++) {
        await page.mouse.move(pts[i].x, pts[i].y);
        for (let f = 0; f < framesPerPoint; f++) await api.sim(1 / 60);
      }
      if (hold) await api.sim(hold);
      if (release) {
        await page.mouse.up();
        await api.sim(2 / 60);
      }
    },
    async close() {
      await browser.close();
    },
  };
  await api.sim(0.5);
  await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 15000 }).catch(() => {});
  return api;
}

export const line = (a, b, n = 10) =>
  Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }));

/** Back-and-forth sweep across an area, the way a hand clears soil. */
export const circle = (c, rx, ry, rows = 5, n = 10) => {
  const pts = [];
  for (let r = 0; r <= rows; r++) {
    const y = c.y - ry + (2 * ry * r) / rows;
    for (let i = 0; i <= n; i++) {
      const t = r % 2 === 0 ? i / n : 1 - i / n;
      pts.push({ x: c.x - rx + 2 * rx * t, y });
    }
  }
  return pts;
};
