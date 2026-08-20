import * as THREE from 'three';
import { fbm2D, makeValueNoise2D, Rng } from '../core/rng';
import { clamp01, lerp, TAU } from '../core/mathx';

export interface UmeShapeParams {
  seed: number;
  /** Mean radius in world units. */
  radius: number;
  /** 0 = green and firm, 1 = fully ripe and slightly slumped. */
  ripeness: number;
  /** Geometry detail; 2 = background, 4 = hero. */
  detail: number;
}

/**
 * A real ume is not a sphere. This builds one with: a suture groove down one
 * side, the dimpled stem scar at the top, a gentle vertical squash that grows
 * with ripeness, and low-frequency asymmetry unique to each fruit.
 */
export function makeUmeGeometry(p: UmeShapeParams): THREE.BufferGeometry {
  const seg = p.detail >= 4 ? 44 : p.detail >= 3 ? 28 : 16;
  const rings = p.detail >= 4 ? 32 : p.detail >= 3 ? 20 : 12;
  const geo = new THREE.SphereGeometry(1, seg, rings);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const noise = makeValueNoise2D(p.seed);
  const rng = new Rng(p.seed ^ 0xa5a5);

  // Where the suture runs, and which way the fruit leans.
  const sutureAzimuth = rng.range(0, TAU);
  const leanX = rng.jitter(0.05);
  const leanZ = rng.jitter(0.05);
  const squash = lerp(0.955, 0.9, p.ripeness) + rng.jitter(0.02);

  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();

    // Individual asymmetry: slow lumps, never spherical.
    const lump = fbm2D(noise, v.x * 1.35 + 5, v.z * 1.35 + 9, 3) - 0.5;
    const lump2 = fbm2D(noise, v.y * 1.9 + 2, v.x * 1.9 + 7, 2) - 0.5;
    let r = 1 + lump * 0.085 + lump2 * 0.05;

    // Suture groove: deepest at the equator, fading out toward both poles.
    const az = Math.atan2(v.z, v.x);
    let d = az - sutureAzimuth;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    const grooveWidth = 0.24;
    const groove = Math.exp(-(d * d) / (grooveWidth * grooveWidth));
    const polarFade = 1 - Math.pow(Math.abs(v.y), 2.2);
    r -= groove * polarFade * lerp(0.055, 0.075, p.ripeness);

    // Stem scar: a small crater at the top pole.
    const topAngle = Math.acos(clamp01(v.y));
    const scar = Math.exp(-(topAngle * topAngle) / (0.19 * 0.19));
    r -= scar * 0.09;
    // Blossom end: a fainter dimple opposite the scar.
    const botAngle = Math.acos(clamp01(-v.y));
    r -= Math.exp(-(botAngle * botAngle) / (0.26 * 0.26)) * 0.035;

    // Micro relief so the silhouette is never a clean arc.
    r += (fbm2D(noise, v.x * 9 + 20, v.z * 9 + 31, 2) - 0.5) * 0.012;

    v.multiplyScalar(r * p.radius);
    v.y *= squash;
    v.x += v.y * leanX;
    v.z += v.y * leanZ;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

/** The short dry stem stub some fruit keep after falling. */
export function makeStemGeometry(radius: number): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(radius * 0.055, radius * 0.075, radius * 0.28, 6, 1);
  geo.translate(0, radius * 0.12, 0);
  return geo;
}

/**
 * Coarse sea salt: an angular chunk, not a sphere. A jittered cube converted
 * to flat shading gives readable facets that catch the light at macro range.
 */
export function makeSaltCrystalGeometry(seed: number, size = 1): THREE.BufferGeometry {
  const rng = new Rng(seed);
  const base = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  const geo = base.toNonIndexed();
  const pos = geo.attributes.position as THREE.BufferAttribute;

  // Jitter shared corners consistently so the chunk stays closed.
  const corners = new Map<string, THREE.Vector3>();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${Math.round(v.x)},${Math.round(v.y)},${Math.round(v.z)}`;
    let c = corners.get(key);
    if (!c) {
      c = new THREE.Vector3(
        v.x * rng.range(0.66, 1.05) + rng.jitter(0.13),
        v.y * rng.range(0.66, 1.05) + rng.jitter(0.13),
        v.z * rng.range(0.66, 1.05) + rng.jitter(0.13),
      );
      corners.set(key, c);
    }
    pos.setXYZ(i, c.x * size, c.y * size, c.z * size);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals(); // non-indexed -> hard facets
  base.dispose();
  return geo;
}

export interface JarParts {
  outer: THREE.BufferGeometry;
  inner: THREE.BufferGeometry;
  rim: THREE.BufferGeometry;
  base: THREE.BufferGeometry;
}

/**
 * A jar you could actually pick up: separate inner and outer walls with real
 * thickness between them, a rolled rim and a thick base. Split into back and
 * front passes at render time so no transparency sorting is ever needed.
 */
export function makeJarGeometry(
  outerR: number,
  height: number,
  wall: number,
  segments = 48,
): JarParts {
  const innerR = outerR - wall;
  const outer = new THREE.CylinderGeometry(outerR, outerR * 0.985, height, segments, 1, true);
  outer.translate(0, height / 2, 0);
  const inner = new THREE.CylinderGeometry(innerR, innerR * 0.99, height - wall, segments, 1, true);
  inner.translate(0, wall + (height - wall) / 2, 0);

  // Rolled rim: a torus flattened slightly, the part a hand grips.
  const rim = new THREE.TorusGeometry(outerR - wall / 2, wall / 2, 8, segments);
  rim.rotateX(Math.PI / 2);
  rim.scale(1, 0.78, 1);
  rim.translate(0, height, 0);

  // Thick base disc, visible from the side through the glass.
  const base = new THREE.CylinderGeometry(outerR * 0.99, outerR * 0.94, wall, segments, 1, false);
  base.translate(0, wall / 2, 0);

  return { outer, inner, rim, base };
}

/** Wooden salt scoop: a hollowed bowl on a handle. */
export function makeScoopGeometry(scale = 1): {
  bowl: THREE.BufferGeometry;
  handle: THREE.BufferGeometry;
} {
  // Lathe a bowl profile so the inside is genuinely concave.
  const pts: THREE.Vector2[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = Math.sin(t * Math.PI * 0.5) * 1.0;
    const y = -Math.cos(t * Math.PI * 0.5) * 0.62;
    pts.push(new THREE.Vector2(Math.max(0.02, r), y + 0.62));
  }
  // Walk back down the inside to give the wall a thickness.
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const r = Math.sin(t * Math.PI * 0.5) * 0.86;
    const y = -Math.cos(t * Math.PI * 0.5) * 0.5;
    pts.push(new THREE.Vector2(Math.max(0.01, r), y + 0.62 + 0.1));
  }
  const bowl = new THREE.LatheGeometry(pts, 28);
  bowl.scale(scale, scale, scale);

  const handle = new THREE.CylinderGeometry(0.1 * scale, 0.13 * scale, 1.5 * scale, 10, 1);
  handle.rotateZ(Math.PI / 2);
  handle.translate(1.4 * scale, 0.45 * scale, 0);
  return { bowl, handle };
}

/** Shallow round drying tray with a rolled rim and slatted floor. */
export function makeTrayGeometry(radius: number): {
  floor: THREE.BufferGeometry;
  rim: THREE.BufferGeometry;
  slats: THREE.BufferGeometry;
} {
  const floor = new THREE.CylinderGeometry(radius * 0.97, radius * 0.95, radius * 0.035, 48, 1);
  const rim = new THREE.TorusGeometry(radius, radius * 0.045, 8, 56);
  rim.rotateX(Math.PI / 2);
  rim.translate(0, radius * 0.05, 0);

  // A few crossing bamboo slats give the floor readable relief.
  const parts: THREE.BufferGeometry[] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = (t - 0.5) * 2 * radius * 0.94;
    const half = Math.sqrt(Math.max(0, radius * radius * 0.93 - x * x));
    const g = new THREE.BoxGeometry(radius * 0.045, radius * 0.022, half * 2);
    g.translate(x, radius * 0.03, 0);
    parts.push(g);
    const g2 = new THREE.BoxGeometry(half * 2, radius * 0.02, radius * 0.045);
    g2.translate(0, radius * 0.045, x);
    parts.push(g2);
  }
  const slats = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  return { floor, rim, slats };
}

/** Minimal merge helper (avoids pulling in the addons build). */
export function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  let vertexCount = 0;
  let indexCount = 0;
  for (const g of geos) {
    vertexCount += g.attributes.position.count;
    indexCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const position = new Float32Array(vertexCount * 3);
  const normal = new Float32Array(vertexCount * 3);
  const uv = new Float32Array(vertexCount * 2);
  const index = new Uint32Array(indexCount);
  let vo = 0;
  let io = 0;
  for (const g of geos) {
    const p = g.attributes.position as THREE.BufferAttribute;
    const n = g.attributes.normal as THREE.BufferAttribute | undefined;
    const u = g.attributes.uv as THREE.BufferAttribute | undefined;
    position.set(p.array as Float32Array, vo * 3);
    if (n) normal.set(n.array as Float32Array, vo * 3);
    if (u) uv.set(u.array as Float32Array, vo * 2);
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) index[io++] = g.index.getX(i) + vo;
    } else {
      for (let i = 0; i < p.count; i++) index[io++] = i + vo;
    }
    vo += p.count;
  }
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingSphere();
  return out;
}

/** Gnarled plum trunk built from a swept ring, plus a few limbs. */
export function makeTrunkGeometry(seed: number, height: number, radius: number): THREE.BufferGeometry {
  const rng = new Rng(seed);
  const noise = makeValueNoise2D(seed ^ 0x33);
  const rings = 18;
  const seg = 12;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const centers: THREE.Vector3[] = [];
  let cx = 0;
  let cz = 0;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    cx += rng.jitter(0.035) * height * 0.08;
    cz += rng.jitter(0.035) * height * 0.08;
    centers.push(new THREE.Vector3(cx * (1 - t * 0.2), t * height, cz * (1 - t * 0.2)));
  }
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const c = centers[i];
    const r = radius * lerp(1.25, 0.45, Math.pow(t, 0.75));
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * TAU;
      const bulge = 1 + (fbm2D(noise, Math.cos(a) * 1.6 + t * 3, Math.sin(a) * 1.6, 3) - 0.5) * 0.42;
      const rr = r * bulge;
      positions.push(c.x + Math.cos(a) * rr, c.y, c.z + Math.sin(a) * rr);
      normals.push(Math.cos(a), 0.1, Math.sin(a));
      uvs.push(j / seg, t * 3);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * (seg + 1) + j;
      const b = a + seg + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
