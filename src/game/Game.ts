import {
  Intersection, Object3D, Plane, Raycaster, Vector2, Vector3,
} from 'three';
import type { App } from '../core/App';
import { CameraRig } from '../core/CameraRig';
import { Input } from '../core/Input';
import { Rand } from '../core/Rand';
import type { QualitySettings } from '../core/Quality';
import { GameAudio } from '../audio/Audio';
import { Hint } from '../ui/Hint';
import { Overlay, type ChoiceId } from '../ui/Overlay';
import { CHIP, DROPLET, MUDFLECK, POWDER, ParticleSystem } from '../gfx/Particles';
import { Geode } from '../world/Geode';
import { Workshop } from '../world/Workshop';
import { pickVariety } from '../world/varieties';
import { SHOTS } from './shots';
import { introStep } from './steps/intro';
import { washStep } from './steps/wash';
import { placeStep } from './steps/place';
import { crackStep } from './steps/crack';
import { openStep } from './steps/open';
import { dustStep } from './steps/dust';
import { holdStep } from './steps/hold';
import { displayStep } from './steps/display';
import type { GameCtx, Session, Step, StepName } from './types';

const STEPS: Record<StepName, Step> = {
  intro: introStep,
  wash: washStep,
  place: placeStep,
  crack: crackStep,
  open: openStep,
  dust: dustStep,
  hold: holdStep,
  display: displayStep,
};

const GROUND = new Plane(new Vector3(0, 1, 0), 0);
const _ndc = new Vector2();
const _v = new Vector3();

export interface GameOptions {
  seed?: number;
  fast?: boolean;
}

/**
 * Owns the world and runs one verb at a time. Each step is handed the same
 * context and is free to reach into the stone directly — there is only ever
 * one stone and one finger, so an elaborate entity system would be ceremony.
 */
export class Game {
  readonly ctx: GameCtx;

  private app: App;
  private raycaster = new Raycaster();
  private step: Step;
  private queued: StepName | null = null;
  private uTime = { value: 0 };
  private rand: Rand;
  private baseSeed: number;
  private width = 1;
  private height = 1;
  private started = false;
  private fast: boolean;

  constructor(app: App, ui: HTMLElement, canvas: HTMLCanvasElement, opts: GameOptions = {}) {
    this.app = app;
    this.fast = opts.fast ?? false;
    this.baseSeed = opts.seed ?? (Math.floor(Math.random() * 0xffffffff) >>> 0);
    this.rand = new Rand(this.baseSeed);

    const quality = app.quality;
    const audio = new GameAudio();
    const input = new Input(canvas);
    const hint = new Hint(ui);
    const overlay = new Overlay(ui, (id) => this.onChoice(id));

    const workshop = new Workshop({
      quality, envMap: app.envMap, uTime: this.uTime, seed: this.baseSeed,
    });
    workshop.addTo(app.scene);

    const geode = this.buildGeode(this.baseSeed, quality);
    app.scene.add(geode.root);

    const uDpr = { value: app.pixelRatio };
    const pm = quality.particleMul;
    const droplets = new ParticleSystem(DROPLET, Math.round(220 * pm), uDpr);
    const mudflecks = new ParticleSystem(MUDFLECK, Math.round(160 * pm), uDpr);
    const powder = new ParticleSystem(POWDER, Math.round(200 * pm), uDpr);
    const chips = new ParticleSystem(CHIP, Math.round(120 * pm), uDpr);
    app.scene.add(droplets.points, mudflecks.points, powder.points, chips.points);

    const rig = new CameraRig(app.camera, SHOTS.intro);

    const session: Session = {
      seed: this.baseSeed, washQuality: 0, dustQuality: 0, presses: 0, recorded: false,
    };

    this.ctx = {
      scene: app.scene,
      camera: app.camera,
      rig, input, audio, hint, overlay, workshop, geode, quality, session,
      droplets, mudflecks, powder, chips,
      stepTime: 0,
      time: 0,
      timeScale: 1,
      go: (s) => { this.queued = s; },
      pick: (objects) => this.pick(objects),
      pickAll: (objects) => this.pickAll(objects),
      pickPlane: (y, out) => this.pickPlane(y, out),
      toScreen: (world) => this.toScreen(world),
      viewport: { w: 1, h: 1 },
      grabbedStone: () => this.grabbedStone(),
      shellMeshes: () => this.ctx.geode.shellMeshes,
      flash: (a) => this.app.flash(a),
    };

    this.step = STEPS.intro;

    // Audio has to be created inside a real gesture on iOS.
    const unlock = () => { audio.unlock(); audio.setAmbience(0.5); };
    canvas.addEventListener('pointerdown', unlock, { once: true });
    canvas.addEventListener('touchstart', unlock, { once: true });
  }

  private buildGeode(seed: number, quality: QualitySettings): Geode {
    const rand = new Rand(seed ^ 0x5bf0);
    return new Geode({
      seed,
      variety: pickVariety(rand),
      quality,
      envMap: this.app.envMap,
      dpr: this.app.pixelRatio,
      uTime: this.uTime,
    });
  }

  begin(): void {
    if (this.started) return;
    this.started = true;
    this.ctx.geode.resetSurface(1);
    this.step.enter(this.ctx);
  }

  // ------------------------------------------------------------------ frame

  onResize(w: number, h: number, aspect: number): void {
    this.width = w;
    this.height = h;
    this.ctx.viewport.w = w;
    this.ctx.viewport.h = h;
    this.ctx.rig.setAspect(aspect);
    this.ctx.input.measure();
  }

  onQualityChange(q: QualitySettings): void {
    // Only the cheap knobs are re-applied live; rebuilding the stone mid-wash
    // would throw away the player's work.
    (this.ctx as { quality: QualitySettings }).quality = q;
    this.ctx.workshop.keyLight.castShadow = q.shadows;
  }

  frame(dtReal: number): void {
    const ctx = this.ctx;
    const dt = dtReal * ctx.timeScale;

    ctx.input.update(dtReal);
    ctx.time += dt;
    ctx.stepTime += dt;
    this.uTime.value = ctx.time;

    if (!ctx.overlay.galleryOpen) {
      this.step.update(ctx, dt);
    }

    if (this.queued) {
      const next = this.queued;
      this.queued = null;
      this.step.exit?.(ctx);
      this.step = STEPS[next];
      ctx.stepTime = 0;
      this.step.enter(ctx);
    }

    ctx.geode.update(dt, ctx.camera);
    ctx.workshop.update(dt);
    ctx.droplets.update(dt);
    ctx.mudflecks.update(dt);
    ctx.powder.update(dt);
    ctx.chips.update(dt);
    ctx.hint.update(dtReal);
    ctx.rig.update(dt);
  }

  // -------------------------------------------------------------- utilities

  private pick(objects: Object3D[]): Intersection | null {
    const hits = this.pickAll(objects);
    return hits.length > 0 ? hits[0] : null;
  }

  private pickAll(objects: Object3D[]): Intersection[] {
    const f = this.ctx.input.frame;
    _ndc.set(f.x, f.y);
    this.raycaster.setFromCamera(_ndc, this.ctx.camera);
    return this.raycaster.intersectObjects(objects, false);
  }

  private pickPlane(y: number, out: Vector3): Vector3 | null {
    const f = this.ctx.input.frame;
    _ndc.set(f.x, f.y);
    this.raycaster.setFromCamera(_ndc, this.ctx.camera);
    GROUND.constant = -y;
    return this.raycaster.ray.intersectPlane(GROUND, out);
  }

  /**
   * Generous grab test. A raycast alone punishes a child for missing a lumpy
   * silhouette by ten pixels, which reads to them as "the game is broken".
   */
  private grabbedStone(): boolean {
    if (this.pick(this.ctx.geode.shellMeshes)) return true;
    const s = this.toScreen(this.ctx.geode.root.position);
    const f = this.ctx.input.frame;
    const margin = Math.min(this.width, this.height) * 0.24;
    return Math.hypot(f.px - s.x, f.py - s.y) < margin;
  }

  private toScreen(world: Vector3): { x: number; y: number } {
    _v.copy(world).project(this.ctx.camera);
    return {
      x: (_v.x * 0.5 + 0.5) * this.width,
      y: (-_v.y * 0.5 + 0.5) * this.height,
    };
  }

  // ---------------------------------------------------------------- choices

  private onChoice(id: ChoiceId): void {
    this.ctx.audio.unlock();
    this.ctx.audio.ui();
    if (id === 'gallery') {
      this.ctx.overlay.openGallery();
      return;
    }
    this.ctx.overlay.hideChoices();
    if (id === 'again') this.restart(this.ctx.session.seed);
    else this.restart(this.rand.int(1, 0x7ffffffe));
  }

  /** Start a run. Same seed reopens the same stone; a new seed grows a new one. */
  restart(seed: number): void {
    const ctx = this.ctx;
    const sameStone = seed === ctx.session.seed;

    ctx.droplets.clear();
    ctx.mudflecks.clear();
    ctx.powder.clear();
    ctx.chips.clear();

    if (!sameStone) {
      ctx.geode.dispose();
      const g = this.buildGeode(seed, ctx.quality);
      (ctx as { geode: Geode }).geode = g;
      this.app.scene.add(g.root);
    }
    ctx.geode.resetSurface(1);

    ctx.session.seed = seed;
    ctx.session.washQuality = 0;
    ctx.session.dustQuality = 0;
    ctx.session.presses = 0;
    ctx.session.recorded = false;

    ctx.workshop.spot.intensity = 0;
    ctx.workshop.mood = 1;
    ctx.workshop.caustics.uIntensity.value = 0;

    this.step.exit?.(ctx);
    this.step = STEPS.intro;
    ctx.stepTime = 0;
    ctx.timeScale = 1;
    this.step.enter(ctx);
  }

  get stepName(): StepName { return this.step.name; }
  get fastMode(): boolean { return this.fast; }

  dispose(): void {
    this.ctx.input.dispose();
    this.ctx.hint.dispose();
    this.ctx.overlay.dispose();
    this.ctx.geode.dispose();
    this.ctx.workshop.dispose();
    this.ctx.droplets.dispose();
    this.ctx.mudflecks.dispose();
    this.ctx.powder.dispose();
    this.ctx.chips.dispose();
    this.ctx.audio.dispose();
  }
}
