import * as THREE from 'three';
import { audio } from './core/audio';
import { Engine } from './core/engine';
import { Pointer } from './core/pointer';
import { settings } from './core/settings';
import { Director } from './game/director';
import { CameraRig } from './game/camera';
import { FingerHint, hideLoading, setupSettingsPanel } from './ui/hud';
import { buildTerrain } from './world/terrain';
import { hillCutouts } from './game/layout';

const mount = document.getElementById('app')!;
const engine = new Engine(mount);
const pointer = new Pointer(engine.canvas);
const rig = new CameraRig(engine.camera);
const finger = new FingerHint();

const terrain = buildTerrain(hillCutouts());
engine.scene.add(terrain.mesh);

const director = new Director(engine, pointer, rig, finger, terrain);

let audioUnlocked = false;
const unlock = () => {
  if (audioUnlocked) return;
  audioUnlocked = true;
  audio.unlock();
};
engine.canvas.addEventListener('pointerdown', unlock, { passive: true });
window.addEventListener('keydown', unlock, { passive: true });
setupSettingsPanel(unlock);

settings.onChange(() => {
  // reduced motion also calms the camera, not just the leaves
  engine.renderer.toneMappingExposure = 1.02;
});

let firstFrame = true;
engine.onUpdate((dt, elapsed) => {
  pointer.update(dt);
  director.update(dt, elapsed);
  if (firstFrame) {
    firstFrame = false;
    requestAnimationFrame(() => hideLoading());
  }
});

engine.start();

/* Deterministic hooks for the automated play-through, harmless in production. */
type TestApi = {
  three: string;
  state: () => Record<string, unknown>;
  errors: string[];
  engine: Engine;
  scene: THREE.Scene;
  manual: (v: boolean) => void;
  tick: (dt: number, render?: boolean) => void;
  fillMask: () => void;
};
const errors: string[] = [];
const origError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  errors.push(args.map(String).join(' '));
  origError(...args);
};
window.addEventListener('error', (e) => errors.push(String(e.message)));
(window as unknown as { __imo: TestApi }).__imo = {
  three: THREE.REVISION,
  state: () => (director as unknown as { debugState?: () => Record<string, unknown> }).debugState?.() ?? {},
  errors,
  engine,
  scene: engine.scene,
  manual: (v: boolean) => engine.setManual(v),
  tick: (dt: number, render = true) => engine.tick(dt, render),
  fillMask: () => (director as unknown as { debugFillMask: () => void }).debugFillMask(),
};
