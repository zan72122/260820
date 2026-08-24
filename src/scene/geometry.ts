import * as THREE from 'three';

export interface LimbHole {
  u0: number;
  u1: number;
  /** Half-angle of the aperture, radians, centred on the anterior surface. */
  halfAngle: number;
}

export interface LimbOptions {
  x0: number;
  x1: number;
  segsX: number;
  segsR: number;
  /** Radius at normalised position along the limb. */
  profile: (u: number) => number;
  /** Flattening of the cross-section in Z; limbs are not round tubes. */
  squashZ?: number;
  centreY: number;
  centreZ: number;
  hole?: LimbHole;
}

export interface LimbMesh {
  geometry: THREE.BufferGeometry;
  /** Untouched positions, so per-frame deformation never accumulates drift. */
  base: Float32Array;
  /** Grid coordinates per vertex: u along the limb, angle around it. */
  us: Float32Array;
  angles: Float32Array;
}

/**
 * A limb as a parametric tube. Built by hand rather than with TubeGeometry so
 * that an aperture can be left in the shell (the training module's inspection
 * slot) and so the vertices stay addressable for the soft-tissue squash under
 * the cuff and under the chestpiece.
 */
export const buildLimb = (o: LimbOptions): LimbMesh => {
  const { x0, x1, segsX, segsR, profile, centreY, centreZ } = o;
  const squashZ = o.squashZ ?? 1;
  const vCount = (segsX + 1) * (segsR + 1);
  const pos = new Float32Array(vCount * 3);
  const nrm = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const us = new Float32Array(vCount);
  const angles = new Float32Array(vCount);

  for (let i = 0; i <= segsX; i++) {
    const u = i / segsX;
    const x = x0 + (x1 - x0) * u;
    const r = profile(u);
    for (let j = 0; j <= segsR; j++) {
      const a = (j / segsR) * Math.PI * 2 - Math.PI; // 0 = anterior (+Y)
      const idx = i * (segsR + 1) + j;
      const cy = Math.cos(a);
      const sz = Math.sin(a);
      pos[idx * 3] = x;
      pos[idx * 3 + 1] = centreY + r * cy;
      pos[idx * 3 + 2] = centreZ + r * sz * squashZ;
      nrm[idx * 3] = 0;
      nrm[idx * 3 + 1] = cy;
      nrm[idx * 3 + 2] = sz;
      uv[idx * 2] = u * 3.2;
      uv[idx * 2 + 1] = j / segsR;
      us[idx] = u;
      angles[idx] = a;
    }
  }

  const indices: number[] = [];
  const inHole = (u: number, a: number): boolean => {
    if (!o.hole) return false;
    return u >= o.hole.u0 && u <= o.hole.u1 && Math.abs(a) <= o.hole.halfAngle;
  };

  for (let i = 0; i < segsX; i++) {
    for (let j = 0; j < segsR; j++) {
      const u = (i + 0.5) / segsX;
      const a = ((j + 0.5) / segsR) * Math.PI * 2 - Math.PI;
      if (inHole(u, a)) continue;
      const a0 = i * (segsR + 1) + j;
      const b0 = a0 + 1;
      const c0 = a0 + segsR + 1;
      const d0 = c0 + 1;
      indices.push(a0, b0, c0, b0, d0, c0);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return { geometry, base: pos.slice(), us, angles };
};

/** Just the aperture patch, as its own sheet, so it can fade to clear. */
export const buildLimbPatch = (o: LimbOptions & { hole: LimbHole }, lift: number): THREE.BufferGeometry => {
  const { x0, x1, profile, centreY, centreZ, hole } = o;
  const squashZ = o.squashZ ?? 1;
  const nu = 14;
  const nv = 14;
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3);
  const uv = new Float32Array((nu + 1) * (nv + 1) * 2);
  for (let i = 0; i <= nu; i++) {
    const u = hole.u0 + (hole.u1 - hole.u0) * (i / nu);
    const x = x0 + (x1 - x0) * u;
    const r = profile(u) + lift;
    for (let j = 0; j <= nv; j++) {
      const a = -hole.halfAngle + (hole.halfAngle * 2 * j) / nv;
      const idx = i * (nv + 1) + j;
      pos[idx * 3] = x;
      pos[idx * 3 + 1] = centreY + r * Math.cos(a);
      pos[idx * 3 + 2] = centreZ + r * Math.sin(a) * squashZ;
      uv[idx * 2] = i / nu;
      uv[idx * 2 + 1] = j / nv;
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a0 = i * (nv + 1) + j;
      const b0 = a0 + 1;
      const c0 = a0 + nv + 1;
      const d0 = c0 + 1;
      indices.push(a0, b0, c0, b0, d0, c0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
};
