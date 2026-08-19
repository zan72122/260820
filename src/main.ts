import './style.css';
import { Renderer } from './engine/Renderer';
import { PointerInput } from './engine/PointerInput';
import { Game } from './game/Game';
import { Config } from './engine/config';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const pointer = new PointerInput(canvas);
const game = new Game(renderer, pointer);

const errors: string[] = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));

let last = performance.now();
let frames = 0;
let fpsAcc = 0;
let fps = 60;

function frame(now: number) {
  const real = (now - last) / 1000;
  const dt = Math.min(0.1, real);
  last = now;
  frames++;
  fpsAcc += real;
  if (fpsAcc > 0.5) {
    fps = frames / fpsAcc;
    frames = 0;
    fpsAcc = 0;
  }
  game.update(dt);
  renderer.render();
  renderer.adapt(dt, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Rotating the device must never cost the child their flower: only the camera
// and the drawing buffer are touched.
const onResize = () => renderer.resize();
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 120));
if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

/** Deterministic hooks for the E2E suite; harmless in normal play. */
Object.defineProperty(window, '__game', {
  value: {
    get act() {
      return game.act;
    },
    get stats() {
      return {
        ...game.stats,
        fps,
        pixelRatio: renderer.pixelRatio,
        webgl2: renderer.gl.capabilities.isWebGL2,
      };
    },
    get errors() {
      return errors.slice();
    },
    get seed() {
      return Config.seed;
    },
    get flowerSignature() {
      // A compact fingerprint of the piped geometry, used to prove that two
      // plays with the same colour never produce an identical flower.
      let acc = 0;
      let n = 0;
      game.flower.group.traverse((o) => {
        const g = (o as unknown as { geometry?: { attributes?: Record<string, { array: ArrayLike<number> }> } })
          .geometry;
        const pos = g?.attributes?.position;
        if (!pos) return;
        for (let i = 0; i < pos.array.length; i += 37) {
          acc = (acc + pos.array[i] * 1e6 * (i + 1)) % 1e9;
          n++;
        }
      });
      return { hash: Math.round(acc), samples: n };
    },
    anchors() {
      return game.anchors();
    },
    pointer(kind: 'down' | 'move' | 'up', x: number, y: number) {
      pointer.simulate(kind, x, y);
    },
    /** Advance without a real browser gesture (used to script the acts). */
    force(act: 'petals' | 'lift' | 'done') {
      if (act === 'lift') (game as unknown as { finishPetals(): void }).finishPetals();
    },
  },
  writable: false,
});

if (Config.debug) {
  const el = document.createElement('pre');
  el.style.cssText =
    'position:fixed;left:8px;top:8px;color:#9f9;font:11px monospace;pointer-events:none;text-shadow:0 1px 2px #000';
  document.body.appendChild(el);
  setInterval(() => {
    el.textContent = `${game.act} fps:${fps.toFixed(0)} dpr:${renderer.pixelRatio} calls:${game.stats.drawCalls} petals:${game.stats.petals} cone:${game.stats.coneHeight.toFixed(4)}`;
  }, 250);
}
