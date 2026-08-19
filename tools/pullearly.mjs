// Verifies the forgiving path: as soon as any green shows, a decisive upward
// tug takes the carrot without making the child finish sweeping.
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
await new Promise(r => server.listen(8090, r));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:8090/index.html?q=low&dpr=1');
await page.waitForFunction(() => window.__game);
const r = await page.evaluate(() => {
  const g = window.__game;
  const step = (s) => window.__step(1 / 60, Math.max(1, Math.round(s * 60)));
  const V = g.tmpV.constructor;
  step(1); g.onDown(190, 400); g.onUp(); step(2);
  g.selectSpot(g.remaining[0]); step(2.5);
  const a = g.active;
  const log = { state0: g.state };
  // sweep sideways only, until the leaf tips first show
  let guard = 0;
  while (!a.revealed && guard++ < 400) {
    const p = g.toScreen(new V(a.x, a.y + 0.03, a.z));
    g.onDown(p.x - 90, p.y);
    for (let i = 1; i <= 10; i++) { g.onMove(p.x - 90 + i * 18, p.y); step(1 / 45); }
    g.onUp(); step(0.05);
  }
  log.revealed = a.revealed;
  log.sweepsToReveal = guard;
  log.capAtReveal = +a.capAmount.toFixed(2);
  log.snowAtReveal = +g.field.snowAround(a.x, a.z, 0.075).toFixed(3);
  log.stateAtReveal = g.state;
  // now one decisive upward tug, without finishing the sweeping
  const p = g.toScreen(new V(a.x, a.y + a.leafHeight * 0.5, a.z));
  g.onDown(p.x, p.y);
  for (let i = 1; i <= 30; i++) { g.onMove(p.x, p.y - i * 12); step(1 / 45); }
  g.onUp();
  step(0.5);
  log.stateAfterTug = g.state;
  log.shortcuts = g.shortcuts;
  step(4);
  log.stateLater = g.state;
  return log;
});
console.log(JSON.stringify(r, null, 1));
console.log('errors:', errs.length ? errs : 'none');
await browser.close(); server.close();
const ok = r.revealed && r.shortcuts >= 1 && r.stateAfterTug === 'pop' &&
           ['pop', 'carry', 'box', 'overview'].includes(r.stateLater);
console.log(ok ? 'EARLY PULL OK' : 'EARLY PULL PROBLEM');
process.exit(ok && !errs.length ? 0 : 1);
