import * as THREE from '../vendor/three.module.js';
import { Game } from './game.js';

/**
 * Boot. Picks a quality tier for the device, owns the frame loop, and keeps the
 * canvas honest across rotation, iOS toolbar changes and Split View resizes.
 */

const params = new URLSearchParams(location.search);
const FAST = params.get('fast') === '1' || params.get('e2e') === '1';
const SEED = Number(params.get('seed') || 20260825);

function pickQuality() {
  const dpr = window.devicePixelRatio || 1;
  const px = Math.max(window.innerWidth, window.innerHeight) * dpr;
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;

  if (FAST) {
    return {
      name: 'fast', maxDpr: 1, antialias: false,
      waterRings: 72, waterSegs: 64, bedRings: 44, bedSegs: 44,
      netRings: 10, netSegs: 36, netTexSize: 256
    };
  }
  const low = mem <= 2 || cores <= 3 || px < 900;
  if (low) {
    return {
      name: 'low', maxDpr: 1.5, antialias: false,
      waterRings: 96, waterSegs: 84, bedRings: 56, bedSegs: 56,
      netRings: 11, netSegs: 40, netTexSize: 384
    };
  }
  return {
    name: 'high', maxDpr: 2, antialias: true,
    waterRings: 128, waterSegs: 112, bedRings: 72, bedSegs: 72,
    netRings: 13, netSegs: 48, netTexSize: 512
  };
}

const quality = pickQuality();
const stage = document.getElementById('stage');

const renderer = new THREE.WebGLRenderer({
  antialias: quality.antialias,
  alpha: false,
  powerPreference: 'high-performance',
  stencil: false
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.maxDpr));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
stage.appendChild(renderer.domElement);

const game = new Game({ renderer, canvasEl: renderer.domElement, quality, seed: SEED });

function resize() {
  // visualViewport is the only value iOS gets right while the toolbars move.
  const vv = window.visualViewport;
  const w = Math.round(vv ? vv.width : window.innerWidth);
  const h = Math.round(vv ? vv.height : window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.maxDpr));
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + 'px';
  renderer.domElement.style.height = h + 'px';
  game.resize(w, h);
}
resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 220));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

let last = performance.now();
let frames = 0, fpsT = 0;
let running = true;

function frame(now) {
  requestAnimationFrame(frame);
  if (!running) { last = now; return; }
  let dt = (now - last) / 1000;
  last = now;
  if (!(dt > 0)) dt = 1 / 60;
  dt = Math.min(dt, 0.1);

  game.update(dt);
  game.render();

  frames++; fpsT += dt;
  if (fpsT >= 0.5) { game.fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
}
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  running = !document.hidden;
  last = performance.now();
});

// Fade the boot cover once the first real frame is on screen.
requestAnimationFrame(() => requestAnimationFrame(() => {
  const boot = document.getElementById('boot');
  if (!boot) return;
  if (FAST) { boot.remove(); return; }
  boot.classList.add('gone');
  setTimeout(() => boot.remove(), 1000);
}));

// --- test surface -----------------------------------------------------------
window.__toami = {
  game,
  quality,
  get state() { return game.debugState(); },
  /** Drive a cast directly, bypassing the finger. */
  cast(opts = {}) {
    game._startCast({
      distance: opts.distance ?? 7,
      azimuth: opts.azimuth ?? 0,
      sharpness: opts.sharpness ?? 0.6,
      smoothness: opts.smoothness ?? 0.8,
      wobble: opts.wobble ?? 0.2
    });
    return game.debugState();
  },
  haul() { game._startHaul(); return game.debugState(); },
  release() { game._startRelease(); return game.debugState(); },
  /** Step the simulation forward without waiting in real time. */
  advance(seconds, step = 1 / 60) {
    let t = 0;
    while (t < seconds) { game.update(step); t += step; }
    game.render();
    return game.debugState();
  },
  setRunning(v) { running = v; }
};
