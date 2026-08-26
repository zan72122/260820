import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5173/?fast=1&seed=99' + (process.env.NOSURF ? '&nosurf=1' : '') + (process.env.FS ? '&fs=' + process.env.FS : ''));
await page.waitForFunction(() => !!window.__toami);
const out = await page.evaluate(() => {
  const T = window.__toami, g = T.game;
  T.advance(1.0);
  g.fishes.putInTank(g.tank.center, 'school', Number(new URLSearchParams(location.search).get('fs') || 0.15));
  g.state = 'observe'; g.stateT = 0;
  T.advance(1.4);
  if (location.search.includes('nosurf')) {
    g.tank.group.traverse(o => { if (o.material === g.tank.surfMat) o.visible = false; });
    T.advance(0.05);
  }
  const k = g.fishes.tank;
  const cam = g.camera; cam.updateMatrixWorld();
  const M4 = g.net.center.constructor;
  const im = g.fish.mesh.instanceMatrix.array;
  const mat = new (Object.getPrototypeOf(cam.matrixWorld).constructor)();
  mat.fromArray(im, k.slot * 16);
  const proj = (lx, ly, lz) => {
    const v = new M4(lx, ly, lz).applyMatrix4(mat).project(cam);
    return [ +((v.x*0.5+0.5)*393).toFixed(0), +((-v.y*0.5+0.5)*852).toFixed(0) ];
  };
  return {
    has: !!k, pos: k.pos.toArray().map(v=>+v.toFixed(3)),
    scale: k.scale, elems: Array.from(im.slice(k.slot*16, k.slot*16+16)).map(v=>+v.toFixed(3)),
    head: proj(0, 0, 0.52), tail: proj(0, 0, -0.76), topFin: proj(0, 0.24, -0.05),
    alpha: g.fish.data.array[k.slot*4+3], state: g.state
  };
});
console.log(JSON.stringify(out));
await page.screenshot({ path: process.env.NOSURF ? 'shots/debug-observe-nosurf.png' : 'shots/debug-observe.png' });
await browser.close();
