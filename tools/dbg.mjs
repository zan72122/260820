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
await new Promise(r => server.listen(8098, r));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
page.on('console', m => console.log('CONSOLE', m.type(), m.text()));
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:8098/index.html');
await page.waitForFunction(() => window.__game);
await page.evaluate(() => {
  const g = window.__game;
  window.__log = [];
  const ss = g.setState.bind(g);
  g.setState = (st) => { window.__log.push(['setState', st, new Error().stack.split('\n').slice(1,4).join(' | ')]); ss(st); };
  const od = g.onDown.bind(g);
  g.onDown = (x, y) => { window.__log.push(['down', x|0, y|0, g.state, g.rig.moving]); od(x, y); window.__log.push(['after', g.state]); };
  for (const t of ['pointerdown','pointerup','pointercancel','pointerleave','touchstart','touchend']) {
    document.getElementById('view').addEventListener(t, (e) => window.__log.push([t, e.pointerId]), true);
  }
});
await page.waitForTimeout(1200);
await page.touchscreen.tap(195, 400);
await page.waitForTimeout(1800);
console.log('rig', JSON.stringify(await page.evaluate(() => { const r = window.__game.rig; return {t: r.t, dur: r.dur, moving: r.moving, state: window.__game.state, stateT: window.__game.stateT}; })));
await page.touchscreen.tap(120, 550);
await page.waitForTimeout(500);
console.log(JSON.stringify(await page.evaluate(() => window.__log), null, 1));
console.log('state', await page.evaluate(() => window.__game.state));
await browser.close(); server.close();
