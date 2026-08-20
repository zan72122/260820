import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  LatheGeometry,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three';
import { clamp } from '../core/math';
import { Noise2D } from '../render/noise';

/** Box with rounded edges, built by pushing a subdivided box out to a core. */
export function roundedBox(
  w: number,
  h: number,
  d: number,
  r: number,
  seg = 4,
): BufferGeometry {
  const geo = new BoxGeometry(w, h, d, seg, seg, seg);
  const pos = geo.attributes.position as BufferAttribute;
  const cw = Math.max(0, w / 2 - r);
  const ch = Math.max(0, h / 2 - r);
  const cd = Math.max(0, d / 2 - r);
  const v = new Vector3();
  const core = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    core.set(clamp(v.x, -cw, cw), clamp(v.y, -ch, ch), clamp(v.z, -cd, cd));
    v.sub(core);
    if (v.lengthSq() > 1e-9) v.setLength(r);
    v.add(core);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** A soft, slightly lumpy pouch — a bean bag rather than a sphere. */
export function pouch(rx: number, ry: number, rz: number): BufferGeometry {
  const geo = new SphereGeometry(1, 26, 18);
  const pos = geo.attributes.position as BufferAttribute;
  const n = new Noise2D(4242);
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const lump = 1 + (n.fbm(v.x * 2.4 + 3, v.z * 2.4 + 5, 3, 256) - 0.5) * 0.24;
    // Settle under its own weight: flatter underneath, bulging at the waist.
    const settle = v.y < 0 ? 1 - Math.pow(-v.y, 1.8) * 0.36 : 1;
    pos.setXYZ(i, v.x * rx * lump, v.y * ry * settle * lump, v.z * rz * lump);
  }
  geo.computeVertexNormals();
  return geo;
}

/** A disc with a properly rounded rim, so its silhouette reads as ice. */
export function roundedDisc(radius: number, halfThickness: number): BufferGeometry {
  const pts: Vector2[] = [];
  const flat = radius - halfThickness * 1.1;
  pts.push(new Vector2(0, halfThickness));
  pts.push(new Vector2(flat * 0.6, halfThickness));
  pts.push(new Vector2(flat, halfThickness * 0.96));
  for (let i = 1; i < 6; i++) {
    const a = (i / 6) * Math.PI;
    pts.push(
      new Vector2(flat + Math.sin(a) * halfThickness * 1.1, Math.cos(a) * halfThickness),
    );
  }
  pts.push(new Vector2(flat, -halfThickness * 0.96));
  pts.push(new Vector2(flat * 0.6, -halfThickness));
  pts.push(new Vector2(0, -halfThickness));
  return new LatheGeometry(pts, 34);
}

/**
 * A single dried leaf: a curled blade with a thickened midrib. The mesh is a
 * parametric grid so it can be given a believable flutter without cloth
 * simulation.
 */
export function leafBlade(length = 0.16, width = 0.075): BufferGeometry {
  const NU = 22;
  const NV = 9;
  const pos = new Float32Array(NU * NV * 3);
  const uv = new Float32Array(NU * NV * 2);
  const n = new Noise2D(5150);
  for (let i = 0; i < NU; i++) {
    const t = i / (NU - 1);
    // Blade outline: pointed tip, broad shoulder, narrow stalk.
    const w = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.06)), 0.72) * width * 0.5;
    const stalk = t < 0.1 ? 0.16 : 1;
    for (let j = 0; j < NV; j++) {
      const q = j / (NV - 1);
      const across = (q - 0.5) * 2;
      const x = (t - 0.5) * length;
      const z = across * w * stalk;
      // Curl: the blade cups upward and the tip lifts as it dries.
      const cup = Math.pow(Math.abs(across), 2) * w * 0.9;
      const lift = Math.pow(t, 2.6) * length * 0.13;
      const rib = Math.exp(-Math.pow(across / 0.16, 2)) * 0.0035;
      const wob = (n.value(t * 9, q * 5, 256) - 0.5) * 0.0025;
      const k = (i * NV + j) * 3;
      pos[k] = x;
      pos[k + 1] = cup + lift + rib + wob;
      pos[k + 2] = z;
      const m = (i * NV + j) * 2;
      uv[m] = t;
      uv[m + 1] = q;
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < NU - 1; i++) {
    for (let j = 0; j < NV - 1; j++) {
      const a = i * NV + j;
      const b = (i + 1) * NV + j;
      const c = (i + 1) * NV + j + 1;
      const d = i * NV + j + 1;
      idx.push(a, b, c, a, c, d);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Add a `squash` morph target: flatten along Y, bulge outwards. This is the
 * cheap stand-in for soft-body deformation asked for by the design.
 */
export function addSquashMorph(geo: BufferGeometry, amount = 0.42): void {
  const pos = geo.attributes.position as BufferAttribute;
  const out = new Float32Array(pos.count * 3);
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const minY = bb.min.y;
  const height = Math.max(1e-5, bb.max.y - bb.min.y);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const h = (y - minY) / height;
    const ny = minY + (y - minY) * (1 - amount);
    // Material bulges out most around the waist, least at the very bottom.
    const bulge = 1 + amount * 0.62 * Math.sin(Math.PI * clamp(h, 0, 1)) + amount * 0.12;
    out[i * 3] = x * bulge;
    out[i * 3 + 1] = ny;
    out[i * 3 + 2] = z * bulge;
  }
  geo.morphAttributes.position = [new BufferAttribute(out, 3)];
  geo.morphTargetsRelative = false;
}

/** A short length of grippy rubber matting the child can lay on the bed. */
export function rubberStrip(length: number, width: number, thickness: number): BufferGeometry {
  return roundedBox(length, thickness, width, thickness * 0.45, 3);
}

export function wheel(radius: number, width: number): BufferGeometry {
  const g = new CylinderGeometry(radius, radius, width, 18, 1);
  g.rotateX(Math.PI / 2);
  return g;
}
