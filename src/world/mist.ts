import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CustomBlending,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  Sphere,
  TorusGeometry,
  Vector3,
} from 'three';
import { Rng } from '../core/rng';
import type { Settings } from '../core/settings';
import { LAYOUT, mistDensityAt } from './layout';
import { mistPatch, softDot } from './textures';
import { mergeStatics } from './mergeStatics';
import { clamp } from '../core/math';

const pointVert = /* glsl */ `
attribute float aSize;
attribute float aLife;
attribute float aSeed;
uniform float uScale;
varying float vLife;
varying float vSeed;
varying vec3 vWorld;
void main() {
  vLife = aLife;
  vSeed = aSeed;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(0.35, -mv.z);
}
`;

const pointFrag = /* glsl */ `
precision mediump float;
uniform sampler2D uTex;
uniform vec3 uSunDir;
uniform vec3 uWarm;
uniform vec3 uCool;
uniform float uOpacity;
varying float vLife;
varying float vSeed;
varying vec3 vWorld;
void main() {
  vec4 t = texture2D(uTex, gl_PointCoord);
  if (t.a < 0.01) discard;
  vec3 viewDir = normalize(vWorld - cameraPosition);
  // Two bright geometries: looking into the sun through the veil, and looking
  // away from it, where the droplets throw the light straight back at the eye.
  float fwd  = max(0.0, dot(viewDir, uSunDir));
  float back = max(0.0, -dot(viewDir, uSunDir));
  float lit = clamp(pow(fwd, 1.6) * 0.75 + pow(back, 1.3) * 0.85, 0.0, 1.0);
  vec3 col = mix(uCool, uWarm, lit);
  float fade = smoothstep(0.0, 0.14, vLife) * smoothstep(1.0, 0.72, vLife);
  float a = t.a * fade * uOpacity * (0.7 + 0.3 * fract(vSeed * 7.3));
  gl_FragColor = vec4(col * a, a);
}
`;

interface Pool {
  pos: Float32Array;
  vel: Float32Array;
  life: Float32Array;
  size: Float32Array;
  seed: Float32Array;
  max: number;
  cursor: number;
  ttl: Float32Array;
  geo: BufferGeometry;
  points: Points;
}

function makePool(n: number, mat: ShaderMaterial, scene: Scene, order: number): Pool {
  const pos = new Float32Array(n * 3);
  const life = new Float32Array(n);
  const size = new Float32Array(n);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3 + 1] = -1000;
    life[i] = 1.001;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('aLife', new BufferAttribute(life, 1));
  geo.setAttribute('aSize', new BufferAttribute(size, 1));
  geo.setAttribute('aSeed', new BufferAttribute(seed, 1));
  geo.boundingSphere = new Sphere(new Vector3(0, 1.5, 1), 16);
  const points = new Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = order;
  scene.add(points);
  return {
    pos,
    vel: new Float32Array(n * 3),
    life,
    size,
    seed,
    ttl: new Float32Array(n),
    max: n,
    cursor: 0,
    geo,
    points,
  };
}

/**
 * The mist installation and the veil it puts into the air.
 *
 * The arch is a real piece of garden hardware — flanged posts, a bent header,
 * tee fittings, brass nozzles and a supply line back to a valve box — and it
 * stands well off the swing's plane. Only the thin tail of its plume, carried by
 * the breeze, ever reaches the seat.
 */
export class MistSystem {
  readonly group = new Group();

  private mistMat: ShaderMaterial;
  private dropMat: ShaderMaterial;
  private mist: Pool;
  private drops: Pool;
  private sheets: Mesh[] = [];
  private nozzles: Vector3[] = [];
  private rng: Rng;
  private settings: Settings;
  private emitAcc = 0;
  private dropAcc = 0;
  private wind = new Vector3();
  private active = true;

  constructor(scene: Scene, settings: Settings) {
    this.settings = settings;
    this.rng = new Rng(settings.seed ^ 0xa17c);
    scene.add(this.group);
    this.buildArch(settings);

    this.mistMat = new ShaderMaterial({
      uniforms: {
        uTex: { value: softDot(64, 0.22) },
        uSunDir: { value: new Vector3(-0.96, 0.15, 0.24).normalize() },
        uWarm: { value: new Color(1.0, 0.82, 0.62) },
        uCool: { value: new Color(0.60, 0.66, 0.78) },
        uOpacity: { value: 0.38 },
        uScale: { value: 260 },
      },
      vertexShader: pointVert,
      fragmentShader: pointFrag,
      transparent: true,
      depthWrite: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
    });

    this.dropMat = this.mistMat.clone();
    this.dropMat.uniforms.uTex.value = softDot(32, 0.55);
    this.dropMat.uniforms.uOpacity.value = 0.85;
    this.dropMat.uniforms.uScale.value = 210;
    this.dropMat.uniforms.uWarm.value = new Color(1.0, 0.92, 0.80);
    this.dropMat.uniforms.uCool.value = new Color(0.72, 0.80, 0.90);

    this.mist = makePool(settings.mistParticles, this.mistMat, scene, 6);
    this.drops = makePool(settings.dropletParticles, this.dropMat, scene, 7);

    this.buildSheets(settings);
  }

  private buildArch(settings: Settings): void {
    const L = LAYOUT;
    const steel = new MeshStandardMaterial({
      color: new Color(0.62, 0.64, 0.66),
      roughness: 0.42,
      metalness: 0.85,
    });
    const brass = new MeshStandardMaterial({
      color: new Color(0.72, 0.56, 0.28),
      roughness: 0.34,
      metalness: 0.95,
    });
    const plastic = new MeshStandardMaterial({
      color: new Color(0.24, 0.26, 0.25),
      roughness: 0.7,
      metalness: 0.05,
    });

    const g = new Group();
    const half = L.archSpan / 2;
    const postH = L.archHeight - half;

    for (const sx of [-1, 1]) {
      const post = new Mesh(new CylinderGeometry(0.042, 0.046, postH, 12), steel);
      post.position.set(sx * half, postH / 2, 0);
      post.castShadow = settings.shadows;
      g.add(post);

      // Flanged base with visible bolts, sat on a small concrete pad.
      const flange = new Mesh(new CylinderGeometry(0.09, 0.09, 0.018, 12), steel);
      flange.position.set(sx * half, 0.012, 0);
      g.add(flange);
      for (let b = 0; b < 4; b++) {
        const a = (b / 4) * Math.PI * 2 + 0.4;
        const bolt = new Mesh(new CylinderGeometry(0.008, 0.008, 0.022, 6), steel);
        bolt.position.set(sx * half + Math.cos(a) * 0.065, 0.028, Math.sin(a) * 0.065);
        g.add(bolt);
      }
      const pad = new Mesh(new CylinderGeometry(0.16, 0.18, 0.05, 12), plastic);
      pad.position.set(sx * half, 0.02, 0);
      pad.receiveShadow = settings.shadows;
      g.add(pad);

      // Union coupling where the bent header screws onto the post.
      const union = new Mesh(new CylinderGeometry(0.042, 0.042, 0.05, 12), brass);
      union.position.set(sx * half, postH, 0);
      g.add(union);

      // Diagonal stay so the arch is not floating unsupported.
      const stay = new Mesh(new CylinderGeometry(0.014, 0.014, 0.86, 8), steel);
      stay.position.set(sx * (half + 0.20), postH * 0.42, 0.20);
      stay.rotation.set(-0.30, 0, sx * 0.55);
      g.add(stay);
      const foot = new Mesh(new CylinderGeometry(0.05, 0.055, 0.03, 10), plastic);
      foot.position.set(sx * (half + 0.40), 0.015, 0.40);
      g.add(foot);
    }

    // Bent header pipe: a real 180 degree bend, not a decorative curve.
    const bend = new Mesh(new TorusGeometry(half, 0.042, 8, 30, Math.PI), steel);
    bend.position.set(0, postH, 0);
    bend.rotation.z = 0;
    bend.castShadow = settings.shadows;
    g.add(bend);

    // Tees and nozzles along the header, all pointing inward and down.
    const count = 9;
    for (let i = 0; i < count; i++) {
      const a = Math.PI * (0.08 + (i / (count - 1)) * 0.84);
      const px = Math.cos(a) * half;
      const py = postH + Math.sin(a) * half;
      const tee = new Mesh(new CylinderGeometry(0.034, 0.034, 0.062, 8), steel);
      tee.position.set(px, py, 0);
      tee.rotation.z = Math.PI / 2 - a;
      g.add(tee);

      const inward = new Vector3(-Math.cos(a), -Math.sin(a), 0).multiplyScalar(0.055);
      const noz = new Mesh(new CylinderGeometry(0.008, 0.015, 0.046, 8), brass);
      noz.position.set(px + inward.x, py + inward.y, 0);
      noz.rotation.z = Math.PI / 2 - a;
      g.add(noz);

      // Kept in the arch's own frame; converted to world once it is placed.
      this.nozzles.push(new Vector3(px + inward.x * 1.7, py + inward.y * 1.7, 0));
    }

    // Supply line along the ground to a small valve box.
    const supply = new Mesh(new CylinderGeometry(0.02, 0.02, 2.1, 8), plastic);
    supply.position.set(-half - 0.1, 0.03, 1.05);
    supply.rotation.x = Math.PI / 2;
    g.add(supply);
    const box = new Mesh(new CylinderGeometry(0.14, 0.14, 0.2, 10), plastic);
    box.position.set(-half - 0.1, 0.1, 2.1);
    box.castShadow = settings.shadows;
    g.add(box);
    const valve = new Mesh(new TorusGeometry(0.05, 0.009, 5, 12), brass);
    valve.position.set(-half - 0.1, 0.22, 2.1);
    valve.rotation.x = Math.PI / 2;
    g.add(valve);

    g.position.copy(L.archPos);
    g.rotation.y = -0.42;
    this.group.add(g);

    g.updateMatrix();
    for (const n of this.nozzles) n.applyMatrix4(g.matrix);
    mergeStatics(g);
  }

  /**
   * Low-lying haze layers. The bank sitting just behind the swing plane is what
   * the arcs are read against: raked by the low sun it stays luminous, so a
   * thread of dispersed colour has something bright to sit on instead of dirt.
   */
  private buildSheets(settings: Settings): void {
    const n = settings.tier === 'low' ? 5 : 8;
    for (let i = 0; i < n; i++) {
      const near = i < Math.ceil(n * 0.55);
      const mat = new MeshBasicMaterial({
        map: mistPatch(),
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        opacity: near ? 0.19 : 0.13,
        color: near ? new Color(1.0, 0.90, 0.78) : new Color(0.92, 0.88, 0.86),
        fog: true,
      });
      const m = new Mesh(new PlaneGeometry(near ? 7.5 : 15, near ? 1.7 : 3.0), mat);
      m.position.set(
        this.rng.range(-6, 6),
        near ? this.rng.range(0.42, 1.05) : this.rng.range(1.0, 2.2),
        near ? this.rng.range(-5.5, -2.6) : this.rng.range(-16, -8),
      );
      m.renderOrder = near ? 5 : 4;
      m.userData.near = near;
      this.sheets.push(m);
      this.group.add(m);
    }
  }

  setSun(dir: Vector3): void {
    this.mistMat.uniforms.uSunDir.value.copy(dir);
    this.dropMat.uniforms.uSunDir.value.copy(dir);
  }

  setWind(w: Vector3): void {
    this.wind.copy(w);
  }

  setActive(v: boolean): void {
    this.active = v;
  }

  setPixelScale(h: number): void {
    this.mistMat.uniforms.uScale.value = h * 0.30;
    this.dropMat.uniforms.uScale.value = h * 0.08;
  }

  private spawnMist(): void {
    const p = this.mist;
    const i = p.cursor;
    p.cursor = (p.cursor + 1) % p.max;
    const nz = this.nozzles[this.rng.int(0, this.nozzles.length - 1)];
    const jitter = 0.05;
    p.pos[i * 3] = nz.x + this.rng.spread(jitter);
    p.pos[i * 3 + 1] = nz.y + this.rng.spread(jitter);
    p.pos[i * 3 + 2] = nz.z + this.rng.spread(jitter);
    // Nozzles atomise downward and inward; the breeze takes over almost at once.
    const speed = this.rng.range(0.5, 1.1);
    p.vel[i * 3] = this.rng.spread(0.25) - 0.1;
    p.vel[i * 3 + 1] = -speed * 0.55;
    p.vel[i * 3 + 2] = this.rng.spread(0.25);
    p.life[i] = 0;
    p.ttl[i] = this.rng.range(9.0, 17.0);
    p.size[i] = this.rng.range(0.30, 0.95);
    p.seed[i] = this.rng.next();
  }

  private spawnDrop(): void {
    const p = this.drops;
    const i = p.cursor;
    p.cursor = (p.cursor + 1) % p.max;
    const nz = this.nozzles[this.rng.int(0, this.nozzles.length - 1)];
    p.pos[i * 3] = nz.x + this.rng.spread(0.10);
    p.pos[i * 3 + 1] = nz.y - this.rng.range(0, 0.25);
    p.pos[i * 3 + 2] = nz.z + this.rng.spread(0.10);
    p.vel[i * 3] = this.rng.spread(0.12);
    p.vel[i * 3 + 1] = -this.rng.range(0.4, 1.0);
    p.vel[i * 3 + 2] = this.rng.spread(0.12);
    p.life[i] = 0;
    p.ttl[i] = this.rng.range(0.8, 2.2);
    p.size[i] = this.rng.range(0.5, 1.4);
    p.seed[i] = this.rng.next();
  }

  /** The seat shoulders the veil aside as it goes through. */
  disturb(point: Vector3, dir: Vector3, speed: number): void {
    const p = this.mist;
    const r2 = 0.72 * 0.72;
    for (let i = 0; i < p.max; i++) {
      if (p.life[i] >= 1) continue;
      const dx = p.pos[i * 3] - point.x;
      const dy = p.pos[i * 3 + 1] - point.y;
      const dz = p.pos[i * 3 + 2] - point.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r2) continue;
      const k = (1 - d2 / r2) * Math.min(1, speed * 0.28);
      // Pushed along the seat's travel, and shoved outward from its path.
      p.vel[i * 3] += (dir.x * 1.7 + dx * 2.2) * k;
      p.vel[i * 3 + 1] += (dir.y * 1.7 + dy * 2.2) * k;
      p.vel[i * 3 + 2] += dz * 3.0 * k;
    }
  }

  update(dt: number, time: number, cameraPos: Vector3): void {
    if (!this.active) return;

    const rate = this.settings.tier === 'low' ? 40 : 74;
    this.emitAcc += dt * rate;
    while (this.emitAcc >= 1) {
      this.spawnMist();
      this.emitAcc -= 1;
    }
    this.dropAcc += dt * (this.settings.tier === 'low' ? 8 : 16);
    while (this.dropAcc >= 1) {
      this.spawnDrop();
      this.dropAcc -= 1;
    }

    this.step(this.mist, dt, time, 0.06, true);
    this.step(this.drops, dt, time, 1.0, false);

    for (let i = 0; i < this.sheets.length; i++) {
      const s = this.sheets[i];
      const near = s.userData.near as boolean;
      s.position.addScaledVector(this.wind, dt * (near ? 0.5 : 0.28));
      if (s.position.x < -8) s.position.x = 7;
      if (s.position.z < (near ? -6.5 : -18)) s.position.z = near ? -2.2 : -7;
      s.lookAt(cameraPos.x, s.position.y, cameraPos.z);
      const mat = s.material as MeshBasicMaterial;
      const base = near ? 0.17 : 0.11;
      mat.opacity = base + 0.055 * Math.sin(time * 0.21 + i * 1.7);
    }
  }

  private step(p: Pool, dt: number, time: number, gravity: number, drift: boolean): void {
    const w = this.wind;
    for (let i = 0; i < p.max; i++) {
      if (p.life[i] >= 1) continue;
      const o = i * 3;
      if (drift) {
        // Slow turbulent wander, then the breeze, then a little settling.
        const t = time * 0.6 + p.seed[i] * 31.4;
        p.vel[o] += (Math.sin(t * 1.7 + p.pos[o] * 0.8) * 0.10 + w.x * 0.9 - p.vel[o] * 0.55) * dt;
        p.vel[o + 1] += (Math.sin(t * 1.1 + p.pos[o + 1] * 1.3) * 0.06 + w.y * 0.9 - p.vel[o + 1] * 0.5 - gravity) * dt;
        p.vel[o + 2] += (Math.cos(t * 1.3 + p.pos[o + 2] * 0.9) * 0.10 + w.z * 0.9 - p.vel[o + 2] * 0.55) * dt;
      } else {
        p.vel[o + 1] -= 9.81 * dt * 0.35;
        p.vel[o] += (w.x * 0.4 - p.vel[o]) * dt * 1.2;
        p.vel[o + 2] += (w.z * 0.4 - p.vel[o + 2]) * dt * 1.2;
      }
      p.pos[o] += p.vel[o] * dt;
      p.pos[o + 1] += p.vel[o + 1] * dt;
      p.pos[o + 2] += p.vel[o + 2] * dt;

      if (p.pos[o + 1] < 0.02) {
        p.life[i] = 1.001;
        p.pos[o + 1] = -1000;
        continue;
      }
      p.life[i] += dt / p.ttl[i];
      if (p.life[i] >= 1) p.pos[o + 1] = -1000;
    }
    (p.geo.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (p.geo.getAttribute('aLife') as BufferAttribute).needsUpdate = true;
    (p.geo.getAttribute('aSize') as BufferAttribute).needsUpdate = true;
    (p.geo.getAttribute('aSeed') as BufferAttribute).needsUpdate = true;
  }

  /** Visible density used by the audio mix and the trail's opening test. */
  densityAt(x: number, y: number, z: number, t: number): number {
    return clamp(mistDensityAt(x, y, z, t), 0, 1);
  }
}

void AdditiveBlending;
