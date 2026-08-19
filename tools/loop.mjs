// Plays many complete harvests, driving the game's own input handlers from
// inside the page so a whole session runs in milliseconds even under a
// software rasteriser. Verifies the loop closes: overview -> dig -> pull ->
// pop -> carry -> crate -> next, and across the round boundary (fresh snow).
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
await new Promise(r => server.listen(8093, r));
const OUT = join(ROOT, 'tools', 'shots');
await mkdir(OUT, { recursive: true });
const W = +(process.env.W || 390), H = +(process.env.H || 844);
const TARGET = +(process.env.N || 9);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto(`http://127.0.0.1:8093/index.html?q=${process.env.Q || 'mid'}&dpr=1`);
await page.waitForFunction(() => window.__game);
await page.evaluate(() => { const l = document.getElementById('loader'); if (l) l.remove(); });

const result = await page.evaluate(async (TARGET) => {
  const g = window.__game;
  const step = (sec) => window.__step(1 / 60, Math.max(1, Math.round(sec * 60)));
  const V = g.tmpV.constructor;
  const trace = [];
  let last = '';
  const note = () => { if (g.state !== last) { last = g.state; trace.push(g.state); } };
  const scr = (x, y, z) => g.toScreen(new V(x, y, z));

  step(1.0);
  g.onDown(190, 400); g.onUp(); step(2.0); note();

  let boxed = 0, guard = 0, stuck = 0;
  const stateCounts = {};
  while (boxed < TARGET && guard++ < 4000) {
    note();
    stateCounts[g.state] = (stateCounts[g.state] || 0) + 1;
    const s = g.state;
    if (s === 'overview') {
      const list = g.remaining;
      if (!list.length) { step(0.5); continue; }
      const p = scr(list[0].x, list[0].y + 0.08, list[0].z);
      g.onDown(p.x, p.y); g.onUp();
      step(2.4);
    } else if (s === 'dig') {
      const a = g.active;
      const before = g.field.snowAround(a.x, a.z, 0.075);
      for (let k = 0; k < 3; k++) {
        const p = scr(a.x, a.y + 0.03, a.z);
        const r = Math.min(110, 390 * 0.28);
        const dir = k % 2 ? -1 : 1;
        g.onDown(p.x - dir * r, p.y + (k % 3) * 12 - 12);
        for (let i = 1; i <= 12; i++) {
          g.onMove(p.x - dir * r + (dir * 2 * r * i) / 12, p.y + (k % 3) * 12 - 12 + Math.sin(i) * 9);
          step(1 / 45);
        }
        g.onUp();
        step(0.05);
      }
      const after = g.field.snowAround(a.x, a.z, 0.075);
      if (before - after < 1e-5 && a.capAmount > 0.09) stuck++; else stuck = 0;
      if (stuck > 30) return { fail: 'digging made no progress', trace, boxed };
    } else if (s === 'grab') {
      const a = g.active;
      const p = scr(a.x, a.y + a.leafHeight * 0.5, a.z);
      g.onDown(p.x, p.y);
      for (let i = 1; i <= 26; i++) { g.onMove(p.x, p.y - i * 11); step(1 / 45); }
      g.onUp();
      step(0.2);
    } else if (s === 'carry') {
      const c = new V();
      g.crate.getWorldPosition(c);
      const from = g.toScreen(g.carryPos), to = g.toScreen(c);
      g.onDown(from.x, from.y);
      for (let i = 1; i <= 18; i++) {
        g.onMove(from.x + ((to.x - from.x) * i) / 18, from.y + ((to.y - from.y) * i) / 18);
        step(1 / 45);
      }
      g.onUp();
      step(0.4);
    } else if (s === 'box') {
      const c0 = g.crateCount;
      step(0.5);
      if (g.crateCount > c0) boxed = g.crateCount;
    } else {
      step(0.4);
    }
  }
  // settle back to the wide shot before inspecting the field
  for (let i = 0; i < 600 && g.state !== 'overview'; i++) step(0.1);
  // after a full round the field must be buried again with nothing showing
  let protrusion = -Infinity;
  for (const s of g.spots) {
    if (s.done) continue;
    s.plant.updateMatrixWorld(true);
    const pos = s.plant.userData.leaves.geometry.attributes.position;
    const v = new V();
    for (let i = 0; i < pos.count; i += 3) {
      v.fromBufferAttribute(pos, i).applyMatrix4(s.plant.matrixWorld);
      protrusion = Math.max(protrusion, v.y - g.field.surfaceY(v.x, v.z));
    }
  }
  return { boxed, trace, stateCounts, protrusion, state: g.state, guard };
}, TARGET);

await page.evaluate(() => window.__render());
await page.screenshot({ path: join(OUT, 'loop-final.png') });
const info = await page.evaluate(() => {
  let objects = 0;
  window.__game.scene.traverse(() => objects++);
  return {
  objects,
  crate: window.__game.crateCount,
  earlyPulls: window.__game.shortcuts,
  pile: window.__game.cratePile.children.length,
  tris: window.__renderer.info.render.triangles,
  calls: window.__renderer.info.render.calls,
  programs: window.__renderer.info.programs.length,
  geometries: window.__renderer.info.memory.geometries,
  textures: window.__renderer.info.memory.textures,
  };
});
console.log('trace:', (result.trace || []).slice(0, 30).join(' -> '));
console.log('harvested:', result.boxed, 'of', TARGET, result.fail ? ('FAIL: ' + result.fail) : '');
console.log('leaf protrusion after round rollover (mm):',
  result.protrusion === undefined ? 'n/a' : (result.protrusion * 1000).toFixed(1));
console.log('renderer:', JSON.stringify(info));
console.log('errors:', errs.length ? errs : 'none');
await browser.close(); server.close();
process.exit(errs.length || result.fail || result.boxed < TARGET ? 1 : 0);
