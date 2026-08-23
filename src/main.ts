import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Game } from './game';
import { installTestApi } from './testApi';

const canvas = document.getElementById('lab') as HTMLCanvasElement;
const params = new URLSearchParams(location.search);
const e2e = params.get('e2e') === '1';

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !e2e,
  powerPreference: 'high-performance',
});
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const dpr = e2e ? 1 : Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(dpr);

const game = new Game(renderer, canvas, e2e ? 512 : 1024);

// image-based lighting for the metals — a neutral room, not a showroom
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  game.scene.environment = envTex;
  game.scene.environmentIntensity = 0.45;
  pmrem.dispose();
}

installTestApi(game);
(window as any).__game = game;
(window as any).__perf = () => ({
  calls: renderer.info.render.calls,
  triangles: renderer.info.render.triangles,
  geometries: renderer.info.memory.geometries,
  textures: renderer.info.memory.textures,
});

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  game.resize(w, h);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 60));
resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  game.update(dt);
  game.render();
});

// stray-gesture guards for iOS
document.addEventListener(
  'gesturestart',
  (e) => e.preventDefault(),
  { passive: false },
);
document.addEventListener(
  'dblclick',
  (e) => e.preventDefault(),
  { passive: false },
);
