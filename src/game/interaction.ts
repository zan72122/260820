import { Object3D, Plane, Raycaster, Vector2, Vector3 } from 'three';
import { CameraRig } from './camera';
import { InputRouter, type PointerSample } from '../core/input';
import { ControlStand } from '../world/controlStand';
import { Wagon, type ToolId } from '../world/wagon';
import { LandingMat } from '../world/landingMat';
import { SlideRig } from '../world/slide';
import { Prop } from '../objects/prop';
import type { ObjectId } from '../objects/profiles';
import {
  SLIDE_LENGTH,
  nearestZone,
  slideNormal,
  slidePoint,
  type StartZoneId,
} from '../world/slideCurve';
import { clamp } from '../core/math';

export interface PlayHooks {
  zoneUnlocked(id: StartZoneId): boolean;
  /** Ask for a prop to carry in the hand; null refuses the pick-up. */
  beginCarry(id: ObjectId): Prop | null;
  endCarry(id: ObjectId, zone: StartZoneId | null): void;
  setGatePull(pull: number): void;
  commitGate(pull: number): void;
  setResetPull(pull: number): void;
  commitReset(pull: number): void;
  useTool(tool: ToolId, arc: number, point: Vector3): void;
  toolReleased(tool: ToolId, arc: number | null): void;
  matMoved(): void;
  /** Any deliberate touch, used to retire the attract-mode hints. */
  noteTouch(): void;
}

type DragKind = 'none' | 'gate' | 'reset' | 'object' | 'tool' | 'mat';

const _v = new Vector3();
const _v2 = new Vector3();

/** Nearest arc position on the bed to a world point. */
export function arcAtPoint(p: Vector3): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i <= 64; i++) {
    const s = (i / 64) * SLIDE_LENGTH;
    slidePoint(s, _v);
    const d = (_v.x - p.x) ** 2 + (_v.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  // One refinement pass for a smooth result while dragging.
  for (let i = -8; i <= 8; i++) {
    const s = clamp(best + (i / 8) * (SLIDE_LENGTH / 64), 0, SLIDE_LENGTH);
    slidePoint(s, _v);
    const d = (_v.x - p.x) ** 2 + (_v.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/**
 * Turns one finger into physical actions on physical things. There is no
 * menu, no slider and no text label anywhere in this file for a reason.
 */
export class Interaction {
  private ray = new Raycaster();
  private kind: DragKind = 'none';
  private carried: { id: ObjectId; prop: Prop; zone: StartZoneId | null } | null = null;
  private tool: { id: ToolId; home: Vector3; lastArc: number | null } | null = null;
  private leverStart = new Vector2();
  private leverAxis = new Vector2();
  private leverBase = 0;
  private groundPlane = new Plane(new Vector3(0, 1, 0), 0);
  private carryPlaneY = 0.62;
  private matGrabOffset = new Vector2();
  /** Highlighted band while an object is hovering over the bed. */
  hoverZone: StartZoneId | null = null;
  private canvasSize = new Vector2(1, 1);

  constructor(
    input: InputRouter,
    private hand: Object3D,
    private rig: CameraRig,
    private stand: ControlStand,
    private wagon: Wagon,
    private mat: LandingMat,
    private slide: SlideRig,
    private hooks: PlayHooks,
  ) {
    input.onPointer((phase, p) => {
      if (phase === 'down') this.onDown(p);
      else if (phase === 'move') this.onMove(p);
      else this.onUp(p, phase === 'cancel');
    });
  }

  setViewportSize(w: number, h: number): void {
    this.canvasSize.set(w, h);
  }

  private pickables(): Object3D[] {
    const list: Object3D[] = [this.stand.gateGrab];
    if (this.stand.resetGrab.visible) list.push(this.stand.resetGrab);
    for (const s of this.wagon.slots) if (s.available) list.push(s.grab);
    for (const t of this.wagon.tools) if (t.available) list.push(t.grab);
    if (this.mat.state.present && this.mat.mesh) list.push(this.mat.mesh);
    return list;
  }

  private onDown(p: PointerSample): void {
    this.ray.setFromCamera(p.ndc, this.rig.camera);
    const hits = this.ray.intersectObjects(this.pickables(), false);
    const hit = hits[0];
    if (!hit) return;
    this.hooks.noteTouch();
    const name = hit.object.name;

    if (name === 'grab:gate') {
      this.kind = 'gate';
      this.leverBase = 0;
      this.beginLeverDrag(p);
      return;
    }
    if (name === 'grab:reset') {
      this.kind = 'reset';
      this.leverBase = 0;
      this.beginLeverDrag(p, true);
      return;
    }
    if (name.startsWith('grab:object:')) {
      const id = name.slice('grab:object:'.length) as ObjectId;
      const prop = this.hooks.beginCarry(id);
      if (!prop) return;
      this.kind = 'object';
      this.carried = { id, prop, zone: null };
      this.moveCarried(p);
      return;
    }
    if (name.startsWith('grab:tool:')) {
      const id = name.slice('grab:tool:'.length) as ToolId;
      const t = this.wagon.tools.find((x) => x.id === id);
      if (!t) return;
      this.kind = 'tool';
      this.tool = { id, home: t.model.position.clone(), lastArc: null };
      // The tool leaves the shelf and follows the finger as a real object.
      this.hand.add(t.model);
      t.model.position.set(0, 0, 0);
      t.model.rotation.set(0, 0, 0);
      return;
    }
    if (this.mat.mesh && hit.object === this.mat.mesh) {
      this.kind = 'mat';
      const g = this.rayToGround(p);
      this.matGrabOffset.set(this.mat.state.x - g.x, this.mat.state.z - g.z);
      return;
    }
  }

  private beginLeverDrag(p: PointerSample, reset = false): void {
    const a = reset ? this.stand.resetKnobWorld(_v.clone()) : this.stand.gateKnobAt(0, _v.clone());
    const b = reset ? this.stand.resetKnobWorld(_v2.clone()).setY(a.y - 0.2) : this.stand.gateKnobAt(1, _v2.clone());
    const sa = this.project(a);
    const sb = this.project(b);
    this.leverStart.copy(p.screen);
    this.leverAxis.copy(sb).sub(sa);
    if (this.leverAxis.lengthSq() < 25) this.leverAxis.set(0, 90);
  }

  private project(world: Vector3): Vector2 {
    const v = world.clone().project(this.rig.camera);
    return new Vector2(
      ((v.x + 1) / 2) * this.canvasSize.x,
      ((-v.y + 1) / 2) * this.canvasSize.y,
    );
  }

  private rayToGround(p: PointerSample, y = 0): Vector3 {
    this.ray.setFromCamera(p.ndc, this.rig.camera);
    this.groundPlane.constant = -y;
    const out = new Vector3();
    if (!this.ray.ray.intersectPlane(this.groundPlane, out)) {
      out.copy(this.ray.ray.origin).addScaledVector(this.ray.ray.direction, 8);
    }
    return out;
  }

  private rayToBed(p: PointerSample): Vector3 | null {
    this.ray.setFromCamera(p.ndc, this.rig.camera);
    const hit = this.ray.intersectObject(this.slide.bed, false)[0];
    return hit ? hit.point.clone() : null;
  }

  private moveCarried(p: PointerSample): void {
    if (!this.carried) return;
    const bed = this.rayToBed(p);
    if (bed) {
      const arc = arcAtPoint(bed);
      const zone = nearestZone(arc);
      if (this.hooks.zoneUnlocked(zone.id)) {
        this.carried.zone = zone.id;
        this.hoverZone = zone.id;
        const r = this.carried.prop.profile.radius;
        this.carried.prop.placeStatic(
          this.slide.restPoint(zone.center - r - 0.006, 0, r + 0.03, new Vector3()),
        );
        return;
      }
    }
    this.carried.zone = null;
    this.hoverZone = null;
    const g = this.rayToGround(p, this.carryPlaneY);
    this.carried.prop.placeStatic(g);
  }

  private onMove(p: PointerSample): void {
    switch (this.kind) {
      case 'gate':
      case 'reset': {
        const d = new Vector2().copy(p.screen).sub(this.leverStart);
        const len = this.leverAxis.length();
        const t = clamp(this.leverBase + d.dot(this.leverAxis) / (len * len), 0, 1);
        if (this.kind === 'gate') this.hooks.setGatePull(t);
        else this.hooks.setResetPull(t);
        break;
      }
      case 'object':
        this.moveCarried(p);
        break;
      case 'tool': {
        if (!this.tool) break;
        const bed = this.rayToBed(p);
        if (bed) {
          const arc = arcAtPoint(bed);
          this.tool.lastArc = arc;
          this.hand.position.copy(bed).addScaledVector(slideNormal(arc, _v), 0.075);
          this.hooks.useTool(this.tool.id, arc, bed);
        } else {
          this.tool.lastArc = null;
          this.hand.position.copy(this.rayToGround(p, this.carryPlaneY));
        }
        break;
      }
      case 'mat': {
        const g = this.rayToGround(p);
        this.mat.moveTo(
          clamp(g.x + this.matGrabOffset.x, 4.1, 10.6),
          clamp(g.z + this.matGrabOffset.y, -2.4, 2.4),
        );
        this.hooks.matMoved();
        break;
      }
      default:
        break;
    }
  }

  private onUp(p: PointerSample, cancelled: boolean): void {
    switch (this.kind) {
      case 'gate': {
        const d = new Vector2().copy(p.screen).sub(this.leverStart);
        const len = this.leverAxis.length();
        const t = clamp(this.leverBase + d.dot(this.leverAxis) / (len * len), 0, 1);
        this.hooks.commitGate(cancelled ? 0 : t);
        break;
      }
      case 'reset': {
        const d = new Vector2().copy(p.screen).sub(this.leverStart);
        const len = this.leverAxis.length();
        const t = clamp(this.leverBase + d.dot(this.leverAxis) / (len * len), 0, 1);
        this.hooks.commitReset(cancelled ? 0 : t);
        break;
      }
      case 'object': {
        if (this.carried) this.hooks.endCarry(this.carried.id, cancelled ? null : this.carried.zone);
        this.carried = null;
        this.hoverZone = null;
        break;
      }
      case 'tool': {
        if (this.tool) {
          const t = this.wagon.tools.find((x) => x.id === this.tool!.id);
          if (t) {
            t.anchor.add(t.model);
            t.model.position.copy(this.tool.home);
            t.model.rotation.set(0, 0, 0);
          }
          this.hooks.toolReleased(this.tool.id, this.tool.lastArc);
        }
        this.tool = null;
        break;
      }
      default:
        break;
    }
    this.kind = 'none';
  }

  get dragging(): DragKind {
    return this.kind;
  }
}
