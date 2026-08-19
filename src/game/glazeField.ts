import * as THREE from 'three';
import { FullScreenPass, QUAD_VERT } from '../core/quad';
import { PROFILE_GLSL, CAKE_H, CAKE_R, MERIDIAN_ARC } from './profile';

/** One unit of thickness in the field == this many metres of real glaze. */
export const GLAZE_UNIT = 0.0025;

const SIM_FRAG = /* glsl */ `
  precision highp float;

  uniform sampler2D uPrev;
  uniform vec2  uTexel;      // 1/W, 1/H
  uniform float uDt;
  uniform float uSeed;
  uniform float uScale;      // storage scale (1.0 for float RTs, 0.25 for 8bit)

  uniform vec4  uSplat;      // u, v, radiusU, radiusV
  uniform vec3  uSplatColor; // linear rgb
  uniform float uSplatRate;
  uniform vec2  uSplatVel;   // uv/sec of the pour point

  uniform float uTerrain;    // cake height expressed in thickness units
  uniform float uFlow;
  uniform float uStick;
  uniform float uMaxFrac;
  uniform float uPush;
  uniform float uRimHold;
  uniform float uDrain;
  uniform float uStreak;

  varying vec2 vUv;

  ${PROFILE_GLSL}

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

  vec4 fetch(vec2 uv) {
    vec2 c = vec2(fract(uv.x), clamp(uv.y, uTexel.y * 0.5, 1.0 - uTexel.y * 0.5));
    return texture2D(uPrev, c) * (1.0 / uScale);
  }

  float splatW(vec2 uv) {
    if (uSplatRate <= 0.0) return 0.0;
    float du = abs(uv.x - uSplat.x);
    du = min(du, 1.0 - du);
    float dv = uv.y - uSplat.y;
    float d = length(vec2(du / max(uSplat.z, 1e-4), dv / max(uSplat.w, 1e-4)));
    float w = 1.0 - smoothstep(0.05, 1.0, d);
    return w * w;
  }

  float potential(vec4 c, float v) {
    return profileY(v) * uTerrain + c.a;
  }

  // Flux leaving the cell at uv toward +u, -u, +v, -v (already clamped so the
  // cell can never give away more than the film that is free to move).
  vec4 fluxes(vec2 uv) {
    vec4 c = fetch(uv);
    float v = clamp(uv.y, 0.0, 1.0);
    // gravity has to beat the yield stress, but levelling sideways is easier:
    // that is what turns the poured ribbon into a smooth mirror
    float mob = max(0.0, c.a - uStick);
    float mobLat = max(0.0, c.a - uStick * 0.45);
    if (mobLat <= 0.0) return vec4(0.0);

    float p = potential(c, v);
    float w = splatW(uv);
    float boost = 1.0 + uPush * w;

    // lateral cells shrink towards the pole, so the same pressure moves much
    // further in u there
    float lat = uFlow * uDt * boost * 0.55 / max(profileR(v), 0.06);

    vec4 nb;
    nb.x = potential(fetch(uv + vec2(uTexel.x, 0.0)), v);
    nb.y = potential(fetch(uv - vec2(uTexel.x, 0.0)), v);
    nb.z = potential(fetch(uv + vec2(0.0, uTexel.y)), clamp(v + uTexel.y, 0.0, 1.0));
    nb.w = potential(fetch(uv - vec2(0.0, uTexel.y)), clamp(v - uTexel.y, 0.0, 1.0));

    // organic fingering: per-column noise plus "thicker runs faster"
    // sampled on a circle so the streak field is seamless where u wraps
    float ang = uv.x * 6.2831853;
    vec2 np = vec2(cos(ang), sin(ang)) * 5.6 + vec2(uSeed, uSeed * 0.61) + uv.y * vec2(1.7, -1.7);
    float streak = mix(1.0, 0.72 + vnoise(np) * 0.62, uStreak);
    float finger = 1.0 + 1.1 * clamp(c.a - 0.5 * (fetch(uv + vec2(uTexel.x, 0.0)).a + fetch(uv - vec2(uTexel.x, 0.0)).a), 0.0, 1.0);
    float down = uFlow * uDt * boost * streak * finger;

    vec4 f;
    f.x = max(0.0, p - nb.x) * lat;
    f.y = max(0.0, p - nb.y) * lat;
    f.z = max(0.0, p - nb.z) * down * step(0.0001, mob);
    f.w = max(0.0, p - nb.w) * uFlow * uDt * boost * 0.4 * step(0.0001, mob);

    // the jet drags the film along with the finger
    if (uSplatRate > 0.0) {
      float drag = w * uPush * 0.5 * uDt * 60.0;
      f.x += max(0.0, uSplatVel.x) * drag;
      f.y += max(0.0, -uSplatVel.x) * drag;
      f.z += max(0.0, uSplatVel.y) * drag;
      f.w += max(0.0, -uSplatVel.y) * drag;
    }

    float tot = f.x + f.y + f.z + f.w;
    float cap = min(max(mob, mobLat) * uMaxFrac, c.a * 0.92);
    if (tot > cap) f *= cap / tot;
    return f;
  }

  void main() {
    vec4 c = fetch(vUv);
    vec3 col = c.rgb / max(c.a, 1e-4);

    vec4 fo = fluxes(vUv);
    float out_ = fo.x + fo.y + fo.z + fo.w;
    float h = c.a - out_;
    vec3 prem = c.rgb - out_ * col;

    vec2 nL = vUv - vec2(uTexel.x, 0.0);
    vec2 nR = vUv + vec2(uTexel.x, 0.0);
    vec2 nU = vUv - vec2(0.0, uTexel.y);
    vec2 nD = vUv + vec2(0.0, uTexel.y);

    float fL = fluxes(nL).x;
    float fR = fluxes(nR).y;
    float fU = (vUv.y > uTexel.y * 0.75) ? fluxes(nU).z : 0.0;
    float fD = (vUv.y < 1.0 - uTexel.y * 0.75) ? fluxes(nD).w : 0.0;

    vec4 cL = fetch(nL), cR = fetch(nR), cU = fetch(nU), cD = fetch(nD);
    h += fL + fR + fU + fD;
    prem += fL * (cL.rgb / max(cL.a, 1e-4));
    prem += fR * (cR.rgb / max(cR.a, 1e-4));
    prem += fU * (cU.rgb / max(cU.a, 1e-4));
    prem += fD * (cD.rgb / max(cD.a, 1e-4));

    // deposit from the pouring stream
    float w = splatW(vUv);
    float dep = w * uSplatRate * uDt;
    h += dep;
    prem += dep * uSplatColor;

    // the rim holds a fat bead, then lets go: that mass becomes the side drips
    float bottom = step(1.0 - uTexel.y * 1.5, vUv.y);
    float drain = bottom * max(0.0, h - uRimHold) * uDrain * uDt;
    vec3 dcol = prem / max(h, 1e-4);
    h -= drain;
    prem -= drain * dcol;

    h = clamp(h, 0.0, 3.9);
    prem = clamp(prem, 0.0, 3.9);
    gl_FragColor = vec4(prem, h) * uScale;
  }
`;

const PROBE_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uField;
  uniform vec2 uTexel;
  uniform float uScale;
  uniform float uRows;
  varying vec2 vUv;

  void main() {
    float row = floor(vUv.y * uRows);
    if (row < 0.5) {
      // row 0: the bottom rim — where drips are ready to fall
      vec4 c = texture2D(uField, vec2(vUv.x, 1.0 - uTexel.y * 0.5)) / uScale;
      vec3 col = c.rgb / max(c.a, 1e-4);
      gl_FragColor = vec4(sqrt(clamp(col, 0.0, 1.0)), clamp(c.a * 0.25, 0.0, 1.0));
    } else {
      // rows 1..n: coarse coverage sampling over the whole surface
      float band = (row - 1.0) / (uRows - 1.0);
      float bh = 1.0 / (uRows - 1.0);
      float acc = 0.0;
      for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float vv = band + bh * (fi + 0.5) * 0.25;
        float uu = vUv.x + (fract(fi * 0.37) - 0.5) * 0.9 / 64.0;
        float hh = (texture2D(uField, vec2(fract(uu), clamp(vv, 0.0, 1.0))) / uScale).a;
        acc += step(0.06, hh);
      }
      gl_FragColor = vec4(0.0, 0.0, 0.0, acc * 0.25);
    }
  }
`;

export interface SplatInput {
  /** field u (0..1, wraps) */
  u: number;
  /** field v (0..1, top → rim) */
  v: number;
  /** radius of the jet footprint in metres */
  radius: number;
  /** thickness deposited per second at the centre */
  rate: number;
  color: THREE.Color;
  /** uv-space velocity of the pour point */
  velU: number;
  velV: number;
}

const PROBE_COLS = 64;
const PROBE_ROWS = 8;

export class GlazeField {
  readonly width: number;
  readonly height: number;
  private rtA: THREE.WebGLRenderTarget;
  private rtB: THREE.WebGLRenderTarget;
  private sim: FullScreenPass;
  private probePass: FullScreenPass;
  private probeRT: THREE.WebGLRenderTarget;
  private probeBuf = new Uint8Array(PROBE_COLS * PROBE_ROWS * 4);
  private scale: number;
  private clearPass: FullScreenPass;

  /** thickness (0..1 of the drip threshold) per rim column, updated from the GPU */
  readonly rim = new Float32Array(PROBE_COLS);
  readonly rimColor = new Float32Array(PROBE_COLS * 3);
  /** 0..1 fraction of the surface that carries glaze */
  coverage = 0;
  private probeAge = 0;

  constructor(private renderer: THREE.WebGLRenderer, width: number, height: number) {
    this.width = width;
    this.height = height;

    const gl = renderer.getContext();
    const floatOk =
      !!gl.getExtension('EXT_color_buffer_half_float') ||
      !!gl.getExtension('EXT_color_buffer_float');
    this.scale = floatOk ? 1 : 0.25;

    const opts: THREE.RenderTargetOptions = {
      type: floatOk ? THREE.HalfFloatType : THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
      colorSpace: THREE.NoColorSpace,
    };
    this.rtA = new THREE.WebGLRenderTarget(width, height, opts);
    this.rtB = new THREE.WebGLRenderTarget(width, height, opts);

    this.sim = new FullScreenPass(
      new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT,
        fragmentShader: SIM_FRAG,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uPrev: { value: this.rtA.texture },
          uTexel: { value: new THREE.Vector2(1 / width, 1 / height) },
          uDt: { value: 1 / 60 },
          uSeed: { value: 0 },
          uScale: { value: this.scale },
          uSplat: { value: new THREE.Vector4(0.5, 0.5, 0.06, 0.06) },
          uSplatColor: { value: new THREE.Vector3(1, 1, 1) },
          uSplatRate: { value: 0 },
          uSplatVel: { value: new THREE.Vector2() },
          uTerrain: { value: CAKE_H / GLAZE_UNIT },
          uFlow: { value: 380 },
          uStick: { value: 0.3 },
          uMaxFrac: { value: 0.9 },
          uPush: { value: 2.6 },
          uRimHold: { value: 0.72 },
          uDrain: { value: 2.6 },
          uStreak: { value: 1 },
        },
      })
    );

    this.clearPass = new FullScreenPass(
      new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT,
        fragmentShader: `void main(){ gl_FragColor = vec4(0.0); }`,
        depthTest: false,
        depthWrite: false,
      })
    );

    this.probeRT = new THREE.WebGLRenderTarget(PROBE_COLS, PROBE_ROWS, {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
      colorSpace: THREE.NoColorSpace,
    });
    this.probePass = new FullScreenPass(
      new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT,
        fragmentShader: PROBE_FRAG,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uField: { value: this.rtA.texture },
          uTexel: { value: new THREE.Vector2(1 / width, 1 / height) },
          uScale: { value: this.scale },
          uRows: { value: PROBE_ROWS },
        },
      })
    );

    this.reset(0);
  }

  get texture(): THREE.Texture {
    return this.rtA.texture;
  }

  get storageScale() {
    return this.scale;
  }

  reset(seed: number) {
    this.clearPass.render(this.renderer, this.rtA);
    this.clearPass.render(this.renderer, this.rtB);
    // keep the seed small: large values annihilate float precision in the shader
    this.sim.material.uniforms.uSeed.value = ((seed % 977) + 977) % 977 * 0.131;
    this.rim.fill(0);
    this.rimColor.fill(0);
    this.coverage = 0;
    this.probeAge = 0;
  }

  setParam(name: string, value: number) {
    const u = this.sim.material.uniforms[name];
    if (u) u.value = value;
  }

  /** Raw probe bytes, for diagnostics. */
  get probeBytes() {
    return this.probeBuf;
  }

  setQuality(low: boolean) {
    this.sim.material.uniforms.uStreak.value = low ? 0.75 : 1;
  }

  /** Advance the film. `splat` is null when nothing is being poured. */
  step(dt: number, splat: SplatInput | null) {
    const u = this.sim.material.uniforms;
    u.uDt.value = dt;
    if (splat) {
      // angular half-width of the jet footprint; once the jet swallows the
      // axis it covers the whole ring, which is what a centre pour really does
      const rS = CAKE_R * Math.sin(Math.pow(splat.v, 0.75) * Math.PI * 0.5);
      const radU =
        splat.radius >= rS * 0.98
          ? 0.5
          : Math.min(0.5, Math.asin(splat.radius / rS) / (Math.PI * 2) + 0.02);
      const radV = Math.max(0.02, splat.radius / MERIDIAN_ARC);
      u.uSplat.value.set(splat.u, splat.v, radU, radV);
      u.uSplatColor.value.set(splat.color.r, splat.color.g, splat.color.b);
      u.uSplatRate.value = splat.rate;
      u.uSplatVel.value.set(splat.velU, splat.velV);
    } else {
      u.uSplatRate.value = 0;
      u.uSplatVel.value.set(0, 0);
    }
    u.uPrev.value = this.rtA.texture;
    this.sim.render(this.renderer, this.rtB);
    const t = this.rtA;
    this.rtA = this.rtB;
    this.rtB = t;
    this.probePass.material.uniforms.uField.value = this.rtA.texture;
  }

  /** Cheap GPU→CPU probe: rim beads (for drips) and total coverage. */
  updateProbe(dt: number, force = false) {
    this.probeAge += dt;
    if (!force && this.probeAge < 0.09) return false;
    this.probeAge = 0;
    this.probePass.render(this.renderer, this.probeRT);
    this.renderer.readRenderTargetPixels(
      this.probeRT,
      0,
      0,
      PROBE_COLS,
      PROBE_ROWS,
      this.probeBuf
    );
    for (let i = 0; i < PROBE_COLS; i++) {
      const o = i * 4;
      this.rim[i] = (this.probeBuf[o + 3] / 255) * 4;
      const r = this.probeBuf[o] / 255;
      const g = this.probeBuf[o + 1] / 255;
      const b = this.probeBuf[o + 2] / 255;
      this.rimColor[i * 3] = r * r;
      this.rimColor[i * 3 + 1] = g * g;
      this.rimColor[i * 3 + 2] = b * b;
    }
    let sum = 0;
    let wsum = 0;
    for (let row = 1; row < PROBE_ROWS; row++) {
      const band = (row - 1) / (PROBE_ROWS - 1);
      const w = Math.max(0.2, Math.sin(Math.pow(band + 0.07, 0.75) * Math.PI * 0.5));
      for (let i = 0; i < PROBE_COLS; i++) {
        const o = (row * PROBE_COLS + i) * 4;
        sum += (this.probeBuf[o + 3] / 255) * w;
        wsum += w;
      }
    }
    this.coverage = wsum > 0 ? sum / wsum : 0;
    return true;
  }

  dispose() {
    this.rtA.dispose();
    this.rtB.dispose();
    this.probeRT.dispose();
    this.sim.dispose();
    this.probePass.dispose();
    this.clearPass.dispose();
  }
}
