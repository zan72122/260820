// Renders arbitrary inspection views of the scene without playing through it.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
const ROOT = process.cwd();
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
    const d = await readFile(join(ROOT, p));
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); res.end(d);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(8096, r));
const OUT = join(ROOT, 'tools', 'shots');
await mkdir(OUT, { recursive: true });

const W = +(process.env.W || 720), H = +(process.env.H || 900);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto(`http://127.0.0.1:8096/index.html?q=${process.env.Q || 'high'}&dpr=1`);
await page.waitForFunction(() => window.__game);
await page.evaluate(() => { const l = document.getElementById('loader'); if (l) l.remove(); }); // loaderKill
await page.evaluate(() => window.__step(1 / 60, 30));

// [name, camX, camY, camZ, lookX, lookY, lookZ, prep]
const VIEWS = JSON.parse(process.env.VIEWS || '[]');
for (const v of VIEWS) {
  await page.evaluate((v) => {
    const g = window.__game;
    if (v.prep) new Function('g', v.prep)(g);
    g.rig.driftAmp = 0;
    g.rig.set(new g.tmpV.constructor(v.p[0], v.p[1], v.p[2]),
              new g.tmpV.constructor(v.l[0], v.l[1], v.l[2]));
    window.__step(1 / 60, v.steps || 2);
    g.rig.set(new g.tmpV.constructor(v.p[0], v.p[1], v.p[2]),
              new g.tmpV.constructor(v.l[0], v.l[1], v.l[2]));
    window.__render();
  }, v);
  await page.screenshot({ path: join(OUT, `look-${v.name}.png`) });
  console.log('rendered', v.name);
}
await browser.close(); server.close();
