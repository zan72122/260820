import * as THREE from 'three';
import { clamp01, lerp, smoothstep } from '../util/math';
import type { FloorSpec, MarkKind } from '../physics/params';

/**
 * A test surface that remembers what happened to it.
 *
 * Two independent records are kept:
 *   - a height field, resampled into the mesh, for craters, dents and the
 *     transient squash that happens *while* the ball is in contact;
 *   - a wear canvas, blended into the shader, for the darker damp ring around
 *     a clay strike or the polished patch a rubber ball leaves behind.
 *
 * Marks are never cleared automatically. The child gets to look at them, and
 * can wipe them with the brush when they want a fresh surface.
 */

export type PanelShape = 'circle' | 'rect';

export interface PanelOptions {
  shape: PanelShape;
  halfX: number;
  halfZ: number;
  /** Height-field cells across the panel. */
  fieldRes: number;
  /** Mesh rings (circle) or rows (rect). */
  meshRes: number;
  wearRes: number;
}

interface WearUniforms {
  uWear: { value: THREE.Texture };
  uWearStrength: { value: number };
}

/** Blend a per-panel wear texture into a standard material. */
export function attachWearMap(material: THREE.Material, texture: THREE.Texture, strength = 1) {
  const uniforms: WearUniforms = { uWear: { value: texture }, uWearStrength: { value: strength } };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWear = uniforms.uWear;
    shader.uniforms.uWearStrength = uniforms.uWearStrength;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWearUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvWearUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform sampler2D uWear;
         uniform float uWearStrength;
         varying vec2 vWearUv;`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         vec4 wear = texture2D(uWear, vWearUv) * uWearStrength;
         // r darkens the surface, b adds a damp sheen, g scuffs it lighter.
         diffuseColor.rgb *= (1.0 - wear.r * 0.72);
         diffuseColor.rgb *= (1.0 - wear.b * 0.34);
         diffuseColor.rgb += wear.g * 0.16;`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         // Damp marks go glossy, dry scuffs go slightly smoother, dust duller.
         roughnessFactor = clamp(roughnessFactor - wear.b * 0.55 - wear.g * 0.12 + wear.a * 0.2, 0.03, 1.0);`
      );
  };
  material.customProgramCacheKey = () => 'wear';
  material.needsUpdate = true;
  return uniforms;
}

export class DeformablePanel {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly opts: PanelOptions;
  spec: FloorSpec;

  /** Depth that stays for good, in metres (positive = pushed down). */
  private persistent: Float32Array;
  /** Depth that springs back over time. */
  private recovering: Float32Array;
  private recoverRate = 0.6;

  private transientActive = false;
  private transientX = 0;
  private transientZ = 0;
  private transientDepth = 0;
  private transientRadius = 0.1;

  private geometry: THREE.BufferGeometry;
  private basePositions: Float32Array;
  private fieldDirty = true;

  private wearCanvas: HTMLCanvasElement;
  private wearCtx: CanvasRenderingContext2D;
  readonly wearTexture: THREE.CanvasTexture;

  constructor(spec: FloorSpec, opts: PanelOptions) {
    this.spec = spec;
    this.opts = opts;
    const n = opts.fieldRes;
    this.persistent = new Float32Array(n * n);
    this.recovering = new Float32Array(n * n);

    this.geometry = opts.shape === 'circle' ? buildDisc(opts.halfX, opts.meshRes) : buildGrid(opts.halfX, opts.halfZ, opts.meshRes);
    this.basePositions = (this.geometry.getAttribute('position') as THREE.BufferAttribute).array.slice() as Float32Array;

    this.mesh = new THREE.Mesh(this.geometry, new THREE.MeshStandardMaterial());
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);

    this.wearCanvas = document.createElement('canvas');
    this.wearCanvas.width = opts.wearRes;
    this.wearCanvas.height = opts.wearRes;
    this.wearCtx = this.wearCanvas.getContext('2d')!;
    this.clearWear();
    this.wearTexture = new THREE.CanvasTexture(this.wearCanvas);
    this.wearTexture.colorSpace = THREE.NoColorSpace;
    this.wearTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.wearTexture.wrapT = THREE.ClampToEdgeWrapping;
  }

  setMaterial(mat: THREE.Material) {
    this.mesh.material = mat;
  }

  private clearWear() {
    this.wearCtx.clearRect(0, 0, this.opts.wearRes, this.opts.wearRes);
    this.wearCtx.fillStyle = 'rgba(0,0,0,0)';
    this.wearCtx.fillRect(0, 0, this.opts.wearRes, this.opts.wearRes);
  }

  /** Panel-local metres -> height-field cell coordinates (may be fractional). */
  private toField(lx: number, lz: number) {
    const n = this.opts.fieldRes;
    const fx = ((lx / this.opts.halfX) * 0.5 + 0.5) * (n - 1);
    const fz = ((lz / this.opts.halfZ) * 0.5 + 0.5) * (n - 1);
    return { fx, fz };
  }

  /** Current sink depth at a panel-local point, in metres. */
  depthAt(lx: number, lz: number) {
    const n = this.opts.fieldRes;
    const { fx, fz } = this.toField(lx, lz);
    if (fx < 0 || fz < 0 || fx > n - 1 || fz > n - 1) return this.transientAt(lx, lz);
    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const x1 = Math.min(x0 + 1, n - 1);
    const z1 = Math.min(z0 + 1, n - 1);
    const tx = fx - x0;
    const tz = fz - z0;
    const at = (x: number, z: number) => this.persistent[z * n + x] + this.recovering[z * n + x];
    const a = lerp(at(x0, z0), at(x1, z0), tx);
    const b = lerp(at(x0, z1), at(x1, z1), tz);
    return lerp(a, b, tz) + this.transientAt(lx, lz);
  }

  private transientAt(lx: number, lz: number) {
    if (!this.transientActive) return 0;
    const d = Math.hypot(lx - this.transientX, lz - this.transientZ);
    if (d >= this.transientRadius) return 0;
    const t = 1 - d / this.transientRadius;
    return this.transientDepth * t * t * (3 - 2 * t);
  }

  /** The live squash under the ball while it is in contact. */
  setTransient(lx: number, lz: number, depth: number, radius: number) {
    this.transientActive = depth > 1e-6;
    this.transientX = lx;
    this.transientZ = lz;
    this.transientDepth = depth;
    this.transientRadius = Math.max(radius, 0.02);
    this.fieldDirty = true;
  }

  clearTransient() {
    if (!this.transientActive) return;
    this.transientActive = false;
    this.transientDepth = 0;
    this.fieldDirty = true;
  }

  /**
   * Carve the mark an impact leaves behind. `depth` is how far the surface
   * gave way; how much of it stays is the material's business.
   */
  carve(lx: number, lz: number, depth: number, ballRadius: number, kind: MarkKind, energy: number) {
    const n = this.opts.fieldRes;
    const persistence = this.spec.markPersistence;
    if (kind === 'none' || kind === 'ripple' || depth <= 1e-5) {
      this.paintMark(lx, lz, ballRadius, kind, energy);
      return;
    }

    // A crater is wider than the ball; a clay dent is closer to ball-sized and
    // pushes a rim up around itself.
    const spread = kind === 'crater' ? 1.75 : kind === 'press' ? 2.1 : 1.35;
    const radius = ballRadius * spread;
    const rimHeight = kind === 'crater' ? 0.22 : kind === 'dent' ? 0.4 : 0.08;
    const rimWidth = radius * (kind === 'dent' ? 0.55 : 0.8);

    const cellX = (this.opts.halfX * 2) / (n - 1);
    const cellZ = (this.opts.halfZ * 2) / (n - 1);
    const { fx, fz } = this.toField(lx, lz);
    const reach = Math.ceil(((radius + rimWidth) / Math.min(cellX, cellZ)) + 1);

    for (let z = Math.max(0, Math.floor(fz - reach)); z <= Math.min(n - 1, Math.ceil(fz + reach)); z++) {
      for (let x = Math.max(0, Math.floor(fx - reach)); x <= Math.min(n - 1, Math.ceil(fx + reach)); x++) {
        const wx = (x / (n - 1) - 0.5) * 2 * this.opts.halfX;
        const wz = (z / (n - 1) - 0.5) * 2 * this.opts.halfZ;
        const d = Math.hypot(wx - lx, wz - lz);
        let h = 0;
        if (d < radius) {
          // Bowl.
          const t = 1 - d / radius;
          h = depth * (kind === 'crater' ? Math.pow(t, 1.3) : t * t * (3 - 2 * t));
        } else if (d < radius + rimWidth) {
          // Displaced material pushed up around the edge.
          const t = 1 - (d - radius) / rimWidth;
          h = -depth * rimHeight * Math.sin(t * Math.PI) * 0.9;
        }
        if (h === 0) continue;
        // Granular surfaces do not carve smoothly.
        if (kind === 'crater') h *= 0.86 + 0.28 * pseudo(x * 7 + z * 13);
        const i = z * n + x;
        this.persistent[i] += h * persistence;
        this.recovering[i] += h * (1 - persistence);
      }
    }
    this.recoverRate = kind === 'press' ? 0.42 : 3.2;
    this.fieldDirty = true;
    this.paintMark(lx, lz, ballRadius, kind, energy);
  }

  /** Paint the visual residue: damp ring, dust halo, polished patch. */
  private paintMark(lx: number, lz: number, ballRadius: number, kind: MarkKind, energy: number) {
    const res = this.opts.wearRes;
    const cx = ((lx / this.opts.halfX) * 0.5 + 0.5) * res;
    const cy = ((lz / this.opts.halfZ) * 0.5 + 0.5) * res;
    const rPix = (ballRadius / this.opts.halfX) * res * 0.5;
    const ctx = this.wearCtx;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    const blob = (radius: number, stops: Array<[number, string]>) => {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(radius, 1));
      for (const [o, c] of stops) g.addColorStop(o, c);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(radius, 1), 0, Math.PI * 2);
      ctx.fill();
    };

    const e = clamp01(energy);
    switch (kind) {
      case 'crater':
        // Damp, darker sand turned over inside the pit; dust thrown outward.
        blob(rPix * 1.9, [
          [0, `rgba(${Math.round(150 * e)},0,0,${0.5 * e})`],
          [0.62, `rgba(${Math.round(90 * e)},0,0,${0.22 * e})`],
          [1, 'rgba(0,0,0,0)'],
        ]);
        blob(rPix * 3.1, [
          [0.55, 'rgba(0,0,0,0)'],
          [0.8, `rgba(0,${Math.round(120 * e)},0,${0.16 * e})`],
          [1, 'rgba(0,0,0,0)'],
        ]);
        break;
      case 'dent':
        // Wet clay: the strike squeezes water to the surface, so it goes dark
        // and glossy right where the ball hit.
        blob(rPix * 1.5, [
          [0, `rgba(${Math.round(120 * e)},0,${Math.round(210 * e)},${0.72 * e})`],
          [0.7, `rgba(${Math.round(70 * e)},0,${Math.round(120 * e)},${0.3 * e})`],
          [1, 'rgba(0,0,0,0)'],
        ]);
        break;
      case 'press':
        blob(rPix * 2.2, [
          [0, `rgba(${Math.round(70 * e)},0,0,${0.3 * e})`],
          [1, 'rgba(0,0,0,0)'],
        ]);
        break;
      case 'scuff':
        // Repeated hits burnish the mat and grind a faint dust ring.
        blob(rPix * 1.25, [
          [0, `rgba(0,${Math.round(90 * e)},0,${0.22 * e})`],
          [1, 'rgba(0,0,0,0)'],
        ]);
        blob(rPix * 2.4, [
          [0.6, 'rgba(0,0,0,0)'],
          [0.85, `rgba(0,0,0,${0.1 * e})`],
          [1, 'rgba(0,0,0,0)'],
        ]);
        break;
      case 'ripple':
        break;
      default:
        break;
    }
    ctx.restore();
    this.wearTexture.needsUpdate = true;
  }

  /** Brush the surface flat again, one stroke at a time. */
  sweep(lx: number, lz: number, radius: number, amount: number) {
    const n = this.opts.fieldRes;
    const { fx, fz } = this.toField(lx, lz);
    const cell = (this.opts.halfX * 2) / (n - 1);
    const reach = Math.ceil(radius / cell + 1);
    let touched = 0;
    for (let z = Math.max(0, Math.floor(fz - reach)); z <= Math.min(n - 1, Math.ceil(fz + reach)); z++) {
      for (let x = Math.max(0, Math.floor(fx - reach)); x <= Math.min(n - 1, Math.ceil(fx + reach)); x++) {
        const wx = (x / (n - 1) - 0.5) * 2 * this.opts.halfX;
        const wz = (z / (n - 1) - 0.5) * 2 * this.opts.halfZ;
        const d = Math.hypot(wx - lx, wz - lz);
        if (d > radius) continue;
        const k = amount * smoothstep(radius, 0, d);
        const i = z * n + x;
        if (Math.abs(this.persistent[i]) > 1e-6) touched++;
        this.persistent[i] *= 1 - k;
        this.recovering[i] *= 1 - k;
      }
    }
    // Fade the painted residue at the same rate.
    const res = this.opts.wearRes;
    const cx = ((lx / this.opts.halfX) * 0.5 + 0.5) * res;
    const cy = ((lz / this.opts.halfZ) * 0.5 + 0.5) * res;
    const rPix = (radius / this.opts.halfX) * res * 0.5;
    const ctx = this.wearCtx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rPix, 1));
    g.addColorStop(0, `rgba(0,0,0,${amount})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(rPix, 1), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    this.wearTexture.needsUpdate = true;
    this.fieldDirty = true;
    return touched;
  }

  /** True when the surface still carries a mark the child could sweep away. */
  get marked() {
    for (let i = 0; i < this.persistent.length; i++) {
      if (Math.abs(this.persistent[i]) > 0.0012) return true;
    }
    return false;
  }

  reset() {
    this.persistent.fill(0);
    this.recovering.fill(0);
    this.clearWear();
    this.wearTexture.needsUpdate = true;
    this.fieldDirty = true;
  }

  update(dt: number) {
    // Springy surfaces climb back towards flat.
    let recovered = false;
    const k = 1 - Math.exp(-this.recoverRate * dt);
    for (let i = 0; i < this.recovering.length; i++) {
      const v = this.recovering[i];
      if (v !== 0) {
        const nv = v * (1 - k);
        this.recovering[i] = Math.abs(nv) < 1e-6 ? 0 : nv;
        recovered = true;
      }
    }
    if (recovered) this.fieldDirty = true;
    if (this.fieldDirty) {
      this.rebuild();
      this.fieldDirty = false;
    }
  }

  private rebuild() {
    const pos = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const base = this.basePositions;
    for (let i = 0; i < arr.length; i += 3) {
      const x = base[i];
      const z = base[i + 2];
      arr[i + 1] = base[i + 1] - this.depthAt(x, z);
    }
    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }

  dispose() {
    this.geometry.dispose();
    this.wearTexture.dispose();
  }
}

function pseudo(i: number) {
  const x = Math.sin(i * 91.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Polar disc grid: dense in the middle, where the ball always lands. */
function buildDisc(radius: number, rings: number) {
  const segments = Math.max(24, rings * 2);
  const positions: number[] = [0, 0, 0];
  const uvs: number[] = [0.5, 0.5];
  const indices: number[] = [];
  for (let r = 1; r <= rings; r++) {
    // Bias the ring spacing so the impact zone gets more vertices.
    const t = Math.pow(r / rings, 0.82);
    const rad = t * radius;
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      positions.push(x, 0, z);
      uvs.push(x / (radius * 2) + 0.5, z / (radius * 2) + 0.5);
    }
  }
  const idx = (r: number, s: number) => (r === 0 ? 0 : 1 + (r - 1) * segments + (s % segments));
  for (let s = 0; s < segments; s++) indices.push(idx(0, 0), idx(1, s + 1), idx(1, s));
  for (let r = 1; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const a = idx(r, s);
      const b = idx(r, s + 1);
      const c = idx(r + 1, s);
      const d = idx(r + 1, s + 1);
      indices.push(a, b, d, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function buildGrid(halfX: number, halfZ: number, rows: number) {
  const cols = Math.max(8, Math.round((rows * halfX) / halfZ));
  const g = new THREE.PlaneGeometry(halfX * 2, halfZ * 2, cols, rows);
  g.rotateX(-Math.PI / 2);
  return g;
}
