import * as THREE from 'three';
import { GameScene } from './scene/scene';
import { Game } from './game/game';
import { SoftAudio } from './core/audio';
import { Rng, sessionSeed } from './core/rng';

/**
 * ユニコーンの角修理工房 — bootstrap.
 * ?e2e=1  : deterministic seed, DPR 1, faster pacing, no audio, test hooks
 * ?seed=N : force layout seed
 */

const url = new URL(window.location.href);
const E2E = url.searchParams.get('e2e') === '1';
const seed = sessionSeed();
const rng = new Rng(seed);

// console error capture (surfaced to the smoke tests)
const capturedErrors: string[] = [];
const origError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  capturedErrors.push(args.map((a) => String(a)).join(' '));
  origError(...args);
};
window.addEventListener('error', (e) => capturedErrors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) =>
  capturedErrors.push(String((e as PromiseRejectionEvent).reason))
);

const app = document.getElementById('app')!;
const audio = new SoftAudio(!E2E);
const gs = new GameScene(app, rng, E2E);
const game = new Game(gs, audio, E2E ? 3 : 1);

let last = performance.now();
let elapsed = 0;

function frame(now: number) {
  const rawDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  elapsed += rawDt;

  game.update(rawDt, elapsed);
  gs.updateCamera(rawDt * game.timeScale);
  gs.unicorn.update(rawDt, elapsed);
  gs.horn.update(rawDt, elapsed);
  gs.lamp.update(rawDt);

  gs.renderer.render(gs.scene, gs.camera);
  gs.trackPerformance(rawDt * 1000); // full frame delta: catches GPU-bound devices too

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ----------------------------------------------------------------- test hooks
declare global {
  interface Window {
    __uha?: unknown;
  }
}

window.__uha = {
  seed,
  errors: capturedErrors,
  snapshot: () => game.snapshot(),
  dirtArray: () => Array.from(gs.horn.dirt),
  probe: (x: number, y: number) => game.raycastHorn(x, y),
  hornDebug: () => ({
    shaderInstalled: gs.horn.shaderInstalled,
    lightFront: gs.horn.lightFront,
    lightPower: gs.horn.lightPower,
  }),
  hornDebugMode: (on: boolean | number) => gs.horn.setDebug(on),
  hoseDebug: () => {
    const g = gs.rinse.hose?.geometry;
    const pos = g?.getAttribute('position');
    const arr = pos ? Array.from((pos.array as Float32Array).slice(0, 9)) : [];
    let nan = 0;
    if (pos) {
      const a = pos.array as Float32Array;
      for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) nan++;
    }
    return {
      hasHose: !!gs.rinse.hose,
      visible: gs.rinse.hose?.visible,
      points: gs.rinse.hosePoints(),
      vertCount: pos?.count ?? 0,
      nanCount: nan,
      firstVerts: arr.map((v) => Math.round(v * 1000) / 1000),
      inScene: gs.rinse.hose?.parent === gs.scene,
    };
  },
  /** screen coords of the groove point at t — lets tests trace real strokes */
  grooveScreen: (t: number) => game.worldToScreen(gs.horn.groovePointWorld(t)),
  crackScreen: (i: number) => {
    const c = gs.horn.cracks[i];
    return c ? game.worldToScreen(gs.horn.crackPointWorld(c)) : null;
  },
  prismScreen: () => game.worldToScreen(gs.prism.group.position.clone()),
  mirrorScreen: () =>
    game.worldToScreen(gs.mirror.group.position.clone().add(new THREE.Vector3(0, 0.12, 0))),
  hornTipScreen: () => game.worldToScreen(gs.hornTip()),
  spectrumIntensity: () =>
    (gs.spectrum.material.uniforms.uIntensity as { value: number }).value,
  renderer: () => ({
    pixelRatio: gs.renderer.getPixelRatio(),
    drawCalls: gs.renderer.info.render.calls,
    triangles: gs.renderer.info.render.triangles,
    programs: gs.renderer.info.programs?.length ?? 0,
    geometries: gs.renderer.info.memory.geometries,
    textures: gs.renderer.info.memory.textures,
  }),
};
