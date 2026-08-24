import * as THREE from 'three';
import { Horn } from './horn';

/** Soft radial sprite texture shared by glows and droplets. */
function glowTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}
const GLOW_TEX = glowTexture();

/** The dew drop: rides the spiral groove, stops where dirt still blocks it. */
export class DewDrop {
  readonly mesh: THREE.Mesh;
  t = 0.05;
  active = false;
  private speed = 0;

  constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.0065, 14, 12),
      new THREE.MeshPhysicalMaterial({
        color: 0xeaf3f5,
        transparent: true,
        opacity: 0.85,
        roughness: 0.02,
        envMapIntensity: 2.4,
      })
    );
    this.mesh.scale.set(1, 0.85, 1);
    this.mesh.visible = false;
  }

  start(at = 0.04) {
    this.t = at;
    this.active = true;
    this.speed = 0;
    this.mesh.visible = true;
  }

  hide() {
    this.active = false;
    this.mesh.visible = false;
  }

  /** Crawls toward the tip; halts just before the first blocking dirt. */
  update(dt: number, horn: Horn, blockT: number) {
    if (!this.active) return;
    const target = Math.max(0.02, blockT - 0.015);
    if (this.t < target) {
      this.speed = Math.min(0.09, this.speed + dt * 0.12);
      this.t = Math.min(target, this.t + this.speed * dt * 2.2);
    } else {
      this.t = Math.min(this.t, target);
      this.speed = 0;
      // trembles slightly against the blockage
      this.mesh.scale.x = 1 + Math.sin(performance.now() * 0.02) * 0.06;
    }
    const p = horn.groovePointWorld(this.t);
    const n = horn.grooveNormalWorld(this.t);
    this.mesh.position.copy(p).addScaledVector(n, 0.004);
  }
}

/** Rinse water: a fine stream plus a handful of droplets sliding the groove. */
export class RinseWater {
  readonly group = new THREE.Group();
  private stream: THREE.Mesh;
  private drops: { m: THREE.Mesh; t: number; life: number; falling: boolean; vel: THREE.Vector3 }[] = [];
  private dropPool: THREE.Mesh[] = [];
  flowing = false;

  constructor() {
    this.stream = new THREE.Mesh(
      new THREE.CylinderGeometry(0.003, 0.0045, 1, 6, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xd6ecf2,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      })
    );
    this.stream.visible = false;
    this.group.add(this.stream);
    const dropMat = new THREE.MeshPhysicalMaterial({
      color: 0xe8f3f5,
      transparent: true,
      opacity: 0.8,
      roughness: 0.03,
      envMapIntensity: 2.0,
    });
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 8), dropMat);
      m.visible = false;
      this.group.add(m);
      this.dropPool.push(m);
    }
  }

  /** Show stream from nozzle tip to surface point; seed droplets at t. */
  setStream(from: THREE.Vector3 | null, to: THREE.Vector3 | null, atT: number, horn: Horn, strong: number) {
    if (!from || !to) {
      this.stream.visible = false;
      this.flowing = false;
      return;
    }
    this.flowing = true;
    const mid = from.clone().lerp(to, 0.5);
    const len = from.distanceTo(to);
    this.stream.visible = len > 0.005;
    this.stream.position.copy(mid);
    this.stream.scale.set(1, len, 1);
    this.stream.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      to.clone().sub(from).normalize()
    );
    // spawn droplets around the contact point
    if (Math.random() < 0.5 * strong + 0.2) {
      const free = this.dropPool.find((d) => !d.visible);
      if (free) {
        free.visible = true;
        this.drops.push({
          m: free,
          t: atT + (Math.random() - 0.5) * 0.02,
          life: 1.4 + Math.random(),
          falling: false,
          vel: new THREE.Vector3(),
        });
      }
    }
    void horn;
  }

  update(dt: number, horn: Horn, blockT: number, trayPos: THREE.Vector3) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= dt;
      if (d.life <= 0) {
        d.m.visible = false;
        this.drops.splice(i, 1);
        continue;
      }
      if (!d.falling) {
        // slide down-groove toward the base (water runs off toward the tray)
        d.t -= dt * 0.13;
        if (d.t <= 0.03) {
          d.falling = true;
          d.vel.set((Math.random() - 0.5) * 0.05, -0.05, (Math.random() - 0.5) * 0.05);
          continue;
        }
        const p = horn.groovePointWorld(Math.max(0.02, Math.min(d.t, blockT - 0.005)));
        const n = horn.grooveNormalWorld(d.t);
        d.m.position.copy(p).addScaledVector(n, 0.003);
      } else {
        d.vel.y -= dt * 2.2;
        d.m.position.addScaledVector(d.vel, dt);
        if (d.m.position.y <= trayPos.y + 0.045) {
          d.m.visible = false;
          this.drops.splice(i, 1);
        }
      }
    }
  }
}

/** Bright sun patch steered by the little mirror during curing. */
export class SunSpot {
  readonly sprite: THREE.Sprite;
  intensity = 0;

  constructor() {
    this.sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: GLOW_TEX,
        color: 0xfff2cf,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.sprite.scale.setScalar(0.09);
  }

  setAt(pos: THREE.Vector3 | null, strength: number) {
    if (!pos) {
      this.intensity = Math.max(0, this.intensity - 0.05);
    } else {
      this.sprite.position.lerp(pos, 0.25);
      this.intensity = THREE.MathUtils.lerp(this.intensity, strength, 0.15);
    }
    const m = this.sprite.material as THREE.SpriteMaterial;
    m.opacity = this.intensity * 0.85;
    this.sprite.scale.setScalar(0.07 + 0.03 * Math.sin(performance.now() * 0.004) * this.intensity + 0.05 * this.intensity);
  }

  /** Instant off (phase change) — no lingering orb. */
  hide() {
    this.intensity = 0;
    (this.sprite.material as THREE.SpriteMaterial).opacity = 0;
  }
}

/** Soft gathering glow at the horn root during the intro. */
export class RootGlow {
  readonly sprite: THREE.Sprite;
  level = 0;

  constructor() {
    this.sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: GLOW_TEX,
        color: 0xffe9c0,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.sprite.scale.setScalar(0.16);
  }

  update(pos: THREE.Vector3, time: number) {
    this.sprite.position.copy(pos);
    const m = this.sprite.material as THREE.SpriteMaterial;
    m.opacity = this.level * (0.5 + 0.2 * Math.sin(time * 2.6));
    this.sprite.scale.setScalar(0.13 + 0.05 * Math.sin(time * 1.7) * this.level);
  }
}

/**
 * The travelling light front: a small warm glow riding at the current limit
 * of the inner light. This is the readable face of the causal front — the
 * dew drop's luminous twin — so a child can SEE how far the light got.
 */
export class FrontGlow {
  readonly sprite: THREE.Sprite;
  level = 0;
  /** larger during the intro so the stall point reads from the wide shot */
  boost = 1;

  constructor() {
    this.sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: GLOW_TEX,
        color: 0xffd98f,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.sprite.scale.setScalar(0.05);
  }

  update(horn: Horn, time: number) {
    const t = horn.lightFront;
    const show = this.level * (t < 0.985 ? 1 : Math.max(0, 1 - (t - 0.985) / 0.015));
    const p = horn.groovePointWorld(Math.max(0.03, t));
    this.sprite.position.copy(p);
    const m = this.sprite.material as THREE.SpriteMaterial;
    m.opacity = show * (0.7 + 0.3 * Math.sin(time * 5.2)) * Math.min(1, horn.lightPower);
    this.sprite.scale.setScalar((0.075 + 0.022 * Math.sin(time * 3.4)) * this.boost);
  }
}

/** The tip beam: horn tip → prism. A soft additive shaft of white light. */
export class Beam {
  readonly mesh: THREE.Mesh;
  strength = 0;

  constructor() {
    const geo = new THREE.CylinderGeometry(0.006, 0.0035, 1, 8, 1, true);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uStrength: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv2;
        varying vec3 vPos;
        void main(){
          vUv2 = uv;
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uStrength;
        uniform float uTime;
        varying vec2 vUv2;
        void main(){
          float core = 0.75 + 0.25 * sin(vUv2.y * 40.0 - uTime * 8.0);
          float fadeEnds = smoothstep(0.0, 0.06, vUv2.y) * smoothstep(1.0, 0.94, vUv2.y);
          vec3 col = vec3(1.0, 0.985, 0.95);
          gl_FragColor = vec4(col, uStrength * core * fadeEnds * 0.55);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
  }

  set(from: THREE.Vector3, to: THREE.Vector3, strength: number, time: number) {
    this.strength = strength;
    const mat = this.mesh.material as THREE.ShaderMaterial;
    mat.uniforms.uStrength.value = strength;
    mat.uniforms.uTime.value = time;
    this.mesh.visible = strength > 0.01;
    if (!this.mesh.visible) return;
    const mid = from.clone().lerp(to, 0.5);
    this.mesh.position.copy(mid);
    this.mesh.scale.set(1, from.distanceTo(to), 1);
    this.mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      to.clone().sub(from).normalize()
    );
  }
}

/**
 * The spectrum on the wall. White light enters the prism; only after the
 * prism do the colors separate. Drawn on a wall-plane in its local UV space,
 * so the band bends and stretches as the prism slides or the horn turns.
 */
export class Spectrum {
  readonly material: THREE.ShaderMaterial;

  constructor(wall: THREE.Mesh) {
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uCenter: { value: new THREE.Vector2(0.5, 0.45) }, // uv on wall plane
        uDir: { value: new THREE.Vector2(0.25, -1).normalize() },
        uWidth: { value: 0.06 },
        uLength: { value: 0.5 },
        uIntensity: { value: 0 },
        uCrisp: { value: 0.4 }, // polish quality: soft ↔ sharp band edges
        uCutoff: { value: 1.0 }, // 0..1: how far along its run the band survives (intro: cut short)
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv2;
        void main(){
          vUv2 = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec2 uCenter;
        uniform vec2 uDir;
        uniform float uWidth;
        uniform float uLength;
        uniform float uIntensity;
        uniform float uCrisp;
        uniform float uCutoff;
        uniform float uTime;
        varying vec2 vUv2;
        vec3 spectral(float x){
          // rainbow with distinct bands: red → orange → yellow → green → blue → violet
          vec3 c = vec3(0.0);
          c.r = (1.0 - smoothstep(0.28, 0.5, x)) + smoothstep(0.86, 1.0, x) * 0.45;
          c.g = smoothstep(0.12, 0.3, x) * (1.0 - smoothstep(0.55, 0.78, x));
          c.b = smoothstep(0.5, 0.7, x);
          return c;
        }
        void main(){
          vec2 p = vUv2 - uCenter;
          vec2 d = normalize(uDir);
          float along = dot(p, d);
          float across = dot(p, vec2(-d.y, d.x));
          if (along < 0.0 || along > uLength) discard;
          float a01 = along / uLength;
          // band widens as it travels
          float w = uWidth * (0.5 + a01 * 1.1);
          float x = across / w * 0.5 + 0.5;
          if (x < 0.0 || x > 1.0) discard;
          vec3 col = spectral(1.0 - x);
          float soft = mix(0.32, 0.06, uCrisp);
          float edge = smoothstep(0.0, soft, x) * smoothstep(1.0, 1.0 - soft, x);
          float travel = 1.0 - smoothstep(uCutoff - 0.12, uCutoff, a01);
          float shimmer = 0.9 + 0.1 * sin(a01 * 30.0 - uTime * 2.0);
          float fade = (0.85 - a01 * 0.35);
          gl_FragColor = vec4(col, uIntensity * edge * travel * fade * shimmer);
        }`,
    });
    wall.material = this.material;
  }

  set(
    centerUv: THREE.Vector2,
    dir: THREE.Vector2,
    width: number,
    intensity: number,
    crisp: number,
    cutoff: number,
    time: number
  ) {
    const u = this.material.uniforms;
    (u.uCenter.value as THREE.Vector2).lerp(centerUv, 0.2);
    (u.uDir.value as THREE.Vector2).lerp(dir, 0.15).normalize();
    u.uWidth.value = THREE.MathUtils.lerp(u.uWidth.value, width, 0.15);
    u.uIntensity.value = THREE.MathUtils.lerp(u.uIntensity.value, intensity, 0.1);
    u.uCrisp.value = THREE.MathUtils.lerp(u.uCrisp.value, crisp, 0.1);
    u.uCutoff.value = THREE.MathUtils.lerp(u.uCutoff.value, cutoff, 0.12);
    u.uTime.value = time;
  }
}

/** Resin bead forming at the syringe tip while squeezing. */
export class ResinBead {
  readonly mesh: THREE.Mesh;
  size = 0;

  constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.004, 10, 10),
      new THREE.MeshPhysicalMaterial({
        color: 0xdfe8ee,
        transparent: true,
        opacity: 0.8,
        roughness: 0.04,
        envMapIntensity: 2.0,
      })
    );
    this.mesh.visible = false;
  }

  set(pos: THREE.Vector3 | null, size: number) {
    this.size = size;
    this.mesh.visible = !!pos && size > 0.05;
    if (pos) {
      this.mesh.position.copy(pos);
      this.mesh.scale.setScalar(0.5 + size);
    }
  }
}
