import * as THREE from 'three';
import { CameraRig, type Viewport } from './Framing';
import { EnvironmentRig } from '../world/Environment';
import { AssetLibrary } from '../world/Assets';
import {
  AdaptiveQuality, isSoftwareRenderer, pickTier, profileFor, resolvePixelRatio,
  type QualityProfile, type QualityTier,
} from './Quality';
import { GameState, loadSnapshot, saveSnapshot, STAGE_ORDER, type StageId } from './GameState';
import { HintDirector } from './HintDirector';
import { audio } from './Audio';
import { InputRouter, Picker, type Pointer } from './Input';
import type { GameContext, GameScene } from './SceneBase';
import { Overlay } from '../ui/Overlay';
import { OrchardScene } from '../scenes/OrchardScene';
import { PicklingScene } from '../scenes/PicklingScene';
import { DryingScene } from '../scenes/DryingScene';

export interface AppOptions {
  canvas: HTMLCanvasElement;
  uiHost: HTMLElement;
  /** ?fast=1 -- deterministic, cheap rendering for automated verification. */
  fast?: boolean;
  forcedQuality?: QualityTier | null;
  startStage?: StageId | null;
}

/** Test/automation surface. Never used by the game itself. */
export interface DebugApi {
  ready: boolean;
  stage(): StageId;
  phase(): string;
  step(): string | null;
  progress(): Record<string, number>;
  goToStage(stage: StageId): void;
  /** Runs the simulation forward without waiting in real time. */
  advanceTime(seconds: number): void;
  /** Scene-specific scripted actions, used by the screenshot audit. */
  act(name: string, amount?: number): void;
  /** Numeric read-out of the active scene's simulation, for assertions. */
  probe(): Record<string, number>;
  /**
   * Screen position of a named prop, in CSS pixels. Lets automated play drive
   * the game through real pointer events rather than through back doors.
   */
  hotspot(name: string): { x: number; y: number } | null;
  quality(): QualityTier;
  setQuality(tier: QualityTier): void;
  frames(): number;
  viewport(): Viewport;
}

const clampDt = (ms: number): number => Math.min(1 / 20, Math.max(1 / 240, ms / 1000));

export class App {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig: CameraRig;
  readonly state: GameState;
  readonly hints = new HintDirector();
  readonly picker = new Picker();
  private env!: EnvironmentRig;
  private assets!: AssetLibrary;
  private quality: QualityProfile;
  private tier: QualityTier;
  private adaptive: AdaptiveQuality;
  private input: InputRouter;
  private overlay: Overlay;
  private scenes = new Map<StageId, GameScene>();
  private active: GameScene | null = null;
  private canvas: HTMLCanvasElement;
  private viewport: Viewport = {
    width: 1, height: 1, safe: { top: 0, right: 0, bottom: 0, left: 0 },
  };
  private raf = 0;
  private lastTime = 0;
  private time = 0;
  private frameCount = 0;
  private running = false;
  private contextLost = false;
  private fast: boolean;
  private ctx: GameContext;
  private resizeObserver: ResizeObserver | null = null;
  private pendingStage: StageId | null = null;
  private stageFade = 1;
  private fadeMesh: THREE.Mesh;
  private fadeMat: THREE.MeshBasicMaterial;
  private fadeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private fadeScene = new THREE.Scene();

  constructor(opts: AppOptions) {
    this.canvas = opts.canvas;
    this.fast = opts.fast ?? false;

    const software = detectSoftware(opts.canvas);
    this.tier = pickTier({
      renderer: software.renderer,
      deviceMemoryGb: (navigator as { deviceMemory?: number }).deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency,
      devicePixelRatio: window.devicePixelRatio,
      maxViewport: Math.max(window.innerWidth, window.innerHeight),
      forced: opts.forcedQuality ?? null,
    });
    if (this.fast && !opts.forcedQuality) this.tier = 'balanced';
    this.quality = profileFor(this.tier);
    this.adaptive = new AdaptiveQuality({ software: software.isSoftware || this.fast });

    this.renderer = new THREE.WebGLRenderer({
      canvas: opts.canvas,
      antialias: this.quality.antialias && !this.fast,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      // Screenshot tooling needs the buffer to survive until it reads it.
      preserveDrawingBuffer: this.fast,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.94;
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x9fbcd8, 1);

    this.rig = new CameraRig({
      target: new THREE.Vector3(0, 0.4, 0),
      radius: 1.6,
      focalMm: 45,
      yaw: 0,
      pitch: 22,
    });

    this.state = new GameState(loadSnapshot());
    if (opts.startStage && STAGE_ORDER.includes(opts.startStage)) {
      this.state.stage = opts.startStage;
    }

    this.input = new InputRouter(opts.canvas);
    this.overlay = new Overlay(opts.uiHost, audio);
    this.overlay.refresh();

    // Full-screen fade quad, used only for the short bridge between locations.
    this.fadeMat = new THREE.MeshBasicMaterial({
      color: 0x0d1410, transparent: true, opacity: 0, depthTest: false, depthWrite: false,
      toneMapped: false,
    });
    this.fadeMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.fadeMat);
    this.fadeMesh.frustumCulled = false;
    this.fadeScene.add(this.fadeMesh);

    this.buildWorld();

    this.ctx = {
      renderer: this.renderer,
      scene: this.scene,
      rig: this.rig,
      env: this.env,
      assets: this.assets,
      quality: this.quality,
      state: this.state,
      hints: this.hints,
      audio,
      picker: this.picker,
      viewport: this.viewport,
      time: 0,
      advanceStage: () => this.requestStageAdvance(),
    };

    this.installListeners();
    this.measure();
    this.mountScene(this.state.stage, true);
    this.rig.snap(this.viewport);
  }

  private buildWorld(): void {
    this.assets = new AssetLibrary(this.quality);
    this.env = new EnvironmentRig({
      quality: this.quality,
      canopy: true,
      canopyHeight: 4.2,
      canopyRadius: 8.2,
    });
    this.scene.add(this.env.group);
    this.env.buildEnvironment(this.renderer, this.scene);
  }

  private installListeners(): void {
    this.input.setHandlers({
      onDown: (p) => this.onDown(p),
      onMove: (p) => this.active?.onPointerMove(p, this.ctx),
      onUp: (p) => this.active?.onPointerUp(p, this.ctx),
      onCancel: (p) => this.active?.onPointerCancel(p, this.ctx),
      onLongPress: (p) => this.active?.onLongPress(p, this.ctx),
      onAnyContact: () => this.hints.notifyInteraction(),
    });

    window.addEventListener('resize', this.onResize, { passive: true });
    window.addEventListener('orientationchange', this.onResize, { passive: true });
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => this.measure());
      this.resizeObserver.observe(document.documentElement);
    }
    document.addEventListener('visibilitychange', this.onVisibility);
    this.canvas.addEventListener('webglcontextlost', this.onContextLost as EventListener, false);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored as EventListener, false);
  }

  private onDown(p: Pointer): void {
    // iOS only lets audio start inside a gesture, so this is the moment.
    void audio.unlock().then(() => this.overlay.refresh());
    audio.setAmbience(this.active?.ambience ?? 0.5);
    this.active?.onPointerDown(p, this.ctx);
  }

  private onResize = (): void => {
    this.measure();
    // Reframing only: no scene state is touched, so rotating cannot rewind.
    this.rig.update(0.0001, this.viewport, false);
  };

  private onVisibility = (): void => {
    if (document.visibilityState === 'hidden') {
      audio.suspend();
      this.pause();
    } else {
      audio.resume();
      this.resume();
    }
  };

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
    cancelAnimationFrame(this.raf);
  };

  private onContextRestored = (): void => {
    this.contextLost = false;
    this.renderer.shadowMap.enabled = this.quality.shadows;
    // Render targets die with the context; the IBL has to be rebuilt.
    this.env.buildEnvironment(this.renderer, this.scene);
    this.active?.onQualityChange(this.ctx);
    this.measure();
    if (this.running) {
      this.lastTime = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  };

  private readSafeArea(): { top: number; right: number; bottom: number; left: number } {
    const cs = getComputedStyle(document.documentElement);
    const px = (v: string): number => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    };
    return {
      top: px(cs.getPropertyValue('--safe-t')),
      right: px(cs.getPropertyValue('--safe-r')),
      bottom: px(cs.getPropertyValue('--safe-b')),
      left: px(cs.getPropertyValue('--safe-l')),
    };
  }

  measure(): void {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.viewport.width = w;
    this.viewport.height = h;
    const safe = this.readSafeArea();
    this.viewport.safe.top = safe.top;
    this.viewport.safe.right = safe.right;
    this.viewport.safe.bottom = safe.bottom;
    this.viewport.safe.left = safe.left;

    const dprCap = this.fast ? 1 : resolvePixelRatio(window.devicePixelRatio || 1, this.quality);
    this.renderer.setPixelRatio(dprCap);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.input.measure();
  }

  private sceneFor(stage: StageId): GameScene {
    let s = this.scenes.get(stage);
    if (!s) {
      s = stage === 'orchard'
        ? new OrchardScene()
        : stage === 'pickling'
          ? new PicklingScene()
          : new DryingScene();
      s.build(this.ctx);
      this.scene.add(s.root);
      s.root.visible = false;
      this.scenes.set(stage, s);
    }
    return s;
  }

  private mountScene(stage: StageId, immediate: boolean): void {
    const next = this.sceneFor(stage);
    if (this.active === next) return;
    if (this.active) {
      this.active.exit(this.ctx);
      this.active.root.visible = false;
    }
    this.active = next;
    next.root.visible = true;
    next.enter(this.ctx);
    this.hints.focus(this.state.step, this.state.masteryOf(this.state.step ?? ''));
    audio.setAmbience(next.ambience);
    if (immediate) this.rig.snap(this.viewport);
  }

  private requestStageAdvance(): void {
    if (this.pendingStage) return;
    const from = this.state.stage;
    this.state.nextStage();
    this.pendingStage = this.state.stage;
    // Reset the destination stage so a repeat loop starts genuinely fresh.
    if (this.pendingStage === 'orchard' && from === 'drying') {
      for (const s of this.scenes.values()) s.exit(this.ctx);
      this.scenes.get('orchard')?.enter(this.ctx);
    }
    audio.play('chime', 0.8);
    saveSnapshot(this.state.snapshot());
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  pause(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  resume(): void {
    if (this.running || this.contextLost) return;
    this.start();
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    if (this.contextLost) return;
    const frameMs = now - this.lastTime;
    this.lastTime = now;
    this.step(clampDt(frameMs), frameMs);
  };

  /**
   * One simulation + render step. Exposed so tests can drive logical time
   * directly; `render` can be turned off so fast-forwarding does not pay for
   * a full frame on a software rasteriser.
   */
  step(dt: number, frameMs = dt * 1000, render = true): void {
    this.time += dt;
    this.ctx.time = this.time;
    this.frameCount++;

    this.input.update();

    // Stage bridge: a short dip to black, never a hard cut mid-causality.
    if (this.pendingStage) {
      this.stageFade = Math.min(1, this.stageFade + dt * 2.2);
      if (this.stageFade >= 1) {
        this.mountScene(this.pendingStage, true);
        this.pendingStage = null;
      }
    } else if (this.stageFade > 0) {
      this.stageFade = Math.max(0, this.stageFade - dt * 1.6);
    }
    this.fadeMat.opacity = this.stageFade * this.stageFade;

    const step = this.state.step;
    this.hints.focus(step, this.state.masteryOf(step ?? ''));
    this.hints.update(dt * 1000);

    this.active?.update(dt, this.ctx);
    this.env.animateCanopy(this.time);
    this.rig.update(dt, this.viewport);

    if (render) {
      this.renderer.render(this.scene, this.rig.camera);
      if (this.fadeMat.opacity > 0.001) {
        this.renderer.autoClear = false;
        this.renderer.render(this.fadeScene, this.fadeCam);
        this.renderer.autoClear = true;
      }
    }

    const next = this.adaptive.sample(frameMs, this.tier);
    if (next) this.setQuality(next);
  }

  setQuality(tier: QualityTier): void {
    if (tier === this.tier) return;
    this.tier = tier;
    this.quality = profileFor(tier);
    this.ctx.quality = this.quality;
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.renderer.shadowMap.needsUpdate = true;
    this.measure();
    for (const s of this.scenes.values()) s.onQualityChange(this.ctx);
  }

  get currentTier(): QualityTier {
    return this.tier;
  }

  get hintState(): ReturnType<HintDirector['update']> {
    return this.hints.update(0);
  }

  debugApi(): DebugApi {
    return {
      ready: true,
      stage: () => this.state.stage,
      phase: () => this.state.phase,
      step: () => this.state.step,
      progress: () => ({ ...this.state.progress[this.state.stage] }),
      goToStage: (stage) => {
        this.state.stage = stage;
        this.state.phase = this.state.step === null ? 'freeplay' : 'task';
        this.pendingStage = null;
        this.stageFade = 0;
        this.mountScene(stage, true);
      },
      advanceTime: (seconds) => {
        const dt = 1 / 60;
        const n = Math.max(1, Math.round(seconds / dt));
        // Simulate every step, but only draw the last few: the visible result
        // is identical and a software rasteriser finishes in seconds.
        for (let i = 0; i < n; i++) this.step(dt, dt * 1000, i >= n - 2);
      },
      act: (name, amount) => {
        const scene = this.active as unknown as {
          debugAct?: (n: string, a: number | undefined, ctx: GameContext) => void;
        };
        scene?.debugAct?.(name, amount, this.ctx);
      },
      hotspot: (name) => {
        const scene = this.active as unknown as {
          debugHotspots?: () => Record<string, THREE.Vector3>;
        };
        const spots = scene?.debugHotspots?.();
        const v = spots?.[name];
        if (!v) return null;
        const p = v.clone().project(this.rig.camera);
        return {
          x: ((p.x + 1) / 2) * this.viewport.width,
          y: ((1 - p.y) / 2) * this.viewport.height,
        };
      },
      probe: () => {
        const scene = this.active as unknown as { debugProbe?: () => Record<string, number> };
        return scene?.debugProbe?.() ?? {};
      },
      quality: () => this.tier,
      setQuality: (t) => this.setQuality(t),
      frames: () => this.frameCount,
      viewport: () => ({ ...this.viewport, safe: { ...this.viewport.safe } }),
    };
  }

  dispose(): void {
    this.pause();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost as EventListener);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored as EventListener);
    this.resizeObserver?.disconnect();
    this.input.dispose();
    this.overlay.dispose();
    for (const s of this.scenes.values()) s.dispose();
    this.scenes.clear();
    this.env.dispose();
    this.assets.dispose();
    this.fadeMesh.geometry.dispose();
    this.fadeMat.dispose();
    this.renderer.dispose();
  }
}

function detectSoftware(canvas: HTMLCanvasElement): { isSoftware: boolean; renderer?: string } {
  try {
    const gl =
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ??
      canvas.getContext('webgl');
    if (!gl) return { isSoftware: false };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext
      ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string)
      : (gl.getParameter(gl.RENDERER) as string);
    return { isSoftware: isSoftwareRenderer(name), renderer: name };
  } catch {
    return { isSoftware: false };
  }
}
