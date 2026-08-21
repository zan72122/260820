import * as THREE from 'three';
import { clamp, damp, lerp } from '../core/util';
import type { Slide } from './slide';

/**
 * The inspection droplet.
 *
 * Not a fluid solve: a controlled bead with a tail whose speed responds to the
 * slope and to whatever the wall is doing under it. Speed is the whole message,
 * so it is deliberately readable rather than physical.
 */
export class Droplet {
  readonly group = new THREE.Group();
  u = 0;
  speed = 0;
  running = false;
  /** Where the wall currently misbehaves and how badly, 0..1. */
  obstacleU: number | null = null;
  obstacleStrength = 0;
  /** Optional early finish, so a proving run does not have to reach the pool. */
  stopU = 1;
  onSnag: (() => void) | null = null;
  onFinish: (() => void) | null = null;

  private snagged = false;
  private snagTimer = 0;
  private bead: THREE.Mesh;
  private tail: THREE.Mesh;
  private jiggle = 0;
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private hasSnagged = false;

  constructor(
    private slide: Slide,
    envMap: THREE.Texture,
  ) {
    const water = new THREE.MeshPhysicalMaterial({
      color: 0xd6f2ff,
      roughness: 0.03,
      metalness: 0,
      ior: 1.33,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      transparent: true,
      opacity: 0.66,
      envMap,
      envMapIntensity: 2.6,
      depthWrite: false,
    });
    this.bead = new THREE.Mesh(new THREE.SphereGeometry(0.036, 18, 14), water);
    this.bead.scale.set(1.05, 0.62, 1.25);
    const tailGeo = new THREE.ConeGeometry(0.026, 0.11, 12, 1, true);
    tailGeo.rotateX(-Math.PI / 2);
    tailGeo.translate(0, 0, -0.062);
    this.tail = new THREE.Mesh(tailGeo, water.clone());
    (this.tail.material as THREE.MeshPhysicalMaterial).opacity = 0.4;
    this.tail.scale.set(1, 0.55, 1);
    this.group.add(this.bead, this.tail);
    this.group.name = 'droplet';
    this.group.visible = false;
  }

  release(u0: number, stopU = 1): void {
    this.stopU = stopU;
    this.u = u0;
    this.speed = 0.12;
    this.running = true;
    this.snagged = false;
    this.hasSnagged = false;
    this.snagTimer = 0;
    this.group.visible = true;
    this.place();
  }

  stopNow(): void {
    this.running = false;
    this.group.visible = false;
  }

  private place(): void {
    this.slide.floorAt(this.u, 0.02, this.tmp);
    const f = this.slide.frame(this.u);
    this.group.position.copy(this.tmp);
    const n = this.slide.normalAt(this.u, 0, this.tmp2);
    const right = new THREE.Vector3().crossVectors(n, f.t).normalize();
    this.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, n, f.t));
  }

  update(dt: number): void {
    if (!this.running) return;
    // Sub-step so a long frame cannot carry the bead straight through the joint
    // it is supposed to catch on.
    const steps = Math.min(8, Math.max(1, Math.ceil(dt / 0.02)));
    for (let i = 0; i < steps && this.running; i++) this.step(dt / steps);
  }

  private step(dt: number): void {
    const f = this.slide.frame(this.u);
    const slope = clamp(-f.t.y, -1, 1);

    let target = clamp(0.6 + slope * 22, 0.3, 5.4);

    if (this.obstacleU !== null) {
      const distM = (this.obstacleU - this.u) * this.slide.length;
      const near = 1 - clamp(Math.abs(distM) / 0.42, 0, 1);
      if (near > 0 && distM > -0.12) {
        target = lerp(target, target * (1 - this.obstacleStrength * 0.97), near);
      }
      if (this.obstacleStrength > 0.85 && distM < 0.035 && distM > -0.2) {
        this.snagged = true;
      }
    }

    if (this.snagged) {
      this.speed = damp(this.speed, 0, 9, dt);
      this.snagTimer += dt;
      this.jiggle = Math.sin(this.snagTimer * 22) * Math.exp(-this.snagTimer * 1.1) * 0.35;
      if (!this.hasSnagged && this.snagTimer > 0.12) {
        this.hasSnagged = true;
        this.onSnag?.();
      }
    } else {
      this.speed = damp(this.speed, target, 3.2, dt);
      this.jiggle = damp(this.jiggle, 0, 6, dt);
    }

    this.u += (this.speed * dt) / this.slide.length;
    if (this.u >= Math.min(0.995, this.stopU)) {
      this.u = Math.min(0.995, this.stopU);
      this.running = false;
      this.group.visible = false;
      this.onFinish?.();
      return;
    }
    this.place();

    const stretch = clamp(this.speed / 4, 0, 1);
    this.bead.scale.set(1.05 - stretch * 0.22, 0.62, 1.25 + stretch * 0.7);
    this.tail.scale.set(1, 0.55, 0.25 + stretch * 1.5);
    (this.tail.material as THREE.MeshPhysicalMaterial).opacity = 0.1 + stretch * 0.38;
    this.group.position.addScaledVector(this.slide.radial(this.u, 0, this.tmp2), 0);
    this.group.rotation.z += this.jiggle * dt * 6;
  }

  /** Nudges a stopped droplet so a distracted player is drawn back to it. */
  twitch(): void {
    this.snagTimer = 0;
  }
}

/**
 * The empty test raft. It never carries a rider; it is the final proof that the
 * repaired section runs quiet.
 */
export class Raft {
  readonly group = new THREE.Group();
  u = 0;
  running = false;
  speed = 0;
  onFinish: (() => void) | null = null;
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();

  constructor(private slide: Slide, envMap: THREE.Texture) {
    const tube = new THREE.Mesh(
      new THREE.TorusGeometry(0.52, 0.2, 12, 28),
      new THREE.MeshPhysicalMaterial({
        color: 0xf2d44f,
        roughness: 0.35,
        metalness: 0,
        clearcoat: 0.7,
        clearcoatRoughness: 0.25,
        envMap,
        envMapIntensity: 1,
      }),
    );
    tube.rotation.x = Math.PI / 2;
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 22),
      new THREE.MeshStandardMaterial({
        color: 0x2f4d5c,
        roughness: 0.75,
        side: THREE.DoubleSide,
        envMap,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.022, 8, 14),
      new THREE.MeshStandardMaterial({ color: 0x33424c, roughness: 0.8, envMap }),
    );
    handle.position.set(0.4, 0.16, 0);
    handle.rotation.y = Math.PI / 2;
    this.group.add(tube, floor, handle);
    this.group.name = 'raft';
    this.group.visible = false;
  }

  release(u0: number): void {
    this.u = u0;
    this.speed = 2.2;
    this.running = true;
    this.group.visible = true;
    this.place();
  }

  private place(): void {
    this.slide.floorAt(this.u, 0.17, this.tmp);
    const f = this.slide.frame(this.u);
    this.group.position.copy(this.tmp);
    const n = this.slide.normalAt(this.u, 0, this.tmp2);
    const right = new THREE.Vector3().crossVectors(n, f.t).normalize();
    this.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, n, f.t));
  }

  update(dt: number): void {
    if (!this.running) return;
    // Sub-step so a long frame cannot carry the bead straight through the joint
    // it is supposed to catch on.
    const steps = Math.min(8, Math.max(1, Math.ceil(dt / 0.02)));
    for (let i = 0; i < steps && this.running; i++) this.step(dt / steps);
  }

  private step(dt: number): void {
    const f = this.slide.frame(this.u);
    const slope = clamp(-f.t.y, -1, 1);
    this.speed = damp(this.speed, clamp(2.4 + slope * 26, 1.6, 8.5), 1.9, dt);
    this.u += (this.speed * dt) / this.slide.length;
    if (this.u >= 0.995) {
      this.running = false;
      this.group.visible = false;
      this.onFinish?.();
      return;
    }
    this.place();
  }
}
