import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5173/?fast=1&seed=4242');
await page.waitForFunction(() => !!window.__toami);
const out = await page.evaluate(() => {
  const T = window.__toami, g = T.game;
  T.advance(1.0);
  T.cast({ distance: 8.5, azimuth: 0.18, sharpness: 0.7, smoothness: 0.85, wobble: 0.2 });
  T.advance(3.0);
  T.haul();
  const rows = [];
  const V = g.net.center.constructor;
  for (let i = 0; i < 22; i++) {
    T.advance(0.12);
    const cam = g.camera; cam.updateMatrixWorld();
    const n = g.net;
    let minx=9e9,maxx=-9e9,miny=9e9,maxy=-9e9;
    const v = new V();
    for (let k = 0; k < n.count; k++) {
      v.set(n.p[k*3], n.p[k*3+1], n.p[k*3+2]).project(cam);
      minx=Math.min(minx,v.x);maxx=Math.max(maxx,v.x);miny=Math.min(miny,v.y);maxy=Math.max(maxy,v.y);
    }
    rows.push({ t:+(i*0.12+0.12).toFixed(2), ph:n.phase, R:+n.openRadiusNow.toFixed(2), close:+(n.closeK??0).toFixed(2),
      cy:+n.center.y.toFixed(2), wide:+((maxx-minx)*0.5*393).toFixed(0), tall:+((maxy-miny)*0.5*852).toFixed(0) });
  }
  return rows;
});
console.table(out);
await browser.close();
