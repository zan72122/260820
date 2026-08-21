import * as THREE from 'three';
import { Rng, TAU, clamp01, lerp, smoothstep } from '../core/math';
import type { QualitySettings } from '../core/quality';
import {
  applyMaps,
  cached,
  mudFilmMaps,
  mudMask,
  rootSkinMaps,
  type SoilKind,
} from '../core/textures';

/**
 * A cassava storage-root cluster.
 *
 * Structure follows the real plant: one central stem node, and 4-9 storage
 * roots radiating from it. Each root is a spline with its own length,
 * thickness, descent angle and curl, wrapped in an individual surface mesh
 * with a tapered, non-circular cross-section.
 *
 * Shape variation is NOT free-running procedural noise. Five archetypes were
 * authored and checked by eye; a run only jitters their parameters within
 * modest bounds, so no cluster ever comes out as a ring of identical
 * cylinders.
 */

export type ArchetypeName = 'openFan' | 'tightBunch' | 'plunge' | 'lopsided' | 'twinLobe';

interface Archetype {
  name: ArchetypeName;
  count: [number, number];
  /** Total azimuth sweep occupied by the roots, in radians. */
  sweep: [number, number];
  /** Descent angle at the neck and at the tip, in radians. */
  elevStart: [number, number];
  elevEnd: [number, number];
  length: [number, number];
  radius: [number, number];
  /** Share of roots drawn as the long/slender kind rather than short/stout. */
  slenderShare: [number, number];
  curl: [number, number];
  /** Extra azimuth clumping: 0 = even spacing, 1 = strongly grouped. */
  clump: number;
}

const ARCHETYPES: Record<ArchetypeName, Archetype> = {
  openFan: {
    name: 'openFan',
    count: [6, 8],
    sweep: [TAU * 0.86, TAU * 0.98],
    elevStart: [0.72, 0.92],
    elevEnd: [0.24, 0.40],
    length: [0.34, 0.50],
    radius: [0.034, 0.046],
    slenderShare: [0.55, 0.75],
    curl: [0.18, 0.42],
    clump: 0.15,
  },
  tightBunch: {
    name: 'tightBunch',
    count: [4, 5],
    sweep: [TAU * 0.55, TAU * 0.72],
    elevStart: [0.88, 1.08],
    elevEnd: [0.46, 0.62],
    length: [0.26, 0.35],
    radius: [0.046, 0.061],
    slenderShare: [0.10, 0.28],
    curl: [0.10, 0.26],
    clump: 0.42,
  },
  plunge: {
    name: 'plunge',
    count: [5, 7],
    sweep: [TAU * 0.70, TAU * 0.88],
    elevStart: [0.86, 1.05],
    elevEnd: [0.46, 0.66],
    length: [0.30, 0.43],
    radius: [0.038, 0.053],
    slenderShare: [0.35, 0.55],
    curl: [0.22, 0.48],
    clump: 0.24,
  },
  lopsided: {
    name: 'lopsided',
    count: [5, 8],
    sweep: [TAU * 0.42, TAU * 0.60],
    elevStart: [0.66, 0.94],
    elevEnd: [0.20, 0.44],
    length: [0.30, 0.52],
    radius: [0.032, 0.058],
    slenderShare: [0.40, 0.70],
    curl: [0.26, 0.55],
    clump: 0.30,
  },
  twinLobe: {
    name: 'twinLobe',
    count: [6, 9],
    sweep: [TAU * 0.92, TAU],
    elevStart: [0.80, 1.02],
    elevEnd: [0.30, 0.52],
    length: [0.28, 0.48],
    radius: [0.035, 0.055],
    slenderShare: [0.45, 0.65],
    curl: [0.14, 0.38],
    clump: 0.62,
  },
};

export const ARCHETYPE_NAMES = Object.keys(ARCHETYPES) as ArchetypeName[];

export interface RootClusterParams {
  seed: number;
  archetype: ArchetypeName;
  soil: SoilKind;
  /** Bias of the whole cluster's azimuth, radians. */
  facing: number;
  /** 0..1, scales the size of soil clods that cling to the roots. */
  clodScale: number;
}

export interface RootSpec {
  azimuth: number;
  /** Horizontal reach from the node, metres. */
  reach: number;
  /** Deepest point below the node, metres. */
  depth: number;
  maxRadius: number;
  slender: boolean;
}

interface RootPart {
  group: THREE.Group;
  spec: RootSpec;
  /** Seconds of lag before this root starts to follow the cluster. */
  delay: number;
  /** How far it hangs back while still gripped by the soil. */
  stickDepth: number;
  clods: ClodPart[];
  fibre: THREE.LineSegments | null;
}

interface ClodPart {
  mesh: THREE.Mesh;
  /** Number of shakes after which this clod lets go. */
  releaseAt: number;
  fallen: boolean;
  fallTime: number;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  home: THREE.Vector3;
}

const UP = new THREE.Vector3(0, 1, 0);

/* ------------------------------------------------------------------ */
/* spline + surface                                                    */
/* ------------------------------------------------------------------ */

function buildSpine(
  rng: Rng,
  azimuth: number,
  length: number,
  elevStart: number,
  elevEnd: number,
  curl: number,
): THREE.CatmullRomCurve3 {
  const points: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0)];
  const steps = 5;
  const pos = new THREE.Vector3();
  // Gravity plus soil pressure: the root leaves the node steeply and then
  // flattens as it runs out into looser soil, drifting sideways as it goes.
  const drift = curl * (rng.next() < 0.5 ? -1 : 1);
  for (let k = 1; k <= steps; k++) {
    const frac = k / steps;
    const e = lerp(elevStart, elevEnd, Math.pow(frac, 0.75)) + rng.jitter(0.05);
    const az = azimuth + drift * Math.pow(frac, 1.4) + rng.jitter(0.035);
    const step = length / steps;
    pos.x += Math.cos(az) * Math.cos(e) * step;
    pos.y += -Math.sin(e) * step;
    pos.z += Math.sin(az) * Math.cos(e) * step;
    points.push(pos.clone());
  }
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
  return curve;
}

/** Neck constriction, mid bulge, taper to a fibrous tip. */
function radiusProfile(t: number, slender: boolean): number {
  // A real storage root pinches hard where it joins the stem node, and the
  // constriction runs a good way out before the body swells.
  const neck = smoothstep(t / 0.30) * 0.78 + 0.22;
  const peakAt = slender ? 0.50 : 0.45;
  const shoulder = 1 - Math.pow(Math.abs(t - peakAt) / (slender ? 0.85 : 0.75), slender ? 2.0 : 1.7);
  const body = lerp(0.62, 1, clamp01(shoulder));
  // Cassava roots run out to a blunt, fibrous end, not to a point.
  const tip = 1 - smoothstep((t - (slender ? 0.78 : 0.72)) / (slender ? 0.22 : 0.28)) * 0.50;
  return neck * body * tip;
}

function buildRootGeometry(
  curve: THREE.CatmullRomCurve3,
  baseRadius: number,
  slender: boolean,
  seedPhase: number,
  q: QualitySettings,
): THREE.BufferGeometry {
  const L = q.rootLengthSegments;
  const R = q.rootRadialSegments;
  const frames = curve.computeFrenetFrames(L, false);
  const positions = new Float32Array((L + 1) * (R + 1) * 3);
  const normals = new Float32Array((L + 1) * (R + 1) * 3);
  const uvs = new Float32Array((L + 1) * (R + 1) * 2);
  const point = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const radial = new THREE.Vector3();
  const tmpN = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const arcLength = curve.getLength();

  for (let i = 0; i <= L; i++) {
    const t = i / L;
    curve.getPointAt(t, point);
    const N = frames.normals[i]!;
    const B = frames.binormals[i]!;

    // Long-wavelength lumps down the root, so no length reads as machined.
    const lumpAt = (u: number): number =>
      1 + Math.sin(u * 11.3 + seedPhase) * 0.075 + Math.sin(u * 23.7 + seedPhase * 1.7) * 0.035;
    const radiusAt = (u: number): number =>
      baseRadius * radiusProfile(Math.min(1, Math.max(0, u)), slender) * lumpAt(u);
    const rBase = radiusAt(t);
    // Rate of change of radius along the surface, used to tilt the normal off
    // the pure radial. Without it a strongly tapered root shades like a
    // cylinder and reads as a flat blade.
    const h = 0.5 / L;
    const dRds = (radiusAt(t + h) - radiusAt(t - h)) / (2 * h * Math.max(arcLength, 1e-4));
    const T = frames.tangents[i]!;

    for (let j = 0; j <= R; j++) {
      const v = (j / R) * TAU;
      // Non-circular cross-section: cassava roots are slightly lobed.
      const lobe =
        1 +
        Math.sin(v * 3 + t * 4.1 + seedPhase) * 0.045 +
        Math.sin(v * 5 - t * 2.7 + seedPhase * 0.6) * 0.024;
      const r = rBase * lobe;
      tmpN.copy(N).multiplyScalar(Math.cos(v));
      tmpB.copy(B).multiplyScalar(Math.sin(v));
      radial.copy(tmpN).add(tmpB).normalize();
      vertex.copy(point).addScaledVector(radial, r);
      normal.copy(radial).addScaledVector(T, -dRds).normalize();

      const idx = (i * (R + 1) + j) * 3;
      positions[idx] = vertex.x;
      positions[idx + 1] = vertex.y;
      positions[idx + 2] = vertex.z;
      normals[idx] = normal.x;
      normals[idx + 1] = normal.y;
      normals[idx + 2] = normal.z;
      const uvIdx = (i * (R + 1) + j) * 2;
      uvs[uvIdx] = j / R;
      // Keep the transverse striations at a constant real-world pitch.
      uvs[uvIdx + 1] = t * (curve.getLength() / 0.32);
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < L; i++) {
    for (let j = 0; j < R; j++) {
      const a = i * (R + 1) + j;
      const b = a + R + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  // Normals are analytic. Re-averaging them here would split the seam where
  // the tube wraps and draw a hard line down the length of every root.
  geom.computeBoundingSphere();
  return geom;
}

function buildFibre(
  curve: THREE.CatmullRomCurve3,
  baseRadius: number,
  count: number,
  rng: Rng,
): THREE.BufferGeometry {
  const verts: number[] = [];
  const p = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const side = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const t = rng.range(0.12, 1.0);
    curve.getPointAt(t, p);
    curve.getTangentAt(t, dir);
    side.set(rng.jitter(1), rng.range(-1, 0.2), rng.jitter(1)).normalize();
    const r = baseRadius * radiusProfile(t, false);
    const start = p.clone().addScaledVector(side, r * 0.9);
    // Fine roots are wispy: 2-3 short kinked segments each.
    let cur = start.clone();
    const links = 2 + (rng.next() < 0.5 ? 0 : 1);
    for (let k = 0; k < links; k++) {
      const len = rng.range(0.008, 0.021);
      const next = cur
        .clone()
        .addScaledVector(side, len)
        .add(new THREE.Vector3(rng.jitter(0.012), rng.range(-0.018, -0.002), rng.jitter(0.012)));
      verts.push(cur.x, cur.y, cur.z, next.x, next.y, next.z);
      cur = next;
      side.add(new THREE.Vector3(rng.jitter(0.5), rng.range(-0.4, 0), rng.jitter(0.5))).normalize();
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return geom;
}

function clodGeometry(rng: Rng, radius: number): THREE.BufferGeometry {
  // A clod of damp soil is a rounded lump, not a shard. The displacement is
  // deliberately gentle so the cluster never reads as spiky.
  const geom = new THREE.IcosahedronGeometry(radius, 1);
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const sx = 1 + rng.jitter(0.18);
  const sy = 0.46 + rng.jitter(0.08);
  const sz = 1 + rng.jitter(0.18);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.multiplyScalar(1 + rng.jitter(0.10));
    v.x *= sx;
    v.y *= sy;
    v.z *= sz;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

/* ------------------------------------------------------------------ */
/* cluster                                                             */
/* ------------------------------------------------------------------ */

export class RootCluster {
  readonly group = new THREE.Group();
  readonly specs: RootSpec[] = [];
  private parts: RootPart[] = [];
  private disposables: (THREE.BufferGeometry | THREE.Material)[] = [];
  private shakeCount = 0;
  private soilCoverage = 0.62;
  private mudMaterials: THREE.MeshStandardMaterial[] = [];
  /** Master lift progress in metres, driven by the lever. */
  private liftProgress = 0;
  private freed = false;
  private elapsed = 0;
  private releaseStartedAt = -1;
  private hang = 0;
  private shoulderScore = -1;

  readonly node: THREE.Mesh;
  /** Azimuth of the thickest root — the one the reveal is staged around. */
  heroAzimuth = 0;
  /** Local point on the thickest root's shoulder, near the node. */
  readonly shoulder = new THREE.Vector3();
  readonly boundingRadius: number;
  readonly maxReach: number;
  readonly maxDepth: number;

  constructor(params: RootClusterParams, q: QualitySettings) {
    const rng = new Rng(params.seed);
    const arch = ARCHETYPES[params.archetype];
    const count = rng.int(arch.count[0], arch.count[1]);
    const sweep = rng.range(arch.sweep[0], arch.sweep[1]);
    const slenderShare = rng.range(arch.slenderShare[0], arch.slenderShare[1]);

    const skin = cached('rootSkin' + q.textureSize, () => rootSkinMaps(q.textureSize));
    const mud = cached(`mudFilm${q.textureSize}${params.soil}`, () =>
      mudFilmMaps(Math.max(256, q.textureSize / 2), params.soil),
    );

    let maxReach = 0;
    let maxDepth = 0;
    let boundingRadius = 0.1;

    // Azimuth layout: even spacing, pulled toward clumps by the archetype.
    const azimuths: number[] = [];
    for (let i = 0; i < count; i++) {
      const even = (i / count) * sweep;
      const clumped = Math.pow(i / Math.max(1, count - 1), 1 + arch.clump * 1.8) * sweep;
      azimuths.push(
        params.facing - sweep / 2 + lerp(even, clumped, arch.clump) + rng.jitter(0.16),
      );
    }

    for (let i = 0; i < count; i++) {
      const slender = rng.next() < slenderShare;
      const length = slender
        ? rng.range(lerp(arch.length[0], arch.length[1], 0.55), arch.length[1] * 1.08)
        : rng.range(arch.length[0] * 0.82, lerp(arch.length[0], arch.length[1], 0.55));
      const radius = slender
        ? rng.range(arch.radius[0] * 0.78, lerp(arch.radius[0], arch.radius[1], 0.5))
        : rng.range(lerp(arch.radius[0], arch.radius[1], 0.5), arch.radius[1] * 1.12);
      const elevStart = rng.range(arch.elevStart[0], arch.elevStart[1]);
      const elevEnd = rng.range(arch.elevEnd[0], Math.min(arch.elevEnd[1], elevStart - 0.08));
      const curl = rng.range(arch.curl[0], arch.curl[1]);
      const azimuth = azimuths[i]!;

      const curve = buildSpine(rng, azimuth, length, elevStart, elevEnd, curl);
      const geom = buildRootGeometry(curve, radius, slender, rng.range(0, 10), q);
      this.disposables.push(geom);

      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.86,
        metalness: 0,
      });
      applyMaps(mat, skin, new THREE.Vector2(1, 1), q.anisotropy);
      // Subtle per-root tint so no two roots read as clones.
      mat.color.setHSL(0.086 + rng.jitter(0.012), 0.26 + rng.jitter(0.05), 0.72 + rng.jitter(0.05));
      this.disposables.push(mat);

      geom.computeBoundingBox();
      const mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Thin clay film pressed onto the skin, masked so it is never
      // left/right symmetric and never coats the whole root.
      const mudMat = new THREE.MeshStandardMaterial({
        transparent: true,
        roughness: 0.9,
        metalness: 0,
        alphaMap: cached(`mudMask${(params.seed + i) % 8}`, () => mudMask(128, (params.seed + i) % 8)),
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      applyMaps(mudMat, mud, new THREE.Vector2(1, 1), q.anisotropy);
      mudMat.opacity = 0.62;
      this.disposables.push(mudMat);
      this.mudMaterials.push(mudMat);
      const mudMesh = new THREE.Mesh(geom, mudMat);
      mudMesh.castShadow = false;
      mudMesh.receiveShadow = false;
      mudMesh.renderOrder = 1;

      const rootGroup = new THREE.Group();
      rootGroup.add(mesh, mudMesh);

      let fibre: THREE.LineSegments | null = null;
      if (q.fibrePerRoot > 0) {
        const fibreGeom = buildFibre(curve, radius, q.fibrePerRoot, rng);
        const fibreMat = new THREE.LineBasicMaterial({
          color: 0x50412e,
          transparent: true,
          opacity: 0.55,
        });
        this.disposables.push(fibreGeom, fibreMat);
        fibre = new THREE.LineSegments(fibreGeom, fibreMat);
        rootGroup.add(fibre);
      }

      // Clods clinging along the root, released one shake at a time.
      const clods: ClodPart[] = [];
      const clodCount = Math.round(lerp(1, 3, params.clodScale) + rng.jitter(0.8));
      const clodMat = new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0 });
      applyMaps(clodMat, mud, new THREE.Vector2(3, 3), q.anisotropy);
      clodMat.color.setRGB(0.78, 0.74, 0.72);
      this.disposables.push(clodMat);
      for (let c = 0; c < clodCount; c++) {
        const t = rng.range(0.08, 0.92);
        const p = curve.getPointAt(t);
        const cr = radius * radiusProfile(t, slender) * rng.range(0.5, 0.95) * lerp(0.55, 0.95, params.clodScale);
        const cg = clodGeometry(rng, cr);
        this.disposables.push(cg);
        const cm = new THREE.Mesh(cg, clodMat);
        const off = new THREE.Vector3(rng.jitter(1), rng.range(-1, 0.4), rng.jitter(1)).normalize();
        cm.position.copy(p).addScaledVector(off, radius * 0.7);
        cm.rotation.set(rng.range(0, TAU), rng.range(0, TAU), rng.range(0, TAU));
        cm.castShadow = true;
        rootGroup.add(cm);
        clods.push({
          mesh: cm,
          releaseAt: rng.int(1, 3),
          fallen: false,
          fallTime: 0,
          velocity: new THREE.Vector3(),
          spin: new THREE.Vector3(rng.jitter(6), rng.jitter(6), rng.jitter(6)),
          home: cm.position.clone(),
        });
      }

      this.group.add(rootGroup);

      const end = curve.getPointAt(1);
      const reach = Math.hypot(end.x, end.z);
      const depth = -curve.getPointAt(0.86).y;
      maxReach = Math.max(maxReach, reach);
      maxDepth = Math.max(maxDepth, Math.max(depth, -end.y));
      boundingRadius = Math.max(boundingRadius, end.length() + radius);

      const spec: RootSpec = { azimuth, reach, depth, maxRadius: radius, slender };
      // Remember where this root's shoulder sits, in case it turns out to be
      // the thickest one: this is the sliver of pale skin the first crack has
      // to show, so it is measured rather than guessed.
      const shoulderAt = curve.getPointAt(0.26);
      shoulderAt.y += radius * radiusProfile(0.26, slender);
      // Prefer a thick root running away from the tool, which stands on +Z:
      // the crack over it is the one the low camera can look down without the
      // fulcrum frame standing in the way.
      const clearOfTool = Math.sin(azimuth) < -0.15;
      const score = radius + (clearOfTool ? 1 : 0);
      if (score >= this.shoulderScore) {
        this.shoulderScore = score;
        this.shoulder.copy(shoulderAt);
        this.heroAzimuth = azimuth;
      }
      this.specs.push(spec);
      this.parts.push({
        group: rootGroup,
        spec,
        delay: 0,
        stickDepth: 0,
        clods,
        fibre,
      });
    }

    // Release order: the thick central root first, then the flanking roots,
    // then the ones running away from camera.
    const frontAz = params.facing;
    const thickest = this.parts.reduce((best, p) => (p.spec.maxRadius > best.spec.maxRadius ? p : best), this.parts[0]!);
    for (const part of this.parts) {
      let d = Math.abs(angleDelta(part.spec.azimuth, frontAz)); // 0 = front, PI = back
      d /= Math.PI;
      part.delay = 0.06 + d * 0.30 + (part.spec.slender ? 0.05 : 0);
      part.stickDepth = lerp(0.030, 0.075, d) * lerp(0.8, 1.25, params.clodScale);
      if (part === thickest) {
        part.delay = 0;
        part.stickDepth *= 0.6;
      }
    }

    // Swollen node where every root meets the stem.
    const nodeGeom = new THREE.SphereGeometry(0.040, 18, 14);
    const npos = nodeGeom.getAttribute('position') as THREE.BufferAttribute;
    const nv = new THREE.Vector3();
    for (let i = 0; i < npos.count; i++) {
      nv.fromBufferAttribute(npos, i);
      nv.y *= 0.78;
      nv.multiplyScalar(
        1 + Math.sin(nv.x * 22) * 0.09 + Math.sin(nv.z * 17 + 1.3) * 0.07 + Math.sin(nv.y * 31) * 0.05,
      );
      npos.setXYZ(i, nv.x, nv.y, nv.z);
    }
    nodeGeom.computeVertexNormals();
    const nodeMat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
    // Coarse, low-contrast skin here; dense rings would read as machining.
    applyMaps(nodeMat, skin, new THREE.Vector2(1, 0.45), q.anisotropy);
    nodeMat.color.setHex(0x8a7050);
    this.disposables.push(nodeGeom, nodeMat);
    this.node = new THREE.Mesh(nodeGeom, nodeMat);
    this.node.castShadow = true;
    this.group.add(this.node);

    this.maxReach = maxReach;
    this.maxDepth = maxDepth;
    this.boundingRadius = boundingRadius;
    this.group.visible = false;
  }

  get rootCount(): number {
    return this.parts.length;
  }

  /** How far below the soil line the hero shoulder still sits, metres. */
  shoulderDepth(nodeDepth: number): number {
    return nodeDepth - this.shoulder.y;
  }

  /** World position of the hero shoulder. */
  shoulderWorld(out: THREE.Vector3): THREE.Vector3 {
    out.copy(this.shoulder);
    this.group.updateWorldMatrix(true, false);
    return this.group.localToWorld(out);
  }

  /** Directions and reaches, so the crater and cracks match this cluster. */
  get layout(): RootSpec[] {
    return this.specs;
  }

  /**
   * Master lift, in metres, reported by the lever.
   *
   * This does NOT move the cluster: the cluster is a child of the group that
   * already carries the lift, because above ground and below ground are one
   * object. What it does is start the per-root release clock, so each root
   * lags out of the soil on its own delay.
   */
  setLift(metres: number): void {
    if (metres > this.liftProgress + 1e-5 && this.releaseStartedAt < 0 && metres > 0.02) {
      this.releaseStartedAt = this.elapsed;
    }
    this.liftProgress = Math.max(0, metres);
    this.group.visible = true;
  }

  /** Called once the cluster is fully clear of the hole. */
  markFreed(): void {
    this.freed = true;
  }

  /**
   * 0 while buried, 1 once hanging in the air. Out of the ground the roots
   * settle downward under their own weight, which is what turns a splayed
   * underground fan into a hanging bunch — without losing the radial pattern
   * that has to match the hole.
   */
  setHang(t: number): void {
    this.hang = clamp01(t);
  }

  /** One left/right shake; returns how many clods let go. */
  shake(): number {
    this.shakeCount++;
    let dropped = 0;
    for (const part of this.parts) {
      for (const clod of part.clods) {
        if (!clod.fallen && clod.releaseAt <= this.shakeCount) {
          clod.fallen = true;
          clod.fallTime = 0;
          clod.velocity.set(
            (Math.random() - 0.5) * 0.5,
            0.15 + Math.random() * 0.2,
            (Math.random() - 0.5) * 0.5,
          );
          dropped++;
        }
      }
    }
    this.soilCoverage = Math.max(0.12, this.soilCoverage - 0.3);
    return dropped;
  }

  get shakesDone(): number {
    return this.shakeCount;
  }

  get allClodsGone(): boolean {
    return this.parts.every((p) => p.clods.every((c) => c.fallen && c.fallTime > 0.9));
  }

  update(dt: number, rock: number): void {
    this.elapsed += dt;

    for (let i = 0; i < this.parts.length; i++) {
      const part = this.parts[i]!;
      let lag = 0;
      if (!this.freed && this.releaseStartedAt >= 0) {
        const since = this.elapsed - this.releaseStartedAt - part.delay;
        // Reluctant, then a soft break-free — the soil does not let go evenly.
        const t = clamp01(since / 0.72);
        lag = -part.stickDepth * (1 - stickyRelease(t));
      }
      // Cluster sways as a bunch when the player rocks it; outer roots more.
      const swayAmp = 0.05 + part.spec.reach * 0.4;
      // Gravity droop: each root rotates about the horizontal axis square to
      // its own direction, so the fan closes downward without twisting.
      const droop = this.hang * (0.13 + (part.spec.slender ? 0.11 : 0.04));
      part.group.position.y = lag;
      part.group.rotation.z = rock * swayAmp * Math.cos(part.spec.azimuth) - droop * Math.cos(part.spec.azimuth);
      part.group.rotation.x = -rock * swayAmp * Math.sin(part.spec.azimuth) + droop * Math.sin(part.spec.azimuth);

      for (const clod of part.clods) {
        if (!clod.fallen) continue;
        clod.fallTime += dt;
        if (clod.fallTime > 1.6) {
          clod.mesh.visible = false;
          continue;
        }
        clod.velocity.y -= 9.81 * dt * 0.55;
        clod.mesh.position.addScaledVector(clod.velocity, dt);
        clod.mesh.rotation.x += clod.spin.x * dt;
        clod.mesh.rotation.z += clod.spin.z * dt;
        const mat = clod.mesh.material as THREE.MeshStandardMaterial;
        if (clod.fallTime > 1.1 && !mat.transparent) {
          // Shared material: fade by shrinking instead of touching opacity.
          clod.mesh.scale.setScalar(Math.max(0.001, 1 - (clod.fallTime - 1.1) / 0.5));
        }
      }
    }

    // Mud film thins out as the cluster is shaken.
    const target = this.soilCoverage;
    for (const m of this.mudMaterials) {
      m.opacity += (target - m.opacity) * Math.min(1, dt * 3);
    }
  }

  /**
   * Every extremity of the cluster, in world space. Used to prove the whole
   * thing is inside the frame — a bounding sphere would be too generous to
   * catch a wide fan clipping the edge of a portrait screen.
   */
  extremities(out: THREE.Vector3[]): THREE.Vector3[] {
    out.length = 0;
    this.group.updateWorldMatrix(true, true);
    const corner = new THREE.Vector3();
    for (const part of this.parts) {
      const mesh = part.group.children.find(
        (c): c is THREE.Mesh => (c as THREE.Mesh).isMesh === true,
      );
      const box = mesh?.geometry.boundingBox;
      if (!mesh || !box) continue;
      for (let i = 0; i < 8; i++) {
        corner.set(
          i & 1 ? box.max.x : box.min.x,
          i & 2 ? box.max.y : box.min.y,
          i & 4 ? box.max.z : box.min.z,
        );
        out.push(mesh.localToWorld(corner.clone()));
      }
    }
    const node = new THREE.Vector3();
    this.node.getWorldPosition(node);
    out.push(node);
    return out;
  }

  /** Current world-space centre and radius, used for camera framing. */
  getFramingSphere(target: THREE.Sphere): THREE.Sphere {
    this.group.updateWorldMatrix(true, false);
    const centre = new THREE.Vector3(0, -this.maxDepth * 0.35, 0);
    this.group.localToWorld(centre);
    target.center.copy(centre);
    target.radius = Math.max(this.maxReach, this.maxDepth) * 1.15 + 0.08;
    return target;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.group.removeFromParent();
  }
}

function stickyRelease(t: number): number {
  const x = clamp01(t);
  // clings, then gives
  return clamp01(Math.pow(x, 3) * 0.35 + (1 - Math.pow(1 - x, 4)) * 0.65);
}

function angleDelta(a: number, b: number): number {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export { UP };
