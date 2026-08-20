import * as THREE from 'three';
import { clamp, clamp01 } from '../util/math';

/**
 * Touch handling.
 *
 * Every control is a thing in the world, not a button on a layer above it: you
 * pull the ring, you push the tray round, you carry a specimen from the rack to
 * the clamp. That is the only vocabulary a pre-reader has, and it means the
 * hand is always somewhere sensible — in particular, never on top of the place
 * the ball is about to land.
 */

export type PickKind = 'ring' | 'carriage' | 'ball' | 'tile' | 'brush' | 'tray';

export interface InteractionHost {
  /** Objects to raycast, rebuilt on each press so locked controls are inert. */
  pickTargets(): THREE.Object3D[];
  /** World position of the clamp, for the "did they drop it on the rig" test. */
  clampPosition(target: THREE.Vector3): THREE.Vector3;
  /** Height of the surface the brush is working on. */
  brushPlaneY(): number;
  /** Height of the ground the tiles are laid on. */
  tilePlaneY(): number;

  canPull(): boolean;
  canChangeFloor(): boolean;
  canChangeBall(): boolean;
  canChangeHeight(): boolean;
  canArrange(): boolean;

  onTouch(): void;
  onRingPull(t: number): void;
  onRingCommit(): void;
  onRingCancel(): void;
  onFloorStep(dir: number): void;
  onBallCarry(index: number, world: THREE.Vector3 | null): void;
  onBallDropped(index: number, accepted: boolean): void;
  onHeightPreview(index: number): void;
  onHeightCommit(index: number): void;
  onTileCarry(tileIndex: number, world: THREE.Vector3, slot: number): void;
  onTileDropped(tileIndex: number, slot: number): void;
  onBrushStroke(world: THREE.Vector3): void;
  onBrushEnd(): void;
  currentHeightIndex(): number;
}

interface DragState {
  kind: PickKind;
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: number;
  index: number;
  accumulated: number;
  startIndex: number;
  anchor: THREE.Vector3;
  committed: boolean;
}

/** Smaller number wins when several pick volumes overlap. */
const PICK_PRIORITY: Record<PickKind, number> = {
  ball: 0,
  tile: 0,
  brush: 1,
  carriage: 2,
  ring: 3,
  tray: 4,
};

const _plane = new THREE.Plane();
const _ray = new THREE.Vector2();
const _hit = new THREE.Vector3();
const _clamp = new THREE.Vector3();
const _screen = new THREE.Vector3();

export class Interaction {
  private el: HTMLElement;
  private camera: THREE.Camera;
  private host: InteractionHost;
  private raycaster = new THREE.Raycaster();
  private drag: DragState | null = null;
  private width = 1;
  private height = 1;

  constructor(el: HTMLElement, camera: THREE.Camera, host: InteractionHost) {
    this.el = el;
    this.camera = camera;
    this.host = host;
    el.addEventListener('pointerdown', this.onDown, { passive: false });
    el.addEventListener('pointermove', this.onMove, { passive: false });
    el.addEventListener('pointerup', this.onUp, { passive: false });
    el.addEventListener('pointercancel', this.onUp, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setViewport(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  get isDragging() {
    return this.drag !== null;
  }

  get dragKind() {
    return this.drag?.kind ?? null;
  }

  /** Pixels of drag that count as "one whole gesture" on this screen. */
  private get pullDistance() {
    return Math.max(78, this.height * 0.18);
  }

  private get stepDistance() {
    return Math.max(64, Math.min(this.width, this.height) * 0.16);
  }

  private setRay(x: number, y: number) {
    const rect = this.el.getBoundingClientRect();
    _ray.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(_ray, this.camera);
  }

  /** Intersect the current ray with a horizontal plane. */
  private toGround(y: number, out: THREE.Vector3) {
    _plane.set(new THREE.Vector3(0, 1, 0), -y);
    const hit = this.raycaster.ray.intersectPlane(_plane, out);
    return hit ?? out.copy(this.raycaster.ray.origin).addScaledVector(this.raycaster.ray.direction, 4);
  }

  /** Intersect the current ray with a screen-parallel plane through a point. */
  private toCameraPlane(anchor: THREE.Vector3, out: THREE.Vector3) {
    const n = new THREE.Vector3();
    this.camera.getWorldDirection(n);
    _plane.setFromNormalAndCoplanarPoint(n, anchor);
    const hit = this.raycaster.ray.intersectPlane(_plane, out);
    return hit ?? out.copy(anchor);
  }

  private onDown = (ev: PointerEvent) => {
    if (this.drag) return;
    ev.preventDefault();
    this.host.onTouch();
    this.setRay(ev.clientX, ev.clientY);

    const targets = this.host.pickTargets();
    const hits = this.raycaster.intersectObjects(targets, false);
    let kind: PickKind | null = null;
    let index = 0;
    let anchor = new THREE.Vector3();

    if (hits.length) {
      // Pick volumes are deliberately generous, so they overlap. When two of
      // them are under the same finger, the smaller, more specific control
      // wins: a specimen the child is reaching for should not be stolen by the
      // big forgiving ball around the release ring.
      let best: THREE.Object3D | null = null;
      let bestRank = Infinity;
      for (const hit of hits) {
        const pick = hit.object.userData.pick as PickKind | undefined;
        if (!pick) continue;
        const rank = PICK_PRIORITY[pick] ?? 9;
        if (rank < bestRank) {
          bestRank = rank;
          best = hit.object;
        }
      }
      if (best) {
        kind = best.userData.pick as PickKind;
        index = (best.userData.ballIndex ?? best.userData.floorIndex ?? 0) as number;
        best.getWorldPosition(anchor);
      }
    }

    // A press on empty space low in the frame is a tray swipe: a small child
    // aiming at a turntable will miss it more often than not.
    if (!kind && this.host.canChangeFloor()) {
      const rect = this.el.getBoundingClientRect();
      if ((ev.clientY - rect.top) / rect.height > 0.42) kind = 'tray';
    }
    if (!kind) return;

    if (kind === 'ring' && !this.host.canPull()) return;
    if (kind === 'tray' && !this.host.canChangeFloor()) return;
    if (kind === 'ball' && !this.host.canChangeBall()) return;
    if (kind === 'carriage' && !this.host.canChangeHeight()) return;
    if (kind === 'tile' && !this.host.canArrange()) return;

    this.drag = {
      kind,
      pointerId: ev.pointerId,
      startX: ev.clientX,
      startY: ev.clientY,
      lastX: ev.clientX,
      lastY: ev.clientY,
      moved: 0,
      index,
      accumulated: 0,
      startIndex: kind === 'carriage' ? this.host.currentHeightIndex() : 0,
      anchor,
      committed: false,
    };
    this.el.setPointerCapture?.(ev.pointerId);

    if (kind === 'ball') this.host.onBallCarry(index, null);
    if (kind === 'brush') {
      this.toGround(this.host.brushPlaneY(), _hit);
      this.host.onBrushStroke(_hit);
    }
  };

  private onMove = (ev: PointerEvent) => {
    const d = this.drag;
    if (!d || ev.pointerId !== d.pointerId) return;
    ev.preventDefault();
    const dx = ev.clientX - d.lastX;
    const dy = ev.clientY - d.lastY;
    d.moved += Math.hypot(dx, dy);
    d.lastX = ev.clientX;
    d.lastY = ev.clientY;
    this.setRay(ev.clientX, ev.clientY);

    switch (d.kind) {
      case 'ring': {
        if (d.committed) break;
        const pull = clamp01((ev.clientY - d.startY) / this.pullDistance);
        this.host.onRingPull(pull);
        if (pull >= 0.82) {
          d.committed = true;
          this.host.onRingCommit();
        }
        break;
      }
      case 'tray': {
        d.accumulated += dx;
        const step = this.stepDistance;
        while (Math.abs(d.accumulated) >= step) {
          const dir = d.accumulated > 0 ? -1 : 1;
          d.accumulated -= Math.sign(d.accumulated) * step;
          this.host.onFloorStep(dir);
        }
        break;
      }
      case 'ball': {
        this.toCameraPlane(d.anchor, _hit);
        this.host.onBallCarry(d.index, _hit);
        break;
      }
      case 'carriage': {
        // Dragging up raises the clamp; three broad zones, no scale.
        const zone = Math.max(52, this.height * 0.13);
        const shift = -(ev.clientY - d.startY) / zone;
        const idx = Math.round(clamp(d.startIndex + shift, 0, 2));
        this.host.onHeightPreview(idx);
        d.index = idx;
        break;
      }
      case 'tile': {
        this.toGround(this.host.tilePlaneY(), _hit);
        this.host.onTileCarry(d.index, _hit, -1);
        break;
      }
      case 'brush': {
        this.toGround(this.host.brushPlaneY(), _hit);
        this.host.onBrushStroke(_hit);
        break;
      }
    }
  };

  private onUp = (ev: PointerEvent) => {
    const d = this.drag;
    if (!d || ev.pointerId !== d.pointerId) return;
    ev.preventDefault();
    this.el.releasePointerCapture?.(ev.pointerId);
    this.drag = null;
    this.setRay(ev.clientX, ev.clientY);

    switch (d.kind) {
      case 'ring': {
        if (!d.committed) this.host.onRingCancel();
        break;
      }
      case 'ball': {
        // Accept either a deliberate carry onto the rig or a simple tap:
        // a four-year-old will often just poke the one they want.
        this.host.clampPosition(_clamp);
        _screen.copy(_clamp).project(this.camera);
        const rect = this.el.getBoundingClientRect();
        const sx = ((_screen.x + 1) / 2) * rect.width + rect.left;
        const sy = ((1 - _screen.y) / 2) * rect.height + rect.top;
        const near = Math.hypot(ev.clientX - sx, ev.clientY - sy) < Math.min(rect.width, rect.height) * 0.3;
        const tapped = d.moved < 14;
        this.host.onBallDropped(d.index, near || tapped);
        break;
      }
      case 'carriage': {
        this.host.onHeightCommit(d.index);
        break;
      }
      case 'tile': {
        this.toGround(this.host.tilePlaneY(), _hit);
        this.host.onTileDropped(d.index, -1);
        break;
      }
      case 'brush': {
        this.host.onBrushEnd();
        break;
      }
      case 'tray':
        break;
    }
  };

  dispose() {
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onUp);
  }
}
