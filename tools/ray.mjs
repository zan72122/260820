import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 800, height: 650 } });
page.on('pageerror',e=>console.log('ERR '+e.message));
await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.waitForTimeout(5000);
const out = await page.evaluate(() => {
  const d = window.__dev; const app = d.app;
  d.fit(1, 0);
  d.cam(5.04,4.81,-5.93,-0.676,3.159,-5.162,46);
  const THREE = app.scene.constructor;
  // walk the scene, report meshes with their material identity
  const list = [];
  app.scene.traverse(o => { if (o.isMesh) list.push({ name: o.name, mat: o.material.uuid, side: o.material.side, tris: o.geometry.index ? o.geometry.index.count/3 : 0 }); });
  const m = app.mats;
  const ids = { outer: m.frpOuter.uuid, inner: m.frpInner.uuid, cut: m.frpCut.uuid, rib: m.frpRib.uuid, water: m.water.uuid };
  const named = list.map(x => ({ ...x, which: Object.entries(ids).find(([,v])=>v===x.mat)?.[0] ?? 'other' }));
  return { counts: named.filter(x=>x.which!=='other'), sides: { outer: m.frpOuter.side, inner: m.frpInner.side } };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
