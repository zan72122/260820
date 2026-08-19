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
await new Promise(r => server.listen(8097, r));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:8097/index.html?q=low&dpr=1');
await page.waitForFunction(() => window.__game);
const step = (s) => page.evaluate((x) => window.__step(1/60, Math.round(x*60)), s);
const snap = () => page.evaluate(() => ({ state: window.__game.state, t: +window.__game.rig.t.toFixed(3), moving: window.__game.rig.moving, stateT: +window.__game.stateT.toFixed(2) }));
await step(1.5);
console.log('a', JSON.stringify(await snap()));
await page.touchscreen.tap(195, 400);
console.log('b', JSON.stringify(await snap()));
await step(2.0);
console.log('c', JSON.stringify(await snap()));
const m = await page.evaluate(() => { const g = window.__game; const s = g.remaining[0]; return g.toScreen(new (g.tmpV.constructor)(s.x, s.y+0.1, s.z)); });
console.log('marker', JSON.stringify(m));
await page.touchscreen.tap(Math.round(m.x), Math.round(m.y));
console.log('d', JSON.stringify(await snap()));
await step(2.0);
console.log('e', JSON.stringify(await snap()));
await browser.close(); server.close();
