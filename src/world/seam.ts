import * as THREE from 'three';
import { clamp, lerp, Rng, smoothstep } from '../core/util';
import { frpNormal, sealantNormal } from '../core/textures';
import { Slide, WORK_HALF_LEN, WORK_THETA } from './slide';
import type { DefectKind } from '../game/defects';

/** Grid resolution of the repair state that drives colour, roughness and relief. */
const NS = 64;
const NT = 26;

/** Angular half width of the caulk strip that a player can actually work on. */
const STRIP_THETA = WORK_THETA;

const GROOVE_HALF = 0.075;
const GROOVE_DEPTH = 0.03;
const SEALANT_TOP = -0.007;
const SEALANT_THICK = 0.013;

/** Defects fade out inside the work window so the rest of the ring stays healthy. */
function bottomFalloff(theta: number): number {
  const a = clamp((Math.abs(theta) - 0.1) / 0.1, 0, 1);
  return 1 - smoothstep(a);
}

function grooveProfile(du: number): number {
  const a = clamp(Math.abs(du) / GROOVE_HALF, 0, 1);
  return (1 - smoothstep(a)) * GROOVE_DEPTH;
}

/** Sharp moulding lip just downstream of the joint, faired back into the wall. */
function stepRamp(du: number): number {
  if (du <= 0.004) return 0;
  const rise = smoothstep(clamp((du - 0.004) / 0.009, 0, 1));
  const fall = 1 - smoothstep(clamp((du - 0.125) / 0.085, 0, 1));
  return rise * fall;
}

const SCRATCH_AT = [-0.048, -0.011, 0.028, 0.06];

function scratchProfile(du: number): number {
  let v = 0;
  for (const c of SCRATCH_AT) {
    const a = clamp(Math.abs(du - c) / 0.006, 0, 1);
    v = Math.max(v, (1 - smoothstep(a)) * 0.005);
  }
  return v;
}

function makeThetaList(): number[] {
  const list: number[] = [];
  const denseHalf = 0.55;
  const denseStep = (2 * Math.PI) / 240;
  const nDense = Math.round((2 * denseHalf) / denseStep);
  const coarseSpan = Math.PI - denseHalf;
  const nCoarse = Math.round(coarseSpan / ((2 * Math.PI) / 40));
  for (let i = 0; i <= nCoarse; i++) list.push(-Math.PI + (coarseSpan * i) / nCoarse);
  for (let i = 1; i <= nDense; i++) list.push(-denseHalf + (2 * denseHalf * i) / nDense);
  for (let i = 1; i <= nCoarse; i++) list.push(denseHalf + (coarseSpan * i) / nCoarse);
  return list;
}

interface DynMap {
  tex: THREE.CanvasTexture;
  ctx: CanvasRenderingContext2D;
  small: HTMLCanvasElement;
  smallCtx: CanvasRenderingContext2D;
}

let grainPattern: CanvasPattern | null = null;

/** Fine tiling grain laid over the upscaled state grid so grime has texture. */
function getGrain(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (grainPattern) return grainPattern;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) return null;
  const img = g.createImageData(size, size);
  const rng = new Rng(4919);
  for (let i = 0; i < size * size; i++) {
    const v = 150 + Math.floor(rng.next() * 105);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainPattern = ctx.createPattern(c, 'repeat');
  return grainPattern;
}

function makeDynMap(w: number, h: number, srgb: boolean): DynMap {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const small = document.createElement('canvas');
  small.width = NS;
  small.height = NT;
  const smallCtx = small.getContext('2d');
  if (!ctx || !smallCtx) throw new Error('2d canvas unavailable');
  ctx.imageSmoothingEnabled = true;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 4;
  return { tex, ctx, small, smallCtx };
}

/** Freshly extruded caulk, modelled as a real ridge whose section changes shape. */
class Bead {
  static readonly N = 56;
  static readonly NDU = 17;
  readonly amount = new Float32Array(Bead.N);
  readonly width = new Float32Array(Bead.N).fill(0.032);
  readonly smoothed = new Float32Array(Bead.N);
  readonly excess = new Float32Array(Bead.N);
  readonly mesh: THREE.Mesh;
  private geo = new THREE.BufferGeometry();
  private pos: THREE.Float32BufferAttribute;

  constructor(
    private slide: Slide,
    private uSeam: number,
    private stepHeight: () => number,
    envMap: THREE.Texture,
  ) {
    const n = Bead.N * Bead.NDU;
    this.pos = new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3);
    this.pos.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.pos);
    const uv: number[] = [];
    const idx: number[] = [];
    for (let k = 0; k < Bead.N; k++) {
      for (let m = 0; m < Bead.NDU; m++) {
        uv.push(k / (Bead.N - 1), m / (Bead.NDU - 1));
      }
    }
    for (let k = 0; k < Bead.N - 1; k++) {
      for (let m = 0; m < Bead.NDU - 1; m++) {
        const a = k * Bead.NDU + m;
        const b = (k + 1) * Bead.NDU + m;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    this.geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    this.geo.setIndex(idx);

    const normal = sealantNormal().clone();
    normal.needsUpdate = true;
    normal.wrapS = THREE.RepeatWrapping;
    normal.wrapT = THREE.RepeatWrapping;
    normal.repeat.set(5, 3);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xeef0e6,
      roughness: 0.42,
      metalness: 0,
      sheen: 0.5,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(0xfff6e2),
      normalMap: normal,
      normalScale: new THREE.Vector2(0.16, 0.16),
      envMap,
      envMapIntensity: 0.85,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.name = 'new-sealant';
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.rebuild();
  }

  setAmbient(ao: number): void {
    (this.mesh.material as THREE.MeshPhysicalMaterial).color
      .copy(new THREE.Color(0xeef0e6).convertSRGBToLinear())
      .multiplyScalar(ao);
  }

  reset(): void {
    this.amount.fill(0);
    this.width.fill(0.032);
    this.smoothed.fill(0);
    this.excess.fill(0);
    this.mesh.visible = false;
    this.rebuild();
  }

  thetaAt(k: number): number {
    return -STRIP_THETA + (2 * STRIP_THETA * k) / (Bead.N - 1);
  }

  indexForS(s: number): number {
    return clamp(Math.round(((s + 1) / 2) * (Bead.N - 1)), 0, Bead.N - 1);
  }

  private surface(k: number, du: number): number {
    const stepH = this.stepHeight();
    const base = -grooveProfile(du) + stepH * stepRamp(du);
    const target = stepH * smoothstep(clamp((du + GROOVE_HALF) / 0.15, 0, 1));
    const w = this.width[k];
    const bulge = 0.017 * Math.exp(-((du / w) * (du / w)));
    const extra = this.excess[k] * 0.011 * Math.exp(-((du / 0.032) * (du / 0.032)));
    const raw = target + bulge * (1 - 0.74 * this.smoothed[k]) + extra;
    const edge = 1 - smoothstep(clamp((Math.abs(du) - 0.048) / 0.032, 0, 1));
    // taper the run-out at both ends so the ridge does not stop like a brick
    const endK = Math.min(k, Bead.N - 1 - k) / 4;
    const ends = endK >= 1 ? 1 : smoothstep(clamp(endK, 0, 1));
    return base + (raw - base) * edge * ends * clamp(this.amount[k], 0, 1);
  }

  rebuild(): void {
    const arr = this.pos.array as Float32Array;
    const p = new THREE.Vector3();
    let i = 0;
    let any = false;
    for (let k = 0; k < Bead.N; k++) {
      if (this.amount[k] > 0.01) any = true;
      const theta = this.thetaAt(k);
      for (let m = 0; m < Bead.NDU; m++) {
        const du = -0.082 + (0.164 * m) / (Bead.NDU - 1);
        const h = this.surface(k, du);
        this.slide.pointAt(this.uSeam + this.slide.metersToU(du), theta, h, p);
        arr[i++] = p.x;
        arr[i++] = p.y;
        arr[i++] = p.z;
      }
    }
    this.pos.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
    this.mesh.visible = any;
    // drawn down material closes up and picks up a little more sheen
    (this.mesh.material as THREE.MeshPhysicalMaterial).roughness = lerp(0.52, 0.3, this.smoothness());
  }

  /** Mean fill coverage across the work strip. */
  coverage(): number {
    let sum = 0;
    for (let k = 0; k < Bead.N; k++) sum += clamp(this.amount[k], 0, 1);
    return sum / Bead.N;
  }

  smoothness(): number {
    let sum = 0;
    let w = 0;
    for (let k = 0; k < Bead.N; k++) {
      const a = clamp(this.amount[k], 0, 1);
      sum += this.smoothed[k] * a;
      w += a;
    }
    return w > 0.001 ? sum / w : 0;
  }
}

/** The old, hardened caulk strip: it lifts under raking light and peels in one piece. */
class Ribbon {
  readonly mesh: THREE.Mesh;
  readonly rest: THREE.Mesh;
  peel = 0;
  lift = 0;
  peelable = true;
  fade = 1;
  readonly grab = new THREE.Vector3();
  private geo = new THREE.BufferGeometry();
  private pos: THREE.Float32BufferAttribute;
  private static readonly N = 46;
  private static readonly W = 5;
  private mat: THREE.MeshPhysicalMaterial;
  private tmp = {
    a: new THREE.Vector3(),
    b: new THREE.Vector3(),
    c: new THREE.Vector3(),
    d: new THREE.Vector3(),
    e: new THREE.Vector3(),
    f: new THREE.Vector3(),
    g: new THREE.Vector3(),
  };

  constructor(
    private slide: Slide,
    private uSeam: number,
    envMap: THREE.Texture,
  ) {
    const N = Ribbon.N;
    const W = Ribbon.W;
    const count = N * W * 2;
    this.pos = new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3);
    this.pos.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.pos);

    const colors = new Float32Array(count * 3);
    const top = new THREE.Color(0xa9a99b).convertSRGBToLinear();
    const under = new THREE.Color(0x6d6353).convertSRGBToLinear();
    for (let k = 0; k < N; k++) {
      for (let j = 0; j < W; j++) {
        const t = (k * W + j) * 3;
        const b = (N * W + k * W + j) * 3;
        const mottle = 0.86 + 0.14 * Math.sin(k * 2.3 + j * 1.7);
        colors[t] = top.r * mottle;
        colors[t + 1] = top.g * mottle;
        colors[t + 2] = top.b * mottle;
        colors[b] = under.r * mottle;
        colors[b + 1] = under.g * mottle;
        colors[b + 2] = under.b * mottle;
      }
    }
    this.geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const uv = new Float32Array(count * 2);
    for (let k = 0; k < N; k++) {
      for (let j = 0; j < W; j++) {
        const t = (k * W + j) * 2;
        const b = (N * W + k * W + j) * 2;
        uv[t] = k / (N - 1);
        uv[t + 1] = j / (W - 1);
        uv[b] = k / (N - 1);
        uv[b + 1] = j / (W - 1);
      }
    }
    this.geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));

    const idx: number[] = [];
    const T = (k: number, j: number): number => k * W + j;
    const B = (k: number, j: number): number => N * W + k * W + j;
    for (let k = 0; k < N - 1; k++) {
      for (let j = 0; j < W - 1; j++) {
        idx.push(T(k, j), T(k + 1, j), T(k, j + 1), T(k, j + 1), T(k + 1, j), T(k + 1, j + 1));
        idx.push(B(k, j), B(k, j + 1), B(k + 1, j), B(k, j + 1), B(k + 1, j + 1), B(k + 1, j));
      }
      // side walls give the strip real thickness
      idx.push(T(k, 0), B(k, 0), T(k + 1, 0), T(k + 1, 0), B(k, 0), B(k + 1, 0));
      idx.push(T(k, W - 1), T(k + 1, W - 1), B(k, W - 1), T(k + 1, W - 1), B(k + 1, W - 1), B(k, W - 1));
    }
    for (let j = 0; j < W - 1; j++) {
      idx.push(T(0, j), T(0, j + 1), B(0, j), T(0, j + 1), B(0, j + 1), B(0, j));
      idx.push(T(N - 1, j), B(N - 1, j), T(N - 1, j + 1), T(N - 1, j + 1), B(N - 1, j), B(N - 1, j + 1));
    }
    this.geo.setIndex(idx);

    const normal = sealantNormal().clone();
    normal.needsUpdate = true;
    normal.wrapS = THREE.RepeatWrapping;
    normal.wrapT = THREE.RepeatWrapping;
    normal.repeat.set(9, 1.4);
    this.mat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.72,
      metalness: 0,
      normalMap: normal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      envMap,
      envMapIntensity: 0.9,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.name = 'old-sealant';
    this.mesh.frustumCulled = false;

    this.rest = this.buildRest(envMap);
    this.rebuild();
  }

  private buildRest(envMap: THREE.Texture): THREE.Mesh {
    const N = 30;
    const W = 3;
    const positions: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];
    const p = new THREE.Vector3();
    const span = 2 * Math.PI - 2 * (STRIP_THETA + 0.02);
    for (let k = 0; k < N; k++) {
      const theta = STRIP_THETA + 0.02 + (span * k) / (N - 1);
      for (let j = 0; j < W; j++) {
        const du = -0.058 + (0.116 * j) / (W - 1);
        this.slide.pointAt(this.uSeam + this.slide.metersToU(du), theta, SEALANT_TOP, p);
        positions.push(p.x, p.y, p.z);
        uvs.push((k / (N - 1)) * 12, j / (W - 1));
      }
    }
    for (let k = 0; k < N - 1; k++) {
      for (let j = 0; j < W - 1; j++) {
        const a = k * W + j;
        const b = (k + 1) * W + j;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const restNormal = sealantNormal().clone();
    restNormal.needsUpdate = true;
    restNormal.wrapS = THREE.RepeatWrapping;
    restNormal.wrapT = THREE.RepeatWrapping;
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshPhysicalMaterial({
        color: 0x8d8f84,
        roughness: 0.7,
        metalness: 0,
        normalMap: restNormal,
        envMap,
        envMapIntensity: 0.85,
        side: THREE.DoubleSide,
      }),
    );
    mesh.name = 'old-sealant-ring';
    mesh.frustumCulled = false;
    return mesh;
  }

  /** Applies the flume's baked ambient level so the strip sits in its lighting. */
  setAmbient(ao: number): void {
    this.mat.color.setScalar(ao);
    const rest = this.rest.material as THREE.MeshPhysicalMaterial;
    rest.color.copy(new THREE.Color(0xa8a89a).convertSRGBToLinear()).multiplyScalar(ao);
  }

  setFade(v: number): void {
    this.fade = v;
    this.mat.opacity = v;
    this.mesh.visible = v > 0.02;
  }

  reset(peelable: boolean): void {
    this.peel = 0;
    this.lift = 0;
    this.peelable = peelable;
    this.setFade(1);
    this.rebuild();
  }

  private thetaAt(k: number): number {
    return -STRIP_THETA + (2 * STRIP_THETA * k) / (Ribbon.N - 1);
  }

  rebuild(): void {
    const arr = this.pos.array as Float32Array;
    const N = Ribbon.N;
    const W = Ribbon.W;
    const front = -STRIP_THETA + 2 * STRIP_THETA * this.peel;
    const { a: A, b: nrm, c: C, d: P, e: tangent, f: wide, g: thick } = this.tmp;

    if (this.peel > 0.001) {
      this.slide.pointAt(this.uSeam, front, SEALANT_TOP, A);
      this.slide.normalAt(this.uSeam, front, nrm);
      C.copy(A).addScaledVector(nrm, 0.115).addScaledVector(this.tmp.d.copy(this.grab).sub(A), 0.35);
    }

    for (let k = 0; k < N; k++) {
      const theta = this.thetaAt(k);
      const peeled = this.peel > 0.001 && theta < front;
      if (!peeled) {
        for (let j = 0; j < W; j++) {
          const du = -0.058 + (0.116 * j) / (W - 1);
          const liftEdge =
            this.lift *
            0.014 *
            smoothstep(clamp((du - 0.008) / 0.05, 0, 1)) *
            bottomFalloff(theta);
          const h = SEALANT_TOP + liftEdge;
          this.slide.pointAt(this.uSeam + this.slide.metersToU(du), theta, h, P);
          const ti = (k * W + j) * 3;
          arr[ti] = P.x;
          arr[ti + 1] = P.y;
          arr[ti + 2] = P.z;
          this.slide.pointAt(this.uSeam + this.slide.metersToU(du), theta, h - SEALANT_THICK, P);
          const bi = (N * W + k * W + j) * 3;
          arr[bi] = P.x;
          arr[bi + 1] = P.y;
          arr[bi + 2] = P.z;
        }
        continue;
      }

      // Peeled: ride a curl from the peel front up to where the finger pulls.
      const span = front + STRIP_THETA;
      const a = span > 1e-4 ? clamp((front - theta) / span, 0, 1) : 0;
      quadBezier(A, C, this.grab, a, P);
      quadBezier(A, C, this.grab, Math.min(1, a + 0.02), tangent);
      tangent.sub(P);
      if (tangent.lengthSq() < 1e-9) tangent.set(0, 0.001, 0);
      tangent.normalize();
      wide.crossVectors(tangent, nrm);
      if (wide.lengthSq() < 1e-9) wide.set(1, 0, 0);
      wide.normalize();
      thick.crossVectors(wide, tangent).normalize();
      // gentle twist so the strip reads as rubber rather than card
      const twist = a * 0.95;
      const cw = Math.cos(twist);
      const sw = Math.sin(twist);
      for (let j = 0; j < W; j++) {
        const du = -0.058 + (0.116 * j) / (W - 1);
        const ox = wide.x * cw + thick.x * sw;
        const oy = wide.y * cw + thick.y * sw;
        const oz = wide.z * cw + thick.z * sw;
        const tx = -wide.x * sw + thick.x * cw;
        const ty = -wide.y * sw + thick.y * cw;
        const tz = -wide.z * sw + thick.z * cw;
        const ti = (k * W + j) * 3;
        arr[ti] = P.x + ox * du;
        arr[ti + 1] = P.y + oy * du;
        arr[ti + 2] = P.z + oz * du;
        const bi = (N * W + k * W + j) * 3;
        arr[bi] = arr[ti] - tx * SEALANT_THICK;
        arr[bi + 1] = arr[ti + 1] - ty * SEALANT_THICK;
        arr[bi + 2] = arr[ti + 2] - tz * SEALANT_THICK;
      }
    }
    this.pos.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }
}

function quadBezier(
  a: THREE.Vector3,
  c: THREE.Vector3,
  b: THREE.Vector3,
  t: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const mt = 1 - t;
  out.set(
    mt * mt * a.x + 2 * mt * t * c.x + t * t * b.x,
    mt * mt * a.y + 2 * mt * t * c.y + t * t * b.y,
    mt * mt * a.z + 2 * mt * t * c.z + t * t * b.z,
  );
  return out;
}

/**
 * A single moulding joint: high resolution wall geometry, the caulk that sits in
 * it, and the live repair state that colour, roughness and relief are baked from.
 */
export class SeamCollar {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly proxy: THREE.Mesh;
  readonly ribbon: Ribbon;
  readonly bead: Bead;
  defect: DefectKind | null = null;

  /** Per cell repair state across the work window. */
  readonly dirt = new Float32Array(NS * NT);
  readonly cloud = new Float32Array(NS * NT);
  readonly dull = new Float32Array(NS * NT);
  /** Polish level per cell, 0 = as found and matt, 1 = fully brought up. */
  readonly work = new Float32Array(NS * NT);
  /** How much compound the pad has actually laid down on each cell. */
  readonly touch = new Float32Array(NS * NT);
  scratchLevel = 0;
  private stepH = 0;

  private thetas = makeThetaList();
  private dus: number[] = [];
  private geo = new THREE.BufferGeometry();
  private pos: THREE.Float32BufferAttribute;
  private colorMap: DynMap;
  private roughMap: DynMap;
  private material: THREE.MeshPhysicalMaterial;
  private mapDirty = true;
  private geoDirty = true;
  private mapTimer = 0;
  private geoTimer = 0;

  constructor(
    private slide: Slide,
    readonly index: number,
    readonly u: number,
    envMap: THREE.Texture,
  ) {
    for (let i = 0; i <= 44; i++) this.dus.push(-WORK_HALF_LEN + (2 * WORK_HALF_LEN * i) / 44);

    const NTh = this.thetas.length;
    const NDu = this.dus.length;
    this.pos = new THREE.Float32BufferAttribute(new Float32Array(NTh * NDu * 3), 3);
    this.pos.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.pos);

    const uv: number[] = [];
    for (let i = 0; i < NDu; i++) {
      for (let j = 0; j < NTh; j++) {
        uv.push(0.5 + this.thetas[j] / (2 * WORK_THETA), 0.5 + this.dus[i] / (2 * WORK_HALF_LEN));
      }
    }
    this.geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    // Second set keeps the moulding relief running the same way as the long runs
    // either side of the joint, so the collar does not read as a pasted-on patch.
    const uv1: number[] = [];
    const axial = slide.length / (2 * Math.PI * slide.radius);
    for (let i = 0; i < NDu; i++) {
      for (let j = 0; j < NTh; j++) {
        uv1.push(
          (u + slide.metersToU(this.dus[i])) * axial,
          (this.thetas[j] + Math.PI) / (2 * Math.PI),
        );
      }
    }
    this.geo.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1, 2));
    const idx: number[] = [];
    for (let i = 0; i < NDu - 1; i++) {
      for (let j = 0; j < NTh - 1; j++) {
        const a = i * NTh + j;
        const b = (i + 1) * NTh + j;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    this.geo.setIndex(idx);

    this.colorMap = makeDynMap(256, 112, true);
    this.roughMap = makeDynMap(256, 112, false);

    const normal = frpNormal();
    this.material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: this.colorMap.tex,
      roughnessMap: this.roughMap.tex,
      roughness: 1,
      metalness: 0,
      clearcoat: 0.32,
      clearcoatRoughness: 0.12,
      normalMap: normal,
      normalScale: new THREE.Vector2(0.5, 0.5),
      envMap,
      envMapIntensity: 0.8,
      side: THREE.FrontSide,
    });
    this.material.normalMap = normal.clone();
    this.material.normalMap.wrapS = THREE.RepeatWrapping;
    this.material.normalMap.wrapT = THREE.RepeatWrapping;
    this.material.normalMap.repeat.set(27, 27);
    this.material.normalMap.channel = 1;
    this.material.normalMap.needsUpdate = true;

    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.name = `seam-collar-${index}`;
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;

    this.ribbon = new Ribbon(slide, u, envMap);
    this.ribbon.mesh.castShadow = true;
    this.bead = new Bead(slide, u, () => this.stepH, envMap);

    this.group.add(this.mesh, this.ribbon.rest, this.ribbon.mesh, this.bead.mesh);

    this.proxy = this.buildProxy();
    this.group.add(this.proxy);

    const ao = slide.ambientAt(u, 0);
    this.material.color.setScalar(ao);
    this.ribbon.setAmbient(ao);
    this.bead.setAmbient(ao);

    this.clearDefect();
    this.rebuildGeometry();
    this.paint();
  }

  /** Oversized invisible surface used to turn a touch into work-window coordinates. */
  private buildProxy(): THREE.Mesh {
    const NThP = 16;
    const NDuP = 10;
    const positions: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const p = new THREE.Vector3();
    for (let i = 0; i < NDuP; i++) {
      const du = -0.34 + (0.68 * i) / (NDuP - 1);
      for (let j = 0; j < NThP; j++) {
        const th = -0.45 + (0.9 * j) / (NThP - 1);
        this.slide.pointAt(this.u + this.slide.metersToU(du), th, 0, p);
        positions.push(p.x, p.y, p.z);
        uv.push(0.5 + th / (2 * WORK_THETA), 0.5 + du / (2 * WORK_HALF_LEN));
      }
    }
    for (let i = 0; i < NDuP - 1; i++) {
      for (let j = 0; j < NThP - 1; j++) {
        const a = i * NThP + j;
        const b = (i + 1) * NThP + j;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
    m.name = `seam-proxy-${this.index}`;
    m.visible = false;
    return m;
  }

  // ---- state -----------------------------------------------------------

  cell(s: number, t: number): number {
    const i = clamp(Math.round(((s + 1) / 2) * (NS - 1)), 0, NS - 1);
    const j = clamp(Math.round(((t + 1) / 2) * (NT - 1)), 0, NT - 1);
    return j * NS + i;
  }

  clearDefect(): void {
    this.defect = null;
    this.dirt.fill(0);
    this.cloud.fill(0);
    this.dull.fill(0);
    this.work.fill(1);
    this.touch.fill(0);
    this.scratchLevel = 0;
    this.stepH = 0;
    this.ribbon.reset(false);
    this.bead.reset();
    this.mapDirty = true;
    this.geoDirty = true;
  }

  setDefect(kind: DefectKind): void {
    this.clearDefect();
    this.defect = kind;
    this.work.fill(0.5);
    const blob = (amp: number, arr: Float32Array, sx: number, sy: number): void => {
      for (let j = 0; j < NT; j++) {
        for (let i = 0; i < NS; i++) {
          const s = (i / (NS - 1)) * 2 - 1;
          const t = (j / (NT - 1)) * 2 - 1;
          const d = Math.hypot((s - sx) / 0.95, (t - sy) / 1.15);
          arr[j * NS + i] = Math.max(arr[j * NS + i], amp * (1 - smoothstep(clamp(d, 0, 1))));
        }
      }
    };
    switch (kind) {
      case 'step':
        this.stepH = 0.03;
        this.work.fill(0.34);
        this.ribbon.reset(true);
        break;
      case 'oldSealant':
        this.stepH = 0.006;
        this.work.fill(0.88);
        this.ribbon.reset(true);
        break;
      case 'cloudy':
        blob(1, this.cloud, 0.05, 0.1);
        blob(0.62, this.dirt, -0.1, -0.05);
        this.work.fill(0.06);
        break;
      case 'scratch':
        this.scratchLevel = 1;
        this.work.fill(0.22);
        break;
      case 'wax':
        blob(0.85, this.dull, 0, 0);
        this.work.fill(0.14);
        break;
    }
    this.mapDirty = true;
    this.geoDirty = true;
  }

  get stepHeight(): number {
    return this.stepH;
  }

  /** Base wall relief without any live repair state. */
  private heightAt(du: number, theta: number, sampleDirt: boolean): number {
    const w = bottomFalloff(theta);
    let h = -grooveProfile(du);
    if (this.stepH > 0) h += this.stepH * w * stepRamp(du);
    if (this.scratchLevel > 0.001) h -= scratchProfile(du) * w * this.scratchLevel;
    if (sampleDirt && Math.abs(du) < GROOVE_HALF) {
      const s = clamp(theta / WORK_THETA, -1, 1);
      const d = this.dirt[this.cell(s, 0)];
      if (d > 0.01) {
        const ripple =
          0.55 + 0.45 * Math.sin(theta * 17 + du * 34) * Math.sin(theta * 9.3 - 2.1);
        h += d * 0.005 * ripple * w;
      }
    }
    return h;
  }

  rebuildGeometry(): void {
    const arr = this.pos.array as Float32Array;
    const p = new THREE.Vector3();
    const NTh = this.thetas.length;
    let k = 0;
    for (let i = 0; i < this.dus.length; i++) {
      const du = this.dus[i];
      const uu = this.u + this.slide.metersToU(du);
      for (let j = 0; j < NTh; j++) {
        const theta = this.thetas[j];
        this.slide.pointAt(uu, theta, this.heightAt(du, theta, true), p);
        arr[k++] = p.x;
        arr[k++] = p.y;
        arr[k++] = p.z;
      }
    }
    this.pos.needsUpdate = true;
    this.geo.computeVertexNormals();
    // weld the ceiling seam so the ring has no visible facet
    const nrm = this.geo.getAttribute('normal') as THREE.BufferAttribute;
    for (let i = 0; i < this.dus.length; i++) {
      const a = i * NTh;
      const b = i * NTh + NTh - 1;
      const nx = (nrm.getX(a) + nrm.getX(b)) * 0.5;
      const ny = (nrm.getY(a) + nrm.getY(b)) * 0.5;
      const nz = (nrm.getZ(a) + nrm.getZ(b)) * 0.5;
      nrm.setXYZ(a, nx, ny, nz);
      nrm.setXYZ(b, nx, ny, nz);
    }
    nrm.needsUpdate = true;
    this.geo.computeBoundingSphere();
    this.geoDirty = false;
  }

  /** Rasterises the repair state grid into the colour and roughness maps. */
  paint(): void {
    const cImg = this.colorMap.smallCtx.createImageData(NS, NT);
    const rImg = this.roughMap.smallCtx.createImageData(NS, NT);
    for (let j = 0; j < NT; j++) {
      for (let i = 0; i < NS; i++) {
        const n = j * NS + i;
        const dirt = clamp(this.dirt[n], 0, 1);
        const cloud = clamp(this.cloud[n], 0, 1);
        const dull = clamp(this.dull[n], 0, 1);
        const gloss = clamp(this.work[n], 0, 1);
        // Compound clouds the surface on the way up and clears as gloss arrives.
        const haze =
          clamp(this.touch[n], 0, 1) * clamp(1 - Math.abs(gloss - 0.55) / 0.42, 0, 1) * 0.9;

        let r = lerp(0.44, 0.055, gloss);
        r = lerp(r, 0.3, dull);
        r = lerp(r, 0.6, cloud);
        r = lerp(r, 0.78, dirt);
        r = lerp(r, 0.88, haze);

        let cr = 0.85;
        let cg = 0.91;
        let cb = 0.9;
        cr = lerp(cr, 0.4, dirt * 0.9);
        cg = lerp(cg, 0.37, dirt * 0.9);
        cb = lerp(cb, 0.31, dirt * 0.9);
        cr = lerp(cr, 0.95, cloud * 0.55);
        cg = lerp(cg, 0.96, cloud * 0.55);
        cb = lerp(cb, 0.94, cloud * 0.55);
        cr = lerp(cr, 0.98, haze * 0.8);
        cg = lerp(cg, 0.98, haze * 0.8);
        cb = lerp(cb, 0.96, haze * 0.8);

        const ci = n * 4;
        cImg.data[ci] = cr * 255;
        cImg.data[ci + 1] = cg * 255;
        cImg.data[ci + 2] = cb * 255;
        cImg.data[ci + 3] = 255;
        rImg.data[ci] = 255;
        rImg.data[ci + 1] = clamp(r, 0, 1) * 255;
        rImg.data[ci + 2] = 0;
        rImg.data[ci + 3] = 255;
      }
    }
    this.blit(this.colorMap, cImg, true);
    this.blit(this.roughMap, rImg, false);

    const gloss = this.meanGloss();
    const k = lerp(0.62, 0.14, gloss);
    this.material.normalScale.set(k, k);
    this.mapDirty = false;
  }

  private blit(map: DynMap, img: ImageData, grain: boolean): void {
    const w = map.tex.image.width as number;
    const h = map.tex.image.height as number;
    map.smallCtx.putImageData(img, 0, 0);
    map.ctx.imageSmoothingEnabled = true;
    map.ctx.clearRect(0, 0, w, h);
    map.ctx.drawImage(map.small, 0, 0, w, h);
    if (grain) {
      const pattern = getGrain(map.ctx);
      if (pattern) {
        map.ctx.globalCompositeOperation = 'overlay';
        map.ctx.globalAlpha = 0.3;
        map.ctx.fillStyle = pattern;
        map.ctx.fillRect(0, 0, w, h);
        map.ctx.globalAlpha = 1;
        map.ctx.globalCompositeOperation = 'source-over';
      }
    }
    map.tex.needsUpdate = true;
  }

  markMaps(): void {
    this.mapDirty = true;
  }

  markGeometry(): void {
    this.geoDirty = true;
  }

  update(dt: number): void {
    this.mapTimer -= dt;
    this.geoTimer -= dt;
    if (this.mapDirty && this.mapTimer <= 0) {
      this.paint();
      this.mapTimer = 0.05;
    }
    if (this.geoDirty && this.geoTimer <= 0) {
      this.rebuildGeometry();
      this.geoTimer = 0.09;
    }
  }

  // ---- treatment operations -------------------------------------------

  /** Applies a radial brush stroke that lifts old residue and grime. */
  scrub(s: number, t: number, radius: number, amount: number): number {
    return this.stamp(this.dirt, s, t, radius, -amount);
  }

  polish(s: number, t: number, radius: number, amount: number): number {
    let touched = 0;
    for (let j = 0; j < NT; j++) {
      for (let i = 0; i < NS; i++) {
        const cs = (i / (NS - 1)) * 2 - 1;
        const ct = (j / (NT - 1)) * 2 - 1;
        const d = Math.hypot((cs - s) / radius, (ct - t) / (radius * 1.6));
        if (d >= 1) continue;
        const f = (1 - smoothstep(d)) * amount;
        const n = j * NS + i;
        const before = this.work[n];
        this.touch[n] = Math.min(1, this.touch[n] + f * 5);
        this.work[n] = Math.min(1, this.work[n] + f * 1.7);
        this.cloud[n] = Math.max(0, this.cloud[n] - f * 2.4);
        this.dull[n] = Math.max(0, this.dull[n] - f * 3.2);
        touched += this.work[n] - before;
      }
    }
    if (this.scratchLevel > 0 && Math.abs(t) < 0.9) {
      this.scratchLevel = Math.max(0, this.scratchLevel - amount * 0.5);
      this.geoDirty = true;
    }
    if (touched > 0) this.mapDirty = true;
    return touched;
  }

  private stamp(
    arr: Float32Array,
    s: number,
    t: number,
    radius: number,
    delta: number,
  ): number {
    let touched = 0;
    for (let j = 0; j < NT; j++) {
      for (let i = 0; i < NS; i++) {
        const cs = (i / (NS - 1)) * 2 - 1;
        const ct = (j / (NT - 1)) * 2 - 1;
        const d = Math.hypot((cs - s) / radius, (ct - t) / (radius * 1.6));
        if (d >= 1) continue;
        const n = j * NS + i;
        const before = arr[n];
        arr[n] = clamp(arr[n] + delta * (1 - smoothstep(d)), 0, 1);
        touched += Math.abs(arr[n] - before);
      }
    }
    if (touched > 0) {
      this.mapDirty = true;
      if (arr === this.dirt) this.geoDirty = true;
    }
    return touched;
  }

  /** Called when the old strip finally lets go: the groove is left grubby. */
  soilGroove(): void {
    for (let j = 0; j < NT; j++) {
      const ct = (j / (NT - 1)) * 2 - 1;
      const across = 1 - smoothstep(clamp((Math.abs(ct) - 0.12) / 0.35, 0, 1));
      for (let i = 0; i < NS; i++) {
        const cs = (i / (NS - 1)) * 2 - 1;
        const along = 1 - smoothstep(clamp((Math.abs(cs) - 0.72) / 0.28, 0, 1));
        const grain = 0.68 + 0.32 * Math.sin(i * 0.9 + j * 1.35) * Math.cos(i * 0.41);
        this.dirt[j * NS + i] = Math.max(this.dirt[j * NS + i], across * along * grain);
      }
    }
    this.mapDirty = true;
    this.geoDirty = true;
  }

  meanDirt(): number {
    let sum = 0;
    let w = 0;
    for (let j = 0; j < NT; j++) {
      const ct = (j / (NT - 1)) * 2 - 1;
      if (Math.abs(ct) > 0.55) continue;
      for (let i = 0; i < NS; i++) {
        sum += this.dirt[j * NS + i];
        w++;
      }
    }
    return w ? sum / w : 0;
  }

  meanCloud(): number {
    let sum = 0;
    for (let n = 0; n < this.cloud.length; n++) sum += this.cloud[n] + this.dull[n] * 0.8;
    return sum / this.cloud.length;
  }

  meanGloss(): number {
    let sum = 0;
    for (let n = 0; n < this.work.length; n++) sum += clamp(this.work[n], 0, 1);
    return sum / this.work.length;
  }

  /** 0..1 quality used by the water test to decide how freely the drop runs. */
  quality(): number {
    const flat = 1 - clamp(this.stepH / 0.021, 0, 1) * (1 - this.bead.smoothness() * this.bead.coverage());
    const clean = 1 - this.meanDirt();
    const clear = 1 - clamp(this.meanCloud() * 1.4, 0, 1);
    const scratched = 1 - this.scratchLevel;
    return clamp(Math.min(flat, clean, clear, scratched), 0, 1);
  }

  setShadowCasting(on: boolean): void {
    this.mesh.receiveShadow = on;
    this.ribbon.mesh.castShadow = on;
    this.ribbon.mesh.receiveShadow = on;
    this.bead.mesh.castShadow = on;
  }
}

export { NS, NT, STRIP_THETA };
