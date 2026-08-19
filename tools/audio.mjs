// Verifies the Web Audio graph actually wakes up on the first touch (iOS only
// unlocks audio inside a user gesture) and that each cue schedules sources.
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
await new Promise(r => server.listen(8092, r));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox',
         '--disable-dev-shm-usage','--autoplay-policy=user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.addInitScript(() => {
  window.__audio = { contexts: 0, osc: 0, buf: 0, started: 0 };
  const AC = window.AudioContext;
  window.AudioContext = function (...a) {
    window.__audio.contexts++;
    const c = new AC(...a);
    const co = c.createOscillator.bind(c), cb = c.createBufferSource.bind(c);
    c.createOscillator = () => { window.__audio.osc++; const o = co();
      const st = o.start.bind(o); o.start = (...x) => { window.__audio.started++; return st(...x); }; return o; };
    c.createBufferSource = () => { window.__audio.buf++; const b = cb();
      const st = b.start.bind(b); b.start = (...x) => { window.__audio.started++; return st(...x); }; return b; };
    window.__ctx = c;
    return c;
  };
});
await page.goto('http://127.0.0.1:8092/index.html?q=low&dpr=1');
await page.waitForFunction(() => window.__game);
const before = await page.evaluate(() => ({ ...window.__audio, ctxState: window.__ctx && window.__ctx.state }));
await page.touchscreen.tap(195, 500);
await page.waitForTimeout(400);
const after = await page.evaluate(() => ({ ...window.__audio, ctxState: window.__ctx && window.__ctx.state,
  started: window.__game.audioStarted }));
// fire each cue and count scheduled sources
const cues = await page.evaluate(async () => {
  const g = window.__game;
  const base = window.__audio.started;
  const counts = {};
  const snap = (name) => { counts[name] = window.__audio.started - base - Object.values(counts).reduce((a, b) => a + b, 0); };
  g.fx.puffSnow(0, 0.2, 0, 0, 0, 0.02);
  // reach the audio module through the game's own calls
  g.enterOverview(0.01); window.__step(1 / 60, 5);
  const s = g.remaining[0];
  g.selectSpot(s); window.__step(1 / 60, 100);      // twinkle
  snap('select');
  for (let i = 0; i < 40; i++) {
    g.onDown(180, 500); g.onMove(200 + i, 505); window.__step(1 / 60, 2); g.onUp();
  }
  snap('brush');
  for (let pass = 0; pass < 80; pass++) {
    for (let i = 0; i <= 20; i++) {
      const x = s.x - 0.2 + (0.4 * i) / 20, z = s.z - 0.16 + (pass % 9) * 0.04;
      g.field.brush(x, z, 0.13, 0.06);
    }
  }
  g.field.sync(); s.capAmount = 0; window.__step(1 / 60, 120);     // reveal chime + grab
  snap('reveal');
  g.enterPull(); g.pullPx = g.pullNeed() * 2; window.__step(1 / 60, 60);   // pop
  snap('pop');
  window.__step(1 / 60, 400);
  if (g.carryPos) {
    const c = new (g.tmpV.constructor)(); g.crate.getWorldPosition(c);
    g.carryPos.copy(c); g.carryPos.y += 0.3;
  }
  window.__step(1 / 60, 300);                                              // knock
  snap('crate');
  return { counts, total: window.__audio.started - base, state: g.state, crate: g.crateCount };
});
console.log('before tap:', JSON.stringify(before));
console.log('after tap :', JSON.stringify(after));
console.log('cues      :', JSON.stringify(cues));
console.log('errors    :', errs.length ? errs : 'none');
await browser.close(); server.close();
const need = ['select', 'brush', 'reveal', 'pop', 'crate'];
const missing = need.filter((k) => !(cues.counts[k] > 0));
if (missing.length) console.log('cues that scheduled nothing:', missing);
const ok = before.contexts === 0 && after.contexts === 1 &&
           after.ctxState === 'running' && !missing.length;
console.log(ok ? 'AUDIO OK' : 'AUDIO PROBLEM');
process.exit(ok && !errs.length ? 0 : 1);
