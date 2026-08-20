/** Ad-hoc scene probe: raycast a screen point and report what is under it. */
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto('http://localhost:4173/?quality=mid&debug=1', { waitUntil: 'load' });
await page.waitForFunction(() => window.__cassava?.ready === true, null, { timeout: 60000 });
await page.evaluate(() => window.__cassava.step(0.5));

const pts = JSON.parse(process.argv[2] ?? '[[0.75,0.22]]');
const res = await page.evaluate(async (pts) => {
  const { scene, camera } = window.__cassavaDebug;
  const THREE = window.__cassavaDebug.THREE;
  const rc = new THREE.Raycaster();
  const out = [];
  for (const [nx, ny] of pts) {
    rc.setFromCamera(new THREE.Vector2(nx * 2 - 1, -(ny * 2 - 1)), camera);
    const hits = rc.intersectObjects(scene.children, true).slice(0, 3);
    out.push(hits.map(h => {
      const m = Array.isArray(h.object.material) ? h.object.material[h.face ? (h.object.geometry.groups.find(g => h.faceIndex*3 >= g.start && h.faceIndex*3 < g.start+g.count)?.materialIndex ?? 0) : 0] : h.object.material;
      return `${h.object.name || h.object.type} d=${h.distance.toFixed(2)} y=${h.point.y.toFixed(3)} x=${h.point.x.toFixed(2)} matcol=${m.color ? m.color.getHexString() : '?'} rough=${m.roughness}`;
    }));
  }
  return out;
}, pts);
console.log(JSON.stringify(res, null, 1));
await browser.close();
