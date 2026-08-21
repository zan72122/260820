/**
 * Drives a whole play-through in a headless Chromium and captures the beats.
 * Logical time is advanced directly (`__game.advance`) because software WebGL
 * cannot render this scene at interactive rates; frames are only rendered when
 * a screenshot is taken. Nothing here is a performance measurement.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const OUT = process.env.SHOT_DIR || 'shots';
const MODE = process.argv[2] || 'portrait';
const DEVICES = {
  portrait: { width: 390, height: 844, name: 'iphone-portrait' },
  landscape: { width: 1024, height: 768, name: 'ipad-landscape' },
  phoneland: { width: 844, height: 390, name: 'iphone-landscape' },
};
const dev = DEVICES[MODE];
const URL = `${process.env.URL || 'http://127.0.0.1:5173/'}?fast=1&px=0.35`;
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('[playtest]', ...a);

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox', '--no-sandbox'],
});
const ctx = await browser.newContext({
  viewport: { width: dev.width, height: dev.height },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
// the surface world loads asynchronously; give it its frame
await page.evaluate(() => window.__game.advance(0.2));
await page.waitForFunction(() => !!window.__game.tower, null, { timeout: 60000 });
await page.evaluate(() => window.__game.setAutoRender(false));
log('booted', dev.name);

const adv = (s) => page.evaluate((x) => window.__game.advance(x), s);
const settle = () =>
  page.evaluate(() => {
    // let the camera finish its move so captures are of composed frames
    for (let i = 0; i < 40 && window.__game.director.travelling; i++) window.__game.advance(0.05);
  });
const shot = async (n, doSettle = true) => {
  if (doSettle) await settle();
  await page.evaluate(() => window.__game.snap(1));
  await page.screenshot({ path: `${OUT}/${dev.name}-${n}.png` });
  await page.evaluate(() => window.__game.snap(0.35));
  const w = await page.evaluate(() => ({
    shot: window.__game.director.current?.name,
    phase: window.__game.sim.phase,
    hint: window.__game.hud.hint?.kind ?? null,
  }));
  log('shot', n, JSON.stringify(w));
};
const state = () =>
  page.evaluate(() => {
    const g = window.__game;
    const r = (v) => +v.toFixed(3);
    return {
      phase: g.sim.phase,
      cam: g.director.current?.name,
      main: r(g.sim.valves.main.open),
      sight: r(g.sim.segments.sight.fill),
      air: r(g.sim.primeAir),
      rpm: r(g.sim.rpm),
      flow: r(g.sim.flow),
      disch: r(g.sim.segments.discharge.fill),
      riser: r(g.sim.segments.riser.fill),
      header: r(g.sim.segments.topHeader.fill),
      valves: { A: r(g.sim.valves.A.open), B: r(g.sim.valves.B.open), C: r(g.sim.valves.C.open) },
      film: { A: r(g.sim.slides.A.film), B: r(g.sim.slides.B.film), C: r(g.sim.slides.C.film) },
      hint: g.hud.hint ? g.hud.hint.kind : null,
    };
  });
const spot = (id) => page.evaluate((i) => window.__game.router.screenPos(i) ?? null, id);
const until = (fn, label, limit = 90) =>
  page.evaluate(
    ([f, l]) => {
      const g = window.__game;
      const test = new Function('g', `return (${f})`);
      let t = 0;
      while (t < l) {
        g.advance(0.1);
        t += 0.1;
        if (test(g)) return +t.toFixed(1);
      }
      return -1;
    },
    [fn, limit],
  ).then((t) => {
    if (t < 0) throw new Error(`timed out waiting for ${label}`);
    log(`  ${label} after ${t}s of game time`);
    return t;
  });

/* ---- gestures (pointer events, exactly what a finger produces) ---- */
async function circleDrag(id, turns = 3, dir = -1) {
  const s = await spot(id);
  if (!s) throw new Error('offscreen: ' + id);
  const r = Math.max(44, Math.min(84, s.r * 0.75));
  const steps = Math.round(24 * turns);
  await page.mouse.move(s.x + r, s.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const a = dir * (i / steps) * Math.PI * 2 * turns;
    // a wobbly circle on purpose: a small child does not draw a good one
    const rr = r * (0.7 + 0.32 * Math.sin(i * 0.63));
    await page.mouse.move(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr);
    if (i % 6 === 0) await adv(0.06);
  }
  await page.mouse.up();
}
async function swipeStrokes(id, n = 4) {
  const s = await spot(id);
  if (!s) throw new Error('offscreen: ' + id);
  await page.mouse.move(s.x, s.y - 45);
  await page.mouse.down();
  for (let i = 0; i < n; i++) {
    for (let k = 1; k <= 5; k++) await page.mouse.move(s.x, s.y - 45 + (k / 5) * 100);
    await adv(0.1);
    for (let k = 1; k <= 5; k++) await page.mouse.move(s.x, s.y + 55 - (k / 5) * 100);
    await adv(0.1);
  }
  await page.mouse.up();
}
async function tapSpot(id) {
  const s = await spot(id);
  if (!s) throw new Error('offscreen: ' + id);
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  await adv(0.15);
  await page.mouse.up();
}
async function pressLever(id) {
  const s = await spot(id);
  if (!s) throw new Error('offscreen: ' + id);
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  for (let i = 1; i <= 9; i++) await page.mouse.move(s.x, s.y + i * 10);
  await adv(0.2);
  await page.mouse.up();
}

/* ------------------------------- run ------------------------------- */
log('1. the question — a dry tower');
await shot('01-tower-dry');
log('  ', await state());

log('2. down through the ground');
await adv(4.2);
await shot('02-through-the-slab');
await until("g.sim.phase === 'discover'", "reached the machine room");
await adv(0.8);
await shot('03-tank-and-still-water');
await adv(2.8);
await shot('04-closed-valve');
log('  ', await state());

log('3. first touch — the handwheel');
// the smallest possible input: barely a quarter turn
await circleDrag('mainWheel', 0.3);
await adv(1.4);
await shot('05-first-nudge', false);
log('   after a quarter turn:', await state());
await circleDrag('mainWheel', 1.6);
await adv(1.8);
await shot('06-sight-glass', false);
// stop where the camera would stop a real player: the glass is full, the game moves on
await adv(2.5);
log('   valve:', await state());

log('4. priming');
await until("g.sim.phase === 'priming'", 'priming shot');
await adv(1.5);
await shot('07-air-in-the-column');
for (let i = 0; i < 4; i++) {
  const st = await state();
  if (st.air <= 0.02) break;
  await swipeStrokes('prime', 3);
  await adv(0.5);
}
log('   primed:', await state());
await shot('08-primed');

log('5. the starter');
await until("g.sim.phase === 'ready'", 'starter shot');
await adv(2);
await tapSpot('start');
await adv(0.6);
await shot('09-guard-lifted');
await pressLever('start');
await adv(1.6);
log('   motor:', await state());
await shot('10-impeller-turning');

log('6. following the water up');
await until("g.sim.phase === 'chasing'", 'chase begins');
await adv(2.2);
await shot('11-leaving-the-pump');
await until('g.sim.segments.riser.fill > 0.5', 'front crosses the ground');
await shot('12-crossing-the-ground');
await until("g.sim.phase === 'branching'", 'front reaches the manifold');
await adv(2.6);
await shot('13-manifold');
log('  ', await state());

log('7. the branch valve');
await tapSpot('branchA');
await adv(0.4);
await tapSpot('branchA');
await adv(1.6);
await shot('14-branch-open', false);
await until('g.sim.slides.A.film > 0.25', 'first flume wets');
await adv(2.2);
await shot('15-slide-running', false);
log('  ', await state());

log('8. the whole loop');
await until("g.sim.phase === 'reveal'", 'reveal');
await adv(3.4);
await shot('16a-full-circuit', false);
await adv(3.4);
await shot('16b-following-it-home', false);
await adv(4.4);
await shot('16c-back-in-the-tank', false);

log('9. second round');
await until("g.sim.phase === 'freeplay'", 'free play unlocked');
await adv(2.6);
await shot('17-three-valves-now');
await tapSpot('branchB');
await tapSpot('branchB');
log('   two taps -> ', (await state()).valves);
await adv(7);
await shot('18-two-flumes');
log('  ', await state());

log('10. splitting the flow weakens it — open the main valve further');
const weak = await state();
if (Math.max(weak.film.A, weak.film.B) > 0.85) throw new Error('splitting did not weaken the flow: ' + JSON.stringify(weak.film));
const btn = await spot('btnRoom');
if (!btn) throw new Error('room button missing');
await page.mouse.move(btn.x, btn.y);
await page.mouse.down();
await adv(0.15);
await page.mouse.up();
await adv(3.5);
await shot('19-back-in-the-room');
await circleDrag('mainWheel', 1.6);
await adv(5);
await shot('20-more-flow');
const strong = await state();
log('   film before:', weak.film, ' after:', strong.film, ' main:', weak.main, '->', strong.main);
if (strong.film.A <= weak.film.A || strong.film.B <= weak.film.B)
  throw new Error('opening the main valve did not help: ' + JSON.stringify({ weak: weak.film, strong: strong.film }));

// and the same lesson must hold for a player who opened the main valve all the way
log('12. the lesson still holds with the main valve wide open');
await circleDrag('mainWheel', 3);
await adv(4);
const wideSingle = await state();
const btnT = await spot('btnTower');
await page.mouse.move(btnT.x, btnT.y);
await page.mouse.down();
await adv(0.15);
await page.mouse.up();
await adv(3);
await tapSpot('branchC');
await tapSpot('branchC');
await adv(8);
const wideTriple = await state();
log('   main wide open — two flumes:', wideSingle.film, ' three flumes:', wideTriple.film);
if (wideTriple.film.A >= wideSingle.film.A) throw new Error('adding a third flume did not cost anything');
await shot('23-three-flumes');

log('11. the wrong valve is harmless');
await tapSpot('bypassWheel');
await adv(3);
await shot('21-bypass');
log('  ', await state());
await circleDrag('bypassWheel', 1, 1);
await adv(3);
log('   bypass closed again:', await state());
await shot('22-bypass-closed');

// sound: the context only starts on a real gesture, so prove it came up
const audioState = await page.evaluate(() => ({ ready: window.__game.audio.ready }));
log('audio context started by touch:', audioState.ready);

log('console errors:', errors.length ? errors : 'none');
await browser.close();
if (errors.length) process.exit(2);
