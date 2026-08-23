import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Game, type Phase, type Outcome } from './game/game';
import { Input } from './game/input';
import type { GapState } from './core/pairs';

const params = new URLSearchParams(location.search);
const E2E = params.has('e2e');
const LOW = params.has('low') || (E2E && !params.has('hq'));

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
game.scene.environmentIntensity = 0.45;

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
      pick: (nx: number, ny: number) => string[];
      debug: () => unknown;
    };
  }
}

if (E2E) {
  (window as unknown as Record<string, unknown>).__kcGame = game;
  (window as unknown as Record<string, unknown>).__kcRenderer = renderer;
  window.__kc = {
    state: () => ({
      phase: game.phase,
      outcome: game.outcome,
      pairId: game.pair.id,
      pairIndex: game.pairIndex,
      spacing: game.spacing,
      clearance: game.clearance,
      gapState: game.gapState,
      capsule: game.capsulePos(),
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
    debug: () => {
      let casters = 0;
      game.scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o.castShadow) casters++;
      });
      const sh = game.facility.sun.shadow;
      return {
        shadowMap: renderer.shadowMap.enabled,
        sunCast: game.facility.sun.castShadow,
        sunPos: game.facility.sun.position.toArray(),
        sunIntensity: game.facility.sun.intensity,
        shadowMapAllocated: !!sh.map,
        shadowCam: [sh.camera.left, sh.camera.right, sh.camera.top, sh.camera.bottom, sh.camera.near, sh.camera.far],
        casters,
        capsule: game.capsulePos(),
      };
    },
    pick: (nx: number, ny: number) => {
      const rc = new THREE.Raycaster();
      rc.setFromCamera(new THREE.Vector2(nx, ny), game.rig.camera);
      return rc.intersectObjects(game.scene.children, true).slice(0, 4).map((h) => {
        const p = new THREE.Vector3();
        h.object.getWorldPosition(p);
        return `${h.object.type}/${(h.object as THREE.Mesh).geometry?.type ?? ''} at ${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)} d=${h.distance.toFixed(2)}`;
      });
    },
  };
}
