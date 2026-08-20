import * as THREE from 'three';

/**
 * A thick root drawn as a tube whose control points move every frame, so the
 * link between crown and tuber never breaks while the cluster is lifted.
 */
export class Strand {
  readonly mesh: THREE.Mesh;
  private geo: THREE.BufferGeometry;
  private segments: number;
  private radial: number;
  private radii: Float32Array;
  private curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]);

  constructor(material: THREE.Material, segments = 12, radial = 6, radiusFn: (t: number) => number = () => 0.006) {
    this.segments = segments;
    this.radial = radial;
    this.radii = new Float32Array(segments + 1);
    for (let i = 0; i <= segments; i++) this.radii[i] = radiusFn(i / segments);

    const count = (segments + 1) * (radial + 1);
    const pos = new Float32Array(count * 3);
    const nrm = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const idx: number[] = [];
    for (let i = 0; i <= segments; i++) {
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j;
        uv[k * 2] = i / segments;
        uv[k * 2 + 1] = j / radial;
      }
    }
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j;
        const b = a + radial + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geo.setIndex(idx);
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 6);
    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
  }

  update(a: THREE.Vector3, b: THREE.Vector3, sagDir: THREE.Vector3, sag: number) {
    const p = this.curve.points;
    p[0].copy(a);
    p[3].copy(b);
    p[1].lerpVectors(a, b, 0.34).addScaledVector(sagDir, sag);
    p[2].lerpVectors(a, b, 0.68).addScaledVector(sagDir, sag * 0.6);
    this.curve.updateArcLengths();

    const frames = this.curve.computeFrenetFrames(this.segments, false);
    const pos = this.geo.attributes.position as THREE.BufferAttribute;
    const nrm = this.geo.attributes.normal as THREE.BufferAttribute;
    const pt = new THREE.Vector3();
    for (let i = 0; i <= this.segments; i++) {
      const t = i / this.segments;
      this.curve.getPoint(t, pt);
      const N = frames.normals[i];
      const B = frames.binormals[i];
      const r = this.radii[i];
      for (let j = 0; j <= this.radial; j++) {
        const ang = (j / this.radial) * Math.PI * 2;
        const cx = Math.cos(ang);
        const sy = Math.sin(ang);
        const nx = N.x * cx + B.x * sy;
        const ny = N.y * cx + B.y * sy;
        const nz = N.z * cx + B.z * sy;
        const k = i * (this.radial + 1) + j;
        pos.setXYZ(k, pt.x + nx * r, pt.y + ny * r, pt.z + nz * r);
        nrm.setXYZ(k, nx, ny, nz);
      }
    }
    pos.needsUpdate = true;
    nrm.needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
  }
}
