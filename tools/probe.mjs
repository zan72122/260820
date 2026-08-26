// Quick numeric probe: where things actually land on screen, and how big.
import { chromium } from '@playwright/test';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5173/?fast=1&seed=4242');
await page.waitForFunction(() => !!window.__toami);
await page.evaluate(() => window.__toami.advance(2.0));
const out = await page.evaluate(() => {
  const g = window.__toami.game;
  const THREE = g.net.mesh.geometry.attributes.position;
  const cam = g.camera;
  cam.updateMatrixWorld();
  const bbox = (arr, count) => {
    let minx = 9e9, maxx = -9e9, miny = 9e9, maxy = -9e9, n = 0;
    const v = new (g.net.center.constructor)();
    for (let i = 0; i < count; i++) {
      v.set(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]).project(cam);
      if (!isFinite(v.x)) continue;
      minx = Math.min(minx, v.x); maxx = Math.max(maxx, v.x);
      miny = Math.min(miny, v.y); maxy = Math.max(maxy, v.y);
      n++;
    }
    return { minx: +minx.toFixed(2), maxx: +maxx.toFixed(2), miny: +miny.toFixed(2), maxy: +maxy.toFixed(2), n };
  };
  const netBox = bbox(g.net.p, g.net.count);
  const fishInfo = g.fishes.shoals.map(s => ({ kind: s.kind, pos: s.pos.toArray().map(v => +v.toFixed(1)), alpha: +(s.members[0].alpha || 0).toFixed(2) }));
  const hand = g.camera.position.clone();
  return {
    netBox,
    netCenter: g.net.center.toArray().map(v => +v.toFixed(2)),
    netVisible: g.net.mesh.visible,
    netMatWet: g.net.material.uniforms.uWet.value,
    fishInfo,
    cam: hand.toArray().map(v => +v.toFixed(2)),
    drawCalls: g.renderer.info.render.calls,
    tris: g.renderer.info.render.triangles
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
