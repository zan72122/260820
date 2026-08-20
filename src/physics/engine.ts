import * as THREE from 'three';
import { clamp, clamp01 } from '../util/math';
import type { BallSpec, FloorSpec } from './params';

/**
 * Deterministic drop simulation.
 *
 * A general rigid-body engine would give us bounces we cannot predict, and the
 * whole point of the first two trials is that the difference between two floors
 * must be unmistakable. So the ball is integrated at a fixed timestep, and the
 * contact itself is *authored*: on touchdown we compute how long the ball and
 * the surface stay in contact, how deep each of them gives, and exactly how
 * fast the ball leaves. The result is repeatable, tunable per material pair,
 * and — because the contact lasts several frames — actually visible.
 */

export const GRAVITY = 9.81;
export const FIXED_DT = 1 / 180;
/** Impact speed used as "1.0" when scaling craters, particles and volume. */
export const REFERENCE_SPEED = 5.0;

export type PadShape = 'circle' | 'rect';

export interface ContactPad {
  id: string;
  spec: FloorSpec;
  /** World position of the centre of the pad's top surface. */
  center: THREE.Vector3;
  /** Orientation; the pad's local +Y is its outward normal. */
  quaternion: THREE.Quaternion;
  shape: PadShape;
  halfX: number;
  halfZ: number;
  /** Extra depth already carved into the surface at a pad-local point. */
  depthAt?: (lx: number, lz: number) => number;
  enabled: boolean;
}

export interface ImpactEvent {
  pad: ContactPad;
  floor: FloorSpec;
  ball: BallSpec;
  /** Contact point in world space, on the surface. */
  point: THREE.Vector3;
  normal: THREE.Vector3;
  /** Contact point in pad-local coordinates. */
  localX: number;
  localZ: number;
  /** Closing speed along the surface normal, m/s. */
  normalSpeed: number;
  tangentSpeed: number;
  /** Normal speed after the bounce, m/s. */
  reboundSpeed: number;
  /** 0..1 relative to the reference drop. */
  energy: number;
  /** How far the surface itself gives way, in metres. */
  surfaceSink: number;
  /** How far the ball squashes, in metres. */
  ballSquash: number;
  /** Seconds of contact. */
  duration: number;
  /** 1 for the first touchdown of a drop, then 2, 3, ... */
  index: number;
}

export type BallPhase = 'held' | 'falling' | 'contact' | 'airborne' | 'rolling' | 'settled';

export interface SimEvents {
  onImpact?: (e: ImpactEvent) => void;
  /** Fires at the top of the first rebound — the camera waits for this. */
  onApex?: (height: number, position: THREE.Vector3) => void;
  onSettle?: (position: THREE.Vector3, pad: ContactPad | null) => void;
  onRoll?: (speed: number, pad: ContactPad) => void;
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _local = new THREE.Vector3();
const _invQ = new THREE.Quaternion();

export class DropSimulation {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly spin = new THREE.Vector3();
  /** Unit vector along which the ball is currently squashed. */
  readonly squashAxis = new THREE.Vector3(0, 1, 0);
  /** 0 = round, 1 = fully squashed by the ball's squash profile. */
  squashAmount = 0;
  /** How far the surface is currently pushed in, in metres. Drives the
   *  transient dimple the child sees under the ball during contact. */
  surfaceSinkNow = 0;
  /** Pad-local contact point of the current or most recent impact. */
  contactLocalX = 0;
  contactLocalZ = 0;

  phase: BallPhase = 'held';
  ball: BallSpec;
  pads: ContactPad[] = [];
  events: SimEvents = {};

  /** Pad the ball is currently resting or rolling on. */
  activePad: ContactPad | null = null;

  private accumulator = 0;
  private contactPad: ContactPad | null = null;
  private contactTime = 0;
  private contactDuration = 0;
  private contactSink = 0;
  private contactSquash = 0;
  private contactRebound = 0;
  private contactBaseY = 0;
  private contactNormal = new THREE.Vector3(0, 1, 0);
  private contactTangent = new THREE.Vector3();
  private impactCount = 0;
  private apexReported = false;
  private lastVerticalSpeed = 0;
  private stillTime = 0;
  private ranSinceRelease = 0;

  constructor(ball: BallSpec) {
    this.ball = ball;
  }

  hold(position: THREE.Vector3) {
    this.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.spin.set(0, 0, 0);
    this.squashAmount = 0;
    this.surfaceSinkNow = 0;
    this.squashAxis.set(0, 1, 0);
    this.phase = 'held';
    this.activePad = null;
    this.contactPad = null;
    this.impactCount = 0;
    this.apexReported = false;
    this.stillTime = 0;
    this.ranSinceRelease = 0;
    this.accumulator = 0;
  }

  release() {
    if (this.phase !== 'held') return;
    this.phase = 'falling';
    // A hair of lateral drift from the clamp opening, so two drops are never
    // pixel-identical and the ball does not look like it is on rails.
    this.velocity.set(0, 0, 0);
    this.ranSinceRelease = 0;
  }

  get airborne() {
    return this.phase === 'falling' || this.phase === 'airborne';
  }

  get elapsedSinceRelease() {
    return this.ranSinceRelease;
  }

  /** Advance by real time; internally runs a fixed number of fixed steps. */
  update(dt: number) {
    if (this.phase === 'held') return;
    this.accumulator += Math.min(dt, 0.1);
    let guard = 0;
    while (this.accumulator >= FIXED_DT && guard < 24) {
      this.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
      guard++;
    }
    if (guard >= 24) this.accumulator = 0;
  }

  private padLocal(pad: ContactPad, world: THREE.Vector3, out: THREE.Vector3) {
    out.copy(world).sub(pad.center);
    _invQ.copy(pad.quaternion).invert();
    out.applyQuaternion(_invQ);
    return out;
  }

  private padNormal(pad: ContactPad, out: THREE.Vector3) {
    return out.set(0, 1, 0).applyQuaternion(pad.quaternion);
  }

  private withinPad(pad: ContactPad, lx: number, lz: number, margin: number) {
    if (pad.shape === 'circle') return Math.hypot(lx, lz) <= pad.halfX + margin;
    return Math.abs(lx) <= pad.halfX + margin && Math.abs(lz) <= pad.halfZ + margin;
  }

  /** Signed gap between the ball surface and the pad surface (negative = inside). */
  private gapTo(pad: ContactPad, position: THREE.Vector3) {
    this.padLocal(pad, position, _local);
    if (!this.withinPad(pad, _local.x, _local.z, 0)) return Infinity;
    const carved = pad.depthAt ? pad.depthAt(_local.x, _local.z) : 0;
    return _local.y + carved - this.ball.radius;
  }

  private step(dt: number) {
    this.ranSinceRelease += dt;
    if (this.phase === 'contact') {
      this.stepContact(dt);
      return;
    }
    if (this.phase === 'rolling') {
      this.stepRolling(dt);
      return;
    }
    if (this.phase === 'settled') return;

    // Airborne integration.
    this.velocity.y -= GRAVITY * dt;
    // Light air drag: matters only for the foam ball, where it is the point.
    const dragK = 0.00035 / Math.max(this.ball.mass, 0.005);
    const speed = this.velocity.length();
    if (speed > 0.01) {
      _v.copy(this.velocity).multiplyScalar(-dragK * speed * dt);
      this.velocity.add(_v);
    }

    const prevY = this.position.y;
    this.position.addScaledVector(this.velocity, dt);
    this.squashAmount = Math.max(0, this.squashAmount - dt * 6);

    // First rebound apex, for the camera.
    if (
      !this.apexReported &&
      this.phase === 'airborne' &&
      this.lastVerticalSpeed > 0 &&
      this.velocity.y <= 0
    ) {
      this.apexReported = true;
      this.events.onApex?.(this.position.y, this.position);
    }
    this.lastVerticalSpeed = this.velocity.y;

    // Find the pad we crossed into this step, keeping the highest surface.
    let best: ContactPad | null = null;
    let bestGap = Infinity;
    for (const pad of this.pads) {
      if (!pad.enabled) continue;
      const gap = this.gapTo(pad, this.position);
      if (gap <= 0 && gap < bestGap) {
        bestGap = gap;
        best = pad;
      }
    }
    if (best) {
      // Back up to the moment of touchdown so a fast ball never tunnels
      // visibly into the surface before the contact starts.
      const travelled = prevY - this.position.y;
      if (travelled > 1e-6) {
        const back = clamp(-bestGap / travelled, 0, 1) * travelled;
        this.position.y += back;
      }
      this.beginContact(best);
    }
  }

  private beginContact(pad: ContactPad) {
    const floor = pad.spec;
    const ball = this.ball;
    this.padNormal(pad, this.contactNormal);

    const vn = this.velocity.dot(this.contactNormal); // negative on approach
    const normalSpeed = Math.max(0, -vn);
    _v.copy(this.velocity).addScaledVector(this.contactNormal, -vn);
    const tangentSpeed = _v.length();
    this.contactTangent.copy(_v).normalize();

    const energy = clamp01(normalSpeed / (REFERENCE_SPEED * 1.2));
    const restitution = floor.restitution * ball.restitution;

    // Both bodies give way; the softer one takes most of the deformation.
    const floorHardness = clamp01(1 - floor.deformation * 26);
    const ballHardness = clamp01(1 - ball.squash * 2.2);
    const massFactor = Math.sqrt(clamp(ball.mass / 0.12, 0.35, 2.4));

    const surfaceSink =
      floor.deformation * (0.35 + 0.65 * energy) * massFactor * (0.4 + 0.6 * ballHardness);
    const ballSquash =
      ball.squash * ball.radius * (0.3 + 0.7 * energy) * (0.35 + 0.65 * floorHardness);

    const duration = floor.contactTime * ball.contactScale * (0.75 + 0.35 * (1 - energy));

    this.contactPad = pad;
    this.activePad = pad;
    this.contactTime = 0;
    this.contactDuration = Math.max(duration, FIXED_DT * 2);
    this.contactSink = surfaceSink;
    this.contactSquash = ballSquash;
    this.contactRebound = normalSpeed * restitution;
    this.phase = 'contact';
    this.squashAxis.copy(this.contactNormal);

    // Hold the pre-contact position as the top of the contact stroke.
    this.contactBaseY = this.position.dot(this.contactNormal);

    // Friction converts sliding into spin, and spin back into rolling.
    if (tangentSpeed > 0.001) {
      const mu = floor.friction;
      const lost = Math.min(1, mu * (0.5 + 0.5 * energy));
      _v2.copy(this.contactTangent).multiplyScalar(-tangentSpeed * lost);
      this.velocity.add(_v2);
      _v.crossVectors(this.contactNormal, this.contactTangent);
      this.spin.addScaledVector(_v, (tangentSpeed * lost * ball.spinGain) / ball.radius);
    }
    // A vertical drop still picks up a little spin from surface texture.
    const texSpin = floor.friction * normalSpeed * 0.06 * ball.spinGain;
    this.spin.x += (this.hashNoise(this.impactCount * 3 + 1) - 0.5) * texSpin;
    this.spin.z += (this.hashNoise(this.impactCount * 3 + 2) - 0.5) * texSpin;

    this.padLocal(pad, this.position, _local);
    this.contactLocalX = _local.x;
    this.contactLocalZ = _local.z;
    this.impactCount++;

    const point = _v2
      .copy(this.position)
      .addScaledVector(this.contactNormal, -this.ball.radius)
      .clone();

    this.events.onImpact?.({
      pad,
      floor,
      ball,
      point,
      normal: this.contactNormal.clone(),
      localX: _local.x,
      localZ: _local.z,
      normalSpeed,
      tangentSpeed,
      reboundSpeed: this.contactRebound,
      energy,
      surfaceSink,
      ballSquash,
      duration: this.contactDuration,
      index: this.impactCount,
    });
  }

  /** Cheap deterministic jitter so repeated drops are not bit-identical. */
  private hashNoise(i: number) {
    const x = Math.sin(i * 12.9898 + this.impactCount * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  private stepContact(dt: number) {
    const pad = this.contactPad!;
    this.contactTime += dt;
    const p = clamp01(this.contactTime / this.contactDuration);

    // A single smooth compression/restore stroke. The peak sits early so the
    // surface "gives" fast and pushes back over a longer window, which is what
    // reads as springy rather than sticky.
    const peak = 0.42;
    const stroke = p < peak ? Math.sin((p / peak) * Math.PI * 0.5) : Math.cos(((p - peak) / (1 - peak)) * Math.PI * 0.5);

    const total = this.contactSink + this.contactSquash;
    const drop = total * stroke;
    this.squashAmount = this.contactSquash > 1e-5 ? stroke : 0;
    this.surfaceSinkNow = this.contactSink * stroke;

    // Slide the ball along the contact normal by the current stroke depth.
    const targetAlongNormal = this.contactBaseY - drop;
    const current = this.position.dot(this.contactNormal);
    this.position.addScaledVector(this.contactNormal, targetAlongNormal - current);

    // Tangential motion continues during contact (a ball landing on a slope
    // keeps sliding forward while it is compressed).
    _v.copy(this.velocity).addScaledVector(this.contactNormal, -this.velocity.dot(this.contactNormal));
    this.position.addScaledVector(_v, dt);

    if (p >= 1) {
      // Leave with the authored rebound speed along the normal.
      const vn = this.velocity.dot(this.contactNormal);
      this.velocity.addScaledVector(this.contactNormal, this.contactRebound - vn);
      this.squashAmount = 0;
      this.surfaceSinkNow = 0;
      this.contactPad = null;

      // Rest inside the mark the impact just made, if the surface keeps it.
      this.position.addScaledVector(
        this.contactNormal,
        -(this.contactSink * pad.spec.markPersistence * 0.55)
      );

      if (this.contactRebound < 0.32) {
        this.phase = 'rolling';
        this.activePad = pad;
        // Kill the residual normal component so it settles instead of jittering.
        const vn2 = this.velocity.dot(this.contactNormal);
        this.velocity.addScaledVector(this.contactNormal, -vn2);
      } else {
        this.phase = 'airborne';
        this.lastVerticalSpeed = this.velocity.y;
      }
    }
  }

  private stepRolling(dt: number) {
    const pad = this.activePad;
    if (!pad) {
      this.phase = 'airborne';
      return;
    }
    this.padNormal(pad, this.contactNormal);

    // Gravity resolved onto the surface: this is what rolls the ball down a
    // tilted panel and into the next one.
    _v.set(0, -GRAVITY, 0);
    _v.addScaledVector(this.contactNormal, -_v.dot(this.contactNormal));
    this.velocity.addScaledVector(_v, dt);

    // Rolling resistance.
    const speed = this.velocity.length();
    if (speed > 1e-4) {
      const decel = pad.spec.rollingResistance * this.ball.rollingDrag * 0.34;
      const drop = Math.min(speed, decel * dt);
      this.velocity.multiplyScalar((speed - drop) / speed);
    }

    this.position.addScaledVector(this.velocity, dt);

    // Keep the ball on the (possibly carved) surface.
    this.padLocal(pad, this.position, _local);
    if (!this.withinPad(pad, _local.x, _local.z, 0)) {
      this.phase = 'airborne';
      this.activePad = null;
      this.stillTime = 0;
      return;
    }
    const carved = pad.depthAt ? pad.depthAt(_local.x, _local.z) : 0;
    const targetY = this.ball.radius - carved - pad.spec.restSink;
    this.position.addScaledVector(this.contactNormal, targetY - _local.y);

    // Spin follows the surface velocity so the texture visibly rolls.
    const v = this.velocity.length();
    if (v > 1e-4) {
      _v2.copy(this.velocity).normalize();
      _v.crossVectors(this.contactNormal, _v2).multiplyScalar(v / this.ball.radius);
      this.spin.lerp(_v, 1 - Math.exp(-14 * dt));
      this.events.onRoll?.(v, pad);
    } else {
      this.spin.multiplyScalar(1 - Math.min(1, 8 * dt));
    }

    if (v < 0.045) {
      this.stillTime += dt;
      if (this.stillTime > 0.22) {
        this.phase = 'settled';
        this.velocity.set(0, 0, 0);
        this.spin.multiplyScalar(0.2);
        if (!this.apexReported) {
          // A drop that never bounced still needs to release the camera.
          this.apexReported = true;
          this.events.onApex?.(this.position.y, this.position);
        }
        this.events.onSettle?.(this.position, pad);
      }
    } else {
      this.stillTime = 0;
    }
  }
}
