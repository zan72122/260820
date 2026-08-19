import * as THREE from '../vendor/three/three.module.min.js';
import { World, CFG } from './world.js';
import { Game } from './game.js';
import { Audio } from './audio.js';

const canvas = document.getElementById('gl');
const bootEl = document.getElementById('boot');
const bootMsg = document.getElementById('bootMsg');
const startBtn = document.getElementById('btnStart');
const hintEl = document.getElementById('hint');
const hintText = document.getElementById('hintText');
const btnSound = document.getElementById('btnSound');
const btnAgain = document.getElementById('btnAgain');
const oops = document.getElementById('oops');

function fail(msg) {
  document.getElementById('oopsMsg').textContent = msg;
  oops.hidden = false;
  bootEl.classList.add('gone');
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
    stencil: false,
  });
} catch (e) {
  fail('この ブラウザでは 3Dが うごかないみたい。Safari か Chrome で ひらいてね。');
  throw e;
}


let maxDpr = 2;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.86;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.clipShadows = true;
renderer.setClearColor(0xc6d4e2, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, 1, 0.12, 400);

const audio = new Audio();
const ui = {
  hint(text) {
    if (!text) { hintEl.classList.remove('show'); return; }
    if (hintText.textContent === text && hintEl.classList.contains('show')) return;
    hintText.textContent = text;
    hintEl.classList.add('show');
  },
};

let world, game, ready = false;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  if (game) game.reframe();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 220));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// ---------------------------------------------------------------- pointer
function rect() { return canvas.getBoundingClientRect(); }
let activePointer = null;

canvas.addEventListener('pointerdown', (e) => {
  if (!ready || activePointer !== null) return;
  activePointer = e.pointerId;
  canvas.setPointerCapture?.(e.pointerId);
  audio.resume();
  game.onDown(e.clientX, e.clientY, rect());
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('pointermove', (e) => {
  if (!ready || e.pointerId !== activePointer) return;
  game.onMove(e.clientX, e.clientY, rect());
  e.preventDefault();
}, { passive: false });

function endPointer(e, cancel) {
  if (!ready || e.pointerId !== activePointer) return;
  activePointer = null;
  if (cancel) game.onCancel();
  else game.onUp(e.clientX, e.clientY, rect());
  e.preventDefault();
}
canvas.addEventListener('pointerup', (e) => endPointer(e, false), { passive: false });
canvas.addEventListener('pointercancel', (e) => endPointer(e, true), { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

// ------------------------------------------------------------------- ui
let soundOn = true;
btnSound.addEventListener('click', () => {
  soundOn = !soundOn;
  btnSound.classList.toggle('off', !soundOn);
  audio.resume();
  audio.setEnabled(soundOn);
});
btnAgain.addEventListener('click', () => { if (ready) game.restart(); });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (soundOn) audio.resume();
});

// ------------------------------------------------------------- build/loop
async function boot() {
  const step = async (msg, fn) => {
    bootMsg.textContent = msg;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return fn();
  };
  resize();
  world = new World(renderer, scene);
  await step('ゆきを つもらせています…', () => world.build());
  await step('みちを つくっています…', () => {
    game = new Game({ renderer, scene, camera, world, audio, ui });
    game.snapView('establish', CFG.inlets[0]);
    // handle for automated device checks
    window.__game = game; window.__world = world; window.__three = THREE; window.__cfg = CFG;
  });
  // one warm-up frame so the first tap is not the frame that compiles shaders
  await step('しあげ…', () => { renderer.compile(scene, camera); renderer.render(scene, camera); });
  bootMsg.textContent = 'ゆきの したに なにが あるのかな？';
  bootEl.classList.add('ready');
  startBtn.hidden = false;
  loop();
}

startBtn.addEventListener('click', () => {
  audio.init();
  audio.resume();
  audio.setEnabled(soundOn);
  bootEl.classList.add('gone');
  setTimeout(() => { bootEl.style.display = 'none'; }, 600);
  ready = true;
  game.start();
});

// adaptive resolution: keep 60fps on a phone before keeping pixels
let frames = 0, accum = 0, dprStep = 0;
function adapt(dt) {
  frames++; accum += dt;
  if (frames < 70) return;
  const avg = accum / frames;
  frames = 0; accum = 0;
  if (avg > 0.026 && dprStep < 2) {
    dprStep++;
    const dprs = [2, 1.5, 1.15];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprs[dprStep]));
    if (dprStep === 2) world.setSunMapSize(1024);
    resize();
  }
}

let last = performance.now();
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1;

  const r = rect();
  if (ready) {
    game.update(dt, r);
    adapt(dt);
  } else if (game) {
    // slow drift behind the title card
    const t = now / 1000;
    camera.position.set(
      game.cam.pos.x + Math.sin(t * 0.13) * 1.6,
      game.cam.pos.y + Math.sin(t * 0.09) * 0.35,
      game.cam.pos.z);
    camera.lookAt(game.cam.look);
  }
  world.update(dt, now / 1000, camera);
  renderer.render(scene, camera);
}

canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  fail('えを つくる ちからが たりなくなっちゃった。ページを もういちど ひらいてね。');
});

boot().catch((e) => {
  console.error(e);
  fail('よみこみに しっぱいしました。ページを もういちど ひらいてね。');
});
