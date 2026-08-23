import * as THREE from 'three';
import { CAPSULE_R } from '../core/constants';
import { makeWoodMaterial, makeRubberMaterial } from './materials';
import type { CapsuleBody } from '../core/physics';

/**
 * Wooden test capsule with rubber bumper rings. Squashes slightly along the
 * strongest contact normal — rubber under load — and recovers.
 */
export class CapsuleVisual {
  group: THREE.Group;
  private ball: THREE.Mesh;
  private squash = 0;
  private squashNormal = new THREE.Vector3(0, 1, 0);
  private spin = 0;

  constructor() {
    this.group = new THREE.Group();
    const wood = makeWoodMaterial(31);
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(CAPSULE_R, 26, 18), wood);
    this.ball.castShadow = true;
    this.group.add(this.ball);
    const rubber = makeRubberMaterial();
    for (const off of [-0.045, 0.045]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.sqrt(CAPSULE_R * CAPSULE_R - off * off) * 1.005, 0.016, 10, 28), rubber);
      ring.position.z = off;
      ring.castShadow = true;
      this.ball.add(ring);
    }
    // end-grain cap hints (wood turned on a lathe)
    const capMat = makeWoodMaterial(87);
    capMat.color = new THREE.Color(0xb08d5f);
    for (const s of [1, -1]) {
      const cap = new THREE.Mesh(new THREE.CircleGeometry(CAPSULE_R * 0.42, 20), capMat);
      cap.position.z = s * CAPSULE_R * 0.915;
      cap.rotation.y = s > 0 ? 0 : Math.PI;
      this.ball.add(cap);
    }
  }

  syncFromBody(body: CapsuleBody, dt: number): void {
    this.group.position.set(body.x, body.y, 0);
    // rolling: approximate spin from horizontal velocity
    this.spin -= (body.vx / CAPSULE_R) * dt;
    this.ball.rotation.z = this.spin;

    let strongest = 0;
    for (const c of body.contacts) {
      if (c.impulse > strongest) {
        strongest = c.impulse;
        this.squashNormal.set(c.nx, c.ny, 0);
      }
    }
    const targetSquash = Math.min(0.22, strongest * 0.05);
    this.squash += (targetSquash - this.squash) * Math.min(1, dt * 18);
    const s = this.squash;
    if (s > 0.005) {
      const n = this.squashNormal;
      const angle = Math.atan2(n.y, n.x);
      this.group.rotation.z = angle;
      this.group.scale.set(1 - s, 1 + s * 0.7, 1);
      this.ball.rotation.z = this.spin - angle;
    } else {
      this.group.rotation.z = 0;
      this.group.scale.set(1, 1, 1);
    }
  }
}
