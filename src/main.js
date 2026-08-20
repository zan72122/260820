// 第2章「復興祈願花火フェニックス」
// 一点の火が、川に沿って左右へ増えていき、最後に信濃川ぞい一帯を包む。
import { clamp, lerp, damp, easeOutCubic, easeInOutCubic, smoothstep, makeRng, rngRange } from './util.js';
import { Camera } from './camera.js';
import { buildWorld, LAYOUT, drawSky, drawStars, drawTown, drawFarBank, drawWater, drawBridges, drawNearBank, drawGrade, makeGrain } from './world.js';
import { Fireworks } from './fireworks.js';
import { buildSites, Fuses, drawSites, drawFuses, drawChain, hitTest, LOCKED, ARMED, LIT } from './sites.js';
import { Audio } from './audio.js';

const q = new URLSearchParams(location.search);
const FAST = q.get('fast') === '1' || q.get('e2e') === '1';
const DEBUG = q.get('debug') === '1';

const PALETTES = [
  { name: 'kogane',  a: 36,  b: 18,  s: .92 },  // 黄金
  { name: 'sakura',  a: 338, b: 34,  s: .78 },  // 桜
  { name: 'wakaba',  a: 96,  b: -42, s: .80 },  // 若葉と金
  { name: 'ai',      a: 208, b: -26, s: .74 },  // 藍と銀
  { name: 'akane',   a: 8,   b: 30,  s: .90 },  // 茜
  { name: 'murasaki',a: 286, b: 44,  s: .78 },  // 紫と橙
];

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

const el = {
  title: document.getElementById('title'),
  start: document.getElementById('btn-start'),
  again: document.getElementById('btn-again'),
  end: document.getElementById('end'),
  endTitle: document.getElementById('end-title'),
  endStat: document.getElementById('end-stat'),
  coach: document.getElementById('coach'),
  coachText: document.querySelector('.coach-text'),
  bar: document.getElementById('riverbar'),
  dots: document.getElementById('riverbar-dots'),
  caption: document.getElementById('finale-caption'),
  sound: document.getElementById('btn-sound'),
  rotate: document.getElementById('rotate-hint'),
};

const G = {
  state: 'title',            // title | play | finale | end
  t: 0,                      // 経過時間（秒）
  growth: 0,                 // 0..1 見えている広がり（カメラ駆動）
  landscape: true,
  spanX: 1500,
  siteCount: 13,
  sites: [],
  world: null,
  cam: new Camera(),
  fw: null,
  fuses: new Fuses(),
  audio: new Audio(),
  palette: PALETTES[0],
  rng: Math.random,
  events: [],
  finaleT: 0,
  litCount: 0,
  maxSpread: 0,
  quality: 1,
  dpr: 1,
  grain: null,
  paused: false,
  soundOn: true,
  reachedEdges: false,
  finaleIn: -1,
};

// ---------------------------------------------------------------------------
// セットアップ
// ---------------------------------------------------------------------------
function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
}

function pickQuality() {
  if (FAST) return 0.32;
  const mob = isMobile();
  const px = window.innerWidth * window.innerHeight;
  if (mob) return px > 500000 ? 0.52 : 0.66;
  return 1;
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const wasLandscape = G.landscape;
  G.landscape = w >= h;
  const maxDpr = FAST ? 1 : (isMobile() ? 2 : 2);
  G.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  // 面積が大きすぎるときは解像度を落とす（iPad Pro 対策）
  const area = w * h * G.dpr * G.dpr;
  if (area > 4.2e6) G.dpr *= Math.sqrt(4.2e6 / area);
  canvas.width = Math.max(2, Math.round(w * G.dpr));
  canvas.height = Math.max(2, Math.round(h * G.dpr));
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  if (wasLandscape !== G.landscape) relayout();
  el.rotate.classList.toggle('hidden', G.landscape || G.state === 'title' || G.state === 'end');
}

// 画面の向きで川の「実尺」を変える。縦画面でも収まるように、横画面は思い切り広く。
function orientationSpec() {
  return G.landscape
    ? { span: 2200, count: 13, fov0: 44, fov1: 70, fit: 1.00, hw0: 230, hw1: 2200 * 1.16 + 260 }
    : { span: 1000, count: 9, fov0: 50, fov1: 76, fit: 0.80, hw0: 230, hw1: 1000 * 1.16 + 260 };
}

function relayout() {
  const spec = orientationSpec();
  const prevLit = G.sites.map(s => s.state);
  G.spanX = spec.span;
  G.siteCount = spec.count;
  G.world = buildWorld(G.spanX);
  G.world.stride = G.quality > 0.8 ? 1 : 2;
  const fresh = buildSites(G.siteCount, G.spanX);
  // 向きが変わっても進捗は保つ（同じ数でないときは割合で移す）
  if (prevLit.length) {
    for (let i = 0; i < fresh.length; i++) {
      const src = prevLit[Math.round(i / (fresh.length - 1) * (prevLit.length - 1))];
      fresh[i].state = src ?? LOCKED;
      if (fresh[i].state === LIT) fresh[i].litAt = G.t - 3;
    }
    // 向きが変わっても詰まらないようにする：
    // 何も点いていなければ中央を、点いていれば必ずその両どなりを armed にする。
    const litIdx = fresh.filter(s => s.state === LIT).map(s => s.i);
    if (!litIdx.length) {
      fresh.forEach(s => { s.state = LOCKED; s.pending = false; });
      fresh[(fresh.length - 1) >> 1].state = ARMED;
    } else {
      const lo = Math.min(...litIdx), hi = Math.max(...litIdx);
      for (let i = lo; i <= hi; i++) fresh[i].state = LIT;   // 連続した「つながり」に直す
      if (fresh[lo - 1]) fresh[lo - 1].state = ARMED;
      if (fresh[hi + 1]) fresh[hi + 1].state = ARMED;
    }
  }
  G.sites = fresh;
  buildDots();
  recount();
}

function buildDots() {
  el.dots.innerHTML = '';
  for (let i = 0; i < G.sites.length; i++) {
    const d = document.createElement('div');
    d.className = 'rb-dot';
    el.dots.appendChild(d);
  }
  syncDots();
}
function syncDots() {
  const kids = el.dots.children;
  for (let i = 0; i < G.sites.length && i < kids.length; i++) {
    const s = G.sites[i], k = kids[i];
    k.classList.toggle('lit', s.state === LIT);
    k.classList.toggle('armed', s.state === ARMED && !s.pending);
  }
}

function recount() {
  G.litCount = G.sites.filter(s => s.state === LIT).length;
  let m = 0;
  for (const s of G.sites) if (s.state === LIT) m = Math.max(m, Math.abs(s.x));
  G.maxSpread = m;
  syncDots();
}

// ---------------------------------------------------------------------------
// ゲーム進行
// ---------------------------------------------------------------------------
function newRun() {
  G.t = 0; G.growth = 0; G.finaleT = 0; G.events.length = 0;
  G.reachedEdges = false; G.finaleIn = -1;
  G.palette = PALETTES[(Math.random() * PALETTES.length) | 0];
  G.rng = makeRng((Math.random() * 1e9) | 0);
  G.fw.reset(); G.fuses.reset();
  G.sites = buildSites(G.siteCount, G.spanX);
  buildDots();
  recount();
  G.cam.want.fov = orientationSpec().fov0 * Math.PI / 180;
  applyCamera(0, true);
  G.audio.setFinale(false);
  G.audio.setIntensity(0.05);
}

function nearestLitNeighbour(site) {
  let best = null, bd = Infinity;
  for (const s of G.sites) {
    if (s.state !== LIT) continue;
    const d = Math.abs(s.x - site.x);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

function tryIgnite(site) {
  if (!site || site.state !== ARMED || site.pending) return false;
  site.pending = true;
  syncDots();
  const from = nearestLitNeighbour(site);
  const dist = from ? Math.abs(from.x - site.x) : 0;
  const dur = from ? clamp(dist / G.spanX * 1.05 + 0.14, 0.14, 0.42) : 0.0;
  if (from) {
    G.fuses.add(from, site, dur, () => ignite(site));
    G.audio.whoosh(clamp(site.x / G.spanX, -1, 1) * 0.8);
  } else {
    ignite(site);
  }
  return true;
}

function shellFor(absT) {
  const r = G.rng();
  if (absT < 0.2) return r < 0.6 ? 'peony' : 'ring';
  if (absT < 0.6) return r < 0.45 ? 'wide' : (r < 0.8 ? 'peony' : 'palm');
  return r < 0.55 ? 'wide' : (r < 0.85 ? 'willow' : 'palm');
}

function ignite(site) {
  site.pending = false;
  site.state = LIT;
  site.litAt = G.t;
  // となりが「つけられる」ようになる ＝ 必ず横へ横へ伸びていく
  for (const j of [site.i - 1, site.i + 1]) {
    const n = G.sites[j];
    if (n && n.state === LOCKED) n.state = ARMED;
  }
  const a = Math.abs(site.t);
  const P = G.palette;
  const hue = P.a + (G.rng() - .5) * 26 + a * P.b;
  const size = 0.72 + a * 0.62;
  const apex = 215 + a * 235 + G.rng() * 55;
  G.fw.launch(site.x, site.z, apex, {
    hue, sat: P.s, shell: shellFor(a), size,
    onBurst: null,
  });
  G.audio.whoosh(clamp(site.x / G.spanX, -1, 1) * 0.85);
  recount();

  const frac = G.litCount / G.sites.length;
  G.audio.setIntensity(clamp(0.08 + frac * 0.85, 0, 1));
  updateCoach();

  if (G.litCount >= G.sites.length) el.coach.classList.add('hidden');
  if (G.litCount >= G.sites.length && G.state === 'play' && G.finaleIn < 0) {
    G.reachedEdges = true;
    G.finaleIn = 0.7;   // ゲームループ側で数える（タブが裏でも止まらない）
  }
}

function updateCoach() {
  if (G.state !== 'play') { el.coach.classList.add('hidden'); return; }
  const frac = G.litCount / G.sites.length;
  let msg;
  if (G.litCount === 0) msg = 'ひかってるところを さわってね';
  else if (frac < 0.35) msg = 'よこの ひかりも さわってみて';
  else if (frac < 0.8) msg = 'もっと よこへ ひろげよう';
  else msg = 'あと ちょっとで ぜんぶ！';
  el.coachText.textContent = msg;
  el.coach.classList.remove('hidden');
}

// ---------------------------------------------------------------------------
// フィナーレ：一斉に、川ぞい一帯へ
// ---------------------------------------------------------------------------
function at(t, fn) { G.events.push({ t, fn, done: false }); }

function startFinale() {
  if (G.state === 'finale' || G.state === 'end') return;
  G.finaleIn = -1;
  G.state = 'finale';
  G.finaleT = 0;
  G.events.length = 0;
  el.coach.classList.add('hidden');
  G.audio.setIntensity(1);
  G.audio.setFinale(true);
  G.audio.cheer(1);

  const S = G.sites, N = S.length, P = G.palette;
  const sorted = [...S].sort((a, b) => a.x - b.x);

  // 第1波：左から右へ走る、低くて横に広い「フェニックス」型
  sorted.forEach((s, i) => {
    at(0.25 + i * (1.9 / N), () => {
      G.fw.launch(s.x, s.z, 300 + Math.abs(s.t) * 120, {
        hue: P.a + i * 3, sat: P.s, shell: 'wide', size: 1.25 + Math.abs(s.t) * 0.3,
      });
      G.audio.whoosh(clamp(s.x / G.spanX, -1, 1) * 0.9);
    });
  });

  // 第2波：全地点いっせいに大玉
  at(2.5, () => {
    S.forEach((s, i) => {
      G.fw.launch(s.x, s.z, 500 + Math.abs(s.t) * 220, {
        hue: P.a + P.b * 0.6 + (i % 3) * 14, sat: P.s,
        shell: i % 3 === 0 ? 'palm' : 'peony', size: 1.5 + Math.abs(s.t) * 0.35,
      });
    });
    G.audio.whoosh(0);
  });

  // 第3波：横へ横へ。川幅いっぱいに開く
  at(4.5, () => {
    S.forEach((s) => {
      G.fw.launch(s.x, s.z, 370 + Math.abs(s.t) * 180, {
        hue: P.a + P.b, sat: P.s, shell: 'wide', size: 1.75 + Math.abs(s.t) * 0.4,
      });
    });
    G.audio.cheer(0.6);
  });

  // 第4波：しだれ柳の帳（川面いっぱいの映り込み）
  at(6.4, () => {
    S.forEach((s, i) => {
      G.fw.launch(s.x, s.z, 640 + Math.abs(s.t) * 150, {
        hue: 40, sat: 0.55, shell: 'willow', size: 1.5,
      });
      if (i % 2 === 0) G.fw.launch(s.x + 70, s.z, 360, { hue: P.a, sat: P.s, shell: 'wide', size: 1.3 });
    });
    G.audio.crackle(0, 1.2);
  });

  // 締め：中心の大輪と、両端まで届く一斉
  at(8.4, () => {
    S.forEach((s) => {
      G.fw.launch(s.x, s.z, 470 + Math.abs(s.t) * 240, {
        hue: P.a + (G.rng() - .5) * 40, sat: P.s, shell: 'wide', size: 2.0,
      });
    });
    G.fw.launch(0, LAYOUT.launchZ, 720, { hue: P.a, sat: P.s, shell: 'ring', size: 2.2 });
    G.audio.cheer(1);
  });

  at(1.6, () => { el.caption.classList.remove('hidden'); });
  at(9.4, () => { el.caption.classList.add('hidden'); });
  at(11.0, () => finish());
}

function finish() {
  if (G.state === 'end') return;
  G.state = 'end';
  el.end.classList.remove('hidden');
  el.coach.classList.add('hidden');
  el.bar.classList.remove('on');
  const km = (G.spanX * 2 / 1000).toFixed(1);
  el.endTitle.textContent = 'かわ ぜんぶ に ひろがった';
  el.endStat.textContent = `${G.sites.length}かしょ が つながって、やく ${km}km の フェニックス`;
  G.audio.setIntensity(0.25);
  G.audio.setFinale(false);
}

// ---------------------------------------------------------------------------
// カメラ：成長に合わせて「引く」
// ---------------------------------------------------------------------------
function applyCamera(dt, snap = false) {
  const spec = orientationSpec();
  const w = canvas.width / G.dpr, h = canvas.height / G.dpr;
  const aspect = w / h;

  const spreadNorm = clamp(G.maxSpread / G.spanX, 0, 1);
  const frac = G.litCount / Math.max(1, G.sites.length);
  let target = clamp(0.74 * spreadNorm + 0.26 * frac, 0, 1);
  if (G.state === 'finale' || G.state === 'end') target = 1;
  // 最初の一発だけは、まだほとんど引かない（＝小ささを見せる）
  if (G.litCount === 0) target = 0;
  G.growth = snap ? target : damp(G.growth, target, 1.15, dt);

  const e = easeInOutCubic(G.growth);
  const fov = lerp(spec.fov0, spec.fov1, e) * Math.PI / 180;
  const halfW = lerp(spec.hw0, spec.hw1, e) * spec.fit;
  const halfH = lerp(340, 780, e);
  const D = Camera.distanceFor(halfW, halfH, aspect, fov);

  // 見せ場の中心（点いている地点の重心）へゆるく寄る
  let cx = 0, n = 0;
  for (const s of G.sites) if (s.state === LIT) { cx += s.x; n++; }
  cx = n ? cx / n : 0;

  G.cam.want.fov = fov;
  G.cam.want.pz = LAYOUT.launchZ + D;
  G.cam.want.py = lerp(22, 58, e) + D * lerp(0.030, 0.028, e);
  G.cam.want.px = cx * 0.22;
  G.cam.want.tx = cx * 0.42;
  G.cam.want.ty = lerp(120, 400, e);
  G.cam.follow(dt, snap);
}

// ---------------------------------------------------------------------------
// 入力
// ---------------------------------------------------------------------------
const pointers = new Set();

function toLocal(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function handleAt(x, y) {
  if (G.state !== 'play') return;
  const minR = Math.max(44, Math.min(canvas.width / G.dpr, canvas.height / G.dpr) * 0.085);
  const hit = hitTest(G.sites, x, y, minR);
  if (hit) tryIgnite(hit);
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  pointers.add(e.pointerId);
  const p = toLocal(e);
  handleAt(p.x, p.y);
}, { passive: false });

canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  e.preventDefault();
  const p = toLocal(e);
  handleAt(p.x, p.y);
}, { passive: false });

const clearPointer = (e) => pointers.delete(e.pointerId);
canvas.addEventListener('pointerup', clearPointer);
canvas.addEventListener('pointercancel', clearPointer);
canvas.addEventListener('pointerleave', clearPointer);
document.addEventListener('touchmove', (e) => { if (e.target === canvas) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (G.state === 'title' && (e.key === 'Enter' || e.key === ' ')) { start(); return; }
  if (G.state !== 'play') return;
  const armed = G.sites.filter(s => s.state === ARMED && !s.pending);
  if (!armed.length) return;
  if (e.key === 'ArrowLeft') tryIgnite(armed.sort((a, b) => a.x - b.x)[0]);
  else if (e.key === 'ArrowRight') tryIgnite(armed.sort((a, b) => b.x - a.x)[0]);
  else if (e.key === ' ' || e.key === 'Enter') tryIgnite(armed[0]);
});

// ---------------------------------------------------------------------------
// メインループ
// ---------------------------------------------------------------------------
let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const nt = now / 1000;
  let dt = last ? nt - last : 1 / 60;
  last = nt;
  if (G.paused) return;
  dt = clamp(dt, 0, 1 / 20);
  step(dt);
  render();
}

function step(dt) {
  G.t += dt;

  if (G.finaleIn >= 0) {
    G.finaleIn -= dt;
    if (G.finaleIn <= 0) { G.finaleIn = -1; if (G.state === 'play') startFinale(); }
  }

  if (G.state === 'finale') {
    G.finaleT += dt;
    for (const ev of G.events) {
      if (!ev.done && G.finaleT >= ev.t) { ev.done = true; ev.fn(); }
    }
  }

  G.fuses.update(dt);
  G.fw.update(dt);
  applyCamera(dt);
  G.audio.tick();
}

function render() {
  const w = canvas.width / G.dpr, h = canvas.height / G.dpr;
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  G.cam.update(w, h, 1 / 60, G.t);

  const amb = G.fw.amb;
  ctx.fillStyle = '#03050c';
  ctx.fillRect(0, 0, w, h);

  drawSky(ctx, G.cam, w, h, G.t, amb);
  drawStars(ctx, G.cam, G.world, G.t);
  drawTown(ctx, G.cam, G.world, G.t, amb);
  drawFarBank(ctx, G.cam, G.world, G.t, amb);
  drawWater(ctx, G.cam, G.world, G.t, amb);
  drawBridges(ctx, G.cam, G.world, G.t);
  drawChain(ctx, G.cam, G.sites, G.t);
  drawFuses(ctx, G.cam, G.fuses, G.t);
  drawSites(ctx, G.cam, G.sites, G.t, { showLocked: G.state === 'play' });
  G.fw.draw(ctx, G.cam, G.t);
  drawNearBank(ctx, G.cam, G.world, G.t, amb);
  drawGrade(ctx, w, h, amb, G.grain);

  if (DEBUG) {
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.font = '12px monospace';
    ctx.fillText(`state=${G.state} lit=${G.litCount}/${G.sites.length} growth=${G.growth.toFixed(2)} p=${G.fw.alive} D=${(G.cam.pos.z - LAYOUT.launchZ) | 0}`, 10, 18);
  }
}

// ---------------------------------------------------------------------------
// UI 配線
// ---------------------------------------------------------------------------
function start() {
  if (G.state !== 'title') return;
  G.state = 'play';
  el.title.classList.add('hidden');
  el.bar.classList.add('on');
  updateCoach();
  el.rotate.classList.toggle('hidden', G.landscape);
  if (!G.landscape) setTimeout(() => el.rotate.classList.add('hidden'), 4200);
  if (G.soundOn && G.audio.init()) { G.audio.resume(); G.audio.startMusic(); }
}

el.start.addEventListener('click', start);
el.again.addEventListener('click', () => {
  el.end.classList.add('hidden');
  el.caption.classList.add('hidden');
  newRun();
  G.state = 'play';
  el.bar.classList.add('on');
  updateCoach();
  G.audio.setIntensity(0.08);
});
el.sound.addEventListener('click', () => {
  G.soundOn = !G.soundOn;
  el.sound.textContent = G.soundOn ? '🔊' : '🔈';
  el.sound.classList.toggle('off', !G.soundOn);
  if (G.soundOn) { if (G.audio.init()) { G.audio.resume(); G.audio.startMusic(); } G.audio.setMuted(false); }
  else G.audio.setMuted(true);
});

document.addEventListener('visibilitychange', () => {
  G.paused = document.hidden;
  if (!document.hidden) last = 0;
});
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 260));

// ---------------------------------------------------------------------------
// 起動
// ---------------------------------------------------------------------------
G.quality = pickQuality();
G.fw = new Fireworks({
  cap: FAST ? 700 : (isMobile() ? 2300 : 4600),
  quality: G.quality,
  rng: () => G.rng(),
  onBurst: ({ x, y, size }) => {
    G.cam.shake = Math.min(1.2, G.cam.shake + 0.18 * size);
    G.audio.boom(size, clamp(x / G.spanX, -1, 1) * 0.85, clamp(Math.abs(x) / G.spanX, 0, 1));
    if (size > 1.2 && Math.random() < 0.6) G.audio.crackle(clamp(x / G.spanX, -1, 1) * 0.7, 0.8);
  },
});
G.grain = FAST ? null : makeGrain(128);
G.landscape = window.innerWidth >= window.innerHeight;
relayout();
newRun();
resize();
requestAnimationFrame(frame);

// ---------------------------------------------------------------------------
// テスト用フック（決定的に進められるようにする）
// ---------------------------------------------------------------------------
window.__phoenix = {
  get state() { return G.state; },
  get lit() { return G.litCount; },
  get total() { return G.sites.length; },
  get growth() { return G.growth; },
  get camDist() { return G.cam.pos.z - LAYOUT.launchZ; },
  get halfWidth() {
    const h = canvas.height / G.dpr, w = canvas.width / G.dpr;
    return (G.cam.pos.z - LAYOUT.launchZ) * Math.tan(G.cam.fov / 2) * (w / h);
  },
  get particles() { return G.fw.alive; },
  get landscape() { return G.landscape; },
  start,
  screenPos(i) { const s = G.sites[i]; return s && s._sx != null ? { x: s._sx, y: s._sy } : null; },
  armedIndexes() { return G.sites.filter(s => s.state === ARMED && !s.pending).map(s => s.i); },
  tap(i) { return tryIgnite(G.sites[i]); },
  igniteAll() { for (const s of G.sites) { if (s.state !== LIT) { s.pending = false; s.state = ARMED; ignite(s); } } },
  // 論理時間を直接すすめる（テストは実時間を待たない）
  advance(ms, dt = 1 / 60) {
    let left = ms / 1000;
    while (left > 0) { const d = Math.min(dt, left); step(d); left -= d; }
    render();
  },
  finale: startFinale,
};
