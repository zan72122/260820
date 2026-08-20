/**
 * Everything the child's finger leaves behind lives in three shared render targets, packed
 * as a 4x4 atlas of panel tiles. Strokes are drawn as batched instanced quads — one draw
 * call per brush kind per frame — so scribbling never multiplies meshes or draw calls.
 *
 *  paperRT  R glue wetness   G smoothed-out wrinkles   B brush/finger streaks   A paper laid
 *  inkRT    R ink density    G ink pooling             B dry-brush breakup      A wax resist
 *  dyeRT    RGB premultiplied dye                                               A dye density
 */

import {
  CanvasTexture,
  DataUtils,
  HalfFloatType,
  ClampToEdgeWrapping,
  Color,
  CustomBlending,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  LinearSRGBColorSpace,
  MaxEquation,
  Mesh,
  NoBlending,
  OneFactor,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Texture,
  type TextureDataType,
  UnsignedByteType,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
  AddEquation,
} from 'three';
import { ATLAS_COLS, ATLAS_ROWS, PATCHES, localToTile, tileRect } from './shape';
import { GUIDES } from './artwork';
import type { QualitySettings } from '../core/Quality';
import { clamp } from '../util/math';

export const StampKind = {
  Smooth: 0,
  Glue: 1,
  Ink: 2,
  Dye: 3,
  Wax: 4,
  Fill: 5,
} as const;
export type StampKindValue = (typeof StampKind)[keyof typeof StampKind];

export interface Stamp {
  tile: number;
  /** patch-local coordinates, 0..1 */
  a: number;
  b: number;
  /** radius in patch-local units */
  radius: number;
  aspect: number;
  angle: number;
  strength: number;
  extra: number;
  seed: number;
  color?: Color;
}

const STAMP_VERT = /* glsl */ `
attribute vec4 aRect;
attribute vec4 aParam;
attribute vec3 aColor;
varying vec2 vLocal;
varying vec4 vParam;
varying vec3 vColor;
varying vec2 vAtlas;
void main() {
  vLocal = position.xy * 2.0;
  vParam = aParam;
  vColor = aColor;
  vec2 p = position.xy * 2.0 * aRect.zw;
  float c = cos(aParam.x);
  float s = sin(aParam.x);
  vec2 rp = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  vAtlas = aRect.xy + rp;
  gl_Position = vec4(vAtlas * 2.0 - 1.0, 0.0, 1.0);
}
`;

/**
 * The dye target is half float, so premultiplied colour can accumulate past 1.0 without the
 * hue collapsing toward white — 8-bit blending rounded dark dyes apart channel by channel.
 */
export const DYE_SCALE = 1.0;

const STAMP_COMMON = /* glsl */ `
precision highp float;
#define DYE_SCALE ${DYE_SCALE.toFixed(4)}
varying vec2 vLocal;
varying vec4 vParam;
varying vec3 vColor;
varying vec2 vAtlas;
uniform sampler2D tInk;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
/** Parallel bristle tracks running along the stroke. */
float bristle(vec2 l, float seed) {
  float t = l.y * 6.5 + seed * 31.0;
  float g = vnoise(vec2(t, seed * 7.0)) * 0.55 + vnoise(vec2(t * 2.7, seed * 3.0)) * 0.45;
  return 0.62 + 0.38 * g;
}
`;

const STAMP_FRAG = /* glsl */ `
${STAMP_COMMON}
void main() {
  float d = length(vLocal);
  if (d > 1.15) discard;
  float strength = vParam.y;
  float extra = vParam.z;
  float seed = vParam.w;

#if KIND == 0        // finger smoothing wrinkles outward
  float fall = smoothstep(1.05, 0.1, d);
  float amt = fall * strength;
  float streak = vnoise(vLocal * 3.4 + seed * 13.0);
  gl_FragColor = vec4(amt * 0.28, amt, amt * 0.55 * streak, 0.0);

#elif KIND == 1      // glue brush: wet, streaky, slightly smoothing
  float fall = smoothstep(1.05, 0.15, d);
  float br = bristle(vLocal, seed);
  float amt = fall * strength * br;
  gl_FragColor = vec4(amt, amt * 0.34, amt * (br - 0.6), 0.0);

#elif KIND == 2      // sumi ink: soft nib, fibre bleed, dry-brush breakup, pooling
  float core = smoothstep(1.0, 0.42, d);
  float bleed = smoothstep(1.15, 0.55, d) * 0.55;
  float grain = vnoise(vLocal * 5.5 + seed * 21.0) * 0.6 + vnoise(vLocal * 13.0 + seed * 5.0) * 0.4;
  float scratch = clamp(extra * 1.35 - 0.15, 0.0, 1.0) * smoothstep(0.35, 0.95, grain);
  float ink = clamp((core + bleed * 0.7) * strength * (1.0 - scratch * 0.9), 0.0, 1.0);
  float pool = core * clamp(1.0 - extra, 0.0, 1.0) * strength * 0.85;
  gl_FragColor = vec4(ink, pool, scratch, 0.0);

#elif KIND == 3      // dye soaking into the fibres, repelled by the wax lines
  float fall = smoothstep(1.05, 0.02, d);
  float br = bristle(vLocal, seed) * 0.85 + 0.15;
  float wax = texture2D(tInk, vAtlas).a;
  float amt = fall * strength * br * (1.0 - wax * 0.94);
  // colour is stored premultiplied and scaled, so five layers of dye still fit in 8 bits
  // without the hue collapsing to white as the channels clip
  gl_FragColor = vec4(vColor * amt, amt) * DYE_SCALE;

#elif KIND == 4      // wax resist: thin, crisp
  float line = smoothstep(1.0, 0.25, d);
  gl_FragColor = vec4(0.0, 0.0, 0.0, line * strength);

#else                // flat fill of a tile (paper laid down)
  gl_FragColor = vec4(0.0, 0.0, 0.0, strength);
#endif
}
`;

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const DIFFUSE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tSrc;
uniform sampler2D tInk;
uniform vec2 uTexel;
uniform float uRate;
void main() {
  vec4 c = texture2D(tSrc, vUv);
  vec4 s = texture2D(tSrc, vUv + vec2(uTexel.x, 0.0))
         + texture2D(tSrc, vUv - vec2(uTexel.x, 0.0))
         + texture2D(tSrc, vUv + vec2(0.0, uTexel.y))
         + texture2D(tSrc, vUv - vec2(0.0, uTexel.y));
  vec4 blur = (s + c * 1.6) / 5.6;
  float wax = texture2D(tInk, vUv).a;
  vec4 res = mix(c, blur, uRate * (1.0 - wax * 0.9));
  // keep the bleed inside its own tile
  vec2 f = fract(vUv * vec2(${ATLAS_COLS}.0, ${ATLAS_ROWS}.0));
  float m = step(0.016, f.x) * step(f.x, 0.984) * step(0.016, f.y) * step(f.y, 0.984);
  gl_FragColor = mix(c, res, m);
}
`;

interface Batch {
  material: ShaderMaterial;
  geometry: InstancedBufferGeometry;
  mesh: Mesh;
  rect: Float32Array;
  param: Float32Array;
  color: Float32Array;
  count: number;
}

const CAPACITY = 220;

function makeRT(size: number, type: TextureDataType = UnsignedByteType): WebGLRenderTarget {
  const rt = new WebGLRenderTarget(size, size, {
    type,
    format: RGBAFormat,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  rt.texture.colorSpace = LinearSRGBColorSpace;
  return rt;
}

export class PaintAtlas {
  readonly paperRT: WebGLRenderTarget;
  readonly inkRT: WebGLRenderTarget;
  readonly dyeRT: WebGLRenderTarget;
  readonly guideTexture: CanvasTexture;

  private readonly dyeScratch: WebGLRenderTarget;
  private readonly batches = new Map<number, Batch>();
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly fsScene = new Scene();
  private readonly fsQuad: Mesh;
  private readonly diffuseMat: ShaderMaterial;
  private diffusionBudget = 0;
  private readonly tileByPatch = new Map<string, number>();
  private dyeSwapped = false;

  /** Coarse CPU occupancy so progress can be measured without reading back the GPU. */
  private readonly coverage = new Map<string, Uint8Array>();
  private static readonly GRID = 8;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly quality: QualitySettings,
  ) {
    const size = quality.paintAtlas;
    this.paperRT = makeRT(size);
    this.inkRT = makeRT(size);
    this.dyeRT = makeRT(size, HalfFloatType);
    this.dyeScratch = makeRT(size, HalfFloatType);

    for (const p of PATCHES) this.tileByPatch.set(p.id, p.tile);

    this.diffuseMat = new ShaderMaterial({
      vertexShader: FS_VERT,
      fragmentShader: DIFFUSE_FRAG,
      uniforms: {
        tSrc: { value: null },
        tInk: { value: this.inkRT.texture },
        uTexel: { value: new Vector2(1 / size, 1 / size) },
        uRate: { value: 0.34 },
      },
      depthTest: false,
      depthWrite: false,
      blending: NoBlending,
    });
    this.fsQuad = new Mesh(new PlaneGeometry(2, 2), this.diffuseMat);
    this.fsQuad.frustumCulled = false;
    this.fsScene.add(this.fsQuad);

    this.guideTexture = buildGuideTexture(quality.tier === 'low' ? 512 : 1024);
    this.clear();
  }

  /** Wipes every stroke — used by the "make it again" replay path. */
  clear(): void {
    const prev = this.renderer.getRenderTarget();
    for (const rt of [this.paperRT, this.inkRT, this.dyeRT, this.dyeScratch]) {
      this.renderer.setRenderTarget(rt);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.clear(true, false, false);
    }
    this.renderer.setRenderTarget(prev);
    this.coverage.clear();
    this.dyeSwapped = false;
  }

  get dyeTexture(): Texture {
    return (this.dyeSwapped ? this.dyeScratch : this.dyeRT).texture;
  }

  private batch(kind: number): Batch {
    let b = this.batches.get(kind);
    if (b) return b;
    const base = new PlaneGeometry(1, 1);
    const geometry = new InstancedBufferGeometry();
    geometry.index = base.index;
    geometry.setAttribute('position', base.getAttribute('position'));
    geometry.setAttribute('uv', base.getAttribute('uv'));
    const rect = new Float32Array(CAPACITY * 4);
    const param = new Float32Array(CAPACITY * 4);
    const color = new Float32Array(CAPACITY * 3);
    const aRect = new InstancedBufferAttribute(rect, 4);
    const aParam = new InstancedBufferAttribute(param, 4);
    const aColor = new InstancedBufferAttribute(color, 3);
    aRect.setUsage(35048 /* DynamicDrawUsage */);
    aParam.setUsage(35048);
    aColor.setUsage(35048);
    geometry.setAttribute('aRect', aRect);
    geometry.setAttribute('aParam', aParam);
    geometry.setAttribute('aColor', aColor);
    geometry.instanceCount = 0;

    const additive = kind === StampKind.Dye;
    const material = new ShaderMaterial({
      vertexShader: STAMP_VERT,
      fragmentShader: `#define KIND ${kind}\n${STAMP_FRAG}`,
      uniforms: { tInk: { value: this.inkRT.texture } },
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: CustomBlending,
      blendEquation: additive ? AddEquation : MaxEquation,
      blendSrc: OneFactor,
      blendDst: OneFactor,
    });
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    b = { material, geometry, mesh, rect, param, color, count: 0 };
    this.batches.set(kind, b);
    return b;
  }

  /** Queue one dab. Returns false when the per-frame budget is full. */
  add(kind: number, s: Stamp): boolean {
    const b = this.batch(kind);
    if (b.count >= CAPACITY) return false;
    const r = tileRect(s.tile);
    const i = b.count++;
    b.rect[i * 4] = r.x + r.w * clamp(s.a, -0.2, 1.2);
    b.rect[i * 4 + 1] = r.y + r.h * clamp(s.b, -0.2, 1.2);
    b.rect[i * 4 + 2] = s.radius * r.w * s.aspect;
    b.rect[i * 4 + 3] = s.radius * r.h;
    b.param[i * 4] = s.angle;
    b.param[i * 4 + 1] = s.strength;
    b.param[i * 4 + 2] = s.extra;
    b.param[i * 4 + 3] = s.seed;
    if (s.color) {
      b.color[i * 3] = s.color.r;
      b.color[i * 3 + 1] = s.color.g;
      b.color[i * 3 + 2] = s.color.b;
    }
    return true;
  }

  /** Marks the coarse CPU coverage grid, used only for progress reporting. */
  mark(patchId: string, a: number, b: number, channel: number): void {
    const key = `${patchId}:${channel}`;
    let g = this.coverage.get(key);
    if (!g) {
      g = new Uint8Array(PaintAtlas.GRID * PaintAtlas.GRID);
      this.coverage.set(key, g);
    }
    const gx = clamp(Math.floor(a * PaintAtlas.GRID), 0, PaintAtlas.GRID - 1);
    const gy = clamp(Math.floor(b * PaintAtlas.GRID), 0, PaintAtlas.GRID - 1);
    g[gy * PaintAtlas.GRID + gx] = 1;
  }

  coverageOf(patchId: string, channel: number): number {
    const g = this.coverage.get(`${patchId}:${channel}`);
    if (!g) return 0;
    let n = 0;
    for (let i = 0; i < g.length; i++) n += g[i];
    return n / g.length;
  }

  totalCoverage(channel: number, patchIds: string[]): number {
    if (!patchIds.length) return 0;
    let sum = 0;
    for (const id of patchIds) sum += this.coverageOf(id, channel);
    return sum / patchIds.length;
  }

  /** Fill a whole tile's alpha, i.e. "the paper is now on the frame". */
  fillTile(tile: number, strength = 1): void {
    this.add(StampKind.Fill, {
      tile,
      a: 0.5,
      b: 0.5,
      radius: 0.75,
      aspect: 1,
      angle: 0,
      strength,
      extra: 0,
      seed: 0,
    });
  }

  requestDiffusion(frames = 2): void {
    if (!this.quality.dyeDiffusion) return;
    this.diffusionBudget = Math.min(this.diffusionBudget + frames, 8);
  }

  /** Flush all queued strokes. Called once per frame before the scene is drawn. */
  flush(): void {
    const prevTarget = this.renderer.getRenderTarget();
    const prevAutoClear = this.renderer.autoClear;
    this.renderer.autoClear = false;

    const run = (kind: number, target: WebGLRenderTarget) => {
      const b = this.batches.get(kind);
      if (!b || b.count === 0) return;
      b.geometry.instanceCount = b.count;
      (b.geometry.getAttribute('aRect') as InstancedBufferAttribute).needsUpdate = true;
      (b.geometry.getAttribute('aParam') as InstancedBufferAttribute).needsUpdate = true;
      (b.geometry.getAttribute('aColor') as InstancedBufferAttribute).needsUpdate = true;
      this.scene.clear();
      this.scene.add(b.mesh);
      this.renderer.setRenderTarget(target);
      this.renderer.render(this.scene, this.camera);
      b.count = 0;
    };

    run(StampKind.Fill, this.paperRT);
    run(StampKind.Smooth, this.paperRT);
    run(StampKind.Glue, this.paperRT);
    run(StampKind.Ink, this.inkRT);
    run(StampKind.Wax, this.inkRT);
    run(StampKind.Dye, this.dyeSwapped ? this.dyeScratch : this.dyeRT);

    if (this.diffusionBudget > 0) {
      this.diffusionBudget--;
      const src = this.dyeSwapped ? this.dyeScratch : this.dyeRT;
      const dst = this.dyeSwapped ? this.dyeRT : this.dyeScratch;
      this.diffuseMat.uniforms.tSrc.value = src.texture;
      this.fsQuad.material = this.diffuseMat;
      this.renderer.setRenderTarget(dst);
      this.renderer.render(this.fsScene, this.camera);
      this.dyeSwapped = !this.dyeSwapped;
    }

    this.renderer.autoClear = prevAutoClear;
    this.renderer.setRenderTarget(prevTarget);
  }

  /** Compile every stamp shader at load time so the first stroke is never a hitch. */
  prewarm(): void {
    for (const kind of Object.values(StampKind)) {
      this.add(kind as number, {
        tile: 15,
        a: 0.5,
        b: 0.5,
        radius: 0.004,
        aspect: 1,
        angle: 0,
        strength: 0.001,
        extra: 0,
        seed: 0,
        color: new Color(0, 0, 0),
      });
    }
    this.flush();
    this.requestDiffusion(1);
    this.flush();
  }

  /** Test hook: read one texel out of each atlas so the tests can assert on real strokes. */
  sample(tile: number, a: number, b: number): { paper: number[]; ink: number[]; dye: number[] } {
    const r = tileRect(tile);
    const size = this.quality.paintAtlas;
    const x = Math.floor((r.x + r.w * a) * size);
    const y = Math.floor((r.y + r.h * b) * size);
    const read = (rt: WebGLRenderTarget): number[] => {
      const buf = new Uint8Array(4);
      this.renderer.readRenderTargetPixels(rt, x, y, 1, 1, buf);
      return Array.from(buf, (v) => v / 255);
    };
    const readHalf = (rt: WebGLRenderTarget): number[] => {
      const buf = new Uint16Array(4);
      this.renderer.readRenderTargetPixels(rt, x, y, 1, 1, buf);
      return Array.from(buf, (v) => DataUtils.fromHalfFloat(v));
    };
    return {
      paper: read(this.paperRT),
      ink: read(this.inkRT),
      dye: readHalf(this.dyeSwapped ? this.dyeScratch : this.dyeRT),
    };
  }

  dispose(): void {
    this.paperRT.dispose();
    this.inkRT.dispose();
    this.dyeRT.dispose();
    this.dyeScratch.dispose();
    this.guideTexture.dispose();
    this.diffuseMat.dispose();
    this.fsQuad.geometry.dispose();
    for (const b of this.batches.values()) {
      b.material.dispose();
      b.geometry.dispose();
    }
    this.batches.clear();
  }
}

/**
 * The faint thick "planned lines" painted once into a static atlas. They are what the child
 * traces; the brush is attracted to them but never snaps hard onto them.
 */
function buildGuideTexture(size: number): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.clearRect(0, 0, size, size);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const tiles = new Map<string, number>();
  for (const p of PATCHES) tiles.set(p.id, p.tile);

  for (const stroke of GUIDES) {
    const tile = tiles.get(stroke.patch);
    if (tile === undefined) continue;
    const r = tileRect(tile);
    ctx.beginPath();
    stroke.pts.forEach((pt, i) => {
      const x = (r.x + r.w * localToTile(pt[0])) * size;
      const y = (r.y + r.h * localToTile(pt[1])) * size;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    if (stroke.closed) ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(2, stroke.width * size * 0.014);
    ctx.stroke();
  }

  const t = new CanvasTexture(canvas);
  t.colorSpace = LinearSRGBColorSpace;
  t.minFilter = LinearFilter;
  t.magFilter = LinearFilter;
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}
