import * as THREE from 'three';
import { hoseTexture } from '../util/textures';

export interface HoseOptions {
  points: number;
  radius: number;
  tubular: number;
  radial: number;
  ribs: number;
  slackA: number;
  slackB: number;
  color?: number;
  gravity?: number;
}

/**
 * A heavy reinforced suction hose: a verlet chain with distance + bending
 * constraints so it sags under its own weight, drags on the ground and can
 * never fold to a sharp angle.
 */
export class Hose {
  readonly group = new THREE.Group();
  private pts: THREE.Vector3[] = [];
  private prev: THREE.Vector3[] = [];
  private restA = 0.1;
  private restB = 0.1;
  private guide: number;
  private opts: HoseOptions;

  private curve: THREE.CatmullRomCurve3;
  private tube: THREE.Mesh;
  private tubeGeo: THREE.BufferGeometry;
  private ribs: THREE.InstancedMesh;
  private samples: THREE.Vector3[] = [];
  private tangents: THREE.Vector3[] = [];
  private normals: THREE.Vector3[] = [];
  private binormals: THREE.Vector3[] = [];
  private groundY: (x: number, z: number) => number = () => 0;
  /** Rough measure of how much the hose is being dragged; drives scuff audio. */
  scuff = 0;

  constructor(opts: HoseOptions) {
    this.opts = opts;
    this.guide = Math.floor(opts.points * 0.38);
    for (let i = 0; i < opts.points; i++) {
      const p = new THREE.Vector3(0, 0.4, i * 0.1);
      this.pts.push(p);
      this.prev.push(p.clone());
    }
    this.curve = new THREE.CatmullRomCurve3(this.pts, false, 'catmullrom', 0.5);

    for (let i = 0; i <= opts.tubular; i++) {
      this.samples.push(new THREE.Vector3());
      this.tangents.push(new THREE.Vector3());
      this.normals.push(new THREE.Vector3());
      this.binormals.push(new THREE.Vector3());
    }

    this.tubeGeo = buildTubeShell(opts.tubular, opts.radial);
    const tex = hoseTexture(256);
    tex.repeat.set(1, 26);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      color: opts.color ?? 0xffffff,
      roughness: 0.78,
      metalness: 0.08,
    });
    this.tube = new THREE.Mesh(this.tubeGeo, mat);
    this.tube.castShadow = true;
    this.tube.frustumCulled = false;
    this.group.add(this.tube);

    const ribGeo = new THREE.TorusGeometry(opts.radius * 1.02, opts.radius * 0.19, 4, 10);
    const ribMat = new THREE.MeshStandardMaterial({
      color: 0x1b1d21,
      roughness: 0.62,
      metalness: 0.22,
    });
    this.ribs = new THREE.InstancedMesh(ribGeo, ribMat, opts.ribs);
    this.ribs.castShadow = true;
    this.ribs.frustumCulled = false;
    this.group.add(this.ribs);
  }

  setGroundFn(fn: (x: number, z: number) => number) {
    this.groundY = fn;
  }

  setVisible(v: boolean) {
    this.group.visible = v;
  }

  /** Drop the whole chain onto the straight line between the anchors. */
  reset(a: THREE.Vector3, guide: THREE.Vector3, b: THREE.Vector3) {
    const n = this.pts.length;
    for (let i = 0; i < n; i++) {
      let p: THREE.Vector3;
      if (i <= this.guide) {
        p = a.clone().lerp(guide, i / this.guide);
      } else {
        p = guide.clone().lerp(b, (i - this.guide) / (n - 1 - this.guide));
      }
      this.pts[i].copy(p);
      this.prev[i].copy(p);
    }
  }

  update(dt: number, a: THREE.Vector3, guide: THREE.Vector3, b: THREE.Vector3) {
    const n = this.pts.length;
    const g = this.opts.gravity ?? 8.2;
    const h = Math.min(dt, 1 / 30);
    const damping = 0.86;
    const minSeg = this.opts.radius * 0.5;
    this.restA = Math.max(minSeg, (a.distanceTo(guide) * this.opts.slackA) / Math.max(1, this.guide));
    this.restB = Math.max(minSeg, (guide.distanceTo(b) * this.opts.slackB) / Math.max(1, n - 1 - this.guide));
    this.scuff = 0;

    // verlet integrate
    for (let i = 1; i < n - 1; i++) {
      if (i === this.guide) continue;
      const p = this.pts[i];
      const pr = this.prev[i];
      const vx = (p.x - pr.x) * damping;
      const vy = (p.y - pr.y) * damping;
      const vz = (p.z - pr.z) * damping;
      pr.copy(p);
      p.x += vx;
      p.y += vy - g * h * h;
      p.z += vz;
    }

    this.pts[0].copy(a);
    this.prev[0].copy(a);
    this.pts[this.guide].copy(guide);
    this.prev[this.guide].copy(guide);
    this.pts[n - 1].copy(b);
    this.prev[n - 1].copy(b);

    const iterations = 10;
    for (let k = 0; k < iterations; k++) {
      this.solveDistance();
      this.solveBend();
      this.pts[0].copy(a);
      this.pts[this.guide].copy(guide);
      this.pts[n - 1].copy(b);
    }
    this.collide();
    this.rebuild();
  }

  private solveDistance() {
    const n = this.pts.length;
    for (let i = 0; i < n - 1; i++) {
      const rest = i < this.guide ? this.restA : this.restB;
      const p = this.pts[i];
      const q = this.pts[i + 1];
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const dz = q.z - p.z;
      const d = Math.hypot(dx, dy, dz) || 1e-6;
      const diff = (d - rest) / d;
      const wa = i === 0 || i === this.guide ? 0 : 0.5;
      const wb = i + 1 === n - 1 || i + 1 === this.guide ? 0 : 0.5;
      const total = wa + wb;
      if (total === 0) continue;
      const sa = (wa / total) * diff;
      const sb = (wb / total) * diff;
      p.x += dx * sa;
      p.y += dy * sa;
      p.z += dz * sa;
      q.x -= dx * sb;
      q.y -= dy * sb;
      q.z -= dz * sb;
    }
  }

  /** Minimum bend radius: a thick-walled hose refuses to kink. */
  private solveBend() {
    const n = this.pts.length;
    const minCos = -0.55; // ~123 deg between segments is as tight as it gets
    for (let i = 1; i < n - 1; i++) {
      const a = this.pts[i - 1];
      const b = this.pts[i];
      const c = this.pts[i + 1];
      const ax = a.x - b.x;
      const ay = a.y - b.y;
      const az = a.z - b.z;
      const cx = c.x - b.x;
      const cy = c.y - b.y;
      const cz = c.z - b.z;
      const la = Math.hypot(ax, ay, az) || 1e-6;
      const lc = Math.hypot(cx, cy, cz) || 1e-6;
      const cos = (ax * cx + ay * cy + az * cz) / (la * lc);
      if (cos > minCos) {
        // push the middle point out along the bisector to open the angle
        const bx = ax / la + cx / lc;
        const by = ay / la + cy / lc;
        const bz = az / la + cz / lc;
        const lb = Math.hypot(bx, by, bz) || 1e-6;
        const push = (cos - minCos) * 0.22 * ((la + lc) * 0.5);
        if (i !== this.guide) {
          b.x -= (bx / lb) * push;
          b.y -= (by / lb) * push;
          b.z -= (bz / lb) * push;
        }
      }
    }
  }

  private collide() {
    const r = this.opts.radius;
    for (let i = 1; i < this.pts.length - 1; i++) {
      if (i === this.guide) continue;
      const p = this.pts[i];
      const gy = this.groundY(p.x, p.z) + r;
      if (p.y < gy) {
        p.y = gy;
        // ground friction: the hose scrubs rather than slides freely
        const pr = this.prev[i];
        const dx = p.x - pr.x;
        const dz = p.z - pr.z;
        this.scuff += Math.hypot(dx, dz);
        pr.x = p.x - dx * 0.28;
        pr.z = p.z - dz * 0.28;
        pr.y = p.y;
      }
    }
  }

  private up = new THREE.Vector3(0, 1, 0);
  private q = new THREE.Quaternion();
  private mtx = new THREE.Matrix4();
  private scaleV = new THREE.Vector3(1, 1, 1);

  private rebuild() {
    const T = this.opts.tubular;
    for (let i = 0; i <= T; i++) this.curve.getPoint(i / T, this.samples[i]);

    for (let i = 0; i <= T; i++) {
      const a = this.samples[Math.max(0, i - 1)];
      const b = this.samples[Math.min(T, i + 1)];
      this.tangents[i].subVectors(b, a).normalize();
      if (this.tangents[i].lengthSq() < 1e-8) this.tangents[i].set(0, 0, 1);
    }
    // parallel transport frames avoid twisting artefacts along the run
    this.normals[0].set(0, 1, 0);
    if (Math.abs(this.normals[0].dot(this.tangents[0])) > 0.9) this.normals[0].set(1, 0, 0);
    this.normals[0].cross(this.tangents[0]).normalize();
    this.binormals[0].crossVectors(this.tangents[0], this.normals[0]).normalize();
    for (let i = 1; i <= T; i++) {
      this.normals[i].copy(this.normals[i - 1]);
      const dot = this.normals[i].dot(this.tangents[i]);
      this.normals[i].addScaledVector(this.tangents[i], -dot).normalize();
      this.binormals[i].crossVectors(this.tangents[i], this.normals[i]).normalize();
    }

    const R = this.opts.radial;
    const r = this.opts.radius;
    const pos = this.tubeGeo.getAttribute('position') as THREE.BufferAttribute;
    const nor = this.tubeGeo.getAttribute('normal') as THREE.BufferAttribute;
    const pa = pos.array as Float32Array;
    const na = nor.array as Float32Array;
    let k = 0;
    for (let i = 0; i <= T; i++) {
      const c = this.samples[i];
      const nrm = this.normals[i];
      const bin = this.binormals[i];
      for (let j = 0; j <= R; j++) {
        const ang = (j / R) * Math.PI * 2;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const nx = nrm.x * ca + bin.x * sa;
        const ny = nrm.y * ca + bin.y * sa;
        const nz = nrm.z * ca + bin.z * sa;
        pa[k] = c.x + nx * r;
        pa[k + 1] = c.y + ny * r;
        pa[k + 2] = c.z + nz * r;
        na[k] = nx;
        na[k + 1] = ny;
        na[k + 2] = nz;
        k += 3;
      }
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
    this.tubeGeo.boundingSphere = null;

    const ribCount = this.opts.ribs;
    for (let i = 0; i < ribCount; i++) {
      const t = Math.floor(((i + 0.5) / ribCount) * T);
      this.q.setFromUnitVectors(this.up, this.tangents[t]);
      // torus lies in XY; rotate its Z axis onto the tangent
      this.q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.tangents[t]);
      this.mtx.compose(this.samples[t], this.q, this.scaleV);
      this.ribs.setMatrixAt(i, this.mtx);
    }
    this.ribs.instanceMatrix.needsUpdate = true;
    this.ribs.computeBoundingSphere();
  }

  /** Point on the hose nearest the nozzle end; used to align the cuff. */
  endTangent(out: THREE.Vector3) {
    out.copy(this.tangents[this.opts.tubular]);
    return out;
  }
}

function buildTubeShell(tubular: number, radial: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const vCount = (tubular + 1) * (radial + 1);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vCount * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vCount * 3), 3));
  const uv = new Float32Array(vCount * 2);
  let u = 0;
  for (let i = 0; i <= tubular; i++) {
    for (let j = 0; j <= radial; j++) {
      uv[u++] = j / radial;
      uv[u++] = i / tubular;
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx: number[] = [];
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  geo.setIndex(idx);
  return geo;
}
