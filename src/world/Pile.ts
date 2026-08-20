import * as THREE from 'three';


export interface PileBody {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  /** Orientation, integrated from rolling so the suture line really turns. */
  quat: THREE.Quaternion;
  radius: number;
  /** Proportional to r^3: a big ume settles heavily, a small one skips. */
  mass: number;
  restitution: number;
  sleeping: boolean;
  sleepTimer: number;
  /** Scene-specific payload (mesh index, model id...). */
  ref: number;
  /** Set while the player is holding this body; physics leaves it alone. */
  held: boolean;
}

export interface Impact {
  body: PileBody;
  /** Approach speed at the moment of contact, m/s. */
  speed: number;
  kind: 'floor' | 'body' | 'wall';
}

export interface PileBounds {
  kind: 'cylinder' | 'box' | 'none';
  /** Cylinder: centre and radius. Box: centre and half extents. */
  center: THREE.Vector3;
  radius?: number;
  half?: THREE.Vector2;
}

export interface PileOptions {
  gravity?: number;
  /** Ground height under a point; lets fruit roll into a net's sag. */
  floorAt?: (x: number, z: number) => number;
  /** Downhill direction of the floor at a point, for rolling. */
  slopeAt?: (x: number, z: number, out: THREE.Vector2) => THREE.Vector2;
  bounds?: PileBounds;
  linearDamping?: number;
  rollingFriction?: number;
}

const _tmp = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _slope = new THREE.Vector2();
const _dq = new THREE.Quaternion();

/**
 * A compact sphere-pile solver: enough physics that fruit feel like fruit --
 * inertia scaled by size, soft low-restitution contacts, rolling that follows
 * the ground's slope -- without dragging in a full engine.
 */
export class PileSolver {
  readonly bodies: PileBody[] = [];
  gravity: number;
  bounds: PileBounds;
  private floorAt: (x: number, z: number) => number;
  private slopeAt: (x: number, z: number, out: THREE.Vector2) => THREE.Vector2;
  private linearDamping: number;
  private rollingFriction: number;
  private impacts: Impact[] = [];

  constructor(opts: PileOptions = {}) {
    this.gravity = opts.gravity ?? 9.81;
    this.floorAt = opts.floorAt ?? (() => 0);
    this.slopeAt = opts.slopeAt ?? ((_x, _z, out) => out.set(0, 0));
    this.bounds = opts.bounds ?? { kind: 'none', center: new THREE.Vector3() };
    this.linearDamping = opts.linearDamping ?? 0.22;
    this.rollingFriction = opts.rollingFriction ?? 1.5;
  }

  setFloor(fn: (x: number, z: number) => number): void {
    this.floorAt = fn;
  }

  setSlope(fn: (x: number, z: number, out: THREE.Vector2) => THREE.Vector2): void {
    this.slopeAt = fn;
  }

  add(body: Omit<PileBody, 'sleeping' | 'sleepTimer' | 'quat' | 'held'> & { quat?: THREE.Quaternion }): PileBody {
    const b: PileBody = {
      quat: body.quat ?? new THREE.Quaternion(),
      sleeping: false,
      sleepTimer: 0,
      held: false,
      ...body,
    };
    this.bodies.push(b);
    return b;
  }

  wakeAll(): void {
    for (const b of this.bodies) {
      b.sleeping = false;
      b.sleepTimer = 0;
    }
  }

  consumeImpacts(): Impact[] {
    if (this.impacts.length === 0) return [];
    const out = this.impacts;
    this.impacts = [];
    return out;
  }

  /** Fixed-step integration so behaviour is identical at 30 and 120 fps. */
  step(dt: number, substeps = 2): void {
    const h = Math.min(dt, 1 / 30) / substeps;
    for (let s = 0; s < substeps; s++) this.integrate(h);
  }

  private integrate(h: number): void {
    const n = this.bodies.length;

    for (let i = 0; i < n; i++) {
      const b = this.bodies[i];
      if (b.held) {
        b.sleeping = false;
        b.sleepTimer = 0;
        continue;
      }
      if (b.sleeping) continue;
      b.vel.y -= this.gravity * h;

      // Ground slope pulls a resting fruit downhill -- this is what makes
      // lifting one edge of the net gather everything to the middle.
      const floor = this.floorAt(b.pos.x, b.pos.z) + b.radius;
      const grounded = b.pos.y <= floor + b.radius * 0.15;
      if (grounded) {
        this.slopeAt(b.pos.x, b.pos.z, _slope);
        b.vel.x += _slope.x * this.gravity * h * 0.85;
        b.vel.z += _slope.y * this.gravity * h * 0.85;
        const damp = Math.exp(-this.rollingFriction * h);
        b.vel.x *= damp;
        b.vel.z *= damp;
      }
      const d = Math.exp(-this.linearDamping * h);
      b.vel.multiplyScalar(d);
      b.pos.addScaledVector(b.vel, h);
    }

    // Pairwise separation. Small counts (<= ~24), so O(n^2) is cheap and exact.
    for (let i = 0; i < n; i++) {
      const a = this.bodies[i];
      for (let j = i + 1; j < n; j++) {
        const b = this.bodies[j];
        if (a.sleeping && b.sleeping) continue;
        _tmp.subVectors(b.pos, a.pos);
        const minD = a.radius + b.radius;
        const dist = _tmp.length();
        if (dist >= minD || dist < 1e-6) continue;
        const overlap = minD - dist;
        _tmp.multiplyScalar(1 / dist);
        const invA = a.held ? 0 : 1 / a.mass;
        const invB = b.held ? 0 : 1 / b.mass;
        const invSum = invA + invB;
        if (invSum <= 0) continue;
        a.pos.addScaledVector(_tmp, -overlap * (invA / invSum));
        b.pos.addScaledVector(_tmp, overlap * (invB / invSum));

        const rel = _tmp.dot(b.vel) - _tmp.dot(a.vel);
        if (rel < 0) {
          const e = Math.min(a.restitution, b.restitution);
          const jImp = (-(1 + e) * rel) / invSum;
          if (!a.held) a.vel.addScaledVector(_tmp, -jImp * invA);
          if (!b.held) b.vel.addScaledVector(_tmp, jImp * invB);
          if (-rel > 0.35) {
            this.impacts.push({ body: b.mass > a.mass ? b : a, speed: -rel, kind: 'body' });
          }
          a.sleeping = false;
          b.sleeping = false;
          a.sleepTimer = 0;
          b.sleepTimer = 0;
        }
      }
    }

    // Floor, walls, sleeping and rolling orientation.
    for (let i = 0; i < n; i++) {
      const b = this.bodies[i];
      if (b.held) continue;
      const floorY = this.floorAt(b.pos.x, b.pos.z) + b.radius;
      if (b.pos.y < floorY) {
        const impact = -b.vel.y;
        b.pos.y = floorY;
        if (b.vel.y < 0) {
          b.vel.y = -b.vel.y * b.restitution;
          if (Math.abs(b.vel.y) < 0.32) b.vel.y = 0;
          if (impact > 0.4) this.impacts.push({ body: b, speed: impact, kind: 'floor' });
        }
        const f = Math.exp(-2.6 * (1 / 60));
        b.vel.x *= f;
        b.vel.z *= f;
      }

      if (this.bounds.kind === 'cylinder' && this.bounds.radius !== undefined) {
        const cx = b.pos.x - this.bounds.center.x;
        const cz = b.pos.z - this.bounds.center.z;
        const r = Math.hypot(cx, cz);
        const limit = this.bounds.radius - b.radius;
        if (r > limit && r > 1e-6) {
          const nx = cx / r;
          const nz = cz / r;
          b.pos.x = this.bounds.center.x + nx * limit;
          b.pos.z = this.bounds.center.z + nz * limit;
          const vn = b.vel.x * nx + b.vel.z * nz;
          if (vn > 0) {
            b.vel.x -= (1 + b.restitution) * vn * nx;
            b.vel.z -= (1 + b.restitution) * vn * nz;
            if (vn > 0.5) this.impacts.push({ body: b, speed: vn, kind: 'wall' });
          }
        }
      } else if (this.bounds.kind === 'box' && this.bounds.half) {
        const hx = this.bounds.half.x - b.radius;
        const hz = this.bounds.half.y - b.radius;
        const lx = b.pos.x - this.bounds.center.x;
        const lz = b.pos.z - this.bounds.center.z;
        if (Math.abs(lx) > hx) {
          b.pos.x = this.bounds.center.x + Math.sign(lx) * hx;
          if (Math.sign(b.vel.x) === Math.sign(lx)) b.vel.x *= -b.restitution;
        }
        if (Math.abs(lz) > hz) {
          b.pos.z = this.bounds.center.z + Math.sign(lz) * hz;
          if (Math.sign(b.vel.z) === Math.sign(lz)) b.vel.z *= -b.restitution;
        }
      }

      // Rolling: spin follows travel, so the fruit's markings turn with it.
      const speed = Math.hypot(b.vel.x, b.vel.z);
      if (speed > 1e-4) {
        _axis.set(-b.vel.z, 0, b.vel.x).normalize();
        _dq.setFromAxisAngle(_axis, (speed / b.radius) * h);
        b.quat.premultiply(_dq).normalize();
      }

      const still = b.vel.lengthSq() < 0.0016 && b.pos.y <= floorY + 1e-3;
      b.sleepTimer = still ? b.sleepTimer + h : 0;
      if (b.sleepTimer > 0.6) {
        b.sleeping = true;
        b.vel.set(0, 0, 0);
      }
    }
  }
}

export function massForRadius(r: number, density = 1000): number {
  return (4 / 3) * Math.PI * r * r * r * density;
}
