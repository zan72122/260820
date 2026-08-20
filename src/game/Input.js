// Touch handling.
//
// The crank: the handle's circle is projected to screen as an ellipse, and the
// finger is solved back onto that ellipse exactly. So a finger sliding anywhere
// near the handle snaps onto real circular motion, at any camera angle, without
// the rotation speeding up and slowing down inside a turn the way a naive
// screen-space angle would.

import { Vector3, Vector2, Raycaster, Plane } from 'three';
import { M } from '../scene/Machine.js';

export class Input {
  constructor(dom, camera) {
    this.dom = dom;
    this.camera = camera;
    this.active = null;          // 'crank' | 'bottle' | null
    this.pointerId = null;
    this.screen = new Vector2();
    this.crankDelta = 0;
    this.lastAngle = 0;
    this.heldBottle = null;
    this.bottleTarget = new Vector3();
    this.raycaster = new Raycaster();
    this.enabledCrank = true;
    this.bottles = [];
    this.mode = 'crank';
    this.justPressed = false;
    this.releasedAt = -10;
    this._c = new Vector3(); this._a = new Vector3(); this._b = new Vector3();
    this._plane = new Plane();
    this._ndc = new Vector2();

    const opts = { passive: false };
    dom.addEventListener('pointerdown', (e) => this._down(e), opts);
    dom.addEventListener('pointermove', (e) => this._move(e), opts);
    dom.addEventListener('pointerup', (e) => this._up(e), opts);
    dom.addEventListener('pointercancel', (e) => this._up(e), opts);
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _pos(e) {
    const r = this.dom.getBoundingClientRect();
    this.screen.set(e.clientX - r.left, e.clientY - r.top);
    this._ndc.set(
      (this.screen.x / r.width) * 2 - 1,
      -(this.screen.y / r.height) * 2 + 1
    );
    this.rect = r;
  }

  /** Screen-space basis of the crank circle: centre, and the two projected axes. */
  _crankBasis() {
    const r = this.rect || this.dom.getBoundingClientRect();
    const cam = this.camera;
    const toScreen = (v, out) => {
      out.copy(v).project(cam);
      return new Vector2((out.x * 0.5 + 0.5) * r.width, (-out.y * 0.5 + 0.5) * r.height);
    };
    const C = new Vector3(M.crankAxis.x, M.crankAxis.y + 0.03, M.crankAxis.z);
    const A = new Vector3(C.x + M.crankR, C.y, C.z);
    const B = new Vector3(C.x, C.y, C.z + M.crankR);
    const sc = toScreen(C, this._c);
    const sa = toScreen(A, this._a);
    const sb = toScreen(B, this._b);
    return {
      c: sc,
      ax: new Vector2(sa.x - sc.x, sa.y - sc.y),
      az: new Vector2(sb.x - sc.x, sb.y - sc.y),
    };
  }

  /** Solve the finger position back to an angle on the crank circle. */
  _angleAt(px, py, basis) {
    const { c, ax, az } = basis;
    const ux = px - c.x, uy = py - c.y;
    const det = ax.x * az.y - ax.y * az.x;
    if (Math.abs(det) < 1e-4) return Math.atan2(uy, ux);
    // inverse of [ax az] applied to u gives (cos t, sin t) up to scale
    const cs = (az.y * ux - az.x * uy) / det;
    const sn = (-ax.y * ux + ax.x * uy) / det;
    return Math.atan2(sn, cs);
  }

  _crankHit(px, py, basis) {
    const { c, ax, az } = basis;
    const reach = Math.max(ax.length(), az.length());
    const d = Math.hypot(px - c.x, py - c.y);
    const r = this.rect || this.dom.getBoundingClientRect();
    // generous: anywhere in or a little beyond the handle's sweep counts
    const pad = Math.max(34, Math.min(r.width, r.height) * 0.10);
    return d < reach * 1.30 + pad;
  }

  _down(e) {
    if (this.pointerId !== null) return;
    e.preventDefault();
    this._pos(e);
    this.pointerId = e.pointerId;
    this.justPressed = true;

    if (this.mode === 'bottle') {
      const b = this._pickBottle();
      if (b) {
        this.active = 'bottle';
        this.heldBottle = b;
        this._updateBottleTarget();
        return;
      }
      this.active = null;
      return;
    }

    if (this.enabledCrank) {
      const basis = this._crankBasis();
      if (this._crankHit(this.screen.x, this.screen.y, basis)) {
        this.active = 'crank';
        this.lastAngle = this._angleAt(this.screen.x, this.screen.y, basis);
        return;
      }
    }
    this.active = null;
  }

  _move(e) {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this._pos(e);
    if (this.active === 'crank') {
      const basis = this._crankBasis();
      const a = this._angleAt(this.screen.x, this.screen.y, basis);
      let d = a - this.lastAngle;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.crankDelta += d;
      this.lastAngle = a;
    } else if (this.active === 'bottle') {
      this._updateBottleTarget();
    }
  }

  _up(e) {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.active = null;
    this.heldBottle = null;
    this.releasedAt = performance.now() / 1000;
  }

  _pickBottle() {
    this.raycaster.setFromCamera(this._ndc, this.camera);
    let best = null, bestD = Infinity;
    for (const b of this.bottles) {
      const hits = this.raycaster.intersectObject(b.group, true);
      if (hits.length && hits[0].distance < bestD) { bestD = hits[0].distance; best = b; }
    }
    if (best) return best;
    // forgiving fallback: nearest bottle within a fat screen radius
    const r = this.rect;
    const tol = Math.min(r.width, r.height) * 0.16;
    const p = new Vector3();
    for (const b of this.bottles) {
      p.copy(b.group.position); p.y += 0.06; p.project(this.camera);
      const sx = (p.x * 0.5 + 0.5) * r.width, sy = (-p.y * 0.5 + 0.5) * r.height;
      const d = Math.hypot(sx - this.screen.x, sy - this.screen.y);
      if (d < tol && d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  /**
   * The pour point is lifted above the finger on screen so the hand never covers
   * the place the syrup is landing.
   */
  _updateBottleTarget(planeY) {
    if (planeY === undefined) planeY = this.planeY || 0.14;
    this.planeY = planeY;
    const lifted = new Vector2(this._ndc.x, Math.min(0.96, this._ndc.y + 0.20));
    this.raycaster.setFromCamera(lifted, this.camera);
    this._plane.set(new Vector3(0, 1, 0), -planeY);
    const hit = this.raycaster.ray.intersectPlane(this._plane, this.bottleTarget);
    if (!hit) this.bottleTarget.set(0, planeY, 0.05);
  }

  consumeCrank() {
    const d = this.crankDelta;
    this.crankDelta = 0;
    return d;
  }
}
