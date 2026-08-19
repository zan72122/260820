// Chromium smoke test: boots the game, drives the whole loop with synthetic
// touches and reports state transitions + screenshots.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = process.cwd();
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json', '.css': 'text/css' };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const data = await readFile(join(ROOT, p));
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(404); res.end('nf');
  }
});
await new Promise((r) => server.listen(8099, r));

const OUT = join(ROOT, 'tools', 'shots');
await mkdir(OUT, { recursive: true });

const device = process.argv[2] || 'iphone';
const SIZES = {
  iphone: { width: 390, height: 844, dpr: 3, mobile: true },
  ipad: { width: 820, height: 1180, dpr: 2, mobile: true },
  ipadls: { width: 1180, height: 820, dpr: 2, mobile: true },
  desktop: { width: 1280, height: 800, dpr: 1, mobile: false },
};
const size = SIZES[device];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage'],
});
const ctx = await browser.newContext({
  viewport: { width: size.width, height: size.height },
  deviceScaleFactor: size.dpr,
  isMobile: size.mobile,
  hasTouch: true,
  userAgent: size.mobile
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    : undefined,
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto('http://127.0.0.1:8099/index.html?q=' + (process.env.Q || 'mid') + '&dpr=1', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
await page.evaluate(() => { const l = document.getElementById('loader'); if (l) l.remove(); }); // loaderKill

const state = () => page.evaluate(() => window.__game.state);
const info = () => page.evaluate(() => {
  const g = window.__game;
  const a = g.active;
  return {
    state: g.state,
    crate: g.crateCount,
    remaining: g.remaining.length,
    snowLeft: a ? +g.field.snowAround(a.x, a.z, 0.115).toFixed(4) : null,
    cap: a ? +a.capAmount.toFixed(3) : null,
    pull: +g.pullProgress.toFixed(3),
    tris: window.__renderer.info.render.triangles,
    calls: window.__renderer.info.render.calls,
  };
});
const shot = async (n) => { await page.evaluate(() => window.__render()); return page.screenshot({ path: join(OUT, `${device}-${n}.png`) }); };
const step = (secs) => page.evaluate((s) => window.__step(1 / 60, Math.round(s * 60)), secs);

const log = (...a) => console.log(...a);
log('device', device, size);
await step(1.5);
await shot('01-intro');
log('intro', await info());

// tap to enter overview
await page.touchscreen.tap(size.width / 2, size.height / 2);
await step(2.0);
await shot('02-overview');
log('overview', await info());

// choose a spot: tap where the first remaining marker is on screen
const markerXY = await page.evaluate(() => {
  const g = window.__game;
  const s = g.remaining[0];
  const v = new (window.__game.tmpV.constructor)(s.x, s.y + 0.1, s.z);
  return g.toScreen(v);
});
log('marker at', markerXY);
await page.touchscreen.tap(markerXY.x, markerXY.y);
await step(2.6);
await shot('03-approach');
log('after select', await info());

// sweep the snow away with repeated swipes centred on the carrot
async function swipe(cx, cy, r, n) {
  for (let k = 0; k < n; k++) {
    const dir = k % 2 === 0 ? 1 : -1;
    await page.mouse.move(cx - dir * r, cy + (k % 4) * 8 - 12);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(cx - dir * r + (dir * 2 * r * i) / 10, cy + (k % 4) * 8 - 12 + Math.sin(i) * 4);
      await step(1 / 30);
    }
    await page.mouse.up();
    await step(0.05);
  }
}

let guard = 0;
while ((await state()) === 'dig' && guard++ < 26) {
  const p = await page.evaluate(() => {
    const g = window.__game, s = g.active;
    return g.toScreen(new (g.tmpV.constructor)(s.x, s.y + 0.05, s.z));
  });
  await swipe(p.x, p.y, Math.min(110, size.width * 0.28), 3);
  if (guard === 3) { await shot('04-digging'); log('digging', await info()); }
  if (guard === 8) { await shot('05-digging2'); log('digging2', await info()); }
}
log('after dig loop', await info());
await step(1.6);
await shot('06-grabready');
log('grab ready', await info());

// pull upward
if ((await state()) === 'grab') {
  const p = await page.evaluate(() => {
    const g = window.__game, s = g.active;
    return g.toScreen(new (g.tmpV.constructor)(s.x, s.y + s.leafHeight * 0.5, s.z));
  });
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let i = 1; i <= 26; i++) {
    await page.mouse.move(p.x + Math.sin(i) * 3, p.y - i * 12);
    await step(1 / 40);
    if (i === 12) { await shot('07-pulling'); log('pulling', await info()); }
  }
  await step(0.35);
  await shot('08-pop');
  log('pop', await info());
  await page.mouse.up();
}
await step(2.4);
await shot('09-carry');
log('carry', await info());

// drag the carrot to the crate
if ((await state()) === 'carry') {
  const pts = await page.evaluate(() => {
    const g = window.__game;
    const c = new (g.tmpV.constructor)();
    g.crate.getWorldPosition(c);
    return { from: g.toScreen(g.carryPos), to: g.toScreen(c) };
  });
  await page.mouse.move(pts.from.x, pts.from.y);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(
      pts.from.x + ((pts.to.x - pts.from.x) * i) / 20,
      pts.from.y + ((pts.to.y - pts.from.y) * i) / 20
    );
    await step(1 / 40);
  }
  await page.mouse.up();
}
await step(2.4);
await shot('10-boxed');
log('boxed', await info());
await step(2.5);
await shot('11-back-to-overview');
log('final', await info());

log('errors:', errors.length ? errors : 'none');
await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
