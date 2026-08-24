import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildMaterials } from './world/materials';
import { AudioEngine } from './core/audio';
import { Input } from './core/input';
import { Game } from './game/director';

const params = new URLSearchParams(location.search);
const E2E = params.get('e2e') === '1';
const FAST = Number(params.get('fast') || '1');

const appEl = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
appEl.appendChild(renderer.domElement);

const audio = new AudioEngine(!E2E);
const mats = buildMaterials();
const game = new Game(mats, audio);
// soft neutral environment reflections so painted steel and machined parts
// pick up sky light instead of going dead grey
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  game.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  game.scene.environmentIntensity = 0.16;
  pmrem.dispose();
}
if (E2E) game.timeScale = Math.min(FAST, 10);

// ---------------------------------------------------------------- quality
// Adaptive device-pixel-ratio: step down when frame times are long,
// recover when there is headroom. Fixed DPR 1 in E2E for determinism.
let dpr = E2E ? 1 : Math.min(window.devicePixelRatio || 1, 2);
let frameEma = 16;
let lastAdjust = 0;
const DPR_STEPS = [1, 1.2, 1.45, 1.7, 2];

function applySize(): void {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h);
  game.resize(w, h);
}
applySize();
window.addEventListener('resize', applySize);
window.addEventListener('orientationchange', () => setTimeout(applySize, 60));

function adjustQuality(now: number, ms: number): void {
  if (E2E) return;
  frameEma = frameEma * 0.95 + ms * 0.05;
  if (now - lastAdjust < 2000) return;
  const i = DPR_STEPS.findIndex(v => Math.abs(v - dpr) < 0.01);
  if (frameEma > 24 && i > 0) {
    dpr = DPR_STEPS[i - 1];
    lastAdjust = now;
    applySize();
  } else if (frameEma < 13.5 && i >= 0 && i < DPR_STEPS.length - 1
    && DPR_STEPS[i + 1] <= Math.min(window.devicePixelRatio || 1, 2)) {
    dpr = DPR_STEPS[i + 1];
    lastAdjust = now;
    applySize();
  }
}

// ---------------------------------------------------------------- input
new Input(renderer.domElement, {
  onAnyPointer: () => game.onAnyPointer(),
  onDragStart: () => game.onDragStart(),
  onDragMove: (dx) => game.onDragMove(dx),
  onDragEnd: () => game.onDragEnd(),
  onTap: () => game.onTap(),
});

// keep switch state across tab visibility changes; clock must not jump
document.addEventListener('visibilitychange', () => { lastT = performance.now(); });

// ---------------------------------------------------------------- loop
let lastT = performance.now();
let simTime = 0;
const metrics = { fps: 0, ms: 16, calls: 0, tris: 0 };
let fpsAcc = 0, fpsN = 0, fpsWindow = 0;

function frame(now: number): void {
  const rawDt = Math.max(0, (now - lastT) / 1000);
  lastT = now;
  const dt = Math.min(rawDt, 0.1);
  simTime += dt;

  game.update(dt, simTime);
  const camOverride = params.get('cam');
  if (camOverride) {
    const [x, y, z, tx, ty, tz] = camOverride.split(',').map(Number);
    game.camera.position.set(x, y, z);
    game.camera.lookAt(tx, ty, tz);
  }
  renderer.render(game.scene, game.camera);

  const ms = rawDt * 1000;
  metrics.ms = metrics.ms * 0.9 + ms * 0.1;
  fpsAcc += ms; fpsN++; fpsWindow += ms;
  if (fpsWindow > 500) {
    metrics.fps = 1000 / (fpsAcc / fpsN);
    fpsAcc = 0; fpsN = 0; fpsWindow = 0;
  }
  metrics.calls = renderer.info.render.calls;
  metrics.tris = renderer.info.render.triangles;
  adjustQuality(now, ms);
  requestAnimationFrame(frame);
}

// pre-compile shaders before first visible frame, then start
renderer.compile(game.scene, game.camera);
renderer.render(game.scene, game.camera);
document.getElementById('boot')?.classList.add('hidden');
requestAnimationFrame((t) => { lastT = t; requestAnimationFrame(frame); });

// ---------------------------------------------------------------- test API
declare global {
  interface Window { __mono?: Record<string, unknown>; }
}
window.__mono = {
  get phase() { return game.phase; },
  get t() { return game.sw.t; },
  get lockExt() { return game.sw.lockExt; },
  get lockedSide() { return game.lockedSide; },
  get lever() { return game.panel.leverValue; },
  get firstRunDone() { return game.firstRunDone; },
  get runCount() { return game.runCount; },
  get occupied() { return game.switchOccupied; },
  get hint() { return game.hintActive; },
  get metrics() { return { ...metrics, dpr }; },
  get camera() { return game.camera.position.toArray(); },
  setTimeScale(x: number) { game.timeScale = Math.max(0.1, Math.min(12, x)); },
};
