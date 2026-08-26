import * as THREE from 'three';
import { createGardenState } from './sim/state';
import { Simulation } from './sim/physics';
import { GardenAudio, type AudioSettings } from './audio/engine';
import { World } from './scene/world';
import { Cutaway } from './scene/cutaway';
import { createRenderer, buildEnvironment } from './scene/renderer';
import { TouchControl } from './input/pointer';
import { Hud } from './ui/hud';
import { clamp, damp } from './util/math';

const SETTINGS_KEY = 'shishi.audio.v1';

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<AudioSettings>;
      return {
        volume: clamp(typeof v.volume === 'number' ? v.volume : 0.85, 0, 1),
        muted: !!v.muted,
        quiet: !!v.quiet,
      };
    }
  } catch {
    /* 保存が読めなくても遊べる */
  }
  return { volume: 0.85, muted: false, quiet: false };
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const bootEl = document.getElementById('boot')!;

  const { renderer, label } = await createRenderer(canvas);

  const state = createGardenState();
  const sim = new Simulation(state);
  const lengths = state.tubes.map((t) => t.length);

  const world = new World(lengths);
  const env = buildEnvironment(renderer);
  if (env) world.setEnvironment(env);

  const cutaway = new Cutaway(world.materials, lengths[0], 0.055, 0.008);

  const audio = new GardenAudio(lengths);
  const settings = loadSettings();
  audio.setSettings(settings);

  const hud = new Hud({
    get: () => audio.getSettings(),
    set: (s) => {
      audio.setSettings(s);
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(audio.getSettings()));
      } catch {
        /* 保存できなくても遊べる */
      }
    },
  });

  /* 起動中に音源を全て合成しておく（あとで待たされない） */
  await audio.prepare().catch((e) => console.warn('[shishi] 音響の準備に失敗しました', e));
  audio.setSettings(settings);

  const ndc = new THREE.Vector3();
  const toScreen = (v: THREE.Vector3): { x: number; y: number } => ({
    x: ((v.x + 1) / 2) * window.innerWidth,
    y: ((1 - v.y) / 2) * window.innerHeight,
  });

  const touch = new TouchControl(canvas, {
    gateScreen: () => toScreen(world.gateScreenPosition(ndc)),
    splitterScreen: () => {
      if (state.splitterPresence < 0.4) return null;
      ndc.set(world.units[1].layout.x * 0.5, 0.9, 0.5).project(world.camera);
      return toScreen(ndc);
    },
    currentGate: () => state.gateOpening,
    currentSplit: () => state.splitRatio,
    onFirstTouch: () => {
      void audio.unlock();
    },
  });

  /* ── 表示サイズ ─────────────────────── */
  let vw = 1;
  let vh = 1;
  const resize = (): void => {
    vw = Math.max(1, window.innerWidth);
    vh = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(clamp(window.devicePixelRatio || 1, 1, 2));
    renderer.setSize(vw, vh, false);
    world.setViewport(vw, vh);
  };
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));

  /* ── 復帰時に周期音が二重に鳴らないようにする ───────── */
  let hidden = false;
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') {
      hidden = true;
      void audio.suspend();
    } else {
      hidden = false;
      sim.resetClock();
      last = performance.now();
      void audio.resume();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', () => void audio.suspend());

  /* ── ループ ────────────────────────── */
  let last = performance.now();
  let firstRingSeen = false;
  let lowQuality = false;
  let slowFrames = 0;
  let smoothDt = 1 / 60;

  const cutRect = { x: 0, y: 0, w: 0, h: 0 };

  const frame = (now: number): void => {
    requestAnimationFrame(frame);
    if (hidden) {
      last = now;
      return;
    }
    const dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000));
    last = now;
    smoothDt = damp(smoothDt, dt, 0.4, dt);

    /* 仕切り板（二本目が出たあとだけ） */
    if (touch.splitTarget !== null) {
      state.splitRatio = damp(state.splitRatio, touch.splitTarget, 0.08, dt);
    }

    state.events.length = 0;
    sim.step(dt, touch.gate);

    world.update(state, sim.extras, dt);
    world.updateCamera(state, dt, state.time);
    cutaway.update(state.tubes[0], dt, state.cycleCount === 0);

    audio.handle(state.events, state);
    audio.update(state, sim.extras, dt);

    for (const e of state.events) {
      if (e.type === 'cycle-complete' && !firstRingSeen) {
        firstRingSeen = true;
        hud.showKidLine();
      }
    }

    hud.update(dt);

    /* 品質の自動調整（重いときは影を落とす） */
    if (smoothDt > 1 / 34) slowFrames++;
    else slowFrames = Math.max(0, slowFrames - 1);
    if (!lowQuality && slowFrames > 90) {
      lowQuality = true;
      world.applyQuality(true);
      renderer.setPixelRatio(1);
    }

    /* 本編 */
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, vw, vh);
    renderer.render(world.scene, world.camera);

    /* 最初の一周期だけの断面（短いカットアウェイ） */
    const op = cutaway.opacity;
    if (op > 0.06) {
      const span = Math.min(vw, vh);
      const w = span * 0.36 * op;
      const h = w * 0.6;
      const pad = 14;
      const portrait = vh > vw;
      cutRect.x = pad;
      cutRect.y = portrait ? pad + 58 : vh - h - pad - 10;
      cutRect.w = w;
      cutRect.h = h;
      cutaway.setAspect(w / h);
      const y = vh - cutRect.y - h;
      renderer.setScissorTest(true);
      renderer.setViewport(cutRect.x, y, w, h);
      renderer.setScissor(cutRect.x, y, w, h);
      renderer.setClearColor(0x1f231c, 1);
      renderer.clear(true, true, false);
      renderer.render(cutaway.scene, cutaway.camera);
      renderer.setScissorTest(false);
      hud.setCutawayRect(cutRect, op);
    } else {
      hud.setCutawayRect(null, 0);
    }
  };

  requestAnimationFrame(frame);

  bootEl.classList.add('hidden');
  setTimeout(() => bootEl.remove(), 900);
  console.info(`[shishi] renderer: ${label}`);
}

boot().catch((err) => {
  console.error(err);
  const bootEl = document.getElementById('boot');
  if (bootEl) bootEl.textContent = '庭を開けませんでした';
});
