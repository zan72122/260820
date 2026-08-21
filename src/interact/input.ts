import * as THREE from 'three';

export type HotspotKind = 'wheel' | 'swipe' | 'press' | 'tap';

export interface Hotspot {
  id: string;
  kind: HotspotKind;
  /** live world position of the thing being touched */
  world: () => THREE.Vector3;
  /** screen-fixed alternative to `world`, in CSS pixels */
  screen?: (w: number, h: number) => { x: number; y: number; r: number };
  /** grab radius in world units; converted to pixels each frame */
  worldRadius: number;
  enabled: () => boolean;
  /** wheel: turns (signed). swipe: one stroke. press: 0..1 travel. tap: fired once */
  onWheel?: (turns: number) => void;
  onStroke?: () => void;
  onPress?: (travel: number) => void;
  onRelease?: () => void;
  onTap?: () => void;
}

export interface TouchState {
  activeId: string | null;
  hoverId: string | null;
  lastActivity: number;
}

const MIN_GRAB_PX = 54;

/**
 * Deliberately forgiving touch: nothing is raycast against triangles, everything
 * is a generous screen-space disc around the part that matters. A circle drawn
 * badly still turns the wheel; a finger that slides off the hub still counts.
 */
export class TouchRouter {
  readonly state: TouchState = { activeId: null, hoverId: null, lastActivity: 0 };
  private hotspots: Hotspot[] = [];
  private screen = new Map<string, { x: number; y: number; r: number }>();
  private pointerId: number | null = null;
  private origin = new THREE.Vector2();
  private last = new THREE.Vector2();
  private centre = new THREE.Vector2();
  private accumAngle = 0;
  private strokeAnchor = 0;
  private strokeDir = 0;
  private pressTravel = 0;
  private moved = 0;
  private downTime = 0;
  private now = 0;

  constructor(private readonly dom: HTMLElement, private readonly camera: THREE.PerspectiveCamera) {
    dom.addEventListener('pointerdown', this.onDown, { passive: false });
    dom.addEventListener('pointermove', this.onMove, { passive: false });
    dom.addEventListener('pointerup', this.onUp, { passive: false });
    dom.addEventListener('pointercancel', this.onUp, { passive: false });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  add(h: Hotspot) {
    this.hotspots.push(h);
  }

  clear() {
    this.hotspots.length = 0;
  }

  screenPos(id: string) {
    return this.screen.get(id);
  }

  /** Recompute the pixel discs. Called once per frame after the camera settles. */
  project(width: number, height: number, now: number) {
    this.now = now;
    const v = new THREE.Vector3();
    const e = new THREE.Vector3();
    for (const h of this.hotspots) {
      if (h.screen) {
        this.screen.set(h.id, h.screen(width, height));
        continue;
      }
      const w = h.world();
      v.copy(w).project(this.camera);
      const behind = v.z > 1;
      const x = (v.x * 0.5 + 0.5) * width;
      const y = (-v.y * 0.5 + 0.5) * height;
      // project a point offset perpendicular to the view to size the disc
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
      e.copy(w).addScaledVector(right, h.worldRadius).project(this.camera);
      const r = Math.abs((e.x * 0.5 + 0.5) * width - x);
      if (behind) this.screen.delete(h.id);
      else this.screen.set(h.id, { x, y, r: Math.max(MIN_GRAB_PX, r) });
    }
  }

  private pick(x: number, y: number): Hotspot | null {
    let best: Hotspot | null = null;
    let bestD = Infinity;
    for (const h of this.hotspots) {
      if (!h.enabled()) continue;
      const s = this.screen.get(h.id);
      if (!s) continue;
      const d = Math.hypot(x - s.x, y - s.y);
      if (d < s.r && d < bestD) {
        bestD = d;
        best = h;
      }
    }
    return best;
  }

  private find(id: string) {
    return this.hotspots.find((h) => h.id === id) ?? null;
  }

  private onDown = (ev: PointerEvent) => {
    ev.preventDefault();
    if (this.pointerId !== null) return;
    const h = this.pick(ev.clientX, ev.clientY);
    if (!h) return;
    this.pointerId = ev.pointerId;
    this.state.activeId = h.id;
    this.state.lastActivity = this.now;
    this.origin.set(ev.clientX, ev.clientY);
    this.last.copy(this.origin);
    this.moved = 0;
    this.downTime = this.now;
    this.accumAngle = 0;
    this.strokeAnchor = ev.clientY;
    this.strokeDir = 0;
    this.pressTravel = 0;
    const s = this.screen.get(h.id);
    if (s) this.centre.set(s.x, s.y);
    (this.dom as HTMLElement).setPointerCapture?.(ev.pointerId);
  };

  private onMove = (ev: PointerEvent) => {
    if (this.pointerId !== ev.pointerId || !this.state.activeId) return;
    ev.preventDefault();
    const h = this.find(this.state.activeId);
    if (!h) return;
    const x = ev.clientX;
    const y = ev.clientY;
    this.moved += Math.hypot(x - this.last.x, y - this.last.y);
    this.state.lastActivity = this.now;

    if (h.kind === 'wheel') {
      const s = this.screen.get(h.id);
      if (s) this.centre.set(s.x, s.y);
      const a0 = Math.atan2(this.last.y - this.centre.y, this.last.x - this.centre.x);
      const a1 = Math.atan2(y - this.centre.y, x - this.centre.x);
      const r0 = Math.hypot(this.last.x - this.centre.x, this.last.y - this.centre.y);
      const r1 = Math.hypot(x - this.centre.x, y - this.centre.y);
      let d = a1 - a0;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      // ignore jitter right on the hub where the angle is meaningless
      if (Math.min(r0, r1) > 16) {
        this.accumAngle += d;
        h.onWheel?.(-d / (Math.PI * 2));
      } else {
        // finger parked on the centre: read a plain drag as rotation instead
        const drag = (x - this.last.x + (y - this.last.y)) * 0.004;
        h.onWheel?.(drag);
      }
    } else if (h.kind === 'swipe') {
      const dy = y - this.strokeAnchor;
      if (this.strokeDir >= 0 && dy > 34) {
        h.onStroke?.();
        this.strokeAnchor = y;
        this.strokeDir = -1;
      } else if (this.strokeDir <= 0 && dy < -34) {
        this.strokeAnchor = y;
        this.strokeDir = 1;
      }
      h.onPress?.(THREE.MathUtils.clamp(Math.abs(dy) / 60, 0, 1));
    } else if (h.kind === 'press') {
      this.pressTravel = THREE.MathUtils.clamp((y - this.origin.y) / 70, 0, 1);
      h.onPress?.(this.pressTravel);
    }
    this.last.set(x, y);
  };

  private onUp = (ev: PointerEvent) => {
    if (this.pointerId !== ev.pointerId) return;
    this.pointerId = null;
    const id = this.state.activeId;
    this.state.activeId = null;
    this.state.lastActivity = this.now;
    if (!id) return;
    const h = this.find(id);
    if (!h) return;
    const quick = this.now - this.downTime < 0.45 && this.moved < 18;
    if (h.kind === 'tap' || (quick && h.kind !== 'swipe')) h.onTap?.();
    if (h.kind === 'press' && this.pressTravel > 0.45) h.onPress?.(1);
    h.onRelease?.();
  };

  get accumulatedTurn() {
    return this.accumAngle / (Math.PI * 2);
  }
}
