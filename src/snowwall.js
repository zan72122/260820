import * as THREE from 'three';
import { materials } from './materials.js';
import { ROAD } from './world.js';

/* ------------------------------------------------------------------
   The packed snow wall along the kerb.  It is a strip of short segments;
   the auger knocks each one down as it passes, so the bank visibly
   shrinks exactly where the machine has been.
------------------------------------------------------------------- */

const SEG = 0.6;              // segment length along Z
const COUNT = 300;            // 180 m of wall in the pool
const FULL_H = 2.05;

export class SnowWall {
  constructor(scene) {
    const M = materials();

    // main body: a slightly tapered block, origin at its base
    const body = new THREE.BoxGeometry(1, 1, SEG * 1.35);
    body.translate(0, 0.5, 0);
    // pull the road-facing top edge in so the bank has a plowed slope
    {
      const p = body.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i), x = p.getX(i);
        if (y > 0.9) p.setX(i, x * 0.55 - 0.16);
        else if (y < 0.1) p.setX(i, x * 1.05);
      }
      body.computeVertexNormals();
    }
    this.mesh = new THREE.InstancedMesh(body, M.packedSnow, COUNT);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    // lumpy crown so the top does not read as a row of boxes
    const cap = new THREE.IcosahedronGeometry(0.5, 1);
    {
      const p = cap.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const n = Math.sin(v.x * 5.1) * Math.cos(v.z * 4.3) * Math.sin(v.y * 3.7);
        v.multiplyScalar(1 + n * 0.22);
        p.setXYZ(i, v.x, v.y, v.z);
      }
      cap.computeVertexNormals();
    }
    this.caps = new THREE.InstancedMesh(cap, M.snowPile, COUNT);
    this.caps.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.caps.castShadow = true;
    this.caps.frustumCulled = false;
    scene.add(this.caps);

    this.segs = [];
    for (let i = 0; i < COUNT; i++) {
      this.segs.push({ z: 0, h: 1, target: 1, idx: -1, w: 1, jx: 0 });
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this.baseIdx = -99999;
    this.eaten = 0;      // m^3-ish of snow consumed since last read
    this.cutoffZ = Infinity;   // no wall past here (gap toward the dump site)
  }

  _reseed(seg, idx) {
    seg.idx = idx;
    seg.z = idx * SEG;
    if (seg.z > this.cutoffZ) {
      seg.h = 0; seg.target = 0;
      seg.w = ROAD.wallHalf * 2; seg.jx = 0;
      return;
    }
    const n = Math.sin(idx * 0.7) * 0.5 + Math.sin(idx * 0.23) * 0.5;
    seg.h = FULL_H * (0.82 + 0.18 * (n * 0.5 + 0.5)) + (idx % 7) * 0.012;
    seg.target = seg.h;
    seg.w = ROAD.wallHalf * 2 * (0.92 + 0.12 * Math.abs(Math.sin(idx * 1.31)));
    seg.jx = Math.sin(idx * 2.17) * 0.1;
  }

  /** Stop the bank at `z` so there is a clear run-up to the dump site. */
  clearFrom(z) {
    this.cutoffZ = z;
    for (const s of this.segs) {
      if (s.z > z) { s.target = 0; s.h = 0; }
    }
  }

  /** Lay down a fresh bank ahead of the machine (used between rounds). */
  refill(fromZ) {
    this.cutoffZ = Infinity;
    const base = Math.floor(fromZ / SEG);
    for (let i = 0; i < COUNT; i++) {
      const s = this.segs[i];
      if (s.idx >= base) { s.h = 0; this._reseed(s, s.idx); s.h = s.target; }
    }
  }

  /** How much wall is left in the next `len` metres. */
  remainingAhead(z, len) {
    let sum = 0, n = 0;
    for (const s of this.segs) {
      if (s.z > z && s.z < z + len) { sum += s.h; n++; }
    }
    return n ? sum / (n * FULL_H) : 0;
  }

  update(dt, focusZ, cutZ, cutting) {
    // Recycle as a ring buffer: slot i always holds the segment whose index
    // is congruent to i mod COUNT, so only the slots that actually scroll off
    // the back get a fresh bank.  (Re-seeding the whole pool every 0.6 m would
    // silently regrow the wall the player just ate.)
    const base = Math.floor((focusZ - 40) / SEG);
    if (base !== this.baseIdx) {
      this.baseIdx = base;
      const off = ((base % COUNT) + COUNT) % COUNT;
      for (let i = 0; i < COUNT; i++) {
        const idx = base + ((i - off) + COUNT) % COUNT;
        const s = this.segs[i];
        if (s.idx !== idx) this._reseed(s, idx);
      }
    }

    this.eaten = 0;
    const wallX = ROAD.wallX;
    let visible = 0, capN = 0;

    for (let i = 0; i < COUNT; i++) {
      const s = this.segs[i];
      // the auger mouth eats everything it reaches
      if (cutting && s.z < cutZ && s.z > cutZ - 3.5 && s.target > 0.001) {
        s.target = 0;
      }
      if (s.h > s.target) {
        const d = Math.min(s.h - s.target, dt * 7.5);
        s.h -= d;
        this.eaten += d * s.w * SEG;
        if (s.h < 0.02) s.h = 0;
      }
      if (s.h <= 0.005) continue;

      this._v.set(wallX + s.jx, 0.05, s.z);
      this._s.set(s.w, s.h, 1);
      this._q.identity();
      this._m.compose(this._v, this._q, this._s);
      this.mesh.setMatrixAt(visible, this._m);
      visible++;

      if (i % 2 === 0) {
        const cw = s.w * 0.56;
        this._v.set(wallX + s.jx - 0.14 + Math.sin(s.idx * 3.3) * 0.14, 0.05 + s.h * 0.9, s.z);
        this._s.set(cw, Math.min(0.34, s.h * 0.3), cw * 1.35);
        this._q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.idx * 0.9);
        this._m.compose(this._v, this._q, this._s);
        this.caps.setMatrixAt(capN, this._m);
        capN++;
      }
    }
    this.mesh.count = visible;
    this.caps.count = capN;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.caps.instanceMatrix.needsUpdate = true;
  }

  /** Height of the wall at a given z (for placing dust puffs). */
  heightAt(z) {
    const idx = Math.floor(z / SEG);
    for (const s of this.segs) if (s.idx === idx) return s.h;
    return 0;
  }
}

export { SEG, FULL_H };
