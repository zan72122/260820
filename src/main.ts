import * as THREE from 'three';
import { Stage } from './core/stage';
import { Session, type DebugState } from './game/session';

/**
 * Boot, loop, and the small deterministic surface the browser tests drive.
 *
 * The loop is intentionally plain: measure the frame, step the session, render.
 * Quality steps down on its own if the frame budget is missed, and the step
 * never touches the geometry that carries the game's meaning.
 */

declare global {
  interface Window {
    __cassava?: {
      state(): DebugState;
      drive(amount: number): void;
      gesture(): { from: [number, number]; to: [number, number]; kind: string };
      clusterOnScreen(): { minX: number; maxX: number; minY: number; maxY: number };
      /** Advance the simulation by a fixed step, without waiting for frames. */
      step(seconds: number): void;
      ready: boolean;
    };
  }
}

const container = document.getElementById('app');
if (!container) throw new Error('#app missing');

const stage = new Stage(container);
const session = new Session(stage);

let last = performance.now() / 1000;
let elapsed = 0;
let running = true;

function frame(): void {
  if (!running) return;
  requestAnimationFrame(frame);
  const now = performance.now() / 1000;
  // A backgrounded tab returns a huge delta; clamp it so nothing jumps.
  const dt = Math.min(0.05, Math.max(0.0005, now - last));
  last = now;
  elapsed += dt;

  session.update(dt, elapsed);
  stage.render();

  if (stage.sampleFrame(dt, elapsed)) {
    session.resize();
  }
}

function onResize(): void {
  stage.resize();
  session.resize();
}

window.addEventListener('resize', onResize);
window.visualViewport?.addEventListener('resize', onResize);
// iOS fires orientationchange before the viewport metrics settle.
window.addEventListener('orientationchange', () => {
  onResize();
  setTimeout(onResize, 120);
  setTimeout(onResize, 400);
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) last = performance.now() / 1000;
});

// Deterministic hooks for the browser tests. Real play never touches these.
// A raw scene handle, only when explicitly asked for on the query string.
if (new URLSearchParams(location.search).has('debug')) {
  (window as unknown as { __cassavaDebug: unknown }).__cassavaDebug = {
    scene: stage.scene,
    camera: stage.camera,
    renderer: stage.renderer,
    THREE,
  };
}

window.__cassava = {
  state: () => session.debugState(),
  drive: (amount: number) => session.drive(amount),
  gesture: () => session.gestureScreen(),
  clusterOnScreen: () => session.clusterOnScreen(),
  step: (seconds: number) => {
    const step = 1 / 60;
    let left = seconds;
    while (left > 0) {
      const dt = Math.min(step, left);
      elapsed += dt;
      session.update(dt, elapsed);
      left -= dt;
    }
    stage.render();
  },
  ready: true,
};

requestAnimationFrame(frame);

// Fade the earth-coloured veil once the first frame is genuinely on screen.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.getElementById('veil')?.classList.add('gone');
    setTimeout(() => document.getElementById('veil')?.remove(), 900);
  });
});

window.addEventListener('pagehide', () => {
  running = false;
  session.dispose();
  stage.dispose();
});
