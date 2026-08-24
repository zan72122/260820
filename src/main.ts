import './style.css';
import { AudioSession } from './core/AudioSession';
import { AdaptiveQuality } from './core/AdaptiveQuality';
import { CameraDirector } from './core/CameraDirector';
import { GameDirector } from './core/GameDirector';
import { PointerRouter } from './core/PointerRouter';
import { SceneRoot } from './scene/SceneRoot';
import { Overlay } from './ui/Overlay';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const overlayRoot = document.getElementById('overlay') as HTMLElement;

const viewportSize = (): { w: number; h: number } => {
  const vv = window.visualViewport;
  return {
    w: Math.max(1, Math.round(vv?.width ?? window.innerWidth)),
    h: Math.max(1, Math.round(vv?.height ?? window.innerHeight)),
  };
};

const start = (): void => {
  const size = viewportSize();
  const scene = new SceneRoot(canvas);
  const camera = new CameraDirector(size.w / size.h, size.h >= size.w);
  const audio = new AudioSession();
  const overlay = new Overlay(overlayRoot, audio);
  const router = new PointerRouter(canvas, camera.camera);
  const game = new GameDirector(scene, audio, camera, router, overlay);
  const quality = new AdaptiveQuality(window.devicePixelRatio > 2.5 ? 1 : 0);

  const applyQuality = (): void => {
    scene.applyQuality(quality.level, window.devicePixelRatio || 1);
  };
  quality.onChange.on(applyQuality);
  applyQuality();

  const resize = (): void => {
    const { w, h } = viewportSize();
    scene.setSize(w, h);
    camera.resize(w / h);
    // Orientation only re-frames the shot. Pressure, valve angle, beat phase
    // and the sound stage all carry straight through the rotation.
    camera.setOrientation(h >= w);
    const rect = canvas.getBoundingClientRect();
    router.setViewport(rect.left, rect.top, w, h);
  };
  resize();

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => {
    // Safari reports the old size during the rotation itself.
    resize();
    window.setTimeout(resize, 120);
    window.setTimeout(resize, 420);
  });
  window.visualViewport?.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('scroll', resize);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && audio.ctx?.state === 'suspended') {
      void audio.ctx.resume();
    }
  });

  if (import.meta.env.DEV || import.meta.env.MODE === 'probe') {
    // Handle for browser automation. Present in dev and in the `probe` build
    // used by tools/, and absent from the shipped production bundle.
    (window as unknown as Record<string, unknown>).__bp = {
      game,
      camera,
      router,
      scene,
      audio,
      screenOf(name: 'chestpiece' | 'bulb' | 'valve') {
        const v = router.anchors[name].world.clone().project(camera.camera);
        const { w, h } = viewportSize();
        return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
      },
      /** Step the simulation without waiting on the render loop. */
      advance(seconds: number, step = 1 / 60) {
        for (let t = 0; t < seconds; t += step) {
          game.update(step);
          camera.update(step);
        }
      },
      state() {
        return {
          beat: game.currentBeat,
          pressure: game.pressure.pressure,
          stage: game.pressure.stage,
          valve: game.valve.openness,
          contact: game.contact.contact,
          sounds: game.korotkoff.audibleCount,
          exposure: game.reveal.exposure,
          shot: camera.shot,
          bpm: game.heart.bpm,
          run: game.replay.index,
          quality: quality.level.label,
          buildMs: scene.buildMs,
        };
      },
    };
  }

  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    quality.sample(dt);
    game.update(dt);
    camera.update(dt);
    scene.render(camera.camera);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
};

start();
