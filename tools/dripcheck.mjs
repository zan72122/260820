import { chromium } from '@playwright/test';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1180, height: 820 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://localhost:5173/?fast=1&q=high&seed=4242' + (process.env.BIG ? '&big=1' : ''));
await p.waitForFunction(() => !!window.__toami);
await p.waitForFunction(() => !document.getElementById('boot'));
const r = await p.evaluate(() => {
  const T = window.__toami, g = T.game;
  T.advance(1.0);
  T.cast({ distance: 8.5, azimuth: 0.18, sharpness: 0.7, smoothness: 0.85, wobble: 0.2 });
  T.advance(3.4); T.haul();
  const out = [];
  for (let i = 0; i < 5; i++) {
    T.advance(0.25);
    const d = g.spray.data;
    let live = 0, drips = 0, minY = 9e9, maxY = -9e9;
    for (let k = 0; k < g.spray.n; k++) {
      if (d[k*4] > 0) { live++; if (d[k*4+3] === 1) { drips++;
        minY = Math.min(minY, g.spray.pos[k*3+1]); maxY = Math.max(maxY, g.spray.pos[k*3+1]); } }
    }
    out.push({ t: +(0.25*(i+1)).toFixed(2), phase: g.net.phase, live, drips,
      dripY: drips ? [+minY.toFixed(2), +maxY.toFixed(2)] : null,
      netY: +g.net.center.y.toFixed(2), wet: +g.net.wetness.toFixed(2) });
  }
  return out;
});
console.table(r);
await p.screenshot({ path: 'shots/debug-drip.png' });
await b.close();
