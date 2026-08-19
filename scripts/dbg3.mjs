import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://127.0.0.1:4173/');
await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
console.log(JSON.stringify(await page.evaluate(() => {
  const g = window.__game;
  const r = g.engine.renderer;
  let sun = null, casters = 0, receivers = 0;
  g.engine.scene.traverse(o => {
    if (o.isDirectionalLight && o.castShadow) sun = { i: o.intensity, pos: o.position.toArray(), map: o.shadow.mapSize.toArray() };
    if (o.isMesh && o.castShadow) casters++;
    if (o.isMesh && o.receiveShadow) receivers++;
  });
  return { quality: g.engine.quality, shadowsEnabled: r.shadowMap.enabled, sun, casters, receivers,
           cores: navigator.hardwareConcurrency, mem: navigator.deviceMemory };
})));
await browser.close();
