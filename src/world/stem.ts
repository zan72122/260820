import * as THREE from 'three';
import { Rng, TAU, clamp01, lerp, smoothstep } from '../core/math';
import type { QualitySettings } from '../core/quality';
import { applyMaps, cached, stemBarkMaps, stemCutFaceMap } from '../core/textures';

/**
 * The cut-back cassava stem: the only thing above ground when a plot starts.
 *
 * It carries the readable evidence of what it is — leaf scars in a spiral,
 * swollen nodes, a lignified surface, a fresh machete face on top, and a band
 * of soil staining where it enters the ground.
 */

export interface StemParams {
  seed: number;
  /** Height of the stub above the soil line, metres (0.20-0.30). */
  height: number;
  /** Lean from vertical, radians. */
  tilt: number;
  /** Direction of the lean. */
  tiltAzimuth: number;
  baseRadius: number;
}

export class Stem {
  readonly group = new THREE.Group();
  readonly cutFace: THREE.Mesh;
  /** Local point where the clamp jaws should close, just above the soil. */
  readonly gripPoint = new THREE.Vector3();
  readonly topPoint = new THREE.Vector3();
  private disposables: (THREE.BufferGeometry | THREE.Material)[] = [];

  constructor(params: StemParams, q: QualitySettings) {
    const rng = new Rng(params.seed ^ 0x2ad1);
    const bark = cached('bark' + q.textureSize, () => stemBarkMaps(q.textureSize));
    const face = cached('cutFace' + q.textureSize, () => stemCutFaceMap(Math.max(128, q.textureSize / 2)));

    const bottom = -0.075;
    const total = params.height - bottom;
    const nodeCount = rng.int(4, 6);
    const nodeAt: number[] = [];
    for (let i = 0; i < nodeCount; i++) {
      nodeAt.push(lerp(0.16, 0.94, (i + rng.jitter(0.16)) / Math.max(1, nodeCount - 1)));
    }

    const axis = (t: number, out: THREE.Vector3): THREE.Vector3 => {
      const y = bottom + total * t;
      // The lean develops above the soil line, not below it.
      const bend = smoothstep((t - 0.12) / 0.88) * Math.tan(params.tilt) * total * t;
      out.set(Math.cos(params.tiltAzimuth) * bend, y, Math.sin(params.tiltAzimuth) * bend);
      return out;
    };

    const radiusAt = (t: number): number => {
      const taper = lerp(1.06, 0.82, t);
      let node = 0;
      for (const n of nodeAt) node += Math.exp(-Math.pow((t - n) / 0.035, 2)) * 0.085;
      return params.baseRadius * (taper + node);
    };

    const L = Math.max(22, Math.round(q.rootLengthSegments * 0.7));
    const R = Math.max(10, Math.round(q.rootRadialSegments * 0.8));
    const positions: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];
    const p = new THREE.Vector3();
    const pPrev = new THREE.Vector3();
    const tangent = new THREE.Vector3();

    for (let i = 0; i <= L; i++) {
      const t = i / L;
      axis(t, p);
      axis(Math.max(0, t - 0.01), pPrev);
      tangent.copy(p).sub(pPrev).normalize();
      if (tangent.lengthSq() < 1e-6) tangent.set(0, 1, 0);
      const n1 = new THREE.Vector3(1, 0, 0).cross(tangent).normalize();
      if (n1.lengthSq() < 1e-6) n1.set(1, 0, 0);
      const n2 = new THREE.Vector3().crossVectors(tangent, n1).normalize();
      const r = radiusAt(t);
      for (let j = 0; j <= R; j++) {
        const a = (j / R) * TAU;
        // Slight out-of-round section; woody stems are not lathe-turned.
        const lobe = 1 + Math.sin(a * 4 + t * 3) * 0.035 + Math.sin(a * 7 - t * 5) * 0.02;
        const rr = r * lobe;
        positions.push(
          p.x + n1.x * Math.cos(a) * rr + n2.x * Math.sin(a) * rr,
          p.y + n1.y * Math.cos(a) * rr + n2.y * Math.sin(a) * rr,
          p.z + n1.z * Math.cos(a) * rr + n2.z * Math.sin(a) * rr,
        );
        uvs.push(j / R, t);
      }
    }
    for (let i = 0; i < L; i++) {
      for (let j = 0; j < R; j++) {
        const a = i * (R + 1) + j;
        const b = a + R + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(idx);
    geom.computeVertexNormals();
    this.disposables.push(geom);

    const mat = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0 });
    applyMaps(mat, bark, new THREE.Vector2(1, 1), q.anisotropy);
    this.disposables.push(mat);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    // Leaf scars in a spiral, the way they are left after cutting back.
    const scarGeom = new THREE.SphereGeometry(1, 8, 6);
    this.disposables.push(scarGeom);
    const scarMat = new THREE.MeshStandardMaterial({ color: 0x4a3b28, roughness: 0.86, metalness: 0 });
    this.disposables.push(scarMat);
    let phyllo = rng.range(0, TAU);
    for (const n of nodeAt) {
      for (let k = 0; k < 2; k++) {
        phyllo += 2.399; // golden angle
        const t = n + k * 0.012;
        axis(t, p);
        const r = radiusAt(t);
        const scar = new THREE.Mesh(scarGeom, scarMat);
        scar.position.set(p.x + Math.cos(phyllo) * r * 0.92, p.y, p.z + Math.sin(phyllo) * r * 0.92);
        scar.scale.set(r * 0.26, r * 0.17, r * 0.26);
        scar.rotation.y = -phyllo;
        scar.castShadow = false;
        this.group.add(scar);
      }
    }

    // Machete face on top.
    axis(1, this.topPoint);
    const topR = radiusAt(1);
    const faceGeom = new THREE.CircleGeometry(topR * 1.02, 20);
    this.disposables.push(faceGeom);
    const faceMat = new THREE.MeshStandardMaterial({
      map: face,
      roughness: 0.74,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    this.disposables.push(faceMat);
    this.cutFace = new THREE.Mesh(faceGeom, faceMat);
    this.cutFace.position.copy(this.topPoint);
    // Cassava is cut with a slanted stroke.
    this.cutFace.rotation.set(-Math.PI / 2 + 0.18, 0, params.tiltAzimuth);
    this.cutFace.position.y += 0.001;
    this.cutFace.castShadow = false;
    this.group.add(this.cutFace);

    // The clamp always bites at the same real height above the soil,
    // whatever this stem's stub length is, so the chain geometry is constant.
    axis(clamp01((0.052 - bottom) / total), this.gripPoint);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.group.removeFromParent();
  }
}
