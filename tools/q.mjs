// Asserts that no leaf pokes above the fresh snow at the start of a round.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
const ROOT = process.cwd();
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
    const d = await readFile(join(ROOT, p));
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); res.end(d);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(8094, r));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
await page.goto('http://127.0.0.1:8094/index.html?q=low&dpr=1');
await page.waitForFunction(() => window.__game);
let worst = -1, rounds = 0;
for (let round = 0; round < 12; round++) {
  const r = await page.evaluate(() => {
    const g = window.__game;
    let worst = -1;
    for (const s of g.spots) {
      s.plant.updateMatrixWorld(true);
      const geo = s.plant.userData.leaves.geometry;
      const pos = geo.attributes.position;
      const v = new (g.tmpV.constructor)();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(s.plant.matrixWorld);
        const surf = g.field.surfaceY(v.x, v.z);
        worst = Math.max(worst, v.y - surf);
      }
      // the soil cap must be buried too
      s.cap.updateMatrixWorld(true);
      worst = Math.max(worst, s.cap.position.y + 0.056 - g.field.surfaceY(s.x, s.z));
    }
    // start a fresh round for the next iteration
    g.newRound(true);
    return worst;
  });
  worst = Math.max(worst, r);
  rounds++;
}
console.log(`rounds checked: ${rounds}  worst leaf protrusion above snow: ${(worst * 1000).toFixed(1)} mm`);
await browser.close(); server.close();
process.exit(worst > 0 ? 1 : 0);
