import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Game, type Phase, type Outcome } from './game/game';
import { Input } from './game/input';
import type { GapState } from './core/pairs';

const params = new URLSearchParams(location.search);
const E2E = params.has('e2e');
const LOW = params.has('low') || E2E;

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({
  antialias: !LOW,
  powerPreference: 'high-performance',
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = !LOW;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(LOW ? 1 : Math.min(window.devicePixelRatio, 2));
app.appendChild(renderer.domElement);

const game = new Game(document.body, LOW);

// neutral studio environment for the galvanized steel reflections
const pmrem = new THREE.PMREMGenerator(renderer);
game.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;
pmrem.dispose();
game.scene.environmentIntensity = 0.55;

new Input(renderer.domElement, game, game.rig.camera);

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  game.rig.setAspect(w / h);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 60));
resize();

let last = performance.now();
let paused = false;
function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (!paused) game.update(dt);
  renderer.render(game.scene, game.rig.camera);
}
requestAnimationFrame(frame);

// ---- deterministic hooks for E2E -------------------------------------
interface KcState {
  phase: Phase;
  outcome: Outcome;
  pairId: string;
  pairIndex: number;
  spacing: number;
  clearance: number;
  gapState: GapState;
  capsule: { x: number; y: number } | null;
  cleared: boolean;
}

declare global {
  interface Window {
    __kc?: {
      state: () => KcState;
      setSpacing: (v: number) => void;
      openValve: () => void;
      next: () => void;
      step: (seconds: number) => void;
      pause: () => void;
      resume: () => void;
      render: () => void;
    };
  }
}

if (E2E) {
  window.__kc = {
    state: () => ({
      phase: game.phase,
      outcome: game.outcome,
      pairId: game.pair.id,
      pairIndex: game.pairIndex,
      spacing: game.spacing,
      clearance: game.clearance,
      gapState: game.gapState,
      capsule: null,
      cleared: game.canAdvance(),
    }),
    setSpacing: (v: number) => {
      game.dragBy(v - game.spacing);
      game.dragEnd();
    },
    openValve: () => game.startTest(false),
    next: () => game.nextPair(),
    step: (seconds: number) => {
      const n = Math.ceil(seconds / (1 / 60));
      for (let i = 0; i < n; i++) game.update(1 / 60);
    },
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
    },
    render: () => renderer.render(game.scene, game.rig.camera),
  };
}
