import * as THREE from 'three';
import './style.css';
import { Input } from './core/Input';
import { AudioEngine } from './core/Audio';
import { Quality, QualitySettings } from './core/Quality';
import { Hud } from './core/Hud';
import { Game } from './game/Game';

const sceneCanvas = document.getElementById('scene') as HTMLCanvasElement;
const hintCanvas = document.getElementById('hint') as HTMLCanvasElement;
const startEl = document.getElementById('start') as HTMLDivElement;
const soundBtn = document.getElementById('sound') as HTMLButtonElement;

const renderer = new THREE.WebGLRenderer({
  canvas: sceneCanvas,
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false,
  stencil: false,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0xc6d3dd, 1);

const input = new Input(sceneCanvas);
const audio = new AudioEngine();
const hud = new Hud(hintCanvas);

let renderScale = 1;
const quality = new Quality(renderer, (s: QualitySettings) => {
  renderScale = s.renderScale;
  game.applyQuality(s);
  resize();
});

const game = new Game(input, audio, hud, quality.level);
quality.apply();

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.25) * renderScale;
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  game.director.setViewport(w, h);
  hud.resize();
  // portrait leaves more room below the work point, so the finger sits lower
  input.lift = h > w ? 0.155 : 0.115;
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => {
  // excavation state lives in plain arrays, so rotation only re-frames the view
  setTimeout(resize, 60);
  setTimeout(resize, 320);
});
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();

let running = false;
async function begin() {
  if (running) return;
  running = true;
  startEl.classList.add('hidden');
  try {
    await audio.start();
  } catch {
    /* audio is optional; the game plays without it */
  }
  setTimeout(() => startEl.remove(), 600);
}
startEl.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  void begin();
});

soundBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  audio.muted = !audio.muted;
  const waves = soundBtn.querySelector('#waves') as SVGGElement;
  const mute = soundBtn.querySelector('#mute') as SVGPathElement;
  waves.style.display = audio.muted ? 'none' : '';
  mute.style.display = audio.muted ? '' : 'none';
  if (!audio.muted) void audio.start();
});

sceneCanvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
});
sceneCanvas.addEventListener('webglcontextrestored', () => {
  resize();
});

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000));
  last = now;
  quality.update(dt);
  game.update(dt);
  renderer.render(game.scene, game.director.camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// exposed for automated checks: deterministic state without reading pixels
declare global {
  interface Window {
    __dig?: {
      phase: () => string;
      site: () => number;
      exposure: () => number;
      maxDepth: () => number;
      portrait: () => boolean;
      started: () => boolean;
    };
  }
}
window.__dig = {
  phase: () => game.phase,
  site: () => (game as unknown as { siteIndex: number }).siteIndex,
  exposure: () => game.activeSite.exposure,
  maxDepth: () => game.activeSite.deepest().depth,
  portrait: () => game.director.isPortrait,
  started: () => running,
};
