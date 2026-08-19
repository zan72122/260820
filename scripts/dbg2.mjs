import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', e => console.log('[err]', String(e).slice(0,300)));
await page.goto('http://127.0.0.1:4173/?fast=1');
await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
const out = await page.evaluate(async () => {
  const g = window.__game;
  const scene = g.engine.scene;
  const THREE = window.__THREE;
  // find machine group by looking for the object holding many children near origin
  const res = { names: [], hits: [] };
  let panel = null, chamberGroup = null;
  scene.traverse(o => {
    if (o.geometry && o.geometry.type === 'ExtrudeGeometry') panel = o;
  });
  res.panel = panel ? {
    pos: panel.position.toArray(),
    verts: panel.geometry.attributes.position.count,
    groups: panel.geometry.groups.length,
    bbox: (panel.geometry.computeBoundingBox(), panel.geometry.boundingBox.min.toArray().concat(panel.geometry.boundingBox.max.toArray())),
  } : null;
  // raycast straight through the window along +X in world space
  const m = g.debugState();
  const origin = new THREE.Vector3(m.pos.x - 4.0, 1.62, m.pos.z - 1.62);
  const raycaster = new THREE.Raycaster(origin, new THREE.Vector3(1,0,0), 0, 10);
  const hits = raycaster.intersectObjects(scene.children, true);
  res.hits = hits.slice(0, 10).map(h => ({
    d: +h.distance.toFixed(2),
    type: h.object.geometry ? h.object.geometry.type : '?',
    mat: h.object.material && h.object.material.color ? '#'+h.object.material.color.getHexString() : '',
  }));
  return res;
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
