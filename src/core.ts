import * as THREE from 'three';

// ---------------------------------------------------------------- RNG / noise

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 2D value noise, smooth, deterministic. */
export function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, y: number, oct = 4): number {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    s += amp * vnoise(x * f, y * f);
    amp *= 0.5; f *= 2.03;
  }
  return s;
}

// ---------------------------------------------------------------- math helpers

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t: number) => t * t * (3 - 2 * t);

/** Frame-rate independent exponential approach. */
export function damp(cur: number, target: number, rate: number, dt: number): number {
  return lerp(cur, target, 1 - Math.exp(-rate * dt));
}
export function dampV3(cur: THREE.Vector3, target: THREE.Vector3, rate: number, dt: number): void {
  cur.lerp(target, 1 - Math.exp(-rate * dt));
}
export function dampAngle(cur: number, target: number, rate: number, dt: number): number {
  let d = target - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return cur + d * (1 - Math.exp(-rate * dt));
}

/**
 * Catenary-like sagging curve between two points.
 * sag: max vertical drop at midpoint (m). lateral: optional sideways bow.
 */
export function sagCurve(
  a: THREE.Vector3, b: THREE.Vector3, sag: number, n = 24,
  lateral = 0, lateralDir?: THREE.Vector3
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const side = lateralDir ?? new THREE.Vector3(1, 0, 0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    // cosh-shaped dip, normalised so midpoint = sag
    const dip = (Math.cosh((t - 0.5) * 2.4) - 1) / (Math.cosh(1.2) - 1);
    p.y -= sag * (1 - dip);
    p.addScaledVector(side, lateral * Math.sin(t * Math.PI));
    pts.push(p);
  }
  return pts;
}

// ---------------------------------------------------------------- thread shader

const threadMats: THREE.ShaderMaterial[] = [];

/**
 * Rainbow-thread material: translucent fibre with a thin bright core.
 * Brightness peaks where the tube surface faces the camera (fake inner core),
 * and saturation/brightness shift slightly with sun–view alignment.
 */
export function makeThreadMaterial(
  color: THREE.Color,
  opts: { opacity?: number; boost?: number; vertexColors?: boolean } = {}
): THREE.ShaderMaterial {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexColors: !!opts.vertexColors,
    uniforms: {
      uColor: { value: color.clone() },
      uSunDir: { value: new THREE.Vector3(0.4, 0.7, 0.5) },
      uOpacity: { value: opts.opacity ?? 0.85 },
      uBoost: { value: opts.boost ?? 1.0 }
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalW;
      varying vec3 vViewW;
      #ifdef USE_COLOR
        varying vec3 vColor;
      #endif
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewW = normalize(cameraPosition - wp.xyz);
        #ifdef USE_COLOR
          vColor = color;
        #endif
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uSunDir;
      uniform float uOpacity;
      uniform float uBoost;
      varying vec3 vNormalW;
      varying vec3 vViewW;
      #ifdef USE_COLOR
        varying vec3 vColor;
      #endif
      void main() {
        vec3 n = normalize(vNormalW);
        vec3 v = normalize(vViewW);
        float facing = abs(dot(n, v));           // 1 = tube centre line
        float core = pow(facing, 3.0);           // thin bright core
        float rim = 1.0 - facing;
        // sun glint: thread lights up when sun reflects toward viewer
        vec3 r = reflect(-normalize(uSunDir), n);
        float glint = pow(max(dot(r, v), 0.0), 6.0);
        #ifdef USE_COLOR
          vec3 base = vColor;
        #else
          vec3 base = uColor;
        #endif
        vec3 col = base * (0.55 + 0.9 * core) + vec3(1.0) * (core * 0.35 + glint * 0.5);
        col *= uBoost;
        float a = uOpacity * (0.35 + 0.65 * core) + glint * 0.2;
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
      }
    `
  });
  threadMats.push(mat);
  return mat;
}

export function setThreadSun(dir: THREE.Vector3): void {
  for (const m of threadMats) (m.uniforms.uSunDir.value as THREE.Vector3).copy(dir);
}

/** Add a per-vertex colour attribute to a TubeGeometry from colour stops along its length. */
export function colorizeTube(
  geo: THREE.BufferGeometry,
  tubularSegments: number,
  radialSegments: number,
  colorAt: (t: number) => THREE.Color
): void {
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const ringSize = radialSegments + 1;
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const ring = Math.floor(i / ringSize);
    const t = clamp(ring / tubularSegments, 0, 1);
    c.copy(colorAt(t));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// ---------------------------------------------------------------- audio

/** Tiny WebAudio helper: gentle, failure-free feedback sounds. */
export class AudioFx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private windGain: GainNode | null = null;
  enabled = true;

  /** Call from a user gesture. */
  init(): void {
    if (this.ctx || !this.enabled) return;
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startWind();
    } catch { /* audio unavailable — fine */ }
  }

  private startWind(): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = last * 0.97 + w * 0.03; // brownish
      data[i] = last * 3;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 380; filt.Q.value = 0.4;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.05;
    src.connect(filt).connect(this.windGain).connect(this.master);
    src.start();
  }

  private tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', glideTo?: number): void {
    if (!this.ctx || !this.master || !this.enabled) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g).connect(this.master);
    osc.start(); osc.stop(ctx.currentTime + dur + 0.05);
  }

  /** Soft chime per wound quarter-turn; pitch by thread colour. */
  ping(colorIdx: number, speed = 1): void {
    const base = [523.25, 659.25, 783.99][colorIdx % 3]; // C5 E5 G5
    this.tone(base * (speed > 2.2 ? 1.5 : 1), 0.35, 0.12);
  }
  hook(): void { this.tone(880, 0.2, 0.08, 'triangle'); }
  unwindTick(): void { this.tone(392, 0.18, 0.07, 'triangle'); }
  /** Deep string catch when a bridge line locks onto the far anchor. */
  thrum(): void {
    this.tone(98, 1.1, 0.18, 'sine', 92);
    this.tone(196, 0.7, 0.08, 'triangle');
  }
  clop(soft = false): void {
    if (!this.ctx || !this.master || !this.enabled) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(soft ? 180 : 240, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.09);
    g.gain.setValueAtTime(soft ? 0.10 : 0.16, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.connect(g).connect(this.master);
    osc.start(); osc.stop(ctx.currentTime + 0.15);
  }
  gust(): void {
    if (!this.windGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.cancelScheduledValues(t);
    this.windGain.gain.setValueAtTime(0.05, t);
    this.windGain.gain.linearRampToValueAtTime(0.16, t + 0.8);
    this.windGain.gain.linearRampToValueAtTime(0.05, t + 2.2);
  }
}
