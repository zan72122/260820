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
  T.advance(2.9);
  const cam = g.camera; cam.updateMatrixWorld();
  const net = g.net;
  const S = net.segs, R = net.rings, p = net.p;
  const V = net.center.constructor;
  const px = (x,y,z) => { const v = new V(x,y,z).project(cam); return [ +((v.x*0.5+0.5)*393).toFixed(0), +((-v.y*0.5+0.5)*852).toFixed(0) ]; };
  const rim = [];
  for (let j = 0; j < S; j += Math.floor(S/6)) { const k=(R*S+j)*3; rim.push({ world:[+p[k].toFixed(2),+p[k+1].toFixed(2),+p[k+2].toFixed(2)], screen: px(p[k],p[k+1],p[k+2]) }); }
  const mid = [];
  const im = Math.floor(R/2);
  for (let j = 0; j < S; j += Math.floor(S/4)) { const k=(im*S+j)*3; mid.push({ world:[+p[k].toFixed(2),+p[k+1].toFixed(2),+p[k+2].toFixed(2)], screen: px(p[k],p[k+1],p[k+2]) }); }
  return {
    phase: net.phase,
    centerWorld: net.center.toArray().map(v=>+v.toFixed(2)),
    centerScreen: px(net.center.x, net.center.y, net.center.z),
    coneK: net.coneK, maxCone: net.maxCone,
    rim, mid,
    camPos: cam.position.toArray().map(v=>+v.toFixed(2))
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
