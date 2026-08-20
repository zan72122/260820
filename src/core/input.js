import * as THREE from 'three';

// One finger. That is the whole control scheme.
//
// Two decisions matter here. First, the mapping is *relative* to where the
// finger landed, so a child can put their thumb anywhere -- beside the sparkler,
// below it, off to one side -- and never cover the thing they are watching.
// Second, holding still is not a precision task: the response is a soft spring
// with a generous dead zone, so a four-year-old's natural tremor moves the hand
// a little (which is visible in the sparks, and is the point) without ever
// counting as "shaking".

const MAX_X = 0.030;
const MAX_Y = 0.024;
const MAX_Z = 0.010;

export class Input {
  constructor(element) {
    this.el = element;
    this.active = false;
    this.pointerId = null;

    this.origin = new THREE.Vector2();
    this.pos = new THREE.Vector2();
    this.raw = new THREE.Vector2();
    this.vel = new THREE.Vector2();

    this.offset = new THREE.Vector3();      // where the hand is asked to be
    this.smoothOffset = new THREE.Vector3(); // where it actually is
    this.offsetVel = new THREE.Vector3();
    this.handVelocity = new THREE.Vector3();

    this.shake = 0;        // 0..1, smoothed agitation
    this.steadiness = 1;   // 1 - shake, with a long memory
    this.holdTime = 0;
    this.releaseTime = 999;
    this.everTouched = false;
    this.totalHold = 0;
    this.motionEnergy = 0; // cumulative gentle movement, used for "personality"

    this._scale = 1;
    this._lastMoveTime = 0;
    this._prevSmooth = new THREE.Vector3();
    this._bound = [];
    this._attach();
  }

  _attach() {
    const opts = { passive: false };
    const down = (e) => this._down(e);
    const move = (e) => this._move(e);
    const up = (e) => this._up(e);
    this.el.addEventListener('pointerdown', down, opts);
    this.el.addEventListener('pointermove', move, opts);
    globalThis.addEventListener('pointerup', up, opts);
    globalThis.addEventListener('pointercancel', up, opts);
    this._bound = [
      [this.el, 'pointerdown', down],
      [this.el, 'pointermove', move],
      [globalThis, 'pointerup', up],
      [globalThis, 'pointercancel', up],
    ];
  }

  dispose() {
    for (const [t, n, f] of this._bound) t.removeEventListener(n, f);
  }

  setViewport(w, h) {
    this._scale = 1 / Math.max(1, Math.min(w, h) * 0.5);
    this._w = w;
    this._h = h;
  }

  _norm(e, out) {
    const rect = this.el.getBoundingClientRect();
    out.set((e.clientX - rect.left - rect.width / 2) * this._scale, (e.clientY - rect.top - rect.height / 2) * this._scale);
    return out;
  }

  _down(e) {
    if (this.active) return;
    e.preventDefault();
    this.active = true;
    this.pointerId = e.pointerId;
    this._norm(e, this.raw);
    this.origin.copy(this.raw);
    this.pos.copy(this.raw);
    this.holdTime = 0;
    this.releaseTime = 0;
    this.everTouched = true;
    this.onFirstTouch?.();
    this.el.setPointerCapture?.(e.pointerId);
  }

  _move(e) {
    if (!this.active || e.pointerId !== this.pointerId) return;
    e.preventDefault();
    // Coalesced events give the true path of the finger between frames, which
    // is what keeps the response from feeling one frame late.
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events) this._norm(ev, this.raw);
    this.pos.copy(this.raw);
  }

  _up(e) {
    if (!this.active || (this.pointerId !== null && e.pointerId !== this.pointerId)) return;
    this.active = false;
    this.pointerId = null;
    this.releaseTime = 0;
  }

  update(dt) {
    const prev = this._prevSmooth.copy(this.smoothOffset);

    if (this.active) {
      this.holdTime += dt;
      this.totalHold += dt;
      // Slow recentring so a long hold never parks the hand at the edge.
      const pull = 1 - Math.exp(-dt * 0.22);
      this.origin.lerp(this.pos, pull);

      const dx = THREE.MathUtils.clamp((this.pos.x - this.origin.x) * 1.15, -1, 1);
      const dy = THREE.MathUtils.clamp((this.pos.y - this.origin.y) * 1.15, -1, 1);
      this.offset.set(dx * MAX_X, -dy * MAX_Y, -Math.abs(dy) * MAX_Z * 0.4);
    } else {
      this.releaseTime += dt;
      this.holdTime = 0;
      // Let go and the hand settles back, slowly. It does not snap.
      this.offset.multiplyScalar(Math.exp(-dt * 0.9));
    }

    // Critically damped spring: immediate but never twitchy.
    const omega = this.active ? 19.0 : 6.5;
    const k = omega * omega;
    const c = 2 * omega;
    for (const axis of ['x', 'y', 'z']) {
      const a = (this.offset[axis] - this.smoothOffset[axis]) * k - this.offsetVel[axis] * c;
      this.offsetVel[axis] += a * dt;
      this.smoothOffset[axis] += this.offsetVel[axis] * dt;
    }

    if (dt > 1e-5) {
      this.handVelocity.copy(this.smoothOffset).sub(prev).divideScalar(dt);
    }

    // Agitation. The dead zone is wide on purpose: normal small wobble reads as
    // zero shake, and only genuine waving registers.
    const speed = this.handVelocity.length();
    const raw = THREE.MathUtils.clamp((speed - 0.055) / 0.30, 0, 1);
    const rise = 1 - Math.exp(-dt * 3.2);
    const fall = 1 - Math.exp(-dt * 0.65);
    this.shake += (raw - this.shake) * (raw > this.shake ? rise : fall);
    this.steadiness += ((1 - this.shake) - this.steadiness) * (1 - Math.exp(-dt * 0.35));

    // Gentle movement is not shake; it is character, and it is remembered.
    this.motionEnergy += THREE.MathUtils.clamp(speed, 0, 0.12) * dt;
  }
}
