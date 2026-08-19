// 起動。レンダラの設定、画面回転、フレームループ、そしてテスト用の外部API。
import * as THREE from 'three';
import './ui/style.css';
import { Hud } from './ui/hud.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { Game } from './game/game.js';

const params = new URLSearchParams(window.location.search);
const FAST = params.get('fast') === '1' || window.E2E_FAST === true;
const SEED = parseInt(params.get('seed') || '20260819', 10);

const canvas = document.getElementById('scene');
const hudRoot = document.getElementById('hud');
const loading = document.getElementById('loading');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !FAST && (window.devicePixelRatio || 1) < 2.5,
  powerPreference: 'high-performance',
  alpha: false,
  stencil: false,
  failIfMajorPerformanceCaveat: false,
});
renderer.setClearColor(0xadbcab, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.98;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = !FAST;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 160);

const hud = new Hud(hudRoot);
const audio = new Audio();
const input = new Input(canvas);

let maxPixelRatio = FAST ? 1 : Math.min(window.devicePixelRatio || 1, 2);
// resize() は game を作る前にも走るので、参照は後から差し込む
let gameRef = null;

function resize() {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  renderer.setPixelRatio(maxPixelRatio);
  renderer.setSize(w, h, false);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (gameRef) gameRef.onResize();
}
resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 220));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

const game = new Game({ renderer, scene, camera, input, audio, hud, fast: FAST, seed: SEED });
game.build();
gameRef = game;

input.on('tap', (p) => game.onTap(p));
input.on('down', (p) => game.onDown(p));
input.on('move', (p) => game.onMove(p));
input.on('up', (p) => game.onUp(p));

// WebGL コンテキストが飛んでも黙って死なないように
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  console.warn('WebGL context lost');
});
canvas.addEventListener('webglcontextrestored', () => {
  console.warn('WebGL context restored');
  resize();
});

// --- フレームレートに応じて自動で軽くする ---
let fpsAcc = 0;
let fpsFrames = 0;
let degraded = 0;
function watchPerf(dt) {
  if (FAST) return;
  fpsAcc += dt;
  fpsFrames++;
  if (fpsAcc >= 2.0) {
    const fps = fpsFrames / fpsAcc;
    fpsAcc = 0;
    fpsFrames = 0;
    if (fps < 34 && degraded === 0) {
      degraded = 1;
      maxPixelRatio = Math.min(maxPixelRatio, 1.35);
      resize();
      console.info('画質をすこし下げました (fps=' + fps.toFixed(1) + ')');
    } else if (fps < 26 && degraded === 1) {
      degraded = 2;
      renderer.shadowMap.enabled = false;
      scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
      maxPixelRatio = 1;
      resize();
      console.info('影を切りました (fps=' + fps.toFixed(1) + ')');
    }
  }
}

let last = performance.now();
let running = true;
function frame(now) {
  if (!running) return;
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.0001, (now - last) / 1000));
  last = now;
  step(dt);
}

function step(dt) {
  input.update(dt);
  game.update(dt);
  renderer.render(scene, camera);
  watchPerf(dt);
}

// 最初の1フレームを描いてから読み込み画面を消す
renderer.render(scene, camera);
requestAnimationFrame((t) => {
  last = t;
  loading.classList.add('hide');
  setTimeout(() => loading.remove(), 700);
  requestAnimationFrame(frame);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') last = performance.now();
});

// --- テスト用の外部API(E2E から状態を確認し、時間を進められるようにする) ---
window.__TAKENOKO__ = {
  ready: true,
  fast: FAST,
  game,
  three: THREE,
  state: () => game.debugState(),
  /** 論理時間を直接進める(アニメーション待ちをしない) */
  advance: (seconds, stepSize = 1 / 60) => {
    let t = 0;
    while (t < seconds) {
      const d = Math.min(stepSize, seconds - t);
      input.update(d);
      game.update(d);
      t += d;
    }
    renderer.render(scene, camera);
  },
  /** サイト i の画面座標 */
  siteScreen: (i) => {
    const s = game.sites[i];
    if (!s) return null;
    return game._project(s.position);
  },
  decoyScreen: (i) => {
    const d = game.decoys[i];
    if (!d) return null;
    return game._project(d.position);
  },
  /** サイト i の掘る円の画面上の半径(px) */
  siteRadiusPx: (i, worldR = 0.26) => {
    const s = game.sites[i];
    if (!s) return null;
    const c = game._project(s.position);
    const e = game._project(s.position.clone().add(new THREE.Vector3(worldR, 0, 0)));
    const e2 = game._project(s.position.clone().add(new THREE.Vector3(0, 0, worldR)));
    return Math.max(12, (Math.hypot(e.x - c.x, e.y - c.y) + Math.hypot(e2.x - c.x, e2.y - c.y)) / 2);
  },
  /** いま操作すべき画面座標(HUDのゆびヒントと同じ場所)。画面内に収める */
  focusScreen: () => {
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    const p = game.focusPoint();
    if (!p) return { x: w / 2, y: h / 2 };
    const s = game._project(p);
    return {
      x: Math.min(w - 12, Math.max(12, s.x)),
      y: Math.min(h - 12, Math.max(12, s.y)),
    };
  },
  siteInfo: (i) => {
    const s = game.sites[i];
    if (!s) return null;
    return {
      taken: s.taken,
      brush: s.brushProgress,
      dig: s.digProgress,
      exposure: s.exposure,
      hintLevel: s.hintLevel,
      leaves: s.leaves.filter((l) => l.state === 1).length,
      takenokoY: s.takenoko.position.y,
      ringVisible: s.ring.material.opacity > 0.01,
    };
  },
  info: () => ({
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    textures: renderer.info.memory.textures,
    geometries: renderer.info.memory.geometries,
    pixelRatio: renderer.getPixelRatio(),
    size: [renderer.domElement.clientWidth, renderer.domElement.clientHeight],
  }),
  stop: () => { running = false; },
};

console.info('たけのこほり: 起動しました', FAST ? '(FASTモード)' : '');
