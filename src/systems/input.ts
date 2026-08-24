import * as THREE from 'three';
import { clamp, damp } from '../util/rng';

// One finger only. We never demand a perfect circle: direction and
// accumulated angular travel around a running centroid decide intent.
// The actual reaction point (horn tip) sits ABOVE the finger so the hand
// never hides what it causes.

const TRAIL_MS = 650;
const FINGER_OFFSET = 0.085; // fraction of viewport height

interface TrailPt {
  x: number;
  y: number;
  t: number;
}

export class PointerInput {
  down = false;
  tapped = false; // one-frame flag
  screen = new THREE.Vector2();
  waterPoint: THREE.Vector3 | null = null; // on the y≈0 plane, pond-clamped
  groundPoint: THREE.Vector3 | null = null; // unclamped, for stone aiming
  angSpeed = 0; // |rad/s| smoothed
  dirSign = 0; // +1 ccw(screen), -1 cw
  accumAngle = 0; // signed since touch
  radiusPx = 0;
  radiusWorld = 0;
  circling = false;
  lastInputTime = 0;

  private trail: TrailPt[] = [];
  private center = new THREE.Vector2();
  private haveCenter = false;
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.02);
  private downAt = 0;
  private downPos = new THREE.Vector2();
  private moved = 0;

  constructor(private el: HTMLElement, private camera: THREE.PerspectiveCamera) {
    el.addEventListener('pointerdown', this.onDown, { passive: false });
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp, { passive: false });
    window.addEventListener('pointercancel', this.onUp, { passive: false });
  }

  private onDown = (e: PointerEvent) => {
    if (this.down) return; // one finger only
    e.preventDefault();
    this.down = true;
    this.downAt = performance.now();
    this.downPos.set(e.clientX, e.clientY);
    this.moved = 0;
    this.trail.length = 0;
    this.accumAngle = 0;
    this.haveCenter = false;
    this.dirSign = 0;
    this.push(e.clientX, e.clientY);
    this.lastInputTime = performance.now() / 1000;
  };

  private onMove = (e: PointerEvent) => {
    if (!this.down) return;
    e.preventDefault();
    this.moved += Math.hypot(e.clientX - this.screen.x, e.clientY - this.screen.y);
    this.push(e.clientX, e.clientY);
    this.lastInputTime = performance.now() / 1000;
  };

  private onUp = () => {
    if (!this.down) return;
    if (performance.now() - this.downAt < 260 && this.moved < 14) this.tapped = true;
    this.down = false;
    this.circling = false;
    this.angSpeed = 0;
    this.waterPoint = null;
    this.groundPoint = null;
    this.trail.length = 0;
  };

  private push(x: number, y: number) {
    const now = performance.now();
    this.screen.set(x, y);
    const last = this.trail[this.trail.length - 1];
    this.trail.push({ x, y, t: now });
    while (this.trail.length && now - this.trail[0].t > TRAIL_MS) this.trail.shift();

    if (this.trail.length >= 3) {
      // running centroid
      let cx = 0;
      let cy = 0;
      for (const p of this.trail) {
        cx += p.x;
        cy += p.y;
      }
      cx /= this.trail.length;
      cy /= this.trail.length;
      if (!this.haveCenter) {
        this.center.set(cx, cy);
        this.haveCenter = true;
      } else {
        this.center.x += (cx - this.center.x) * 0.15;
        this.center.y += (cy - this.center.y) * 0.15;
      }
      if (last) {
        const a1 = Math.atan2(last.y - this.center.y, last.x - this.center.x);
        const a2 = Math.atan2(y - this.center.y, x - this.center.x);
        let d = a2 - a1;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const dt = Math.max(1, now - last.t) / 1000;
        const r = Math.hypot(x - this.center.x, y - this.center.y);
        if (r > 8) {
          this.accumAngle += d;
          const inst = Math.abs(d) / dt;
          this.angSpeed = damp(this.angSpeed, Math.min(inst, 20), 6, dt);
          if (Math.abs(d) > 0.002) this.dirSign = d > 0 ? 1 : -1;
        }
        this.radiusPx = damp(this.radiusPx, r, 5, dt);
      }
    }
  }

  // called every frame by the game
  update(dt: number) {
    if (!this.down) {
      this.angSpeed = damp(this.angSpeed, 0, 8, dt);
      this.circling = false;
      return;
    }
    this.circling = this.angSpeed > 0.8 && this.radiusPx > 9;

    // project: reaction point sits above the finger
    const h = this.el.clientHeight || window.innerHeight;
    const w = this.el.clientWidth || window.innerWidth;
    const sx = (this.screen.x / w) * 2 - 1;
    const sy = -((this.screen.y - h * FINGER_OFFSET) / h) * 2 + 1;
    this.ray.setFromCamera(new THREE.Vector2(sx, sy), this.camera);
    const hit = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(this.plane, hit)) {
      this.groundPoint = hit.clone();
      const r = Math.hypot(hit.x, hit.z);
      const maxR = 1.42;
      if (r > maxR) {
        hit.x *= maxR / r;
        hit.z *= maxR / r;
      }
      this.waterPoint = hit;
      // world-space circle radius (for attraction reach)
      const p0 = this.projectToWater(this.center.x, this.center.y);
      const p1 = this.projectToWater(this.center.x + this.radiusPx, this.center.y);
      if (p0 && p1) this.radiusWorld = clamp(p0.distanceTo(p1), 0, 1.2);
    } else {
      this.waterPoint = null;
      this.groundPoint = null;
    }
  }

  private projectToWater(x: number, y: number): THREE.Vector3 | null {
    const h = this.el.clientHeight || window.innerHeight;
    const w = this.el.clientWidth || window.innerWidth;
    const sx = (x / w) * 2 - 1;
    const sy = -((y - h * FINGER_OFFSET) / h) * 2 + 1;
    this.ray.setFromCamera(new THREE.Vector2(sx, sy), this.camera);
    const hit = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.plane, hit) ? hit : null;
  }

  consumeTap(): boolean {
    const t = this.tapped;
    this.tapped = false;
    return t;
  }
}
