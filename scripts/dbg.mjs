import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('console', (m) => console.log('[console:'+m.type()+']', m.text().slice(0,400)));
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0,400)));
await page.goto('http://127.0.0.1:4173/?fast=1');
await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
const info = await page.evaluate(() => {
  const g = window.__game;
  const scene = g.engine.scene;
  const out = [];
  scene.traverse((o) => {
    if (o.isInstancedMesh) {
      const m = new (o.matrixWorld.constructor)();
      o.getMatrixAt(0, m);
      out.push({
        name: o.name || o.type,
        count: o.count,
        capacity: o.instanceMatrix.count,
        visible: o.visible,
        m0: Array.from(m.elements).map(v=>+v.toFixed(2)),
        matType: o.material.type,
        alphaTest: o.material.alphaTest,
        hasMap: !!o.material.map,
        prog: !!(o.material.__webglShader),
      });
    }
  });
  return out;
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
