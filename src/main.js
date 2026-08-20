import { Chapter, PH, QUALITY } from './chapter.js';
import { UI } from './ui.js';
import { rng } from './rng.js';
import * as WORLD from './world.js';

const params = new URLSearchParams(location.search);
const FAST = params.get('fast') === '1';           // E2E / 低速端末向けの決定的モード
const FORCED_Q = params.get('q');
const FORCED_SCALE = parseFloat(params.get('scale') || '') || 0;   // 端末の解像度を上書き（検証用）

const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

const chapter = new Chapter({});
const ui = new UI(chapter);
chapter.hooks.onPhase = (p) => ui.onPhase(p);

// ---------------- 解像度 ----------------
let renderScale = 1;
let scaleFloor = 1;      // 端末が重すぎるときの最後の逃げ道
function pickScale() {
  const dpr = window.devicePixelRatio || 1;
  if (FORCED_SCALE) return FORCED_SCALE;
  if (FAST) return 1;
  if (chapter.qualityName === 'low') return Math.min(dpr, 1.15) * scaleFloor;
  if (chapter.qualityName === 'mid') return Math.min(dpr, 1.45) * scaleFloor;
  return Math.min(dpr, 1.8) * scaleFloor;
}

function resize() {
  const vv = window.visualViewport;
  const cssW = Math.max(1, Math.round(vv ? vv.width : window.innerWidth));
  const cssH = Math.max(1, Math.round(vv ? vv.height : window.innerHeight));
  renderScale = pickScale();
  const w = Math.max(2, Math.round(cssW * renderScale));
  const h = Math.max(2, Math.round(cssH * renderScale));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
  }
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  chapter.cam.setViewport(w, h);
  chapter.camSnap = true;
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 220));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// ---------------- 初期品質 ----------------
function initialQuality() {
  if (FORCED_Q && QUALITY[FORCED_Q]) return FORCED_Q;
  if (FAST) return 'low';
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const px = (window.innerWidth * window.innerHeight) * (window.devicePixelRatio || 1) ** 2;
  if (mem <= 2 || cores <= 2) return 'low';
  if (mem <= 4 || cores <= 4 || px > 3.2e6) return 'mid';
  return 'high';
}
chapter.setQuality(initialQuality());
resize();

// ---------------- 入力 ----------------
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  chapter.snd.resume();
  ui.advance();
}, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => { last = performance.now(); });

// ---------------- ループ ----------------
let last = performance.now();
let acc = 0, frames = 0, msSum = 0;
let autoQ = !FORCED_Q && !FAST;

function frame(now) {
  const t0 = now;
  let dt = (now - last) / 1000;
  last = now;
  if (!(dt > 0) || dt > 0.5) dt = 1 / 60;

  chapter.update(dt);
  chapter.render(ctx);
  ui.update(dt);

  // 品質の自動調整（重い端末で落とし、余裕があれば戻す）
  if (autoQ) {
    msSum += performance.now() - t0;
    frames++;
    if (frames >= 50) {
      const avg = msSum / frames;
      frames = 0; msSum = 0;
      const order = ['low', 'mid', 'high'];
      const i = order.indexOf(chapter.qualityName || 'high');
      if (avg > 23 && i > 0) { chapter.setQuality(order[i - 1]); resize(); }
      else if (avg > 30 && i === 0 && scaleFloor > 0.62) {
        // いちばん軽い設定でも重い端末：解像度そのものを落とす
        scaleFloor *= 0.8; resize();
      } else if (avg < 11 && i < 2) { chapter.setQuality(order[i + 1]); resize(); }
    }
  }
  raf = requestAnimationFrame(frame);
}

let raf = 0;
if (!FAST) raf = requestAnimationFrame(frame);
else {
  // 決定的モード：時間はテストが進める
  chapter.update(1 / 60);
  chapter.render(ctx);
  ui.update(1 / 60);
}

ui.hideLoading();

// ---------------- テスト用フック ----------------
window.__nagaokaWorld = WORLD;
window.__nagaoka = {
  chapter, ui, PH, fast: FAST,
  state: () => chapter.snapshot(),
  /** 論理時間を直接進める（描画も更新する） */
  step(ms = 1000, dtMs = 1000 / 60) {
    const n = Math.max(1, Math.round(ms / dtMs));
    for (let i = 0; i < n; i++) {
      chapter.update(dtMs / 1000);
      ui.update(dtMs / 1000);
    }
    chapter.render(ctx);
    return chapter.snapshot();
  },
  begin: () => { ui.onStart(); },
  niagara: () => chapter.lightNiagara(),
  shell: () => chapter.fireShell(),
  replay: () => ui.onReplay(),
  seed: (s) => { rng.s = (s >>> 0) || 1; },
  quality: (q) => { chapter.setQuality(q); resize(); },
  resize,
};
