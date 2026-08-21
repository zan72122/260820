import { IcosahedronGeometry, InstancedMesh, Matrix4, Vector3 } from 'three';
import type { MaterialLibrary } from '../materials/Materials';
import type { FlumePath } from './geo';
import { DIM } from './dims';

/**
 * Thrown droplets, not a fluid solve: seeded at the inlet, carried down the
 * bed, retired at the run-out. Count is a quality dial.
 */
export class Spray {
  readonly mesh: InstancedMesh;
  private readonly s: Float32Array;
  private readonly theta: Float32Array;
  private readonly lift: Float32Array;
  private readonly vel: Float32Array;
  private readonly scale: Float32Array;
  private readonly m = new Matrix4();
  private readonly p = new Vector3();
  private live = 0;

  constructor(
    private readonly path: FlumePath,
    mats: MaterialLibrary,
    private readonly max: number,
    private readonly sMin: number,
    private readonly sMax: number,
  ) {
    const geo = new IcosahedronGeometry(0.013, 0);
    this.mesh = new InstancedMesh(geo, mats.spray, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.s = new Float32Array(max);
    this.theta = new Float32Array(max);
    this.lift = new Float32Array(max);
    this.vel = new Float32Array(max);
    this.scale = new Float32Array(max);
    for (let i = 0; i < max; i++) this.seed(i, true);
  }

  setBudget(n: number): void {
    this.live = Math.min(this.max, Math.max(0, n));
  }

  private seed(i: number, anywhere: boolean): void {
    this.s[i] = anywhere ? this.sMin + Math.random() * (this.sMax - this.sMin) : this.sMin + Math.random() * 1.4;
    this.theta[i] = Math.PI + (Math.random() - 0.5) * 1.5;
    this.lift[i] = 0.02 + Math.random() * 0.16;
    this.vel[i] = 0.7 + Math.random() * 0.9;
    this.scale[i] = 0.4 + Math.random() * 1.2;
  }

  update(dt: number, flow: number): void {
    const n = Math.round(this.live * Math.min(1, flow * 1.6));
    this.mesh.count = n;
    if (n === 0) return;
    const speed = 1.4 + flow * 5.5;
    for (let i = 0; i < n; i++) {
      this.s[i] += dt * speed * this.vel[i];
      this.lift[i] += dt * (Math.sin(this.s[i] * 5 + i) * 0.06 - 0.12);
      if (this.lift[i] < 0.005) {
        this.lift[i] = 0.01 + Math.random() * 0.13 * flow;
      }
      if (this.s[i] > this.sMax) this.seed(i, false);
      this.path.surfacePoint(this.s[i], this.theta[i], DIM.innerR - DIM.filmDepth - this.lift[i], this.p);
      const sc = this.scale[i] * (0.5 + flow * 0.8);
      this.m.makeScale(sc, sc, sc);
      this.m.setPosition(this.p);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }
}
