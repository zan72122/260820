import { FogExp2, Raycaster, Scene, Vector2, Vector3 } from 'three/webgpu';
import './styles.css';
import { LAYOUT, readFlags } from './core/config';
import { Rng, clamp } from './core/mathx';
import { createRenderer } from './core/renderer';
import { Quality } from './core/quality';
import { Input } from './core/input';
import { AudioEngine } from './core/audio';
import { Materials } from './art/materials';
import { Hall } from './world/hall';
import { Lighting } from './world/lighting';
import { GrandCurtain, LegCurtain } from './world/curtain';
import { CameraRig } from './game/cameraRig';
import { Director } from './game/director';
import { Overlay } from './ui/overlay';

/** Lets the browser paint the loading bar between heavy synchronous steps. */
const yieldToPaint = (): Promise<void> =>
  new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

async function boot(): Promise<void> {
  const flags = readFlags();
  const overlay = new Overlay();
  overlay.setProgress(0.05);

  const canvasEl = document.getElementById('stage-canvas') as HTMLCanvasElement;
  const { renderer, canvas, backend } = await createRenderer(canvasEl, flags);
  overlay.setProgress(0.2);
  await yieldToPaint();

  const scene = new Scene();
  // Just enough aerial perspective to separate near cloth from far house.
  scene.fog = new FogExp2(0x120c10, 0.021);

  const rng = new Rng(flags.seed || 0x1b7a3f);
  const bakeStart = performance.now();
  const mats = new Materials(flags.fast);
  const bakeMs = Math.round(performance.now() - bakeStart);
  overlay.setProgress(0.45);
  await yieldToPaint();

  const hall = new Hall(mats, new Rng(flags.seed || 991), flags.fast);
  scene.add(hall.group);
  overlay.setProgress(0.62);
  await yieldToPaint();

  const lighting = new Lighting(mats, new Rng(flags.seed || 41));
  scene.add(lighting.group);

  const legCurtain = new LegCurtain(mats);
  const grand = new GrandCurtain(mats);
  scene.add(legCurtain.group, grand.group);
  overlay.setProgress(0.8);
  await yieldToPaint();

  const rig = new CameraRig();
  const audio = new AudioEngine();
  const input = new Input(canvas);

  const quality = new Quality(renderer, flags);
  quality.onChange((p) => {
    lighting.applyQuality(p);
    legCurtain.setShadows(p.shadows);
    renderer.shadowMap.enabled = p.shadows;
  });

  const director = new Director({
    scene,
    mats,
    lighting,
    legCurtain,
    grand,
    rig,
    audio,
    overlay,
    input,
    flags,
    rng,
  });
  hall.setAudienceBrightness(mats, 0.1);
  overlay.setProgress(0.95);

  // ---------------------------------------------------------------- resize
  const resize = (): void => {
    const vv = window.visualViewport;
    const w = Math.round(vv?.width ?? window.innerWidth);
    const h = Math.round(vv?.height ?? window.innerHeight);
    quality.applyPixelRatio(w, h);
    renderer.setSize(w, h, false);
    rig.resize(w, h);
    input.measure();
  };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => window.setTimeout(resize, 220));
  window.visualViewport?.addEventListener('resize', resize);
  resize();

  // ------------------------------------------------------------ frame loop
  let last = performance.now();
  let started = false;
  let accum = 0;

  const frame = (now: number): void => {
    const rawDt = (now - last) / 1000;
    last = now;
    const dt = clamp(rawDt, 0, 0.05);
    accum += dt;

    input.update(dt);
    audio.update(dt);

    if (started) {
      director.update(dt);
    }

    legCurtain.update(accum, dt);
    grand.update(accum, dt);
    hall.update(accum, quality.profile.audienceStride);
    const exposure = lighting.update(dt, legCurtain.gap / LAYOUT.legCurtain.peekMaxGap, accum);
    renderer.toneMappingExposure = exposure;
    hall.setAudienceBrightness(mats, lighting.audienceLevel);
    rig.update(dt, accum);

    renderer.renderAsync(scene, rig.camera).catch(() => undefined);

    const frameMs = performance.now() - now;
    quality.sample(frameMs, dt);
    requestAnimationFrame(frame);
  };

  // Warm the pipelines before the first visible frame so the opening shot does
  // not stutter while shaders compile.
  rig.resize(window.innerWidth, window.innerHeight);
  await renderer.renderAsync(scene, rig.camera).catch(() => undefined);
  overlay.setProgress(1);

  overlay.onFirstTouch(() => {
    started = true;
    void audio.unlock().then(() => {
      audio.setOpenness(0);
    });
    director.start();
    input.resetIdle();
  });

  requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    audio.setMuted(document.hidden);
    if (!document.hidden) last = performance.now();
  });

  // Automated-check surface. Only meaningful with ?fast=1, but the read-only
  // state is always available so a smoke test can assert without hacks.
  (window as unknown as { __butai: unknown }).__butai = {
    backend,
    flags,
    bakeMs,
    state: () => director.debugState(),
    quality: () => quality.profile.tier,
    camera: () => {
      const p = rig.camera.position;
      return { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), fov: +rig.camera.fov.toFixed(1) };
    },
    begin: () => {
      started = true;
      director.start();
    },
    peek: (v: number) => director.debugPeek(v),
    advance: () => director.debugAdvance(),
    /** Run game logic forward without rendering, for automated checks. */
    tick: (seconds: number) => {
      const step = 1 / 60;
      let left = Math.min(120, Math.max(0, seconds));
      while (left > 0) {
        const d = Math.min(step, left);
        input.update(d);
        if (started) director.update(d);
        legCurtain.update(accum, d);
        grand.update(accum, d);
        lighting.update(d, legCurtain.gap / LAYOUT.legCurtain.peekMaxGap, accum);
        rig.update(d, accum);
        accum += d;
        left -= d;
      }
      return director.debugState();
    },
    /** What is actually in front of the lens at a given NDC point. */
    probe: (nx = 0, ny = 0) => {
      const ray = new Raycaster();
      ray.setFromCamera(new Vector2(nx, ny), rig.camera);
      const hits = ray
        .intersectObjects(scene.children, true)
        .filter((h) => h.object.type === 'Mesh' || h.object.type === 'InstancedMesh')
        .slice(0, 5);
      return hits.map((h) => {
        const m = h.object as unknown as { material?: { name?: string; color?: { getHexString(): string } } };
        return {
          d: +h.distance.toFixed(2),
          type: h.object.type,
          geo: (h.object as unknown as { geometry?: { type?: string } }).geometry?.type,
          col: m.material?.color?.getHexString?.() ?? '',
          p: `${h.point.x.toFixed(2)},${h.point.y.toFixed(2)},${h.point.z.toFixed(2)}`,
        };
      });
    },
    /** Counts what is actually drawn, so cosmetics cannot fail silently. */
    draws: () => renderer.info.render,
    lookAt: () => {
      const v = new Vector3();
      rig.camera.getWorldDirection(v);
      return { x: +v.x.toFixed(2), y: +v.y.toFixed(2), z: +v.z.toFixed(2) };
    },
  };
}

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById('overlay');
  if (el) {
    el.innerHTML =
      '<div style="position:absolute;inset:0;display:grid;place-items:center;color:#f6e6d0;font-size:15px;text-align:center;padding:2rem">' +
      'このデバイスでは 3D を ひらけませんでした。<br>Safari の設定で WebGL を ゆるして ください。</div>';
  }
});
