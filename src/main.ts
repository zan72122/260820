import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PCFSoftShadowMap,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { AudioEngine } from './core/audio';
import { DebugOverlay } from './core/debug';
import { InputRouter } from './core/input';
import { QualityManager, isIOS } from './core/quality';
import { EnvironmentBaker, MORNING, makeSkyDome } from './render/env';
import { MaterialLibrary } from './render/materials';
import { Particles } from './render/particles';
import { setMaxAnisotropy } from './render/textures';
import { CameraRig } from './game/camera';
import { Director } from './game/director';
import { Interaction } from './game/interaction';
import { ControlStand } from './world/controlStand';
import { LandingMat } from './world/landingMat';
import { Park, SUN_DIRECTION } from './world/park';
import { SlideRig } from './world/slide';
import { SlideSurface } from './world/surface';
import { slideSurface } from './world/slideCurve';
import { Wagon } from './world/wagon';

const stage = document.getElementById('stage') as HTMLDivElement;
const boot = document.getElementById('boot') as HTMLDivElement;

function fail(message: string): void {
  boot.innerHTML = `<div style="font:16px/1.6 system-ui;color:#264;padding:8vw;text-align:center">${message}</div>`;
}

const PARAMS = new URLSearchParams(location.search);
/** `?fast=1` is the cloud/CI profile: smallest sensible everything. */
const FAST = PARAMS.get('fast') === '1';
/** `?e2e=1` exposes a deterministic control surface for automated checks. */
const E2E = PARAMS.get('e2e') === '1';

function start(): void {
  const quality = new QualityManager(FAST ? 'low' : undefined);
  if (FAST) {
    quality.settings.pixelRatioCap = 1;
    quality.settings.transmission = false;
    quality.settings.particles = false;
    quality.settings.foliageDensity = 0.3;
    quality.settings.shadowMapSize = 512;
    quality.lock();
  }
  let settings = quality.settings;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      antialias: settings.antialias,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      // iOS Safari drops the context more readily without this.
      failIfMajorPerformanceCaveat: false,
    });
  } catch {
    fail('この端末では WebGL を利用できません。');
    return;
  }
  if (!renderer.capabilities.isWebGL2) {
    fail('WebGL 2 に対応したブラウザで開いてください。');
    return;
  }

  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setClearColor(new Color('#9dc4d8'));
  stage.appendChild(renderer.domElement);
  setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());

  const scene = new Scene();
  scene.fog = new Fog(new Color('#cfe0e8').convertSRGBToLinear(), 14, 78);
  const sky = makeSkyDome(MORNING);
  scene.add(sky);

  // --- lighting: one shadow-casting sun plus image-based fill --------------
  const sun = new DirectionalLight(new Color('#fff2dc').convertSRGBToLinear(), 3.1);
  const sunBase = SUN_DIRECTION.clone();
  sun.position.copy(sunBase).multiplyScalar(16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(settings.shadowMapSize, settings.shadowMapSize);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 40;
  sun.shadow.camera.left = -8.5;
  sun.shadow.camera.right = 8.5;
  sun.shadow.camera.top = 7.5;
  sun.shadow.camera.bottom = -7.5;
  sun.shadow.bias = -0.0007;
  sun.shadow.normalBias = 0.022;
  sun.target.position.set(4.2, 0.4, 0);
  scene.add(sun);
  scene.add(sun.target);

  // A whisper of sky fill so shaded sides are not pitch black on materials
  // that ignore the environment map.
  const fill = new HemisphereLight(
    new Color('#cfe3ef').convertSRGBToLinear(),
    new Color('#6f7358').convertSRGBToLinear(),
    0.62,
  );
  scene.add(fill);

  const envBaker = new EnvironmentBaker(renderer, MORNING);
  scene.environment = envBaker.update(0, Infinity, settings.envResolution);
  scene.environmentIntensity = 1.35;

  // --- world --------------------------------------------------------------
  const tWorld = performance.now();
  const lib = new MaterialLibrary();
  const surface = new SlideSurface();
  const park = new Park(lib, { foliageDensity: settings.foliageDensity });
  scene.add(park.root);

  const slide = new SlideRig(lib, surface);
  scene.add(slide.root);

  const propOptions = { transmission: settings.transmission, shadows: true };
  const wagon = new Wagon(lib, new Vector3(6.55, 0, 3.5), propOptions);
  scene.add(wagon.root);

  const stand = new ControlStand(lib, new Vector3(0.95, 0, 1.0));
  scene.add(stand.root);

  const mat = new LandingMat(lib);
  scene.add(mat.root);

  const particles = new Particles(settings.particles ? 140 : 1);
  particles.enabled = settings.particles;
  scene.add(particles.points);

  const worldMs = performance.now() - tWorld;

  const rig = new CameraRig();
  const audio = new AudioEngine();
  const director = new Director(
    scene,
    lib,
    slide,
    surface,
    wagon,
    stand,
    mat,
    rig,
    audio,
    particles,
    propOptions,
  );

  const input = new InputRouter(renderer.domElement);
  input.onFirstGesture(() => audio.unlock());
  const interaction = new Interaction(
    input,
    director.handRoot,
    rig,
    stand,
    wagon,
    mat,
    slide,
    director,
  );

  const debug = new DebugOverlay();

  // --- sizing -------------------------------------------------------------
  function resize(): void {
    const w = Math.max(1, stage.clientWidth);
    const h = Math.max(1, stage.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, settings.pixelRatioCap) * quality.renderScale;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    rig.resize(w, h);
    interaction.setViewportSize(w, h);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  window.visualViewport?.addEventListener('resize', resize);
  resize();

  quality.onChange((s) => {
    settings = s;
    sun.shadow.mapSize.set(s.shadowMapSize, s.shadowMapSize);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
    park.setFoliageDensity(s.foliageDensity);
    particles.enabled = s.particles;
    resize();
  });

  // --- main loop ----------------------------------------------------------
  let last = performance.now();
  let firstFrameMs = 0;
  let running = true;
  let elapsed = 0;
  let firstFrame = true;

  rig.snap(director.shotContext);

  function frame(now: number): void {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000));
    last = now;
    elapsed += dt;
    quality.sample(dt);

    // Morning light creeping across the steel: the quietest of the first hints.
    const sweep = Math.sin(elapsed * 0.24) * 0.055;
    sun.position.set(
      sunBase.x * Math.cos(sweep) - sunBase.z * Math.sin(sweep),
      sunBase.y,
      sunBase.x * Math.sin(sweep) + sunBase.z * Math.cos(sweep),
    ).multiplyScalar(16);

    director.update(dt);
    stand.faceTowards(rig.camera.position, dt);
    wagon.faceTowards(rig.camera.position, dt);
    rig.update(dt, director.shotContext);

    const sunView = sun.position.clone().normalize().transformDirection(rig.camera.matrixWorldInverse);
    park.update(elapsed, sunView);
    particles.update(dt);
    audio.ambient(dt);

    if (settings.envRefreshInterval !== Infinity) {
      const tex = envBaker.update(elapsed, settings.envRefreshInterval, settings.envResolution);
      if (tex !== scene.environment) scene.environment = tex;
    }

    sky.position.copy(rig.camera.position);
    renderer.render(scene, rig.camera);
    debug.update(dt, renderer, quality, director);

    if (firstFrame) {
      firstFrame = false;
      firstFrameMs = performance.now();
      boot.classList.add('done');
      setTimeout(() => boot.remove(), 800);
    }
  }
  requestAnimationFrame(frame);

  if (E2E) {
    installTestHooks({
      director,
      rig,
      quality,
      renderer,
      audio,
      stand,
      wagon,
      mat,
      canvas: renderer.domElement,
      step: stepHeadless,
      timings: () => ({
        worldMs: Math.round(worldMs),
        firstFrameMs: Math.round(firstFrameMs),
      }),
    });
  }

  /** Advance game logic without waiting for real time, for automated checks. */
  function stepHeadless(seconds: number): void {
    const h = 1 / 60;
    let left = seconds;
    while (left > 0) {
      const d = Math.min(h, left);
      left -= d;
      elapsed += d;
      director.update(d);
      stand.faceTowards(rig.camera.position, d);
      wagon.faceTowards(rig.camera.position, d);
      rig.update(d, director.shotContext);
      particles.update(d);
    }
  }

  // --- lifecycle ----------------------------------------------------------
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
      audio.suspend();
    } else if (!running) {
      running = true;
      audio.resume();
      last = performance.now();
      requestAnimationFrame(frame);
    }
  });

  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    running = false;
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  });

  // iOS keeps audio suspended after a phone call or a tab switch.
  if (isIOS()) {
    window.addEventListener('pageshow', () => audio.resume());
  }
}

start();

interface TestSurface {
  director: Director;
  rig: CameraRig;
  quality: QualityManager;
  renderer: WebGLRenderer;
  audio: AudioEngine;
  stand: ControlStand;
  wagon: Wagon;
  mat: LandingMat;
  canvas: HTMLCanvasElement;
  step: (seconds: number) => void;
  timings: () => { worldMs: number; firstFrameMs: number };
}

/** Only installed with `?e2e=1`; never present in normal play. */
function installTestHooks(t: TestSurface): void {
  const api = {
    step: t.step,
    orientation: () => t.rig.orientation,
    shot: () => t.rig.currentShot,
    pullGate(amount = 1): void {
      t.director.setGatePull(amount);
      t.director.commitGate(amount);
    },
    place(id: string, zone: string): boolean {
      const prop = t.director.beginCarry(id as never);
      if (!prop) return false;
      t.director.endCarry(id as never, zone as never);
      return true;
    },
    reset(): void {
      t.director.setResetPull(1);
      t.director.commitReset(1);
    },
    tool(kind: string, arc: number, times = 1): void {
      for (let i = 0; i < times; i++) t.director.useTool(kind as never, arc, new Vector3());
    },
    moveMat(x: number, z: number): void {
      t.director.placeMat(x, z);
    },
    surface: () => t.director.surfaceTotals(),
    shots: () => t.rig.shotLog.slice(),
    camera(px: number, py: number, pz: number, lx: number, ly: number, lz: number): void {
      t.rig.frozen = true;
      t.rig.camera.position.set(px, py, pz);
      t.rig.camera.lookAt(lx, ly, lz);
      t.rig.camera.updateProjectionMatrix();
    },
    unfreeze(): void {
      t.rig.frozen = false;
    },
    /** CSS-pixel position of a touch target, so gestures can be driven for real. */
    screenOf(what: string): { x: number; y: number } | null {
      const p = new Vector3();
      if (what === 'gate') t.stand.gateKnobWorld(p);
      else if (what === 'reset') t.stand.resetKnobWorld(p);
      else if (what === 'mat') t.mat.worldPosition(p);
      else if (what.startsWith('object:')) t.wagon.slotWorld(what.slice(7) as never, p);
      else if (what.startsWith('tool:')) t.wagon.toolWorld(what.slice(5) as never, p);
      else if (what.startsWith('slide:')) slideSurface(Number(what.slice(6)), 0, 0.05, p);
      else return null;
      const v = p.project(t.rig.camera);
      const r = t.canvas.getBoundingClientRect();
      return { x: ((v.x + 1) / 2) * r.width, y: ((-v.y + 1) / 2) * r.height };
    },
    audioReady: () => t.audio.ready,
    timings: t.timings,
    state() {
      const d = t.director.debugState;
      const b = d.body;
      return {
        stage: d.stage,
        layer: d.layer,
        runState: d.runState,
        object: d.id,
        zone: d.zone,
        phase: b?.phase ?? null,
        onSlide: b?.onSlide ?? null,
        arc: b?.s ?? null,
        speed: b ? (b.onSlide ? b.v : Math.hypot(b.vx, b.vz)) : 0,
        x: b?.px ?? null,
        z: b?.pz ?? null,
        mu: b?.mu ?? 0,
        shot: t.rig.currentShot,
        orientation: t.rig.orientation,
        runs: t.director.telemetry.runs.length,
        calls: t.renderer.info.render.calls,
        triangles: t.renderer.info.render.triangles,
        textures: t.renderer.info.memory.textures,
        fps: t.quality.fps,
      };
    },
  };
  (window as unknown as { __lab: typeof api }).__lab = api;
}
