// Renders the game's own authored shots at a given viewport, no synthetic camera.
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
await new Promise(r => server.listen(8091, r));
const OUT = join(ROOT, 'tools', 'shots');
await mkdir(OUT, { recursive: true });
const W = +(process.env.W || 390), H = +(process.env.H || 844), TAG = process.env.TAG || 'f';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, isMobile: W < 1000 });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto(`http://127.0.0.1:8091/index.html?q=${process.env.Q || 'high'}&dpr=1`);
await page.waitForFunction(() => window.__game);
await page.evaluate(() => { const l = document.getElementById('loader'); if (l) l.remove(); });
const shot = async (n) => { await page.evaluate(() => window.__render()); await page.screenshot({ path: join(OUT, `${TAG}-${n}.png`) }); };
await page.evaluate(() => window.__step(1 / 60, 90));
await shot('intro');
await page.evaluate(() => { window.__game.enterOverview(0.01); window.__step(1 / 60, 90); });
await shot('overview');
await page.evaluate(() => { const g = window.__game; g.selectSpot(g.remaining[0]); window.__step(1 / 60, 130); });
await shot('work');
console.log('ok', await page.evaluate(() => window.__game.state));
await browser.close(); server.close();
