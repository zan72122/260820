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
await new Promise(r => server.listen(8095, r));
const OUT = join(ROOT, 'tools', 'shots');
await mkdir(OUT, { recursive: true });
const W = +(process.env.W || 390), H = +(process.env.H || 844);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, isMobile: W < H });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto(`http://127.0.0.1:8095/index.html?q=${process.env.Q || 'mid'}&dpr=1`);
await page.waitForFunction(() => window.__game);
await page.evaluate(() => { const l = document.getElementById('loader'); if (l) l.remove(); }); // loaderKill
const tag = process.env.TAG || 'x';
// Skip to a chosen spot, clear its snow, and let the game reach each state.
await page.evaluate(() => {
  const g = window.__game;
  g.rig.driftAmp = 0;
  g.enterOverview(0.01);
  window.__step(1 / 60, 20);
  g.selectSpot(g.remaining[0]);
  window.__step(1 / 60, 120);
});
await page.evaluate(() => { window.__render(); });
await page.screenshot({ path: join(OUT, `${tag}-a-work.png`) });
// sweep the snow off with the game's own brush call
await page.evaluate(() => {
  const g = window.__game, s = g.active;
  for (let pass = 0; pass < 60; pass++) {
    for (let i = 0; i <= 20; i++) {
      const x = s.x - 0.22 + (0.44 * i) / 20;
      const z = s.z - 0.16 + (pass % 9) * 0.04;
      g.field.brush(x, z, 0.11, 0.05);
      if (g.field.snowAt(x, z) <= 0.006) g.field.scrub(x, z, 0.09, 0.05);
    }
  }
  g.field.sync();
  window.__step(1 / 60, 30);
});
await page.evaluate(() => window.__render());
await page.screenshot({ path: join(OUT, `${tag}-b-soil.png`) });
await page.evaluate(() => {
  const g = window.__game, s = g.active;
  s.capAmount = 0; window.__step(1 / 60, 150);
});
await page.evaluate(() => window.__render());
await page.screenshot({ path: join(OUT, `${tag}-c-grab.png`) });
await page.evaluate(() => {
  const g = window.__game;
  g.enterPull(); g.pullPx = g.pullNeed() * 0.7; window.__step(1 / 60, 25);
});
await page.evaluate(() => window.__render());
await page.screenshot({ path: join(OUT, `${tag}-d-pull.png`) });
await page.evaluate(() => {
  const g = window.__game;
  g.pullPx = g.pullNeed() * 1.4; window.__step(1 / 60, 40);
});
await page.evaluate(() => window.__render());
await page.screenshot({ path: join(OUT, `${tag}-e-pop.png`) });
await page.evaluate(() => { window.__step(1 / 60, 200); });
await page.evaluate(() => window.__render());
await page.screenshot({ path: join(OUT, `${tag}-f-carry.png`) });
console.log('done', await page.evaluate(() => window.__game.state));
await browser.close(); server.close();
