import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeMaterials, resetSeed } from './materials';
import { buildEnvironment, buildAmbientLights } from './environment';
import { CameraRig } from './camera';
import { AudioBus } from './audio';
import { Game } from './game';
import { letterA } from './letters/a';
import { installTestHooks } from './debug';

const params = new URLSearchParams(location.search);
const E2E = params.has('e2e');

const app = document.getElementById('app')!;
const canvas = document.createElement('canvas');
app.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const DPR = E2E ? 1 : Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(DPR);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x191b1f);

// subtle image-based lighting so metals separate from paint
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.22;

resetSeed(1234);
const M = makeMaterials();
buildEnvironment(scene, M);
buildAmbientLights(scene);

const rig = new CameraRig(window.innerWidth / window.innerHeight);
const audio = new AudioBus();
const game = new Game(scene, rig, audio, M, letterA, canvas, E2E);

function resize(): void {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  rig.setAspect(w / h);
}
resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => window.setTimeout(resize, 60));

canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());

installTestHooks(game, rig, renderer);

const loader = document.getElementById('loader');
let frames = 0;
let last = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  renderer.render(scene, rig.camera);
  frames++;
  if (frames === 3 && loader) loader.classList.add('hidden');
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
