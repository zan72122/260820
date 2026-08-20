import * as THREE from 'three';
import { pipeTexture } from '../util/textures';

export type PipeKind = 'pe' | 'castiron' | 'steel' | 'cableduct';

export interface PipeSpec {
  kind: PipeKind;
  /** Endpoints in site-local space. y is the pipe centre height (negative = below surface). */
  a: THREE.Vector3;
  b: THREE.Vector3;
  radius: number;
  /** Coupling / flange positions along the run, as 0..1 parameters. */
  couplings?: number[];
}

interface KindLook {
  color: number;
  ribbed: boolean;
  roughness: number;
  metalness: number;
  couplingColor: number;
}

const LOOKS: Record<PipeKind, KindLook> = {
  // Buried utilities are stained and matte. Nothing here is allowed to glow.
  pe: { color: 0x2c6f9c, ribbed: false, roughness: 0.52, metalness: 0.0, couplingColor: 0x22536f },
  castiron: { color: 0x4a443d, ribbed: false, roughness: 0.86, metalness: 0.45, couplingColor: 0x3b3730 },
  steel: { color: 0x76767a, ribbed: false, roughness: 0.55, metalness: 0.72, couplingColor: 0x5d5d61 },
  cableduct: { color: 0x2a2a2c, ribbed: true, roughness: 0.82, metalness: 0.0, couplingColor: 0xd8a12a },
};

const matCache = new Map<PipeKind, THREE.MeshStandardMaterial>();

export function pipeMaterial(kind: PipeKind): THREE.MeshStandardMaterial {
  let m = matCache.get(kind);
  if (!m) {
    const look = LOOKS[kind];
    const tex = pipeTexture(look.color, look.ribbed);
    tex.repeat.set(3, 1);
    m = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: look.roughness,
      metalness: look.metalness,
    });
    matCache.set(kind, m);
  }
  return m;
}

/** Builds one pipe run (body + couplings) as a group in site-local space. */
export function buildPipe(spec: PipeSpec, segments: number): THREE.Group {
  const g = new THREE.Group();
  const dir = new THREE.Vector3().subVectors(spec.b, spec.a);
  const len = dir.length();
  dir.normalize();

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(spec.radius, spec.radius, len, segments, 1, false),
    pipeMaterial(spec.kind)
  );
  const look = LOOKS[spec.kind];
  const couplingMat = new THREE.MeshStandardMaterial({
    color: look.couplingColor,
    roughness: Math.min(1, look.roughness + 0.08),
    metalness: look.metalness,
  });

  const holder = new THREE.Group();
  holder.position.copy(spec.a).addScaledVector(dir, len * 0.5);
  holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  holder.add(body);

  for (const t of spec.couplings ?? []) {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.radius * 1.22, spec.radius * 1.22, spec.radius * 0.62, segments, 1, false),
      couplingMat
    );
    ring.position.y = (t - 0.5) * len;
    ring.castShadow = true;
    ring.receiveShadow = true;
    holder.add(ring);
  }

  body.castShadow = true;
  body.receiveShadow = true;
  g.add(holder);
  return g;
}

/**
 * Height of the pipe's outer surface (plus a safety margin) directly above a
 * site-local ground position, or -Infinity if the point is clear of every pipe.
 * This is what guarantees the tool can never touch buried plant.
 */
export function pipeClearanceY(pipes: PipeSpec[], x: number, z: number, margin: number): number {
  let best = -Infinity;
  for (const p of pipes) {
    const ax = p.a.x;
    const az = p.a.z;
    const dx = p.b.x - ax;
    const dz = p.b.z - az;
    const len2 = dx * dx + dz * dz;
    let t = len2 > 1e-9 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const cx = ax + dx * t;
    const cz = az + dz * t;
    const d = Math.hypot(x - cx, z - cz);
    const r = p.radius + margin;
    if (d < r) {
      const cy = p.a.y + (p.b.y - p.a.y) * t;
      const y = cy + Math.sqrt(r * r - d * d);
      if (y > best) best = y;
    }
  }
  return best;
}

/** Horizontal distance from a site-local point to the nearest pipe centre line. */
export function distanceToPipesXZ(pipes: PipeSpec[], x: number, z: number): number {
  let best = Infinity;
  for (const p of pipes) {
    const ax = p.a.x;
    const az = p.a.z;
    const dx = p.b.x - ax;
    const dz = p.b.z - az;
    const len2 = dx * dx + dz * dz;
    let t = len2 > 1e-9 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) best = d;
  }
  return best;
}
