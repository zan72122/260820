import * as THREE from 'three';
import type { AudioEngine } from '../core/audio';
import type { Touch2D } from '../core/input';
import type { Viewport } from '../core/renderer';
import { clamp, lerp, smoothstep } from '../core/util';
import type { HintPath } from '../ui/hud';
import { WORK_HALF_LEN, WORK_THETA } from '../world/slide';
import type { StepId } from './defects';
import type { World } from './world';

export interface WorkPoint {
  /** Along the seam, -1..1. */
  s: number;
  /** Across the seam, -1..1. */
  t: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  along: THREE.Vector3;
}

export interface StepCtx {
  world: World;
  audio: AudioEngine;
  camera: THREE.PerspectiveCamera;
  viewport: Viewport;
  liftPx: number;
}

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const scratch = new THREE.Vector3();

/** Turns a screen touch into coordinates on the active joint's work window. */
export function project(ctx: StepCtx, t: Touch2D): WorkPoint | null {
  const collar = ctx.world.active;
  ndc.set(t.nx, t.ny);
  ray.setFromCamera(ndc, ctx.camera);
  const hits = ray.intersectObject(collar.proxy, false);
  if (!hits.length || !hits[0].uv) return null;
  const s = clamp(hits[0].uv.x * 2 - 1, -1, 1);
  const tt = clamp(hits[0].uv.y * 2 - 1, -1, 1);
  return workPoint(ctx, s, tt);
}

export function workPoint(ctx: StepCtx, s: number, t: number): WorkPoint {
  const slide = ctx.world.slide;
  const collar = ctx.world.active;
  const theta = s * WORK_THETA;
  const du = t * WORK_HALF_LEN;
  const u = collar.u + slide.metersToU(du);
  const point = slide.pointAt(u, theta, 0);
  const normal = slide.normalAt(u, theta);
  const a = slide.pointAt(u, theta + 0.02, 0);
  const b = slide.pointAt(u, theta - 0.02, 0);
  const along = a.sub(b).normalize();
  return { s, t, point, normal, along };
}

export function toScreen(ctx: StepCtx, p: THREE.Vector3): { x: number; y: number } {
  scratch.copy(p).project(ctx.camera);
  return {
    x: ((scratch.x + 1) / 2) * ctx.viewport.width,
    y: ((1 - scratch.y) / 2) * ctx.viewport.height,
  };
}

/** Base class for one treatment. Each is a single, forgiving gesture. */
export abstract class Step {
  abstract readonly id: StepId;
  progress = 0;
  done = false;
  protected active = false;
  protected last: WorkPoint | null = null;
  protected idle = 0;

  constructor(protected ctx: StepCtx) {}

  enter(): void {
    this.ctx.world.tools.show(this.id);
    this.ctx.world.tools.press = 0;
    this.progress = 0;
    this.done = false;
    this.idle = 0;
  }

  exit(): void {
    this.active = false;
    this.ctx.audio.silenceTools();
    this.ctx.world.tools.show(null);
    this.ctx.world.crawler.reachTo(null);
  }

  down(t: Touch2D): void {
    const w = project(this.ctx, t);
    if (!w) return;
    this.active = true;
    this.idle = 0;
    this.last = w;
    this.ctx.world.tools.press = 1;
    this.aim(w);
    this.onDown(w, t);
  }

  move(t: Touch2D): void {
    const w = project(this.ctx, t);
    if (!w) return;
    this.idle = 0;
    this.aim(w);
    if (this.active) this.onMove(w, t);
    this.last = w;
  }

  up(_t: Touch2D): void {
    this.active = false;
    this.ctx.world.tools.press = 0;
    this.ctx.audio.silenceTools();
    this.onUp();
  }

  /** Places the physical head so the fingertip never covers the contact point. */
  protected aim(w: WorkPoint): void {
    const tools = this.ctx.world.tools;
    scratch.copy(this.ctx.camera.position).sub(w.point);
    tools.place(w.point, w.normal, w.along, scratch, this.roll(w));
    this.ctx.world.crawler.reachTo(tools.group.position);
  }

  protected roll(_w: WorkPoint): number {
    return 0;
  }

  protected onDown(_w: WorkPoint, _t: Touch2D): void {}
  protected onMove(_w: WorkPoint, _t: Touch2D): void {}
  protected onUp(): void {}

  update(dt: number): void {
    if (!this.active) this.idle += dt;
  }

  /** Gesture demonstration, in screen pixels, once a player has stalled. */
  hint(): HintPath | null {
    const c = workPoint(this.ctx, 0, 0);
    const p = toScreen(this.ctx, c.point);
    return { kind: 'tap', from: { x: p.x, y: p.y + this.ctx.liftPx } };
  }

  protected shouldHint(): boolean {
    return this.idle > 4.5 && !this.done;
  }

  get hinting(): boolean {
    return this.shouldHint();
  }
}

/** Pull the lifted end and the whole strip comes away in one piece. */
export class PeelStep extends Step {
  readonly id = 'peel';
  private popped = false;
  private fade = 1;

  enter(): void {
    super.enter();
    const r = this.ctx.world.active.ribbon;
    r.peel = 0;
    r.lift = 1;
    r.setFade(1);
    r.rebuild();
    this.popped = false;
    this.fade = 1;
  }

  protected onMove(w: WorkPoint, t: Touch2D): void {
    if (this.done) return;
    const span = this.ctx.viewport.minEdge * 1.35;
    const gain = (Math.max(0, t.dy) * 1.0 + Math.abs(t.dx) * 0.4) / span;
    if (gain <= 0) return;
    this.progress = clamp(this.progress + gain, 0, 1);
    const r = this.ctx.world.active.ribbon;
    r.peel = this.progress;
    const slide = this.ctx.world.slide;
    const collar = this.ctx.world.active;
    const front = -WORK_THETA + 2 * WORK_THETA * this.progress;
    // Lifted clear of the wall and trailing back towards the operator, tracking
    // the finger across the joint but locked to the peel line along it.
    slide.pointAt(
      collar.u + slide.metersToU(clamp(w.t, -1, 0.4) * 0.16 - 0.07),
      front,
      0.1 + this.progress * 0.15,
      r.grab,
    );
    r.rebuild();
    const v = clamp(t.speed / 900, 0, 1);
    this.ctx.audio.loop('peel')?.set(0.05 + v * 0.16, 900 + v * 1600, 0.85 + v * 0.6);
    if (this.progress >= 1 && !this.popped) {
      this.popped = true;
      this.ctx.audio.peelPop();
      this.ctx.world.active.soilGroove();
    }
  }

  update(dt: number): void {
    super.update(dt);
    if (!this.popped) return;
    this.fade = Math.max(0, this.fade - dt * 2.4);
    this.ctx.world.active.ribbon.setFade(this.fade);
    if (this.fade <= 0 && !this.done) {
      this.done = true;
      this.ctx.audio.stepDone();
    }
  }

  hint(): HintPath {
    const a = workPoint(this.ctx, -0.55, 0.15);
    const p = toScreen(this.ctx, a.point);
    return {
      kind: 'swipe',
      from: { x: p.x, y: p.y + this.ctx.liftPx },
      to: { x: p.x + this.ctx.viewport.width * 0.1, y: p.y + this.ctx.liftPx + this.ctx.viewport.height * 0.22 },
      period: 2.1,
    };
  }
}

/** Scrub the channel until the old material is gone. */
export class BrushStep extends Step {
  readonly id = 'brush';
  private start = 1;

  enter(): void {
    super.enter();
    this.start = Math.max(0.05, this.ctx.world.active.meanDirt());
  }

  protected roll(): number {
    return 0;
  }

  protected onMove(w: WorkPoint, t: Touch2D): void {
    if (this.done) return;
    const collar = this.ctx.world.active;
    const amount = clamp(t.speed / 700, 0.1, 1) * 0.09;
    collar.scrub(w.s, w.t * 0.55, 0.4, amount);
    const now = collar.meanDirt();
    this.progress = clamp(1 - now / this.start, 0, 1);
    const v = clamp(t.speed / 800, 0, 1);
    this.ctx.audio.loop('brush')?.set(0.04 + v * 0.15, 700 + v * 900, 0.8 + v * 0.7);
    const puffs = this.ctx.world.dust;
    if (puffs && t.speed > 90) {
      scratch.copy(w.normal).multiplyScalar(0.25);
      puffs.emit(w.point, scratch, 0.14, 1, 0.5);
    }
    if (this.progress >= 0.9 && !this.done) {
      this.done = true;
      this.ctx.audio.stepDone();
    }
  }

  hint(): HintPath {
    const a = workPoint(this.ctx, -0.6, 0);
    const b = workPoint(this.ctx, 0.6, 0);
    const pa = toScreen(this.ctx, a.point);
    const pb = toScreen(this.ctx, b.point);
    return {
      kind: 'swipe',
      from: { x: pa.x, y: pa.y + this.ctx.liftPx },
      to: { x: pb.x, y: pb.y + this.ctx.liftPx },
      period: 1.5,
    };
  }
}

/** Lay a continuous ridge of fresh sealant along the joint. */
export class FillStep extends Step {
  readonly id = 'fill';

  protected onDown(w: WorkPoint): void {
    this.deposit(w, 0.4, 0);
  }

  protected onMove(w: WorkPoint, t: Touch2D): void {
    if (this.done) return;
    this.deposit(w, clamp(t.dt * 6.5, 0.05, 0.5), t.speed);
    const v = clamp(t.speed / 800, 0, 1);
    this.ctx.audio.loop('extrude')?.set(0.06 + (1 - v) * 0.1, 220 + v * 260, 0.7 + v * 0.5);
  }

  private deposit(w: WorkPoint, rate: number, speed: number): void {
    const bead = this.ctx.world.active.bead;
    const k = bead.indexForS(w.s);
    const width = lerp(0.036, 0.017, clamp(speed / 1100, 0, 1));
    const spread = 3;
    for (let i = -spread; i <= spread; i++) {
      const n = k + i;
      if (n < 0 || n >= bead.amount.length) continue;
      const f = 1 - smoothstep(Math.abs(i) / (spread + 1));
      bead.amount[n] = clamp(bead.amount[n] + rate * f * 1.5, 0, 1);
      bead.width[n] = lerp(bead.width[n], width, f * 0.5);
    }
    bead.rebuild();
    this.progress = bead.coverage();
    if (this.progress >= 0.85 && !this.done) {
      this.done = true;
      this.ctx.audio.stepDone();
    }
  }

  hint(): HintPath {
    const a = workPoint(this.ctx, -0.75, 0);
    const b = workPoint(this.ctx, 0.75, 0);
    const pa = toScreen(this.ctx, a.point);
    const pb = toScreen(this.ctx, b.point);
    return {
      kind: 'swipe',
      from: { x: pa.x, y: pa.y + this.ctx.liftPx },
      to: { x: pb.x, y: pb.y + this.ctx.liftPx },
      period: 2.2,
    };
  }
}

/** One long stroke; the ridge flattens and the surplus escapes at the end. */
export class SmoothStep extends Step {
  readonly id = 'smooth';
  private dir = 0;

  protected onMove(w: WorkPoint, t: Touch2D): void {
    if (this.done) return;
    const bead = this.ctx.world.active.bead;
    const k = bead.indexForS(w.s);
    const ds = this.last ? w.s - this.last.s : 0;
    if (Math.abs(ds) > 0.0005) this.dir = Math.sign(ds);
    const spread = 4;
    for (let i = -spread; i <= spread; i++) {
      const n = k + i;
      if (n < 0 || n >= bead.smoothed.length) continue;
      const f = 1 - smoothstep(Math.abs(i) / (spread + 1));
      bead.smoothed[n] = clamp(bead.smoothed[n] + f * 0.16, 0, 1);
    }
    // surplus pushed ahead of the blade
    const lead = clamp(k + this.dir * 5, 0, bead.excess.length - 1);
    bead.excess[lead] = clamp(bead.excess[lead] + 0.05, 0, 0.8);
    bead.rebuild();
    this.progress = bead.smoothness();
    const v = clamp(t.speed / 900, 0, 1);
    this.ctx.audio.loop('brush')?.set(0.03 + v * 0.1, 380 + v * 320, 0.6 + v * 0.4);
    if (this.progress >= 0.84 && !this.done) {
      this.done = true;
      this.ctx.audio.stepDone();
    }
  }

  hint(): HintPath {
    const a = workPoint(this.ctx, -0.8, 0.05);
    const b = workPoint(this.ctx, 0.8, 0.05);
    const pa = toScreen(this.ctx, a.point);
    const pb = toScreen(this.ctx, b.point);
    return {
      kind: 'swipe',
      from: { x: pa.x, y: pa.y + this.ctx.liftPx },
      to: { x: pb.x, y: pb.y + this.ctx.liftPx },
      period: 1.8,
    };
  }
}

/** Circles with the pad: haze first, then an even gloss. */
export class PolishStep extends Step {
  readonly id = 'polish';
  private spin = 0;

  protected roll(): number {
    return this.spin;
  }

  update(dt: number): void {
    super.update(dt);
    if (this.active) this.spin += dt * 9;
  }

  protected onMove(w: WorkPoint, t: Touch2D): void {
    if (this.done) return;
    const collar = this.ctx.world.active;
    const amount = clamp(t.speed / 650, 0.08, 1) * 0.1;
    collar.polish(w.s, w.t, 0.6, amount);
    this.progress = clamp(collar.meanGloss() / 0.72, 0, 1);
    const v = clamp(t.speed / 800, 0, 1);
    this.ctx.audio
      .loop('polish')
      ?.set(0.03 + v * 0.12, 1200 + this.progress * 2200, 0.8 + v * 0.6);
    const puffs = this.ctx.world.haze;
    if (puffs && t.speed > 80 && this.progress > 0.12 && this.progress < 0.82) {
      scratch.copy(w.normal).multiplyScalar(0.16);
      puffs.emit(w.point, scratch, 0.1, 1, 0.6);
    }
    if (this.progress >= 0.97 && !this.done) {
      this.done = true;
      this.ctx.audio.stepDone();
    }
  }

  hint(): HintPath {
    const c = workPoint(this.ctx, 0, 0);
    const p = toScreen(this.ctx, c.point);
    return {
      kind: 'circle',
      from: { x: p.x, y: p.y + this.ctx.liftPx },
      radius: this.ctx.viewport.minEdge * 0.13,
      period: 1.6,
    };
  }
}

export function makeStep(id: StepId, ctx: StepCtx): Step {
  switch (id) {
    case 'peel':
      return new PeelStep(ctx);
    case 'brush':
      return new BrushStep(ctx);
    case 'fill':
      return new FillStep(ctx);
    case 'smooth':
      return new SmoothStep(ctx);
    case 'polish':
      return new PolishStep(ctx);
  }
}
