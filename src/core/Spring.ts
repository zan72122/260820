import { Vector3 } from 'three';

/** Critically-damped-ish spring for a scalar. Gives things weight. */
export class Spring {
  value: number;
  velocity = 0;
  target: number;
  stiffness: number;
  damping: number;

  constructor(value = 0, stiffness = 120, damping = 18) {
    this.value = value;
    this.target = value;
    this.stiffness = stiffness;
    this.damping = damping;
  }

  set(v: number) {
    this.value = v;
    this.target = v;
    this.velocity = 0;
  }

  step(dt: number): number {
    // Sub-step so a long frame can't blow the integrator up.
    const steps = Math.min(4, Math.max(1, Math.ceil(dt / 0.012)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = (this.target - this.value) * this.stiffness - this.velocity * this.damping;
      this.velocity += a * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
}

const _a = new Vector3();

/** Vector spring — used for anything the finger drags, so it lags like mass. */
export class Spring3 {
  value = new Vector3();
  velocity = new Vector3();
  target = new Vector3();
  stiffness: number;
  damping: number;

  constructor(stiffness = 110, damping = 17) {
    this.stiffness = stiffness;
    this.damping = damping;
  }

  set(v: Vector3) {
    this.value.copy(v);
    this.target.copy(v);
    this.velocity.set(0, 0, 0);
  }

  step(dt: number): Vector3 {
    const steps = Math.min(4, Math.max(1, Math.ceil(dt / 0.012)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      _a.copy(this.target).sub(this.value).multiplyScalar(this.stiffness)
        .addScaledVector(this.velocity, -this.damping);
      this.velocity.addScaledVector(_a, h);
      this.value.addScaledVector(this.velocity, h);
    }
    return this.value;
  }
}
