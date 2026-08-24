import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Vector3 } from 'three';

/**
 * A tube with real thickness that follows a spline.
 *
 * The stethoscope tubing is not a full soft-body simulation: it is a short
 * spline with a handful of control points and a parallel-transported frame,
 * which is enough for it to hang, keep its set bend, and never slice into the
 * chest. Buffers are allocated once and rewritten in place.
 */
export class FlexTube {
  readonly geometry: BufferGeometry;
  private curve = new CatmullRomCurve3([new Vector3(), new Vector3()], false, 'catmullrom', 0.5);
  private readonly T: number;
  private readonly R: number;
  private readonly radius: number;
  private pos: Float32Array;
  private nor: Float32Array;

  private p = new Vector3();
  private tan = new Vector3();
  private nrm = new Vector3();
  private bin = new Vector3();
  private tmp = new Vector3();
  private prevTan = new Vector3();
  private axis = new Vector3();

  constructor(radius = 0.0085, tubularSegments = 44, radialSegments = 10) {
    this.T = tubularSegments;
    this.R = radialSegments;
    this.radius = radius;
    const count = (this.T + 1) * (this.R + 1);
    this.pos = new Float32Array(count * 3);
    this.nor = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const idx: number[] = [];
    for (let i = 0; i <= this.T; i++) {
      for (let j = 0; j <= this.R; j++) {
        const k = i * (this.R + 1) + j;
        uv[k * 2] = i / this.T;
        uv[k * 2 + 1] = j / this.R;
      }
    }
    for (let i = 0; i < this.T; i++) {
      for (let j = 0; j < this.R; j++) {
        const a = i * (this.R + 1) + j;
        const b = a + this.R + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.geometry.setAttribute('normal', new BufferAttribute(this.nor, 3));
    this.geometry.setAttribute('uv', new BufferAttribute(uv, 2));
    this.geometry.setIndex(idx);
    this.geometry.boundingSphere = null;
  }

  setPath(points: Vector3[]): void {
    this.curve.points = points;
    this.rebuild();
  }

  private rebuild(): void {
    const { T, R, radius } = this;
    // Seed the transported frame with any vector not parallel to the tangent.
    this.curve.getTangentAt(0, this.prevTan).normalize();
    this.nrm.set(0, 1, 0);
    if (Math.abs(this.nrm.dot(this.prevTan)) > 0.9) this.nrm.set(1, 0, 0);
    this.nrm.crossVectors(this.prevTan, this.nrm).normalize();

    for (let i = 0; i <= T; i++) {
      const t = i / T;
      this.curve.getPointAt(t, this.p);
      this.curve.getTangentAt(t, this.tan).normalize();

      if (i > 0) {
        // Parallel transport: rotate the previous normal by the same rotation
        // that took the previous tangent to this one. No twisting artefacts.
        this.axis.crossVectors(this.prevTan, this.tan);
        const len = this.axis.length();
        if (len > 1e-6) {
          this.axis.divideScalar(len);
          const angle = Math.acos(Math.min(1, Math.max(-1, this.prevTan.dot(this.tan))));
          this.nrm.applyAxisAngle(this.axis, angle);
        }
      }
      this.nrm.addScaledVector(this.tan, -this.nrm.dot(this.tan)).normalize();
      this.bin.crossVectors(this.tan, this.nrm);
      this.prevTan.copy(this.tan);

      for (let j = 0; j <= R; j++) {
        const a = (j / R) * Math.PI * 2;
        const cs = Math.cos(a);
        const sn = Math.sin(a);
        this.tmp.set(
          this.nrm.x * cs + this.bin.x * sn,
          this.nrm.y * cs + this.bin.y * sn,
          this.nrm.z * cs + this.bin.z * sn,
        );
        const k = (i * (R + 1) + j) * 3;
        this.nor[k] = this.tmp.x;
        this.nor[k + 1] = this.tmp.y;
        this.nor[k + 2] = this.tmp.z;
        this.pos[k] = this.p.x + this.tmp.x * radius;
        this.pos[k + 1] = this.p.y + this.tmp.y * radius;
        this.pos[k + 2] = this.p.z + this.tmp.z * radius;
      }
    }
    (this.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('normal') as BufferAttribute).needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }
}
