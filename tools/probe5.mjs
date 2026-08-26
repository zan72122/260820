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
  T.advance(3.0); T.haul(); T.advance(0.9);
  const cam = g.camera; cam.updateMatrixWorld();
  const n = g.net; const V = n.center.constructor;
  let minx=9e9,maxx=-9e9,miny=9e9,maxy=-9e9; const v=new V();
  for (let k=0;k<n.count;k++){ v.set(n.p[k*3],n.p[k*3+1],n.p[k*3+2]).project(cam);
    minx=Math.min(minx,v.x);maxx=Math.max(maxx,v.x);miny=Math.min(miny,v.y);maxy=Math.max(maxy,v.y); }
  const px=(x)=> +((x*0.5+0.5)*393).toFixed(0), py=(y)=> +((-y*0.5+0.5)*852).toFixed(0);
  return { phase:n.phase, wet:+n.wetness.toFixed(2), box:[px(minx),py(maxy),px(maxx),py(miny)],
    center: n.center.toArray().map(x=>+x.toFixed(2)), visible:n.mesh.visible, matTransparent:n.material.transparent };
});
console.log(JSON.stringify(out));
await page.screenshot({ path: 'shots/debug-haul.png' });
await browser.close();
