import * as THREE from 'three';
import { Rng, clamp, lerp, smoothstep, damp } from '../util/rng';
import { WaterSystem } from './water';
import { Unicorn, HORN_LEN, HORN_TURNS } from './unicorn';
import { POND_RADIUS } from './terrain';

// Murk: thin blackish-purple filaments drifting below the surface.
// Not a fluid sim — each streak is a spline ribbon whose samples blend
// between (a) its drifting water curve and (b) a helix that follows the
// horn's spiral groove. The child's own trace stays visible: winding
// speed sets helix pitch and ribbon width.

const N = 40; // samples per ribbon

export type StreakState =
  | 'inactive'
  | 'drift'
  | 'capture'
  | 'wind'
  | 'stalled'
  | 'absorb'
  | 'gone';

const GROOVE_TOP = 0.86; // groove t where murk enters (near tip)
const GROOVE_SPAN = 0.5; // how far down the groove one streak can occupy

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpV3 = new THREE.Vector3();

export class Streak {
  state: StreakState = 'drift';
  home: THREE.Vector3;
  ctrl: THREE.Vector3[] = [];
  private curve: THREE.CatmullRomCurve3;
  private phases: number[] = [];
  mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private posAttr: THREE.BufferAttribute;

  captureT = 0;
  windT = 0;
  absorbT = 0;
  stallTime = 0;
  loosenT = -1;
  chirality = 1;
  // winding style laid down by the child's own motion
  pitchStyle = 0.5; // 0 slow/dense … 1 fast/wide ribbon
  isMain: boolean;
  len: number;
  thickness: number;
  private appear = 1;

  constructor(
    public index: number,
    private rng: Rng,
    home: THREE.Vector3,
    isMain: boolean
  ) {
    this.isMain = isMain;
    this.home = home.clone();
    this.len = isMain ? rng.range(0.5, 0.75) : rng.range(0.26, 0.4);
    this.thickness = (isMain ? 1 : 0.62) * rng.range(0.8, 1.2);
    for (let i = 0; i < 4; i++) {
      this.ctrl.push(
        new THREE.Vector3(
          home.x + (i / 3 - 0.5) * this.len + rng.range(-0.05, 0.05),
          home.y + rng.range(-0.03, 0.03),
          home.z + rng.range(-0.09, 0.09)
        )
      );
      this.phases.push(rng.next() * 6.28);
    }
    this.curve = new THREE.CatmullRomCurve3(this.ctrl, false, 'catmullrom', 0.5);

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(N * 2 * 3);
    const uvs = new Float32Array(N * 2 * 2);
    const idx: number[] = [];
    for (let i = 0; i < N; i++) {
      uvs[(i * 2) * 2] = i / (N - 1);
      uvs[(i * 2) * 2 + 1] = 0;
      uvs[(i * 2 + 1) * 2] = i / (N - 1);
      uvs[(i * 2 + 1) * 2 + 1] = 1;
      if (i < N - 1) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.posAttr = new THREE.BufferAttribute(positions, 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(idx);

    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      uniforms: {
        uAlpha: { value: 0.62 },
        uColor: { value: new THREE.Color(0x150b1c) },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uAlpha; uniform vec3 uColor; uniform float uTime;
        void main(){
          float endFade = pow(sin(vUv.x * 3.14159), 0.55);
          float edge = 1.0 - pow(abs(vUv.y * 2.0 - 1.0), 2.3);
          float wob = 0.85 + 0.15 * sin(vUv.x * 40.0 + uTime * 2.0);
          vec3 col = uColor + vec3(0.025, 0.01, 0.035) * sin(vUv.x * 9.0 + uTime * 0.7);
          gl_FragColor = vec4(col, uAlpha * endFade * edge * wob);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.renderOrder = 5; // above bottom, below water surface
    this.mesh.frustumCulled = false;
  }

  setInactive() {
    this.state = 'inactive';
    this.mesh.visible = false;
    this.appear = 0;
  }
  activate() {
    if (this.state === 'inactive') {
      this.state = 'drift';
      this.mesh.visible = true;
    }
  }

  headPos(out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.ctrl[3]);
  }
  centroid(out = new THREE.Vector3()): THREE.Vector3 {
    out.set(0, 0, 0);
    for (const c of this.ctrl) out.add(c);
    return out.multiplyScalar(1 / this.ctrl.length);
  }

  startCapture(chirality: number, pitchStyle: number) {
    if (this.state !== 'drift') return;
    this.state = 'capture';
    this.captureT = 0;
    this.windT = 0;
    this.chirality = chirality;
    this.pitchStyle = pitchStyle;
  }

  release() {
    // gentle slip back into the water — not a failure
    this.state = 'drift';
    this.captureT = 0;
    this.windT = 0;
  }

  private hornLocalHelix(m: number, hornMat: THREE.Matrix4, out: THREE.Vector3): THREE.Vector3 {
    // m: wound length ahead of this sample (0 = just attached at tip area)
    const span = GROOVE_SPAN * lerp(0.7, 1.35, this.pitchStyle);
    const t = clamp(GROOVE_TOP - m * span, 0.18, GROOVE_TOP);
    const ang = 2 * Math.PI * (0.5 - t * HORN_TURNS);
    let radius = lerp(0.028, 0.007, t) + 0.008;
    if (this.loosenT >= 0) radius *= 1 + Math.sin(Math.PI * clamp(this.loosenT, 0, 1)) * 0.5;
    out.set(Math.sin(ang) * radius, t * HORN_LEN, Math.cos(ang) * radius);
    return out.applyMatrix4(hornMat);
  }

  // Main per-frame update. Returns clarity paint request or null.
  update(
    dt: number,
    time: number,
    tip: THREE.Vector3,
    hornMat: THREE.Matrix4,
    camera: THREE.Camera,
    attract: { point: THREE.Vector3; radius: number; strength: number } | null
  ): { x: number; z: number; r: number; s: number } | null {
    if (this.state === 'inactive' || this.state === 'gone') return null;
    this.mat.uniforms.uTime.value = time;
    this.appear = Math.min(1, this.appear + dt * 0.6);
    let paint: { x: number; z: number; r: number; s: number } | null = null;

    // --- drift of the underlying water curve
    const driftScale = this.state === 'drift' ? 1 : 0.3;
    for (let i = 0; i < 4; i++) {
      const c = this.ctrl[i];
      const ph = this.phases[i];
      c.x += Math.sin(time * 0.14 + ph) * 0.014 * dt * driftScale;
      c.z += Math.cos(time * 0.11 + ph * 1.7) * 0.014 * dt * driftScale;
      c.y = this.home.y + Math.sin(time * 0.2 + ph) * 0.035;
      // stay inside the pond
      const r = Math.hypot(c.x, c.z);
      if (r > POND_RADIUS - 0.25) {
        c.x -= (c.x / r) * dt * 0.05;
        c.z -= (c.z / r) * dt * 0.05;
      }
    }

    // --- attraction: bigger circles reach farther streaks
    if (attract && (this.state === 'drift' || this.state === 'capture')) {
      const cen = this.centroid(tmpV2);
      // planar distance: the pull works through the water column
      const d = Math.hypot(cen.x - attract.point.x, cen.z - attract.point.z);
      if (d < attract.radius) {
        const pull = attract.strength * (1 - d / attract.radius);
        for (let i = 0; i < 4; i++) {
          const c = this.ctrl[i];
          const w = pull * (0.35 + 0.65 * (i / 3)) * dt;
          c.x += (attract.point.x - c.x) * w;
          c.z += (attract.point.z - c.z) * w;
          if (i === 3 && this.state === 'drift') {
            // the visible "answering" tug of the head filament
            c.y += (Math.min(attract.point.y, -0.04) - c.y) * w * 0.6;
          }
        }
      }
    }

    // --- state animation params
    if (this.state === 'capture') {
      this.captureT = Math.min(1, this.captureT + dt * 2.6);
    } else if (this.state === 'stalled') {
      this.stallTime += dt;
      if (this.stallTime > 4) {
        this.windT = Math.max(0, this.windT - dt * 0.8);
        this.captureT = Math.max(0, this.captureT - dt * 0.5);
        if (this.windT <= 0 && this.captureT <= 0) this.release();
      }
    } else if (this.state === 'absorb') {
      this.absorbT = Math.min(1, this.absorbT + dt / 1.4);
      if (this.absorbT >= 1) {
        this.state = 'gone';
        this.mesh.visible = false;
        return null;
      }
    }
    if (this.loosenT >= 0) {
      this.loosenT += dt * 1.8;
      if (this.loosenT >= 1) this.loosenT = -1;
    }

    // --- continuous clearing right below the point being wound
    if (this.state === 'wind' && this.windT > 0.05) {
      paint = { x: tip.x, z: tip.z, r: this.isMain ? 0.42 : 0.24, s: dt * 1.1 };
    }

    // --- build ribbon
    const wT = this.state === 'capture' ? 0 : this.windT;
    const capT = this.state === 'capture' ? this.captureT : this.state === 'wind' || this.state === 'stalled' ? 1 : 0;
    const viewDir = tmpV3.copy(camera.position);
    const speedWidth = lerp(0.6, 1.7, this.pitchStyle);

    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      this.curve.getPoint(u, tmpV);
      let pull = 0; // how strongly this sample is drawn to the tip (thins the ribbon)
      // stretch toward the horn tip (capture) — head end first
      if (capT > 0 && wT < 1) {
        const reach = smoothstep(1 - 0.45 * capT, 1, u) * capT;
        tmpV.lerp(tip, reach);
        pull = Math.max(pull, reach);
      }
      // wound part maps onto the groove helix
      if (wT > 0) {
        const wound = wT - (1 - u); // how much was wound after this sample attached
        if (wound >= 0) {
          this.hornLocalHelix(wound * this.len, hornMat, tmpV2);
          const blend = clamp(wound * 14, 0, 1); // snap onto the helix quickly
          tmpV.lerp(tmpV2, blend);
        } else if (wound > -0.22) {
          // transition zone racing toward the tip
          const f = 1 - -wound / 0.22;
          tmpV.lerp(tip, f * f * 0.9);
          pull = Math.max(pull, f);
        }
      }
      // sag when stalled
      if (this.state === 'stalled') {
        tmpV.y -= Math.min(this.stallTime, 2) * 0.02 * Math.sin(Math.PI * u);
      }

      // camera-facing ribbon side vector
      let tx: number, ty: number, tz: number;
      if (i < N - 1) {
        this.curve.getPoint(Math.min(1, u + 0.03), tmpV2);
        tx = tmpV2.x - tmpV.x;
        ty = tmpV2.y - tmpV.y;
        tz = tmpV2.z - tmpV.z;
      } else {
        tx = 0.01;
        ty = 0;
        tz = 0;
      }
      const vx = viewDir.x - tmpV.x;
      const vy = viewDir.y - tmpV.y;
      const vz = viewDir.z - tmpV.z;
      let sx = ty * vz - tz * vy;
      let sy = tz * vx - tx * vz;
      let sz = tx * vy - ty * vx;
      const sl = Math.hypot(sx, sy, sz) || 1;
      const wound = wT - (1 - u);
      const onHorn = wT > 0 && wound >= 0;
      let hw = (0.018 + 0.026 * Math.sin(Math.PI * u)) * this.thickness * this.appear;
      hw *= 1 - pull * 0.8; // drawn-out murk becomes a fine thread
      if (onHorn) hw = 0.007 * speedWidth * this.thickness;
      if (this.state === 'absorb') hw *= 1 - this.absorbT * 0.7;
      sx = (sx / sl) * hw;
      sy = (sy / sl) * hw;
      sz = (sz / sl) * hw;
      this.posAttr.setXYZ(i * 2, tmpV.x - sx, tmpV.y - sy, tmpV.z - sz);
      this.posAttr.setXYZ(i * 2 + 1, tmpV.x + sx, tmpV.y + sy, tmpV.z + sz);
    }
    this.posAttr.needsUpdate = true;

    const baseAlpha = this.isMain ? 0.88 : 0.72;
    this.mat.uniforms.uAlpha.value =
      baseAlpha * this.appear * (this.state === 'absorb' ? 1 - this.absorbT : 1);
    return paint;
  }
}

export interface MurkCtx {
  phase: string;
  tip: THREE.Vector3;
  tipInWater: boolean;
  pointerDown: boolean;
  circling: boolean;
  angSpeed: number; // rad/s
  dirSign: number;
  radiusWorld: number;
  camera: THREE.Camera;
}

export class MurkSystem {
  streaks: Streak[] = [];
  active: Streak | null = null; // streak being captured/wound
  onCleared: ((s: Streak) => void) | null = null;
  onFirstWindDone: (() => void) | null = null;
  onLoosen: (() => void) | null = null;
  private firstSequence = false;
  private firstSeqT = 0;
  private speedEMA = 0.5;
  private time = 0;
  private wispRespawnT = 20;
  private rng: Rng;

  constructor(
    private scene: THREE.Scene,
    private water: WaterSystem,
    private unicorn: Unicorn,
    rng: Rng
  ) {
    this.rng = rng;
    // Main streaks: the intro one sits well inside the unicorn's easy reach.
    const homes = [
      new THREE.Vector3(-0.08, -0.08, -0.62), // intro
      new THREE.Vector3(-0.55, -0.1, -0.25),
      new THREE.Vector3(0.5, -0.08, -0.35),
      new THREE.Vector3(-0.42, -0.13, 0.26),
      new THREE.Vector3(0.42, -0.11, 0.1),
      new THREE.Vector3(0.02, -0.15, 0.02),
    ];
    homes.forEach((h, i) => {
      const s = new Streak(i, rng, h, true);
      this.streaks.push(s);
      scene.add(s.mesh);
    });
    // Wisps for free play — hidden until the pond is cleared once.
    for (let i = 0; i < 5; i++) {
      const a = rng.range(Math.PI * 0.9, Math.PI * 2.1); // reachable half
      const r = rng.range(0.2, 0.85);
      const w = new Streak(
        6 + i,
        rng,
        new THREE.Vector3(Math.cos(a) * r, rng.range(-0.24, -0.1), Math.sin(a) * r),
        false
      );
      w.setInactive();
      this.streaks.push(w);
      scene.add(w.mesh);
    }
  }

  remainingMain(): number {
    return this.streaks.filter((s) => s.isMain && s.state !== 'gone' && s.state !== 'absorb').length;
  }
  remainingWisps(): number {
    return this.streaks.filter(
      (s) => !s.isMain && s.state !== 'gone' && s.state !== 'absorb' && s.state !== 'inactive'
    ).length;
  }
  intro(): Streak {
    return this.streaks[0];
  }

  nearestCapturable(p: THREE.Vector3, maxDist: number): Streak | null {
    let best: Streak | null = null;
    let bd = maxDist;
    const c = new THREE.Vector3();
    for (const s of this.streaks) {
      if (s.state !== 'drift') continue;
      s.centroid(c);
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  activateWisps() {
    for (const s of this.streaks) if (!s.isMain) s.activate();
  }

  // The scripted first discovery: quarter-turn already made by the child;
  // now the causal chain plays out in one unbroken view.
  beginFirstSequence() {
    const s = this.intro();
    if (s.state !== 'drift') return;
    this.firstSequence = true;
    this.firstSeqT = 0;
    s.startCapture(1, 0.45);
    this.active = s;
  }
  firstSequenceRunning(): boolean {
    return this.firstSequence;
  }

  update(dt: number, ctx: MurkCtx) {
    this.time += dt;
    const hornMat = this.unicorn.hornMatrixWorld();
    const tip = ctx.tip;

    // --- attraction context
    let attract: { point: THREE.Vector3; radius: number; strength: number } | null = null;
    if (ctx.tipInWater || (ctx.pointerDown && tip.y < 0.6)) {
      const radius = ctx.circling ? 0.4 + ctx.radiusWorld * 2.4 : 0.5;
      const strength = ctx.circling ? 3.0 : 0.5; // idle: just the tiny answering tug
      attract = { point: tip, radius, strength };
    }

    // --- speed memory shapes the spiral the child lays down
    if (ctx.circling) {
      this.speedEMA = damp(this.speedEMA, clamp(ctx.angSpeed / 9, 0, 1), 2.5, dt);
    }

    // --- capture management (after the first discovery)
    if (!this.firstSequence && (ctx.phase === 'play' || ctx.phase === 'freeplay')) {
      if (!this.active && ctx.circling && ctx.tipInWater && ctx.pointerDown) {
        const reach = 0.4 + ctx.radiusWorld * 2.4;
        const s = this.nearestCapturable(tip, reach);
        if (s) {
          s.startCapture(ctx.dirSign, this.speedEMA);
          this.active = s;
        }
      }
      const a = this.active;
      if (a) {
        if (a.state === 'capture' && a.captureT >= 1) {
          a.state = 'wind';
          a.stallTime = 0;
        }
        if (a.state === 'wind' || a.state === 'stalled') {
          if (!ctx.pointerDown) {
            a.state = 'stalled';
          } else if (ctx.circling) {
            if (a.state === 'stalled') {
              a.state = 'wind';
              a.stallTime = 0;
            }
            // reverse direction: the wound murk breathes loose, then re-grips
            if (ctx.dirSign !== 0 && ctx.dirSign !== a.chirality && a.windT > 0.08) {
              a.chirality = ctx.dirSign;
              a.loosenT = 0;
              a.windT = Math.max(0.05, a.windT - 0.12);
              if (this.onLoosen) this.onLoosen();
            }
            a.pitchStyle = damp(a.pitchStyle, this.speedEMA, 1.5, dt);
            const need = a.isMain ? 2.1 : 1.4; // full circles to wind one streak
            a.windT = Math.min(1, a.windT + (ctx.angSpeed * dt) / (Math.PI * 2 * need));
          }
          if (a.state === 'wind' && a.windT >= 1) {
            this.finishStreak(a, tip);
          }
        }
        if (a.state === 'drift' || a.state === 'gone') this.active = null;
      }
    }

    // --- scripted first sequence timing
    if (this.firstSequence && this.active) {
      this.firstSeqT += dt;
      const s = this.active;
      if (s.state === 'capture' && s.captureT >= 1) {
        s.state = 'wind';
      }
      if (s.state === 'wind') {
        // one clean wrap, ~0.9 s, regardless of finger hesitation
        s.windT = Math.min(1, s.windT + dt / 0.9);
        if (s.windT >= 1) {
          this.finishStreak(s, tip);
          this.firstSequence = false;
          if (this.onFirstWindDone) this.onFirstWindDone();
        }
      }
    }

    // --- glow follows the winding point; weak, inside the groove only
    const a = this.active;
    if (a && (a.state === 'wind' || a.state === 'capture')) {
      const span = GROOVE_SPAN * lerp(0.7, 1.35, a.pitchStyle);
      const gt = clamp(GROOVE_TOP - a.windT * a.len * span, 0.2, GROOVE_TOP);
      const amt = a.state === 'wind' ? clamp(0.25 + ctx.angSpeed * 0.08, 0.25, 0.85) : 0.15;
      this.unicorn.setHornGlow(gt, amt);
    } else {
      this.unicorn.setHornGlow(0.85, Math.max(0, this.unicorn.hornMat.uniforms.uGlowAmt.value - dt * 2));
    }

    // --- per-streak update + clarity painting
    for (const s of this.streaks) {
      const paint = s.update(dt, this.time, tip, hornMat, ctx.camera, attract);
      if (paint) this.water.clarity.paint(paint.x, paint.z, paint.r, paint.s);
    }

    // --- gentle wisp respawn during free play
    if (ctx.phase === 'freeplay' && this.remainingWisps() < 3) {
      this.wispRespawnT -= dt;
      if (this.wispRespawnT <= 0) {
        this.wispRespawnT = 18 + this.rng.next() * 10;
        const gone = this.streaks.find((s) => !s.isMain && s.state === 'gone');
        if (gone) {
          const ang = this.rng.range(Math.PI * 0.9, Math.PI * 2.1);
          const r = this.rng.range(0.2, 0.85);
          gone.home.set(Math.cos(ang) * r, this.rng.range(-0.22, -0.1), Math.sin(ang) * r);
          for (let i = 0; i < 4; i++) {
            gone.ctrl[i].set(
              gone.home.x + (i / 3 - 0.5) * gone.len,
              gone.home.y,
              gone.home.z + this.rng.range(-0.06, 0.06)
            );
          }
          gone.state = 'inactive';
          gone.activate();
          gone.absorbT = 0;
          gone.windT = 0;
          gone.captureT = 0;
        }
      }
    }
  }

  private finishStreak(s: Streak, tip: THREE.Vector3) {
    s.state = 'absorb';
    s.absorbT = 0;
    const c = s.centroid(new THREE.Vector3());
    // the water right below comes clear
    this.water.clarity.paint(tip.x, tip.z, s.isMain ? 0.58 : 0.3, 0.9);
    this.water.clarity.paint(c.x, c.z, s.isMain ? 0.52 : 0.28, 0.8);
    if (this.active === s) this.active = null;
    if (this.onCleared) this.onCleared(s);
  }

  releaseActive() {
    if (this.active && (this.active.state === 'capture' || this.active.state === 'wind')) {
      this.active.state = 'stalled';
      this.active.stallTime = 0;
    }
  }

  reset() {
    for (const s of this.streaks) {
      s.windT = 0;
      s.captureT = 0;
      s.absorbT = 0;
      s.loosenT = -1;
      if (s.isMain) {
        s.state = 'drift';
        s.mesh.visible = true;
        for (let i = 0; i < 4; i++) {
          s.ctrl[i].set(
            s.home.x + (i / 3 - 0.5) * s.len,
            s.home.y,
            s.home.z + this.rng.range(-0.08, 0.08)
          );
        }
      } else {
        s.setInactive();
      }
    }
    this.active = null;
    this.firstSequence = false;
  }
}
