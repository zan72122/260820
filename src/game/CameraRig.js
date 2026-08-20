// Scripted framings. Each beat declares what has to be *inside* the frame rather
// than a camera position, so portrait and landscape both stay honest without two
// sets of hand-placed cameras.

import { Vector3, MathUtils } from 'three';

const F = (target, dir, fitW, fitH, fov) => ({
  target: new Vector3(...target),
  dir: new Vector3(...dir).normalize(),
  fitW, fitH, fov,
});

export const SHOTS = {
  // whole machine: handle, ice, blade and bowl all readable in one image
  intro: F([-0.020, 0.238, 0.030], [0.40, 0.275, 0.875], 0.50, 0.60, 36),
  // the handle stays at the edge; ice, blade and the landing spot come closer
  // the grip must stay reachable: if the handle leaves the frame the player
  // cannot keep turning, however nicely the bowl is composed
  firstShave: F([0.026, 0.246, 0.044], [0.335, 0.170, 0.927], 0.38, 0.50, 38),
  // drop the eye line so the bowl's rim and the layers in it read clearly
  growing: F([0.014, 0.230, 0.054], [0.285, 0.120, 0.951], 0.40, 0.52, 39),
  // in on the bowl, but the spout and the place the syrup lands stay together
  syrup: F([-0.044, 0.118, 0.078], [0.215, 0.345, 0.914], 0.54, 0.44, 38),
  // step back and let it sit in the summer light
  finish: F([-0.026, 0.118, 0.062], [0.275, 0.295, 0.915], 0.52, 0.46, 36),
};

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.shot = SHOTS.intro;
    this.pos = new Vector3();
    this.look = new Vector3();
    this.velPos = new Vector3();
    this.velLook = new Vector3();
    this.fov = this.shot.fov;
    this.aspect = 1;
    this.t = 0;
    this.snapNext = true;
    this._p = new Vector3();
    this._l = new Vector3();
    this.blend = null;
  }

  setShot(shot, snap = false) {
    this.shot = shot;
    this.blend = null;
    if (snap) this.snapNext = true;
  }

  /** Blends between two shots, e.g. as the pile grows. */
  setBlend(a, b, t) { this.blend = { a, b, t: MathUtils.clamp(t, 0, 1) }; }

  _resolve(shot, outPos, outLook) {
    const fovRad = MathUtils.degToRad(shot.fov);
    const dV = shot.fitH / (2 * Math.tan(fovRad / 2));
    const dH = shot.fitW / (2 * Math.tan(fovRad / 2) * Math.max(this.aspect, 0.0001));
    const d = Math.max(dV, dH);
    outLook.copy(shot.target);
    outPos.copy(shot.target).addScaledVector(shot.dir, d);
    return shot.fov;
  }

  update(dt, aspect) {
    this.aspect = aspect;
    this.t += dt;

    let fov;
    if (this.blend) {
      const pa = this._p, la = this._l;
      const fa = this._resolve(this.blend.a, pa, la);
      const pb = new Vector3(), lb = new Vector3();
      const fb = this._resolve(this.blend.b, pb, lb);
      const t = this.blend.t;
      pa.lerp(pb, t); la.lerp(lb, t);
      fov = fa + (fb - fa) * t;
      this._tp = pa; this._tl = la;
    } else {
      fov = this._resolve(this.shot, this._p, this._l);
      this._tp = this._p; this._tl = this._l;
    }

    if (this.snapNext) {
      this.pos.copy(this._tp); this.look.copy(this._tl);
      this.velPos.set(0, 0, 0); this.velLook.set(0, 0, 0);
      this.fov = fov;
      this.snapNext = false;
    } else {
      springTo(this.pos, this.velPos, this._tp, 1.55, dt);
      springTo(this.look, this.velLook, this._tl, 1.35, dt);
      this.fov += (fov - this.fov) * Math.min(1, dt * 2.6);
    }

    // the smallest amount of handheld life, so the frame is never dead
    const bx = Math.sin(this.t * 0.37) * 0.0028 + Math.sin(this.t * 0.91) * 0.0011;
    const by = Math.cos(this.t * 0.29) * 0.0024 + Math.sin(this.t * 1.13) * 0.0008;

    const c = this.camera;
    c.position.set(this.pos.x + bx, this.pos.y + by, this.pos.z);
    c.lookAt(this.look);
    if (Math.abs(c.fov - this.fov) > 1e-3 || c.aspect !== aspect) {
      c.fov = this.fov; c.aspect = aspect; c.updateProjectionMatrix();
    }
  }

  nudge(amount) {
    this.velPos.z += amount;
    this.velPos.y += amount * 0.4;
  }
}

// critically damped follow — no overshoot, no rubber banding
function springTo(cur, vel, goal, smoothTime, dt) {
  const omega = 2 / Math.max(smoothTime, 1e-4);
  const x = omega * Math.min(dt, 0.05);
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const dx = cur.x - goal.x, dy = cur.y - goal.y, dz = cur.z - goal.z;
  const tx = (vel.x + omega * dx) * Math.min(dt, 0.05);
  const ty = (vel.y + omega * dy) * Math.min(dt, 0.05);
  const tz = (vel.z + omega * dz) * Math.min(dt, 0.05);
  vel.x = (vel.x - omega * tx) * exp;
  vel.y = (vel.y - omega * ty) * exp;
  vel.z = (vel.z - omega * tz) * exp;
  cur.x = goal.x + (dx + tx) * exp;
  cur.y = goal.y + (dy + ty) * exp;
  cur.z = goal.z + (dz + tz) * exp;
}
