// ---------------------------------------------------------------------------
// 起動。メニューは出さない。最初に見えるのは、氷の中で汗をかいている瓶だけ。
// ---------------------------------------------------------------------------
import * as THREE from '../vendor/three/three.module.min.js';
import { Q, FAST, MANUAL, makeAdaptiveScaler } from './quality.js';
import { buildEnvironment } from './env.js';
import { buildWorld } from './world.js';
import { RamuneAudio } from './audio.js';
import { Input } from './input.js';
import { Director } from './director.js';

const canvas = document.getElementById('view');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !FAST,
  alpha: false,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
if (Q.shadow) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbcd6e2);
const camera = new THREE.PerspectiveCamera(40, 1, 0.02, 14);

scene.environment = buildEnvironment(renderer);

const world = buildWorld(scene, Q);
const audio = new RamuneAudio();
const input = new Input(canvas);
input.onFirstInput = () => audio.unlock();
const director = new Director(scene, camera, audio, input, Q, world);

// --- 画面サイズ -------------------------------------------------------------

let pixelScale = 800;
function resize() {
  const w = Math.max(1, canvas.clientWidth);
  const h = Math.max(1, canvas.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // 縦画面は瓶を主軸に使うので画角を少し狭める
  camera.fov = camera.aspect < 1 ? 38 : 42;
  camera.updateProjectionMatrix();
  director.aspect = camera.aspect;
  const dh = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
  pixelScale = dh / (2 * Math.tan((camera.fov * Math.PI / 180) / 2));
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();

// --- ミュート ---------------------------------------------------------------

const muteBtn = document.getElementById('mute');
let muted = false;
muteBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  muted = !muted;
  audio.unlock();
  audio.setMuted(muted);
  muteBtn.textContent = muted ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-label', muted ? '音を出す' : '音を消す');
});
muteBtn.addEventListener('pointerdown', (e) => e.stopPropagation());

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { audio.setPour(0); if (audio.ctx) audio.ctx.suspend(); }
  else if (audio.ctx && !muted) audio.ctx.resume();
});

canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); running = false; });
canvas.addEventListener('webglcontextrestored', () => { running = true; });

// --- ループ -----------------------------------------------------------------

const adapt = makeAdaptiveScaler(renderer, Math.min(window.devicePixelRatio || 1, Q.pixelRatio));
let running = true;
let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  if (!running) { last = now; return; }
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  if (dt <= 0) return;
  step(dt);
  renderer.render(scene, camera);
  adapt(dt);
}

function step(dt) {
  input.begin(dt);
  director.update(dt, pixelScale);
}

if (!MANUAL) requestAnimationFrame(frame);
document.body.classList.add('ready');

// --- テスト用の口（E2E で論理時間を直接進められるようにする） ---------------

window.__ramune = {
  THREE, scene, camera, renderer, director, world, audio, input,
  get state() { return director.state; },
  debug: () => director.debugState(),
  /** 論理時間を dt 刻みで進める。描画は 1 回だけ。 */
  step(seconds, dt = 1 / 60) {
    let t = 0;
    while (t < seconds) { input.begin(dt); director.update(dt, pixelScale); t += dt; }
    renderer.render(scene, camera);
  },
  render() { renderer.render(scene, camera); },
  manual: MANUAL,
  press(amount = 1.2) {
    input.down = true; input.downFlag = true;
    input.startY = 100; input.y = 100 + amount * 105;
    input.startX = input.x = 100; input.holdTime = 0.5;
  },
  release() { input.down = false; input.upFlag = true; },
  setTilt(deg) {
    director.tiltTarget = deg * Math.PI / 180;
    director.tilt = director.tiltTarget;
  },
  resize,
};
