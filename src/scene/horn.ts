import * as THREE from 'three';
import { Rng } from '../core/rng';
import { ensureOutward } from './meshUtil';

/**
 * The horn is the heart of the game. It is a real grooved spiral cone
 * (grooves are geometry, so the silhouette and the raking-light highlight
 * are honest), with a repair-state model on top:
 *
 *  - dirt:   1D field over t (base→tip), lives visually inside the spiral
 *            groove. Painted away by brush/rinse strokes.
 *  - cracks: parametric segments in UV space with real normal dents so the
 *            inspection-lamp highlight visibly breaks across them.
 *            fill (resin), cured, smoothed evolve per crack.
 *  - polish: 1D field over t, lowers roughness locally but keeps the
 *            layered growth structure.
 *  - light:  an emissive front that travels base→tip and stops at the first
 *            blocking dirt or unfilled crack — the same rule the dew drop
 *            and the wall spectrum obey.
 */

export const HORN_LEN = 0.56;
export const HORN_BASE_R = 0.047;
export const HORN_TIP_R = 0.0045;
export const TURNS = 5.25;
const STATE_N = 256;

export interface Crack {
  u: number; // uv center (circumference 0..1)
  v: number; // uv center (base→tip 0..1)
  du: number; // direction in metric uv space (normalized)
  dv: number;
  halfLen: number; // in v units
  width: number; // metric uv units
  aspect: number; // circumference/length ratio at v (metric for u)
  fill: number; // 0..1 resin fill along crack
  overfill: number; // 0..1 excess bump
  cured: number; // 0..1
  smoothed: number; // 0..1 (excess polished flat)
  discovered: boolean;
  glint: number; // transient sparkle for discovery feedback
}

export function hornRadius(t: number): number {
  const tt = Math.min(1, Math.max(0, t));
  return HORN_BASE_R * Math.pow(1 - tt, 1.12) + HORN_TIP_R * tt + 0.0015 * Math.sin(tt * Math.PI);
}

function grooveDepth(t: number): number {
  // shallower toward the base: keratin ridges, not stacked pillows
  return (0.14 * hornRadius(t) + 0.0007) * (1 - 0.35 * t);
}

/** Bump profile of the groove across w (spiral phase), centered at 0.5. */
function grooveProfile(w: number): number {
  const d = Math.abs(w - 0.5);
  const x = Math.max(0, 1 - d / 0.16);
  return x * x * (3 - 2 * x);
}

export class Horn {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshPhysicalMaterial;
  readonly cracks: Crack[] = [];
  readonly dirt = new Float32Array(STATE_N);
  readonly polish = new Float32Array(STATE_N);
  private stateData: Uint8Array<ArrayBuffer>;
  private stateTex: THREE.DataTexture;
  private uniformsRef: Record<string, THREE.IUniform> | null = null;

  shaderInstalled = false; // diagnostic: onBeforeCompile ran
  lightFront = 0.12; // t of furthest steady light
  lightPower = 1; // overall glow strength
  tipFlicker = 0; // unstable shimmer near tip (intro state)
  private dirtyTex = true;

  constructor(rng: Rng, facingU: number) {
    const geo = this.buildGeometry();
    this.stateData = new Uint8Array(new ArrayBuffer(STATE_N * 4));
    this.stateTex = new THREE.DataTexture(this.stateData, STATE_N, 1, THREE.RGBAFormat);
    this.stateTex.minFilter = THREE.LinearFilter;
    this.stateTex.magFilter = THREE.LinearFilter;
    this.stateTex.wrapS = THREE.ClampToEdgeWrapping;
    this.stateTex.needsUpdate = true;

    this.seedState(rng, facingU);

    this.material = new THREE.MeshPhysicalMaterial({
      color: 0xf2ead9,
      roughness: 0.62,
      metalness: 0.0,
      envMapIntensity: 0.85,
    });
    this.material.defines = { USE_UV: '' };
    this.installShader();

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.castShadow = true;
    this.mesh.name = 'horn';
    this.syncTexture();
  }

  // ---------------------------------------------------------------- geometry

  private buildGeometry(): THREE.BufferGeometry {
    const radial = 110;
    const heights = 240;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j <= heights; j++) {
      const t = j / heights;
      const r = hornRadius(t);
      const gd = grooveDepth(t);
      for (let i = 0; i <= radial; i++) {
        const s = i / radial;
        const th = s * Math.PI * 2;
        const w = ((s + TURNS * t) % 1 + 1) % 1;
        // groove carved inward + faint growth-layer ripple
        const layer = 0.00045 * Math.sin(t * 310 + Math.sin(t * 47) * 2) * (1 - t * 0.6);
        const rho = Math.max(0.0012, r - gd * grooveProfile(w) + layer);
        pos.push(rho * Math.cos(th), t * HORN_LEN, rho * Math.sin(th));
        uv.push(s, t);
      }
    }
    const stride = radial + 1;
    for (let j = 0; j < heights; j++) {
      for (let i = 0; i < radial; i++) {
        const a = j * stride + i;
        const b = a + stride;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    ensureOutward(g);
    // stitch normals across the u seam so no lighting line shows
    const n = g.getAttribute('normal') as THREE.BufferAttribute;
    for (let j = 0; j <= heights; j++) {
      const a = j * stride;
      const b = j * stride + radial;
      const nx = (n.getX(a) + n.getX(b)) / 2;
      const ny = (n.getY(a) + n.getY(b)) / 2;
      const nz = (n.getZ(a) + n.getZ(b)) / 2;
      n.setXYZ(a, nx, ny, nz);
      n.setXYZ(b, nx, ny, nz);
    }
    n.needsUpdate = true;
    return g;
  }

  /** Point on the groove centerline in horn-local coordinates. */
  groovePointLocal(t: number, out = new THREE.Vector3()): THREE.Vector3 {
    const s = ((0.5 - TURNS * t) % 1 + 1) % 1;
    const th = s * Math.PI * 2;
    const rho = Math.max(0.0012, hornRadius(t) - grooveDepth(t) * 0.85);
    return out.set(rho * Math.cos(th), t * HORN_LEN, rho * Math.sin(th));
  }

  groovePointWorld(t: number, out = new THREE.Vector3()): THREE.Vector3 {
    this.groovePointLocal(t, out);
    return this.mesh.localToWorld(out);
  }

  /** Surface point at (u, v) on the horn, world space. */
  surfacePointWorld(u: number, v: number, out = new THREE.Vector3()): THREE.Vector3 {
    const th = u * Math.PI * 2;
    const r = hornRadius(v);
    out.set(r * Math.cos(th), v * HORN_LEN, r * Math.sin(th));
    return this.mesh.localToWorld(out);
  }

  /** Outward surface normal at an arbitrary (u,v) on the horn, world space. */
  surfaceNormalWorld(u: number, v: number, out = new THREE.Vector3()): THREE.Vector3 {
    const th = u * Math.PI * 2;
    out.set(Math.cos(th), 0.15 + 0.1 * v, Math.sin(th)).normalize();
    return out.transformDirection(this.mesh.matrixWorld);
  }

  /** Outward surface normal (approx) at groove t, world space. */
  grooveNormalWorld(t: number, out = new THREE.Vector3()): THREE.Vector3 {
    const s = ((0.5 - TURNS * t) % 1 + 1) % 1;
    const th = s * Math.PI * 2;
    out.set(Math.cos(th), 0.18, Math.sin(th)).normalize();
    return out.transformDirection(this.mesh.matrixWorld);
  }

  crackPointWorld(c: Crack, along = 0, out = new THREE.Vector3()): THREE.Vector3 {
    const v = c.v + c.dv * c.halfLen * along;
    const u = c.u + (c.du * c.halfLen * along) / Math.max(0.2, c.aspect);
    const th = u * Math.PI * 2;
    const rho = hornRadius(v) * 0.995;
    out.set(rho * Math.cos(th), v * HORN_LEN, rho * Math.sin(th));
    return this.mesh.localToWorld(out);
  }

  // ------------------------------------------------------------------- state

  private seedState(rng: Rng, facingU: number) {
    // Two dirt bands and two cracks, interleaved along the horn so that
    // cleaning reveals "light now stops at the crack" as its own discovery.
    // Layout varies per play; the causal rules never do.
    const d0a = rng.range(0.2, 0.26);
    const d0b = d0a + rng.range(0.09, 0.13);
    const c0v = d0b + rng.range(0.07, 0.11);
    const d1a = c0v + rng.range(0.07, 0.1);
    const d1b = d1a + rng.range(0.07, 0.11);
    const c1v = Math.min(0.86, d1b + rng.range(0.06, 0.1));

    const addDirt = (a: number, b: number, amp: number) => {
      for (let i = 0; i < STATE_N; i++) {
        const t = i / (STATE_N - 1);
        const edge = 0.018;
        const inBand =
          smooth01((t - (a - edge)) / edge) * (1 - smooth01((t - b) / edge));
        const grime = 0.75 + 0.25 * Math.sin(t * 210 + a * 40) * Math.sin(t * 91);
        this.dirt[i] = Math.min(1, this.dirt[i] + amp * inBand * grime);
      }
    };
    addDirt(d0a, d0b, rng.range(0.85, 1));
    addDirt(d1a, d1b, rng.range(0.8, 1));
    // faint film elsewhere in groove (cleans quickly, keeps it from looking mirrored/synthetic)
    for (let i = 0; i < STATE_N; i++) {
      const t = i / (STATE_N - 1);
      if (t > 0.14 && t < 0.9) {
        this.dirt[i] = Math.min(1, this.dirt[i] + 0.1 * (0.5 + 0.5 * Math.sin(t * 57 + 2)));
      }
    }

    const mkCrack = (v: number, side: number): Crack => {
      const aspect = (2 * Math.PI * hornRadius(v)) / HORN_LEN;
      const ang = rng.range(-0.5, 0.5) + Math.PI / 2; // mostly along the axis, tilted
      return {
        u: ((facingU + side * rng.range(0.03, 0.1)) % 1 + 1) % 1,
        v,
        du: Math.cos(ang) * (rng.next() > 0.5 ? 1 : -1),
        dv: Math.sin(ang),
        halfLen: rng.range(0.038, 0.055),
        width: rng.range(0.009, 0.012),
        aspect,
        fill: 0,
        overfill: 0,
        cured: 0,
        smoothed: 0,
        discovered: false,
        glint: 0,
      };
    };
    this.cracks.push(mkCrack(c0v, -1), mkCrack(c1v, 1));
    this.computeLightFront();
  }

  private syncTexture() {
    for (let i = 0; i < STATE_N; i++) {
      this.stateData[i * 4] = Math.round(this.dirt[i] * 255);
      this.stateData[i * 4 + 1] = Math.round(this.polish[i] * 255);
      this.stateData[i * 4 + 2] = 0;
      this.stateData[i * 4 + 3] = 255;
    }
    this.stateTex.needsUpdate = true;
    this.dirtyTex = false;
  }

  /** First t (base→tip) blocked by dirt or an unfilled crack; also flicker state. */
  computeLightFront(): { front: number; blocker: 'dirt' | 'crack' | 'none'; crackIndex: number } {
    let front = 1;
    let blocker: 'dirt' | 'crack' | 'none' = 'none';
    let crackIndex = -1;
    outer: for (let i = 0; i < 512; i++) {
      const t = i / 511;
      const di = this.dirt[Math.min(STATE_N - 1, Math.floor(t * STATE_N))];
      if (di > 0.3) {
        front = t;
        blocker = 'dirt';
        break;
      }
      for (let c = 0; c < this.cracks.length; c++) {
        const k = this.cracks[c];
        const lo = k.v - Math.abs(k.dv) * k.halfLen - 0.01;
        const hi = k.v + Math.abs(k.dv) * k.halfLen + 0.01;
        if (t > lo && t < hi && k.fill < 0.92) {
          front = t;
          blocker = 'crack';
          crackIndex = c;
          break outer;
        }
      }
    }
    return { front, blocker, crackIndex };
  }

  /** Total dirt remaining (0..1 average over the initially dirty range). */
  dirtRemaining(): number {
    let s = 0;
    for (let i = 0; i < STATE_N; i++) s += this.dirt[i];
    return s / STATE_N;
  }

  polishCoverage(a = 0.15, b = 0.95): number {
    let s = 0;
    let n = 0;
    for (let i = 0; i < STATE_N; i++) {
      const t = i / (STATE_N - 1);
      if (t < a || t > b) continue;
      s += this.polish[i];
      n++;
    }
    return n ? s / n : 0;
  }

  cleanAt(t: number, radius = 0.035, amount = 1): number {
    let removed = 0;
    const i0 = Math.max(0, Math.floor((t - radius) * STATE_N));
    const i1 = Math.min(STATE_N - 1, Math.ceil((t + radius) * STATE_N));
    for (let i = i0; i <= i1; i++) {
      const ti = i / (STATE_N - 1);
      const f = Math.exp(-((ti - t) * (ti - t)) / (radius * radius * 0.35));
      const d = Math.min(this.dirt[i], amount * f);
      this.dirt[i] -= d;
      removed += d;
    }
    if (removed > 0.0001) this.dirtyTex = true;
    return removed;
  }

  polishAt(t: number, radius = 0.045, amount = 0.5): number {
    let added = 0;
    const i0 = Math.max(0, Math.floor((t - radius) * STATE_N));
    const i1 = Math.min(STATE_N - 1, Math.ceil((t + radius) * STATE_N));
    for (let i = i0; i <= i1; i++) {
      const ti = i / (STATE_N - 1);
      const f = Math.exp(-((ti - t) * (ti - t)) / (radius * radius * 0.35));
      const p = Math.min(1 - this.polish[i], amount * f);
      this.polish[i] += p;
      added += p;
    }
    // polishing also smooths resin excess on cracks under the cloth
    for (const c of this.cracks) {
      if (c.cured > 0.7 && Math.abs(c.v - t) < radius * 1.6) {
        c.smoothed = Math.min(1, c.smoothed + amount * 0.35);
      }
    }
    if (added > 0.0001) this.dirtyTex = true;
    return added;
  }

  /** Nearest crack to uv touch (metric distance), within maxDist, else -1. */
  nearestCrack(u: number, v: number, maxDist = 0.09): number {
    let best = -1;
    let bd = maxDist;
    for (let i = 0; i < this.cracks.length; i++) {
      const c = this.cracks[i];
      let du = u - c.u;
      du = (du % 1 + 1.5) % 1 - 0.5;
      const dx = du * c.aspect;
      const dy = v - c.v;
      const d = Math.hypot(dx, dy);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  fillCrack(i: number, amount: number): void {
    const c = this.cracks[i];
    if (!c || c.cured > 0.05) return;
    const raw = c.fill + amount;
    c.fill = Math.min(1, raw);
    if (raw > 1) c.overfill = Math.min(1, c.overfill + (raw - 1) * 0.9);
  }

  // ------------------------------------------------------------------ shader

  private installShader() {
    this.material.onBeforeCompile = (shader) => {
      const u = shader.uniforms as Record<string, THREE.IUniform>;
      u.uState = { value: this.stateTex };
      u.uTurns = { value: TURNS };
      u.uTime = { value: 0 };
      u.uLightFront = { value: this.lightFront };
      u.uLightPower = { value: this.lightPower };
      u.uTipFlicker = { value: this.tipFlicker };
      u.uCrackA = { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] };
      u.uCrackB = { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] };
      u.uCrackC = { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] };
      u.uCrackCount = { value: this.cracks.length };
      u.uDebug = { value: 0 };
      this.uniformsRef = u;
      this.shaderInstalled = true;
      this.pushCrackUniforms();

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
uniform sampler2D uState;
uniform float uTurns;
uniform float uTime;
uniform float uLightFront;
uniform float uLightPower;
uniform float uTipFlicker;
uniform vec4 uCrackA[3]; // u, v, dirU(metric), dirV
uniform vec4 uCrackB[3]; // halfLen, width, fill, cured
uniform vec4 uCrackC[3]; // smoothed, aspect, glint, 0
uniform int uCrackCount;
uniform float uDebug;

float uhaHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float uhaNoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(uhaHash(i), uhaHash(i+vec2(1,0)), f.x),
             mix(uhaHash(i+vec2(0,1)), uhaHash(i+vec2(1,1)), f.x), f.y);
}

// Signed info about one crack at uv. Returns:
// x: crack mask (1 at center line), y: along param a in -1..1,
// z: perpendicular distance (metric), w: valid
vec4 uhaCrackInfo(int i, vec2 uv){
  vec4 A = uCrackA[i]; vec4 B = uCrackB[i]; vec4 C = uCrackC[i];
  float du = uv.x - A.x;
  du = mod(du + 1.5, 1.0) - 0.5;
  vec2 p = vec2(du * C.y, uv.y - A.y);         // metric local
  vec2 dir = normalize(vec2(A.z, A.w));
  float along = dot(p, dir);
  float perp = abs(dot(p, vec2(-dir.y, dir.x)));
  float hl = B.x;
  // taper: crack thins toward its ends, with slight waviness
  float a01 = clamp(along / hl * 0.5 + 0.5, 0.0, 1.0);
  float wav = (uhaNoise(vec2(a01 * 9.0, float(i) * 7.3)) - 0.5) * B.y * 1.2;
  perp = abs(perp + wav * 0.4);
  float taper = 1.0 - smoothstep(0.55, 1.0, abs(along) / hl);
  float wHere = B.y * (0.35 + 0.65 * taper);
  float mask = (abs(along) < hl * 1.05) ? (1.0 - smoothstep(0.0, wHere, perp)) : 0.0;
  return vec4(mask, along / hl, perp, 1.0);
}
`
        )
        .replace(
          '#include <color_fragment>',
          /* glsl */ `#include <color_fragment>
{
  float tAx = vUv.y;
  float w = fract(vUv.x + uTurns * tAx);
  float dGroove = abs(w - 0.5);
  float grooveMask = 1.0 - smoothstep(0.06, 0.2, dGroove);

  // ivory base with growth layers: gentle warm banding along t (kept low
  // frequency — high frequencies alias on small screens)
  float layers = uhaNoise(vec2(tAx * 46.0, 0.5)) * 0.65 + uhaNoise(vec2(tAx * 130.0, 7.0)) * 0.35;
  vec3 ivory = mix(vec3(0.945, 0.915, 0.855), vec3(0.985, 0.968, 0.932), layers);
  ivory = mix(ivory, vec3(0.885, 0.85, 0.79), 0.45 * smoothstep(0.14, 0.0, tAx)); // denser, heavier base
  ivory += 0.012 * vec3(sin(tAx*18.0), sin(tAx*18.0+2.1), sin(tAx*18.0+4.2)) * (1.0-grooveMask);
  diffuseColor.rgb = ivory;

  // groove shadowing/warmth
  diffuseColor.rgb *= 1.0 - 0.3 * grooveMask;

  // dirt: dark humus packed into the groove, mottled, spilling a little
  // over the groove lips where grime creeps
  vec4 st = texture2D(uState, vec2(tAx, 0.5));
  float mottle = 0.72 + 0.28 * uhaNoise(vec2(vUv.x * 7.0, tAx * 42.0));
  // packed hard into the groove, thinning as a grimy film over the flanks —
  // it must stay readable from any angle, ridges included
  // asymmetric packing (no rotational symmetry — grime settles unevenly)
  float lopside = 0.7 + 0.6 * uhaNoise(vec2(vUv.x * 3.0 + 13.0, tAx * 9.0));
  float pack = 1.5 * lopside * (1.0 - 0.55 * smoothstep(0.22, 0.55, dGroove));
  float dirtVis = clamp(st.r * mottle * pack, 0.0, 1.0);
  vec3 grime = mix(vec3(0.13, 0.1, 0.075), vec3(0.28, 0.22, 0.135), uhaNoise(vec2(tAx*36.0, 3.0)));
  diffuseColor.rgb = mix(diffuseColor.rgb, grime, dirtVis);
  if (uDebug > 0.5) diffuseColor.rgb = vec3(0.0);

  // cracks: dry crack scatters light white at its lips, dark in the gap.
  for (int i = 0; i < 3; i++) {
    if (i >= uCrackCount) break;
    vec4 ci = uhaCrackInfo(i, vUv);
    if (ci.x <= 0.001) continue;
    vec4 B = uCrackB[i]; vec4 C = uCrackC[i];
    float a01 = clamp(ci.y * 0.5 + 0.5, 0.0, 1.0);
    float filledHere = step(a01, B.z); // resin advances from the near end, capillary style
    float dry = ci.x * (1.0 - filledHere);
    // dry crack: a faint shadowed halo, whitened fractured lips, dark core
    float halo = (1.0 - smoothstep(0.0, 1.6, ci.z / max(B.y, 1e-4))) * (1.0 - filledHere);
    diffuseColor.rgb *= 1.0 - 0.14 * halo;
    float core = smoothstep(0.25, 0.85, ci.x);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.99, 0.98, 0.955), dry * 0.7);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.27, 0.24, 0.2), dry * core * 0.9);
    // resin-filled: clear, faintly cool, slightly deeper-toned than the horn
    float resin = ci.x * filledHere;
    vec3 resinCol = mix(vec3(0.86, 0.885, 0.90), vec3(0.90, 0.905, 0.895), B.w);
    diffuseColor.rgb = mix(diffuseColor.rgb, resinCol, resin * 0.55);
    // discovery glint: brief star of light running along the crack
    float gl = C.z;
    if (gl > 0.001) {
      float spark = exp(-abs(a01 - fract(uTime * 0.7)) * 14.0) * gl;
      diffuseColor.rgb += vec3(1.0, 0.98, 0.9) * spark * ci.x * 1.5;
    }
  }
}
`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          /* glsl */ `#include <roughnessmap_fragment>
{
  float tAx = vUv.y;
  float w = fract(vUv.x + uTurns * tAx);
  float grooveMask = 1.0 - smoothstep(0.06, 0.2, abs(w - 0.5));
  vec4 st = texture2D(uState, vec2(tAx, 0.5));
  float layers = uhaNoise(vec2(tAx * 130.0, 7.0));
  float baseR = 0.52 + 0.14 * layers + 0.1 * grooveMask;
  // polish lowers roughness but the layered micro-structure keeps a trace
  float polished = st.g;
  baseR = mix(baseR, 0.16 + 0.06 * layers, polished);
  // dirt is matte wherever it films the surface
  baseR = mix(baseR, 0.82, st.r * (0.55 + 0.45 * grooveMask));
  for (int i = 0; i < 3; i++) {
    if (i >= uCrackCount) break;
    vec4 ci = uhaCrackInfo(i, vUv);
    if (ci.x <= 0.001) continue;
    vec4 B = uCrackB[i]; vec4 C = uCrackC[i];
    float a01 = clamp(ci.y * 0.5 + 0.5, 0.0, 1.0);
    float filledHere = step(a01, B.z);
    // dry crack lips scatter (rough); liquid resin is glassy; cured resin settles
    baseR = mix(baseR, 0.85, ci.x * (1.0 - filledHere));
    float liquid = filledHere * (1.0 - B.w);
    baseR = mix(baseR, 0.045, ci.x * liquid);
    float curedR = mix(0.30, 0.14, C.x); // smoothed by polishing
    baseR = mix(baseR, curedR, ci.x * filledHere * B.w);
  }
  roughnessFactor = clamp(baseR, 0.03, 1.0);
}
`
        )
        .replace(
          '#include <normal_fragment_maps>',
          /* glsl */ `#include <normal_fragment_maps>
{
  // Crack relief without screen-space derivatives (those go blocky):
  // bend the normal across each crack analytically, using the crack's own
  // perpendicular direction mapped to the surface tangent frame.
  for (int i = 0; i < 3; i++) {
    if (i >= uCrackCount) break;
    vec4 ci = uhaCrackInfo(i, vUv);
    if (ci.x <= 0.001) continue;
    vec4 A = uCrackA[i]; vec4 B = uCrackB[i]; vec4 C = uCrackC[i];
    float a01 = clamp(ci.y * 0.5 + 0.5, 0.0, 1.0);
    float filledHere = step(a01, B.z);
    // signed side of the crack line (positive/negative flank)
    float du = vUv.x - A.x; du = mod(du + 1.5, 1.0) - 0.5;
    vec2 p = vec2(du * C.y, vUv.y - A.y);
    vec2 dir = normalize(vec2(A.z, A.w));
    float side = sign(dot(p, vec2(-dir.y, dir.x)));
    // tangent frame: approximate perp direction in view space
    vec3 upT = normalize(cross(normal, vec3(0.0, 0.0, 1.0)));
    vec3 vT = normalize(cross(normal, upT));
    float dent = ci.x * (1.0 - filledHere) * 0.85;       // open crack: flanks fold inward
    float bulge = ci.x * filledHere * C.w * (1.0 - C.x) * 0.5; // overfill: soft bulge until smoothed
    normal = normalize(normal + (upT * side + vT * 0.3) * (dent - bulge) * 0.8);
  }
}
`
        )
        .replace(
          '#include <emissivemap_fragment>',
          /* glsl */ `#include <emissivemap_fragment>
{
  float tAx = vUv.y;
  vec4 st = texture2D(uState, vec2(tAx, 0.5));
  vec3 nv = normalize(vNormal);
  vec3 vv = normalize(vViewPosition);
  float facing = pow(abs(dot(nv, vv)), 0.4); // center-weighted: reads as inner light
  float inside = 1.0 - smoothstep(uLightFront - 0.015, uLightFront + 0.012, tAx);
  float ripple = 0.8 + 0.2 * sin(tAx * 34.0 - uTime * 5.0);
  float frontEdge = exp(-abs(tAx - uLightFront) * 24.0) * (0.6 + 0.4 * sin(uTime * 7.0));
  float baseWell = smoothstep(0.16, 0.0, tAx) * 0.55; // the root always holds warmth
  float flick = uTipFlicker * smoothstep(0.82, 0.96, tAx)
              * max(0.0, sin(uTime * 11.0) * sin(uTime * 4.7 + 1.7) - 0.15) * 1.6;
  float glow = (inside * ripple * 1.25 + frontEdge * 0.9 + baseWell + flick) * uLightPower;
  glow *= 1.0 - 0.7 * clamp(st.r * 1.4, 0.0, 1.0); // dirt occludes the inner light
  // saturated gold so the lit stretch separates from the ivory even in
  // bright daylight; cools toward white only at the tip
  vec3 lightCol = mix(vec3(1.0, 0.82, 0.45), vec3(0.98, 0.96, 0.9), smoothstep(0.2, 1.0, tAx));
  totalEmissiveRadiance += lightCol * glow * facing;
  if (uDebug > 0.5) {
    totalEmissiveRadiance = vec3(st.r, tAx, 0.0);
  }
}
`
        );
      // vNormal is needed for the emissive facing term
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <clipping_planes_pars_fragment>',
        `#include <clipping_planes_pars_fragment>
#ifndef FLAT_SHADED
#endif`
      );
    };
    this.material.customProgramCacheKey = () => 'uha-horn';
  }

  private pushCrackUniforms() {
    if (!this.uniformsRef) return;
    const A = this.uniformsRef.uCrackA.value as THREE.Vector4[];
    const B = this.uniformsRef.uCrackB.value as THREE.Vector4[];
    const C = this.uniformsRef.uCrackC.value as THREE.Vector4[];
    for (let i = 0; i < 3; i++) {
      const c = this.cracks[i];
      if (!c) {
        A[i].set(0, -10, 1, 0);
        B[i].set(0.001, 0.001, 0, 0);
        C[i].set(0, 1, 0, 0);
        continue;
      }
      A[i].set(c.u, c.v, c.du, c.dv);
      B[i].set(c.halfLen, c.width, c.fill, c.cured);
      C[i].set(c.smoothed, c.aspect, c.glint, c.overfill);
    }
    (this.uniformsRef.uCrackCount as THREE.IUniform).value = this.cracks.length;
  }

  setDebug(mode: boolean | number) {
    if (this.uniformsRef) this.uniformsRef.uDebug.value = Number(mode);
  }

  update(dt: number, time: number) {
    for (const c of this.cracks) {
      if (c.glint > 0) c.glint = Math.max(0, c.glint - dt * 0.5);
    }
    if (this.dirtyTex) this.syncTexture();
    if (this.uniformsRef) {
      this.uniformsRef.uTime.value = time;
      this.uniformsRef.uLightFront.value = this.lightFront;
      this.uniformsRef.uLightPower.value = this.lightPower;
      this.uniformsRef.uTipFlicker.value = this.tipFlicker;
      this.pushCrackUniforms();
    }
  }
}

function smooth01(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}
