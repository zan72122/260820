/**
 * Test balls. Motion is owned by each station's deterministic script /
 * 1-DOF simulation; this class supplies the body, rolling spin, squash,
 * and impact bookkeeping so results look and sound physical without a
 * chaotic full 3D solver.
 */
import * as THREE from 'three';
import { BALLS, type BallKind, type BallSpec } from '../glyph/spec';
import type { LabMaterials } from '../core/materials';
import type { LabAudio } from '../core/audio';

export class Ball {
  readonly mesh: THREE.Mesh;
  readonly spec: BallSpec;
  readonly radius: number;
  vel = new THREE.Vector3();
  private squashT = 1;
  private spinAxis = new THREE.Vector3(1, 0, 0);
  private prevPos = new THREE.Vector3();

  constructor(
    public kind: BallKind,
    mats: LabMaterials,
    private audio: LabAudio,
  ) {
    this.spec = BALLS[kind];
    this.radius = this.spec.diameter / 2;
    const mat =
      kind === 'rubber' ? mats.rubberBall : kind === 'wood' ? mats.woodBall : mats.steelBall;
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(this.radius, 26, 18), mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
  }

  get position() {
    return this.mesh.position;
  }

  setPosition(x: number, y: number, z: number) {
    this.mesh.position.set(x, y, z);
    this.prevPos.copy(this.mesh.position);
  }

  /** Call after moving the ball each frame: adds rolling spin + squash decay. */
  tick(dt: number, rollingOnGround: boolean) {
    const d = new THREE.Vector3().subVectors(this.mesh.position, this.prevPos);
    this.prevPos.copy(this.mesh.position);
    if (rollingOnGround && d.lengthSq() > 1e-10) {
      const horiz = new THREE.Vector3(d.x, 0, d.z);
      const len = horiz.length();
      if (len > 1e-8) {
        this.spinAxis.set(horiz.z, 0, -horiz.x).normalize();
        this.mesh.rotateOnWorldAxis(this.spinAxis, len / this.radius);
      }
    }
    if (this.squashT < 1) {
      this.squashT = Math.min(1, this.squashT + dt * 6);
      const s = 1 - Math.sin(this.squashT * Math.PI) * 0.14 * this.spec.bounce;
      this.mesh.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
      if (this.squashT >= 1) this.mesh.scale.set(1, 1, 1);
    }
    if (dt > 0) this.vel.copy(d).divideScalar(dt);
  }

  impact(velocity: number, surface: 'steel' | 'granite' | 'felt' | 'aluminum' = 'steel') {
    this.audio.impact(this.kind, velocity, surface);
    if (this.kind === 'rubber' && velocity > 0.4) this.squashT = 0;
  }
}
