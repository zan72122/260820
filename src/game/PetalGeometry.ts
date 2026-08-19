import * as THREE from 'three';

/**
 * A petal is a ribbon with real wall thickness: two shells offset along the
 * sheet normal plus a rim strip, so the silhouette, the shaved edge and the
 * overlap between petals all read in 3D.
 *
 * Topology is fixed at construction and only the attribute data is rewritten,
 * which lets the petal grow live under the finger without any allocation.
 */
export interface PetalSpec {
  /** Base curve in flower-nail local space, NU points, ordered along the stroke. */
  base: Float32Array;
  /** Petal height above the base curve at each point. */
  rise: Float32Array;
  /** Root wall thickness at each point. */
  thick: Float32Array;
  /** Outward opening at the top edge at each point. */
  curl: Float32Array;
  /** Outward tilt already applied at the root. */
  lean: Float32Array;
  /** How far the petal ends wrap back towards the flower axis. */
  cup: number;
  /** How deep the root sinks into the cone, so no gap shows. */
  embed: number;
  /** Edge ripple amplitude. */
  waviness: number;
  seed: number;
  /** False while the finger is still down: the far end stays open. */
  finished: boolean;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _du = new THREE.Vector3();
const _dv = new THREE.Vector3();
const _n = new THREE.Vector3();

export class PetalGeometry {
  readonly geometry = new THREE.BufferGeometry();
  readonly nu: number;
  readonly nv: number;
  private pos: Float32Array;
  private nor: Float32Array;
  private uv: Float32Array;
  private thin: Float32Array;
  private perimeter: number;
  private surface: Float32Array;
  private snorm: Float32Array;

  constructor(nu = 30, nv = 10) {
    this.nu = nu;
    this.nv = nv;
    this.perimeter = 2 * nu + 2 * nv - 4;
    const vertCount = 2 * nu * nv + 2 * this.perimeter;
    this.pos = new Float32Array(vertCount * 3);
    this.nor = new Float32Array(vertCount * 3);
    this.uv = new Float32Array(vertCount * 2);
    this.thin = new Float32Array(vertCount);
    this.surface = new Float32Array(nu * nv * 3);
    this.snorm = new Float32Array(nu * nv * 3);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    this.geometry.setAttribute('aThin', new THREE.BufferAttribute(this.thin, 1));
    this.geometry.setIndex(new THREE.BufferAttribute(this.buildIndex(), 1));
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0.1);
  }

  private boundaryIndex(k: number): [number, number] {
    const { nu, nv } = this;
    if (k < nu) return [k, 0];
    k -= nu;
    if (k < nv - 1) return [nu - 1, k + 1];
    k -= nv - 1;
    if (k < nu - 1) return [nu - 2 - k, nv - 1];
    k -= nu - 1;
    return [0, nv - 2 - k];
  }

  private buildIndex(): Uint16Array {
    const { nu, nv, perimeter } = this;
    const quads = (nu - 1) * (nv - 1);
    const idx = new Uint16Array(quads * 12 + perimeter * 6);
    let o = 0;
    const back = nu * nv;
    for (let j = 0; j < nv - 1; j++) {
      for (let i = 0; i < nu - 1; i++) {
        const a = j * nu + i;
        const b = j * nu + i + 1;
        const c = (j + 1) * nu + i + 1;
        const d = (j + 1) * nu + i;
        idx[o++] = a; idx[o++] = b; idx[o++] = c;
        idx[o++] = a; idx[o++] = c; idx[o++] = d;
        idx[o++] = back + a; idx[o++] = back + c; idx[o++] = back + b;
        idx[o++] = back + a; idx[o++] = back + d; idx[o++] = back + c;
      }
    }
    const rim = 2 * nu * nv;
    for (let k = 0; k < perimeter; k++) {
      const k2 = (k + 1) % perimeter;
      const fa = rim + k;
      const fb = rim + k2;
      const ba = rim + perimeter + k;
      const bb = rim + perimeter + k2;
      idx[o++] = fa; idx[o++] = ba; idx[o++] = bb;
      idx[o++] = fa; idx[o++] = bb; idx[o++] = fb;
    }
    return idx;
  }

  update(spec: PetalSpec) {
    const { nu, nv, surface, snorm } = this;
    const inv = 1 / (nv - 1);

    // 1. mid-surface: base curve + vertical rise + outward curl.
    for (let i = 0; i < nu; i++) {
      const bx = spec.base[i * 3];
      const by = spec.base[i * 3 + 1];
      const bz = spec.base[i * 3 + 2];
      let rx = bx;
      let rz = bz;
      const rl = Math.hypot(rx, rz) || 1;
      rx /= rl;
      rz /= rl;
      const rise = spec.rise[i];
      const curl = spec.curl[i];
      const lean = spec.lean[i];
      const u = i / (nu - 1);
      // the two ends of a piped petal wrap in around the core
      const wrap = -spec.cup * (1 - Math.sin(Math.PI * u));
      for (let j = 0; j < nv; j++) {
        const v = j * inv;
        const ev = v * v * (3 - 2 * v) * 0.35 + v * 0.65; // gentle S so the root sits upright
        const out = lean * ev + curl * ev * ev + wrap * (0.35 + 0.65 * ev) - spec.embed * (1 - ev) * (1 - ev);
        const o = (j * nu + i) * 3;
        surface[o] = bx + rx * out;
        surface[o + 1] = by + rise * ev;
        surface[o + 2] = bz + rz * out;
      }
    }

    // 2. sheet normals from finite differences on that surface.
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const o = (j * nu + i) * 3;
        const iu0 = (j * nu + Math.max(0, i - 1)) * 3;
        const iu1 = (j * nu + Math.min(nu - 1, i + 1)) * 3;
        const iv0 = (Math.max(0, j - 1) * nu + i) * 3;
        const iv1 = (Math.min(nv - 1, j + 1) * nu + i) * 3;
        _du.set(surface[iu1] - surface[iu0], surface[iu1 + 1] - surface[iu0 + 1], surface[iu1 + 2] - surface[iu0 + 2]);
        _dv.set(surface[iv1] - surface[iv0], surface[iv1 + 1] - surface[iv0 + 1], surface[iv1 + 2] - surface[iv0 + 2]);
        _n.crossVectors(_du, _dv);
        if (_n.lengthSq() < 1e-14) _n.set(surface[o], 0, surface[o + 2]);
        _n.normalize();
        snorm[o] = _n.x;
        snorm[o + 1] = _n.y;
        snorm[o + 2] = _n.z;
      }
    }

    // 3. shells: thick at the root, feathered at the edge, with tip striations.
    const back = nu * nv;
    for (let j = 0; j < nv; j++) {
      const v = j * inv;
      const vThin = Math.pow(v, 0.8);
      for (let i = 0; i < nu; i++) {
        const u = i / (nu - 1);
        const g = (j * nu + i) * 3;
        const endTaper = spec.finished
          ? Math.min(1, Math.sin(Math.PI * Math.min(1, Math.max(0, u))) * 1.9)
          : Math.min(1, Math.min(u * 9, 1) * 1.0);
        const ridge = 1 + 0.03 * Math.sin(v * Math.PI * 7.5 + spec.seed);
        const half =
          0.5 *
          Math.max(0.00004, spec.thick[i] * (1 - v) * (1 - v * 0.45) * endTaper * ridge);
        const nx = snorm[g];
        const ny = snorm[g + 1];
        const nz = snorm[g + 2];
        const fi = (j * nu + i) * 3;
        const bi = (back + j * nu + i) * 3;
        this.pos[fi] = surface[g] + nx * half;
        this.pos[fi + 1] = surface[g + 1] + ny * half;
        this.pos[fi + 2] = surface[g + 2] + nz * half;
        this.pos[bi] = surface[g] - nx * half;
        this.pos[bi + 1] = surface[g + 1] - ny * half;
        this.pos[bi + 2] = surface[g + 2] - nz * half;
        this.nor[fi] = nx; this.nor[fi + 1] = ny; this.nor[fi + 2] = nz;
        this.nor[bi] = -nx; this.nor[bi + 1] = -ny; this.nor[bi + 2] = -nz;
        const t2 = j * nu + i;
        this.uv[t2 * 2] = u;
        this.uv[t2 * 2 + 1] = v;
        this.uv[(back + t2) * 2] = u;
        this.uv[(back + t2) * 2 + 1] = v;
        const thinness = Math.min(1, vThin * 0.85 + (1 - endTaper) * 0.6);
        this.thin[j * nu + i] = thinness;
        this.thin[back + j * nu + i] = thinness;
      }
    }

    // 4. rim strip, welded from duplicated boundary vertices so the edge stays crisp.
    const rim = 2 * nu * nv;
    const P = this.perimeter;
    for (let k = 0; k < P; k++) {
      const [i, j] = this.boundaryIndex(k);
      const fi = (j * nu + i) * 3;
      const bi = (back + j * nu + i) * 3;
      const rf = (rim + k) * 3;
      const rb = (rim + P + k) * 3;
      this.pos[rf] = this.pos[fi];
      this.pos[rf + 1] = this.pos[fi + 1];
      this.pos[rf + 2] = this.pos[fi + 2];
      this.pos[rb] = this.pos[bi];
      this.pos[rb + 1] = this.pos[bi + 1];
      this.pos[rb + 2] = this.pos[bi + 2];
      // rim normal: away from the mid surface, in the sheet plane
      const g = (j * nu + i) * 3;
      _a.set(this.pos[rf] - surface[g], this.pos[rf + 1] - surface[g + 1], this.pos[rf + 2] - surface[g + 2]);
      _b.set(snorm[g], snorm[g + 1], snorm[g + 2]);
      _a.addScaledVector(_b, -_a.dot(_b));
      const [i2, j2] = this.boundaryIndex((k + 1) % P);
      _du.set(
        surface[(j2 * nu + i2) * 3] - surface[g],
        surface[(j2 * nu + i2) * 3 + 1] - surface[g + 1],
        surface[(j2 * nu + i2) * 3 + 2] - surface[g + 2],
      );
      _n.crossVectors(_b, _du);
      if (_n.lengthSq() < 1e-14) _n.copy(_b);
      _n.normalize();
      this.nor[rf] = _n.x; this.nor[rf + 1] = _n.y; this.nor[rf + 2] = _n.z;
      this.nor[rb] = _n.x; this.nor[rb + 1] = _n.y; this.nor[rb + 2] = _n.z;
      const uu = k / P;
      this.uv[(rim + k) * 2] = uu;
      this.uv[(rim + k) * 2 + 1] = 0;
      this.uv[(rim + P + k) * 2] = uu;
      this.uv[(rim + P + k) * 2 + 1] = 1;
      this.thin[rim + k] = 1;
      this.thin[rim + P + k] = 1;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
    this.geometry.attributes.uv.needsUpdate = true;
    this.geometry.attributes.aThin.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }

  /** Snapshot the current shape as a standalone geometry ready to be merged. */
  bake(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.slice(), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor.slice(), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv.slice(), 2));
    g.setAttribute('aThin', new THREE.BufferAttribute(this.thin.slice(), 1));
    const src = this.geometry.getIndex()!;
    g.setIndex(new THREE.BufferAttribute((src.array as Uint16Array).slice(), 1));
    g.computeBoundingSphere();
    return g;
  }

  dispose() {
    this.geometry.dispose();
  }
}
