import * as THREE from 'three';
import { fbm, makeValueNoise } from '../util/noise';
import { makeRng } from '../util/math';

export interface BambooOpts {
  zTail: number;
  zMouth: number;
  rOuter: number;
  wall: number;
  zSeptum: number;
  nodes: number[];
  cutDepth: number;
  radial?: number;
  axial?: number;
}

/**
 * 竹稈。節のふくらみ、肉厚、口の斜め切断、内部の空洞、末端の節を持つ。
 * 局所座標：軸は +Z、口が +Z 側、末端（石に当たる側）が -Z 側。φ=0 が +Y（上）。
 */
export function bambooTubeGeometry(o: BambooOpts): THREE.BufferGeometry {
  const radial = o.radial ?? 28;
  const axial = o.axial ?? 56;
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];

  const zEndAt = (phi: number): number => o.zMouth - (o.cutDepth * (1 + Math.cos(phi))) / 2;
  const radiusAt = (z: number, base: number): number => {
    let r = base * (1 - 0.055 * ((z - o.zTail) / (o.zMouth - o.zTail)));
    for (const nz of o.nodes) {
      const d = (z - nz) / 0.013;
      r += base * 0.052 * Math.exp(-d * d);
    }
    return r;
  };

  const pushSurface = (base: number, flip: boolean, zStart: (phi: number) => number): number => {
    const start = pos.length / 3;
    for (let a = 0; a <= axial; a++) {
      const t = a / axial;
      for (let i = 0; i <= radial; i++) {
        const phi = (i / radial) * Math.PI * 2;
        const z0 = zStart(phi);
        const z1 = zEndAt(phi);
        const z = z0 + (z1 - z0) * t;
        const r = radiusAt(z, base);
        const x = r * Math.sin(phi);
        const y = r * Math.cos(phi);
        pos.push(x, y, z);
        const s = flip ? -1 : 1;
        nrm.push(s * Math.sin(phi), s * Math.cos(phi), 0);
        uv.push(i / radial, (z - o.zTail) / (o.zMouth - o.zTail));
      }
    }
    const row = radial + 1;
    for (let a = 0; a < axial; a++) {
      for (let i = 0; i < radial; i++) {
        const p0 = start + a * row + i;
        const p1 = p0 + 1;
        const p2 = p0 + row;
        const p3 = p2 + 1;
        if (flip) idx.push(p0, p1, p2, p1, p3, p2);
        else idx.push(p0, p2, p1, p1, p2, p3);
      }
    }
    return start;
  };

  // 外面
  pushSurface(o.rOuter, false, () => o.zTail);
  // 内面（水がたまる区間だけ）
  const innerStart = pushSurface(o.rOuter - o.wall, true, () => o.zSeptum);

  // 切断面の縁（肉厚が見える）
  {
    const start = pos.length / 3;
    for (let i = 0; i <= radial; i++) {
      const phi = (i / radial) * Math.PI * 2;
      const z = zEndAt(phi);
      const ro = radiusAt(z, o.rOuter);
      const ri = radiusAt(z, o.rOuter - o.wall);
      // 斜め切断面の法線
      const slope = (o.cutDepth * Math.sin(phi)) / 2;
      const n = new THREE.Vector3(Math.sin(phi) * slope * 0.4, Math.cos(phi) * slope * 0.4, 1).normalize();
      pos.push(ro * Math.sin(phi), ro * Math.cos(phi), z);
      nrm.push(n.x, n.y, n.z);
      uv.push(i / radial, 0.985);
      pos.push(ri * Math.sin(phi), ri * Math.cos(phi), z);
      nrm.push(n.x, n.y, n.z);
      uv.push(i / radial, 0.955);
    }
    for (let i = 0; i < radial; i++) {
      const p0 = start + i * 2;
      idx.push(p0, p0 + 1, p0 + 2, p0 + 1, p0 + 3, p0 + 2);
    }
  }

  // 節（隔壁）— 水が止まる面
  {
    const start = pos.length / 3;
    const r = radiusAt(o.zSeptum, o.rOuter - o.wall);
    pos.push(0, 0, o.zSeptum);
    nrm.push(0, 0, 1);
    uv.push(0.5, 0.5);
    for (let i = 0; i <= radial; i++) {
      const phi = (i / radial) * Math.PI * 2;
      pos.push(r * Math.sin(phi), r * Math.cos(phi), o.zSeptum);
      nrm.push(0, 0, 1);
      uv.push(0.5 + 0.35 * Math.sin(phi), 0.5 + 0.35 * Math.cos(phi));
    }
    for (let i = 0; i < radial; i++) idx.push(start, start + i + 1, start + i + 2);
  }

  // 末端の節（石に当たる面）
  {
    const start = pos.length / 3;
    const r = radiusAt(o.zTail, o.rOuter);
    pos.push(0, 0, o.zTail);
    nrm.push(0, 0, -1);
    uv.push(0.5, 0.02);
    for (let i = 0; i <= radial; i++) {
      const phi = (i / radial) * Math.PI * 2;
      pos.push(r * Math.sin(phi), r * Math.cos(phi), o.zTail);
      nrm.push(0, 0, -1);
      uv.push(0.5 + 0.35 * Math.sin(phi), 0.02 + 0.03 * Math.cos(phi));
    }
    for (let i = 0; i < radial; i++) idx.push(start, start + i + 2, start + i + 1);
  }

  void innerStart;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** 縦に割った断面用の竹（カットアウェイ表示にだけ使う） */
export function bambooHalfGeometry(o: BambooOpts): THREE.BufferGeometry {
  const g = bambooTubeGeometry({ ...o, radial: 24, axial: 40 });
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  // x>0 側の頂点を中心面へ潰して、半割に見せる
  for (let i = 0; i < p.count; i++) {
    if (p.getX(i) > 0) p.setX(i, 0);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** 不規則な石。ひとつとして同じ形にしない。 */
export function stoneGeometry(seed: number, detail = 3, lumpy = 0.32): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.5, detail);
  const n1 = makeValueNoise(32, seed);
  const n2 = makeValueNoise(64, seed + 13);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const u = 0.5 + Math.atan2(v.z, v.x) / (Math.PI * 2);
    const w = 0.5 + v.y;
    const big = fbm(n1, u * 3.3, w * 3.3, 3) - 0.5;
    const small = fbm(n2, u * 11, w * 11, 3) - 0.5;
    const k = 1 + big * lumpy + small * lumpy * 0.28;
    v.multiplyScalar(k);
    // 接地：底を平らに寄せる
    if (v.y < -0.3) v.y = -0.3 - (v.y + 0.3) * -0.25;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  g.deleteAttribute('uv');
  applyBoxUV(g);
  return g;
}

/** 石・土用の簡易ボックスUV */
export function applyBoxUV(g: THREE.BufferGeometry): void {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    uv[i * 2] = 0.5 + Math.atan2(z, x) / (Math.PI * 2);
    uv[i * 2 + 1] = 0.5 + y;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** 水鉢：自然石を刳り抜いた形 */
export function basinGeometry(seed: number, radius: number, depth: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const rim = radius;
  const inner = radius - 0.055; // 縁の厚み
  pts.push(new THREE.Vector2(0.001, 0));
  pts.push(new THREE.Vector2(rim * 0.82, 0));
  pts.push(new THREE.Vector2(rim * 0.97, depth * 0.32));
  pts.push(new THREE.Vector2(rim, depth * 0.86));
  pts.push(new THREE.Vector2(rim * 0.995, depth)); // 縁
  pts.push(new THREE.Vector2(inner, depth * 0.985));
  pts.push(new THREE.Vector2(inner * 0.94, depth * 0.6));
  pts.push(new THREE.Vector2(inner * 0.6, depth * 0.24)); // 内側の底
  pts.push(new THREE.Vector2(0.001, depth * 0.2));
  const g = new THREE.LatheGeometry(pts, 40);
  const n = makeValueNoise(32, seed);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const u = 0.5 + Math.atan2(v.z, v.x) / (Math.PI * 2);
    const k = 1 + (fbm(n, u * 5, v.y * 9, 3) - 0.5) * 0.11;
    v.x *= k;
    v.z *= k;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** 樋（半割竹の水路） */
export function troughGeometry(length: number, radius: number, wall: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const seg = 18;
  const axial = 24;
  const arc = Math.PI * 1.06;
  const push = (r: number, flip: boolean): void => {
    const start = pos.length / 3;
    for (let a = 0; a <= axial; a++) {
      const z = (a / axial) * length;
      for (let i = 0; i <= seg; i++) {
        const phi = Math.PI - arc / 2 + (i / seg) * arc;
        const x = r * Math.sin(phi);
        const y = r * Math.cos(phi);
        pos.push(x, y, z);
        const s = flip ? -1 : 1;
        nrm.push(s * Math.sin(phi), s * Math.cos(phi), 0);
        uv.push(i / seg, z / 0.4);
      }
    }
    const row = seg + 1;
    for (let a = 0; a < axial; a++) {
      for (let i = 0; i < seg; i++) {
        const p0 = start + a * row + i;
        if (flip) idx.push(p0, p0 + 1, p0 + row, p0 + 1, p0 + row + 1, p0 + row);
        else idx.push(p0, p0 + row, p0 + 1, p0 + 1, p0 + row, p0 + row + 1);
      }
    }
  };
  push(radius, false);
  push(radius - wall, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** 低木・下草のかたまり（板ではなく、傾いた葉の集合） */
export function foliageClump(seed: number, count: number, spread: number, scale: number): THREE.BufferGeometry {
  const rng = makeRng(seed);
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const h = scale * (0.55 + rng() * 0.75);
    const w = h * (0.24 + rng() * 0.18);
    const leaf = new THREE.PlaneGeometry(w, h, 1, 3);
    const p = leaf.getAttribute('position') as THREE.BufferAttribute;
    // 葉を反らせる
    for (let k = 0; k < p.count; k++) {
      const t = (p.getY(k) + h / 2) / h;
      p.setZ(k, -Math.pow(t, 2) * h * 0.28);
      p.setX(k, p.getX(k) * (1 - t * 0.35));
    }
    p.needsUpdate = true;
    leaf.translate(0, h / 2, 0);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler((rng() - 0.5) * 0.9, rng() * Math.PI * 2, (rng() - 0.5) * 0.8),
    );
    m.compose(
      new THREE.Vector3((rng() - 0.5) * spread, rng() * spread * 0.2, (rng() - 0.5) * spread),
      q,
      new THREE.Vector3(1, 1, 1),
    );
    leaf.applyMatrix4(m);
    geos.push(leaf);
  }
  return mergeGeometries(geos);
}

export function mergeGeometries(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let vertCount = 0;
  let idxCount = 0;
  for (const g of list) {
    vertCount += g.getAttribute('position').count;
    idxCount += g.getIndex() ? g.getIndex()!.count : g.getAttribute('position').count;
  }
  const pos = new Float32Array(vertCount * 3);
  const nrm = new Float32Array(vertCount * 3);
  const uv = new Float32Array(vertCount * 2);
  const idx = new Uint32Array(idxCount);
  let vo = 0;
  let io = 0;
  for (const g of list) {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    const n = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
    const t = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
    pos.set(p.array as Float32Array, vo * 3);
    if (n) nrm.set(n.array as Float32Array, vo * 3);
    if (t) uv.set(t.array as Float32Array, vo * 2);
    const gi = g.getIndex();
    if (gi) {
      for (let i = 0; i < gi.count; i++) idx[io + i] = gi.getX(i) + vo;
      io += gi.count;
    } else {
      for (let i = 0; i < p.count; i++) idx[io + i] = i + vo;
      io += p.count;
    }
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}
