import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5173/?fast=1&seed=4242');
await page.waitForFunction(() => !!window.__toami);
const rows = await page.evaluate(() => {
  const T = window.__toami, g = T.game;
  T.advance(1.0);
  T.cast({ distance: 8.5, azimuth: 0.18, sharpness: 0.7, smoothness: 0.85, wobble: 0.2 });
  const out = [];
  for (let i = 0; i < 26; i++) {
    T.advance(0.1);
    out.push({
      t: +(i * 0.1 + 0.1).toFixed(2),
      ph: g.net.phase,
      open: +g.net.openness.toFixed(2),
      R: +g.net.openRadiusNow.toFixed(2),
      cy: +g.net.center.y.toFixed(2),
      lowRim: +g.net.lowestRimY.toFixed(2),
      cone: +(g.net.coneK || 0).toFixed(2)
    });
  }
  return out;
});
console.table(rows);
await browser.close();
