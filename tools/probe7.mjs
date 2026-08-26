import { chromium } from '@playwright/test';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 393, height: 852 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://localhost:5173/?fast=1&q=high&seed=4242');
await p.waitForFunction(() => !!window.__toami);
await p.waitForFunction(() => !document.getElementById('boot'));
const info = await p.evaluate(() => {
  const T = window.__toami, g = T.game;
  T.advance(1.0);
  T.cast({ distance: 7.5, azimuth: -0.35, sharpness: 0.55, smoothness: 0.9, wobble: 0.15 });
  T.advance(3.0);
  return { trapped: g.trapped, state: g.state, shoals: g.fishes.shoals.length };
});
console.log('A', JSON.stringify(info));
await p.screenshot({ path: 'shots/debug-ghost-all.png' });
await p.evaluate(() => { const g = window.__toami.game; g.net.mesh.visible = false; window.__toami.advance(0.02); });
await p.screenshot({ path: 'shots/debug-ghost-nonet.png' });
await b.close();
