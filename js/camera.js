/* Camera rig.  Every phase change is a move, never a cut, so the child can
   always see how one thing caused the next. */
import * as THREE from 'three';

const ease = {
  inOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  out: t => 1 - Math.pow(1 - t, 3),
  outSoft: t => 1 - Math.pow(1 - t, 2.2),
  linear: t => t,
};

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.pos = new THREE.Vector3(0, 1.6, 6);
    this.look = new THREE.Vector3(0, 0, 0);
    this.fromPos = this.pos.clone();
    this.fromLook = this.look.clone();
    this.toPos = this.pos.clone();
    this.toLook = this.look.clone();
    this.via = null;
    this.t = 1; this.dur = 1; this.easing = ease.inOut;
    this.queue = [];
    this.sway = 1;
    this.onArrive = null;
    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
    this.fovFrom = camera.fov; this.fovTo = camera.fov;
    this.shake = 0;
  }

  /** jump straight to a framing (used once, at boot) */
  snap(pos, look) {
    this.pos.copy(pos); this.look.copy(look);
    this.fromPos.copy(pos); this.toPos.copy(pos);
    this.fromLook.copy(look); this.toLook.copy(look);
    this.t = 1; this.queue.length = 0;
    this.apply();
  }

  /** move to a framing; extra waypoints can be queued after it */
  to(pos, look, dur = 1.6, { via = null, easing = 'inOut', fov = null, onArrive = null } = {}) {
    this.queue.length = 0;
    this._begin({ pos, look, dur, via, easing, fov, onArrive });
  }
  path(list) {
    const first = list[0];
    this.queue = list.slice(1);
    this._begin(first);
  }
  _begin(s) {
    this.fromPos.copy(this.pos);
    this.fromLook.copy(this.look);
    this.toPos.copy(s.pos);
    this.toLook.copy(s.look);
    this.via = s.via ? s.via.clone() : null;
    this.dur = Math.max(0.0001, s.dur ?? 1.4);
    this.easing = ease[s.easing || 'inOut'];
    this.t = 0;
    this.fovFrom = this.cam.fov;
    this.fovTo = s.fov ?? this.cam.fov;
    this.onArrive = s.onArrive || null;
  }

  get busy() { return this.t < 1 || this.queue.length > 0; }

  kick(amount = 0.4) { this.shake = Math.max(this.shake, amount); }

  update(dt, time) {
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / this.dur);
      const e = this.easing(this.t);
      if (this.via) {
        // quadratic bezier so the camera arcs instead of sliding on a rail
        const a = this._tmpA.copy(this.fromPos).lerp(this.via, e);
        const b = this._tmpB.copy(this.via).lerp(this.toPos, e);
        this.pos.copy(a).lerp(b, e);
      } else {
        this.pos.copy(this.fromPos).lerp(this.toPos, e);
      }
      this.look.copy(this.fromLook).lerp(this.toLook, e);
      this.cam.fov = THREE.MathUtils.lerp(this.fovFrom, this.fovTo, e);
      this.cam.updateProjectionMatrix();
      if (this.t >= 1) {
        const cb = this.onArrive; this.onArrive = null;
        if (this.queue.length) this._begin(this.queue.shift());
        if (cb) cb();
      }
    }

    // gentle handheld life
    const s = this.sway;
    const bx = Math.sin(time * 0.43) * 0.010 + Math.sin(time * 1.13) * 0.0035;
    const by = Math.cos(time * 0.37) * 0.008 + Math.sin(time * 0.91) * 0.003;
    const bz = Math.sin(time * 0.29) * 0.007;
    this.cam.position.set(this.pos.x + bx * s, this.pos.y + by * s, this.pos.z + bz * s);
    if (this.shake > 0.0005) {
      this.shake *= Math.max(0, 1 - dt * 4.5);
      this.cam.position.x += (Math.random() - 0.5) * this.shake * 0.05;
      this.cam.position.y += (Math.random() - 0.5) * this.shake * 0.05;
    }
    this.cam.lookAt(this.look.x + bx * 0.25 * s, this.look.y + by * 0.25 * s, this.look.z);
  }

  apply() {
    this.cam.position.copy(this.pos);
    this.cam.lookAt(this.look);
  }
}
