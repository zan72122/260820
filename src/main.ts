import * as THREE from 'three';
import { Game } from './game';

const app = document.getElementById('app')!;
const veil = document.getElementById('veil')!;

const params = new URLSearchParams(location.search);
const E2E = params.get('e2e') === '1';

const errors: string[] = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => errors.push('unhandledrejection: ' + String(e.reason)));

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;   // Soft is ~2x cost for no gain at this scale
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 200);

// quality scaling: fillrate is the mobile bottleneck — cap DPR on touch
// devices and start below the cap so first seconds are smooth
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const dprCap = Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2);
let pixelScale = E2E ? 1 : Math.min(dprCap, isTouch ? 1.25 : dprCap);
const applySize = () => {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(pixelScale);
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
};
applySize();
window.addEventListener('resize', applySize);
// orientation changes must never lose progress — state lives on, we only resize
window.addEventListener('orientationchange', () => setTimeout(applySize, 250));

const game = new Game(scene, camera, renderer, app);
game.errors.push(...errors.splice(0));
window.addEventListener('error', (e) => game.errors.push(String(e.message)));

// dynamic internal resolution: shrink under sustained load, recover when calm
let frameAcc = 0, frameN = 0, cooldown = 0;
let first = true;
let last = performance.now();

function frame(now: number): void {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (E2E) dt = 1 / 60;                 // deterministic stepping under test
  dt = Math.min(dt, 0.1);

  game.update(dt);
  renderer.render(scene, camera);

  if (first) {
    first = false;
    veil.classList.add('gone');
    setTimeout(() => veil.remove(), 2000);
  }

  if (!E2E) {
    frameAcc += dt; frameN++; cooldown -= dt;
    if (frameN >= 60) {
      const avg = frameAcc / frameN;
      frameAcc = 0; frameN = 0;
      if (avg > 1 / 26 && pixelScale > 0.75 && cooldown <= 0) {
        pixelScale = Math.max(0.75, pixelScale - 0.25);
        cooldown = 4; applySize();
      } else if (avg < 1 / 55 && pixelScale < dprCap && cooldown <= 0) {
        pixelScale = Math.min(dprCap, pixelScale + 0.25);
        cooldown = 6; applySize();
      }
    }
  }
}
requestAnimationFrame(frame);

// e2e helper: advance N frames synchronously for deterministic screenshots
if (E2E) {
  (window as any).__tick = (frames: number) => {
    for (let i = 0; i < frames; i++) {
      game.update(1 / 60);
    }
    renderer.render(scene, camera);
  };
}
