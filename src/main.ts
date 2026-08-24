import * as THREE from 'three';
import { Rng, clamp } from './util/rng';
import { Game } from './game';

// Renderer note: WebGL2 via three's WebGLRenderer. WebGPURenderer was
// considered; the custom water/murk/horn shaders and iOS Safari coverage
// made WebGL2 the dependable choice — every core beat (purify, wind,
// replay) runs on it, which is what the WebGPU-optional requirement needs.

const params = new URLSearchParams(location.search);
const E2E = params.get('e2e') === '1';
const SEED = E2E ? 12345 : (Math.floor(Math.random() * 1e9) ^ Date.now()) >>> 0;

const errors: string[] = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));

const t0 = performance.now();

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 80);

// ---- adaptive internal resolution --------------------------------------
// Never blindly trust devicePixelRatio; measure real frame times and step
// the internal scale down/up between quality tiers.
class Quality {
  private samples: number[] = [];
  private tier = E2E ? 3 : 0; // 0 best
  private scales = [1, 0.85, 0.7, 0.55];
  private cool = 0;
  lowDetail = false;

  baseDpr() {
    return E2E ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  }
  currentScale() {
    return this.scales[this.tier];
  }
  apply() {
    renderer.setPixelRatio(this.baseDpr() * this.currentScale());
    resize();
  }
  frame(dtMs: number, game: Game) {
    if (E2E) return;
    this.samples.push(dtMs);
    this.cool -= dtMs / 1000;
    if (this.samples.length >= 90 && this.cool <= 0) {
      const sorted = [...this.samples].sort((a, b) => a - b);
      const p75 = sorted[Math.floor(sorted.length * 0.75)];
      this.samples.length = 0;
      if (p75 > 26 && this.tier < 3) {
        this.tier++;
        this.cool = 3;
        this.apply();
        if (this.tier >= 2 && !this.lowDetail) {
          this.lowDetail = true;
          game.env.setLowDetail(true);
        }
      } else if (p75 < 14 && this.tier > 0) {
        this.tier--;
        this.cool = 5;
        this.apply();
        if (this.tier < 2 && this.lowDetail) {
          this.lowDetail = false;
          game.env.setLowDetail(false);
        }
      }
    }
  }
}
const quality = new Quality();

function resize() {
  const w = app.clientWidth || window.innerWidth;
  const h = app.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

const rng = new Rng(SEED);
const game = new Game(scene, camera, renderer.domElement, rng, E2E);
quality.apply();
resize();

let resizeTimer: ReturnType<typeof setTimeout> | null = null;
window.addEventListener('resize', () => {
  resize();
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => game.director.refresh(), 120);
});

// audio unlock on the very first touch
const unlock = () => {
  game.audio.resume();
};
window.addEventListener('pointerdown', unlock, { passive: true });

// replay: appears only during free play, disappears while resetting
const replayBtn = document.getElementById('replay') as HTMLButtonElement;
game.onFreeplay = () => replayBtn.classList.add('show');
replayBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  replayBtn.classList.remove('show');
  game.replay();
});
replayBtn.addEventListener('pointerdown', (e) => e.stopPropagation());

// ---- main loop ----------------------------------------------------------
const metrics = { bootMs: 0, firstFrameMs: 0, frames: 0, avgFrameMs: 0 };
let last = performance.now();
let frameAccum = 0;
let timeScale = 1;
let firstFrame = true;

function tick(now: number) {
  const rawDt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const dt = rawDt * timeScale;
  game.update(dt);
  renderer.render(scene, camera);
  if (firstFrame) {
    firstFrame = false;
    metrics.bootMs = Math.round(t0 > 0 ? performance.now() - t0 : 0);
    metrics.firstFrameMs = Math.round(performance.now() - t0);
    console.info(`[unicorn] first frame ${metrics.firstFrameMs} ms after boot`);
  }
  metrics.frames++;
  frameAccum += rawDt * 1000;
  metrics.avgFrameMs = frameAccum / metrics.frames;
  quality.frame(rawDt * 1000, game);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ---- test / debug bridge -------------------------------------------------
const project = (v: THREE.Vector3) => {
  const p = v.clone().project(camera);
  const w = app.clientWidth || window.innerWidth;
  const h = app.clientHeight || window.innerHeight;
  return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h, front: p.z < 1 };
};

declare global {
  interface Window {
    __game: Record<string, unknown>;
  }
}
window.__game = {
  version: '1.0.0',
  seed: SEED,
  get phase() {
    return game.phase;
  },
  get mainRemaining() {
    return game.murk.remainingMain();
  },
  get wispRemaining() {
    return game.murk.remainingWisps();
  },
  get clarityAvg() {
    return game.clarityAvg();
  },
  get hornLoad() {
    return game.hornLoad;
  },
  get errors() {
    return errors;
  },
  get metrics() {
    return metrics;
  },
  get circling() {
    return game.input.circling;
  },
  get angSpeed() {
    return game.input.angSpeed;
  },
  get debug() {
    const tip = game.unicorn.tipWorld(new THREE.Vector3());
    return {
      down: game.input.down,
      accum: game.input.accumAngle,
      angSpeed: game.input.angSpeed,
      radiusPx: game.input.radiusPx,
      radiusWorld: game.input.radiusWorld,
      water: game.input.waterPoint ? [game.input.waterPoint.x, game.input.waterPoint.z] : null,
      tip: [tip.x, tip.y, tip.z],
      activeState: game.murk.active ? game.murk.active.state : null,
      introDist: tip.distanceTo(game.murk.intro().centroid(new THREE.Vector3())),
      ground: game.input.groundPoint ? [game.input.groundPoint.x, game.input.groundPoint.z] : null,
      stoneDist: game.input.groundPoint
        ? Math.hypot(
            game.input.groundPoint.x - game.env.stonePos.x,
            game.input.groundPoint.z - game.env.stonePos.z
          )
        : null,
      tipStoneDist: tip.distanceTo(game.env.stoneTop),
      transfer: (game as unknown as { transferState: string }).transferState,
      screen: [game.input.screen.x, game.input.screen.y],
    };
  },
  hornTipScreen() {
    return project(game.unicorn.tipWorld(new THREE.Vector3()));
  },
  introStreakScreen() {
    return project(game.murk.intro().centroid(new THREE.Vector3()));
  },
  streakScreens() {
    return game.murk.streaks
      .filter((s) => s.state !== 'gone' && s.state !== 'inactive')
      .map((s) => {
        const c = s.centroid(new THREE.Vector3());
        return { ...project(c), wx: c.x, wz: c.z, main: s.isMain, state: s.state };
      });
  },
  stoneScreen() {
    return project(game.env.stoneTop.clone());
  },
  setTimeScale(k: number) {
    timeScale = clamp(k, 0, 20);
  },
  // advance game logic quickly without waiting wall-clock (E2E only)
  fastForward(seconds: number) {
    const step = 1 / 30;
    let t = 0;
    while (t < seconds) {
      game.update(step);
      t += step;
    }
    renderer.render(scene, camera);
  },
  replay() {
    game.replay();
  },
};
