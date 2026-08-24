import * as THREE from 'three';
import { Rng, clamp, smoothstep } from '../util/rng';
import { rippleTexture } from '../util/textures';
import { POND_RADIUS } from './terrain';

// The pond is NOT a fluid sim:
// - surface: real geometry + analytic ripple normals in the shader
// - turbidity: low-frequency noise masked by a paintable "clarity" canvas
// - bottom: always present; only its obscuring fog changes
const MASK_WORLD = 3.6; // clarity canvas covers x,z in [-1.8, 1.8]

export class ClarityMask {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  private grid: Float32Array; // CPU mirror for queries
  private gridN = 48;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 256;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, 256, 256);
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.NoColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.grid = new Float32Array(this.gridN * this.gridN);
  }

  reset() {
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, 256, 256);
    this.grid.fill(0);
    this.texture.needsUpdate = true;
  }

  // Paint clear water spreading from a point. strength per call is small so
  // clearing reads as continuous, not a switch.
  paint(x: number, z: number, radius: number, strength: number) {
    const u = ((x + MASK_WORLD / 2) / MASK_WORLD) * 256;
    const v = ((z + MASK_WORLD / 2) / MASK_WORLD) * 256;
    const rPix = (radius / MASK_WORLD) * 256;
    const g = this.ctx.createRadialGradient(u, v, 0, u, v, rPix);
    const a = clamp(strength, 0, 1);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.6, `rgba(255,255,255,${a * 0.45})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    this.ctx.globalCompositeOperation = 'lighter';
    this.ctx.fillStyle = g;
    this.ctx.beginPath();
    this.ctx.arc(u, v, rPix, 0, Math.PI * 2);
    this.ctx.fill();
    this.texture.needsUpdate = true;
    // CPU mirror
    const n = this.gridN;
    for (let gy = 0; gy < n; gy++) {
      for (let gx = 0; gx < n; gx++) {
        const wx = (gx / (n - 1) - 0.5) * MASK_WORLD;
        const wz = (gy / (n - 1) - 0.5) * MASK_WORLD;
        const d = Math.hypot(wx - x, wz - z);
        if (d < radius) {
          const add = a * (1 - smoothstep(0, radius, d));
          const i = gy * n + gx;
          this.grid[i] = Math.min(1, this.grid[i] + add);
        }
      }
    }
  }

  at(x: number, z: number): number {
    const n = this.gridN;
    const gx = clamp(Math.round(((x + MASK_WORLD / 2) / MASK_WORLD) * (n - 1)), 0, n - 1);
    const gy = clamp(Math.round(((z + MASK_WORLD / 2) / MASK_WORLD) * (n - 1)), 0, n - 1);
    return this.grid[gy * n + gx];
  }

  averageInPond(): number {
    const n = this.gridN;
    let sum = 0;
    let cnt = 0;
    for (let gy = 0; gy < n; gy++) {
      for (let gx = 0; gx < n; gx++) {
        const wx = (gx / (n - 1) - 0.5) * MASK_WORLD;
        const wz = (gy / (n - 1) - 0.5) * MASK_WORLD;
        if (Math.hypot(wx, wz) < POND_RADIUS * 0.92) {
          sum += this.grid[gy * n + gx];
          cnt++;
        }
      }
    }
    return cnt ? sum / cnt : 0;
  }
}

// Shared uniforms injected into bottom / fish / weed materials so their
// visibility follows turbidity and depth.
export interface MurkFogUniforms {
  uClarity: { value: THREE.Texture };
  uMurkWater: { value: THREE.Color };
  uClearWater: { value: THREE.Color };
  uTurbBase: { value: number };
}

export function injectMurkFog(mat: THREE.Material, uni: MurkFogUniforms) {
  const m = mat as THREE.MeshStandardMaterial;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uni);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vMurkWorld;'
      )
      .replace(
        '#include <project_vertex>',
        `vec4 murkWp = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
murkWp = instanceMatrix * murkWp;
#endif
vMurkWorld = (modelMatrix * murkWp).xyz;
#include <project_vertex>`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vMurkWorld;
uniform sampler2D uClarity;
uniform vec3 uMurkWater;
uniform vec3 uClearWater;
uniform float uTurbBase;`
      )
      .replace(
        '#include <dithering_fragment>',
        `{
  vec2 cuv = (vMurkWorld.xz + vec2(${(MASK_WORLD / 2).toFixed(2)})) / ${MASK_WORLD.toFixed(2)};
  float clarity = texture2D(uClarity, cuv).r;
  float depthF = clamp(-vMurkWorld.y * 2.1, 0.0, 1.0);
  float hide = uTurbBase * (1.0 - clarity) * clamp(0.45 + depthF * 0.8, 0.0, 1.0);
  hide = clamp(hide, 0.0, 0.985);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uMurkWater, hide * step(0.005, depthF));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uClearWater, clarity * depthF * 0.3);
}
#include <dithering_fragment>`
      );
  };
  m.needsUpdate = true;
}

export class WaterSystem {
  group = new THREE.Group();
  clarity = new ClarityMask();
  fogUniforms: MurkFogUniforms;
  surface: THREE.Mesh;
  private surfMat: THREE.ShaderMaterial;
  private ripples: { mesh: THREE.Mesh; t: number; life: number }[] = [];
  private ripplePool: THREE.Mesh[] = [];
  private rippleTex = rippleTexture();
  private weeds: { mesh: THREE.Mesh; base: number; phase: number }[] = [];
  private time = 0;

  constructor(
    private scene: THREE.Scene,
    private rng: Rng,
    terrainHeight: (x: number, z: number) => number,
    e2e: boolean
  ) {
    this.fogUniforms = {
      uClarity: { value: this.clarity.texture },
      uMurkWater: { value: new THREE.Color(0x5c4a35) },
      uClearWater: { value: new THREE.Color(0x35544a) },
      uTurbBase: { value: 0.94 },
    };

    // ---- bottom ----------------------------------------------------------
    const bottomGeo = new THREE.CircleGeometry(POND_RADIUS + 0.12, 56, 0, Math.PI * 2);
    bottomGeo.rotateX(-Math.PI / 2);
    const bp = bottomGeo.attributes.position as THREE.BufferAttribute;
    const bcol = new Float32Array(bp.count * 3);
    const cSand = new THREE.Color(0x8a7a5e);
    const cSilt = new THREE.Color(0x6b5c44);
    const cStone = new THREE.Color(0x7d786e);
    const tc = new THREE.Color();
    for (let i = 0; i < bp.count; i++) {
      const x = bp.getX(i);
      const z = bp.getZ(i);
      bp.setY(i, Math.min(-0.035, terrainHeight(x, z) + 0.02));
      const n = rng.next();
      tc.copy(cSilt).lerp(n < 0.5 ? cSand : cStone, rng.next() * 0.6);
      bcol[i * 3] = tc.r;
      bcol[i * 3 + 1] = tc.g;
      bcol[i * 3 + 2] = tc.b;
    }
    bottomGeo.setAttribute('color', new THREE.BufferAttribute(bcol, 3));
    bottomGeo.computeVertexNormals();
    const bottomMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    injectMurkFog(bottomMat, this.fogUniforms);
    const bottom = new THREE.Mesh(bottomGeo, bottomMat);
    bottom.receiveShadow = true;
    this.group.add(bottom);

    // ---- reveal items: pebbles, waterweed, nuts, a sunken branch ---------
    const pebbleGeo = new THREE.SphereGeometry(1, 7, 5);
    const pebbleMat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.02 });
    injectMurkFog(pebbleMat, this.fogUniforms);
    const pebbleCount = e2e ? 40 : 90;
    const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, pebbleCount);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sv = new THREE.Vector3();
    const pcol = new THREE.Color();
    const palette = [0x8d8578, 0x9c8a6a, 0x6d675e, 0xa39274, 0x7b6a55, 0x94847e];
    for (let i = 0; i < pebbleCount; i++) {
      const a = rng.next() * Math.PI * 2;
      const r = Math.sqrt(rng.next()) * (POND_RADIUS - 0.15);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = Math.min(-0.04, terrainHeight(x, z) + 0.03);
      const size = rng.range(0.015, 0.055);
      q.setFromEuler(new THREE.Euler(rng.next(), rng.next() * 6, rng.next()));
      sv.set(size * rng.range(0.8, 1.6), size * 0.6, size * rng.range(0.8, 1.4));
      m4.compose(new THREE.Vector3(x, y, z), q, sv);
      pebbles.setMatrixAt(i, m4);
      pcol.setHex(palette[Math.floor(rng.next() * palette.length)]);
      pcol.multiplyScalar(rng.range(0.75, 1.1));
      pebbles.setColorAt(i, pcol);
    }
    pebbles.instanceMatrix.needsUpdate = true;
    if (pebbles.instanceColor) pebbles.instanceColor.needsUpdate = true;
    this.group.add(pebbles);

    // waterweed tufts
    const weedMat = new THREE.MeshStandardMaterial({
      color: 0x3f5c38,
      roughness: 0.6,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });
    injectMurkFog(weedMat, this.fogUniforms);
    const weedSpots = [
      { x: -0.5, z: -0.35 },
      { x: 0.42, z: 0.3 },
      { x: -0.15, z: 0.75 },
    ];
    for (const spot of weedSpots) {
      for (let b = 0; b < 5; b++) {
        const bx = spot.x + rng.range(-0.08, 0.08);
        const bz = spot.z + rng.range(-0.08, 0.08);
        const y0 = Math.min(-0.05, terrainHeight(bx, bz) + 0.03);
        const h = rng.range(0.12, 0.28);
        const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.02, h, 1, 4), weedMat);
        blade.geometry.translate(0, h / 2, 0);
        blade.position.set(bx, y0, bz);
        blade.rotation.y = rng.next() * Math.PI;
        const lean = rng.range(-0.25, 0.25);
        blade.rotation.z = lean;
        this.weeds.push({ mesh: blade, base: lean, phase: rng.next() * 6 });
        this.group.add(blade);
      }
    }

    // sunken beechnuts + one branch
    const nutMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.55 });
    injectMurkFog(nutMat, this.fogUniforms);
    for (let i = 0; i < 6; i++) {
      const nut = new THREE.Mesh(new THREE.SphereGeometry(rng.range(0.014, 0.022), 8, 6), nutMat);
      const a = rng.next() * 6.3;
      const r = rng.range(0.2, 1.0);
      const nx = Math.cos(a) * r;
      const nz = Math.sin(a) * r;
      nut.position.set(nx, Math.min(-0.04, terrainHeight(nx, nz) + 0.045), nz);
      nut.scale.y = 0.8;
      this.group.add(nut);
    }
    const branchMat = new THREE.MeshStandardMaterial({ color: 0x3d3227, roughness: 0.9 });
    injectMurkFog(branchMat, this.fogUniforms);
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.7, 6), branchMat);
    branch.position.set(0.35, -0.3, -0.5);
    branch.rotation.set(Math.PI / 2 - 0.2, 0.4, 0.3);
    this.group.add(branch);

    // ---- surface ---------------------------------------------------------
    const surfGeo = new THREE.CircleGeometry(POND_RADIUS + 0.06, 80);
    surfGeo.rotateX(-Math.PI / 2);
    this.surfMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uClarity: { value: this.clarity.texture },
        uMurkTint: { value: new THREE.Color(0x7d6448) },
        uDeepTint: { value: new THREE.Color(0x2c3e36) },
        uSkyCol: { value: new THREE.Color(0xc3d1cb) },
        uSunDir: { value: new THREE.Vector3(6.5, 4.2, 3.2).normalize() },
        uTip: { value: new THREE.Vector3(0, 10, 0) },
        uTipActive: { value: 0 },
        uRing: { value: new THREE.Vector4(0, 0, 10, 0) }, // x,z,t,amp
      },
      vertexShader: `
        varying vec3 vWorld;
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        varying vec3 vWorld;
        uniform float uTime;
        uniform sampler2D uClarity;
        uniform vec3 uMurkTint, uDeepTint, uSkyCol, uSunDir, uTip;
        uniform float uTipActive;
        uniform vec4 uRing;

        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p){
          vec2 i = floor(p); vec2 f = fract(p);
          vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
        }

        void main(){
          vec2 p = vWorld.xz;
          vec2 cuv = (p + vec2(${(MASK_WORLD / 2).toFixed(2)})) / ${MASK_WORLD.toFixed(2)};
          float clarity = texture2D(uClarity, cuv).r;
          float turbNoise = vnoise(p * 1.4 + uTime * 0.015) * 0.5 + vnoise(p * 3.4 - uTime * 0.02) * 0.5;
          float turb = clamp((0.62 + 0.55 * turbNoise) * (1.0 - clarity), 0.0, 1.0);

          // --- analytic ripple normal
          float a1 = sin(p.x * 9.0 + uTime * 0.9) * 0.5 + sin((p.x + p.y) * 6.5 - uTime * 0.7);
          float a2 = sin(p.y * 8.0 - uTime * 1.1) * 0.5 + sin((p.y - p.x) * 5.0 + uTime * 0.5);
          vec2 slope = vec2(a1, a2) * 0.012;

          // touch wake around horn tip
          float dTip = distance(p, uTip.xz);
          float wake = uTipActive * exp(-dTip * 9.0) * sin(dTip * 60.0 - uTime * 14.0) * 0.05;
          slope += normalize(p - uTip.xz + 1e-4) * wake;

          // one-shot guidance ring
          float dR = distance(p, uRing.xy);
          float ringR = uRing.z;
          float ring = uRing.w * exp(-abs(dR - ringR) * 26.0) * sin((dR - ringR) * 90.0);
          slope += normalize(p - uRing.xy + 1e-4) * ring * 0.08;

          vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));
          vec3 viewDir = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - clamp(dot(viewDir, n), 0.0, 1.0), 3.0);

          // water body colour: clear = dark green-blue transparency,
          // turbid = silty brown lit from above
          vec3 body = mix(uDeepTint, uMurkTint, turb);
          // faint drifting scum streaks only where turbid
          float scum = vnoise(p * vec2(9.0, 2.5) + vec2(uTime * 0.03, 0.0));
          body += vec3(0.05, 0.04, 0.02) * smoothstep(0.68, 0.9, scum) * turb;

          vec3 col = mix(body, uSkyCol, fres * 0.55 + 0.04);

          // sun glint
          vec3 h = normalize(viewDir + uSunDir);
          float spec = pow(clamp(dot(n, h), 0.0, 1.0), 140.0) * 0.9;
          col += vec3(1.0, 0.95, 0.85) * spec;

          float alpha = mix(0.16 + fres * 0.5, 0.58, turb);
          gl_FragColor = vec4(col, alpha);
        }`,
    });
    this.surface = new THREE.Mesh(surfGeo, this.surfMat);
    this.surface.position.y = 0.0;
    this.surface.renderOrder = 10;
    this.group.add(this.surface);

    scene.add(this.group);
  }

  addRipple(x: number, z: number) {
    const u = this.surfMat.uniforms.uRing.value as THREE.Vector4;
    u.set(x, z, 0.02, 1.0);
  }

  // small expanding decal ripple (touch feedback), pooled
  splash(x: number, z: number, scale = 1) {
    let mesh = this.ripplePool.pop();
    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: this.rippleTex,
          transparent: true,
          depthWrite: false,
          opacity: 0.5,
          color: 0xdde8e2,
        })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 11;
    }
    mesh.position.set(x, 0.012, z);
    mesh.scale.setScalar(0.05 * scale);
    (mesh.material as THREE.MeshBasicMaterial).opacity = 0.42;
    this.group.add(mesh);
    this.ripples.push({ mesh, t: 0, life: 0.9 });
  }

  setTip(pos: THREE.Vector3 | null, inWater: boolean) {
    const u = this.surfMat.uniforms;
    if (pos && inWater) {
      (u.uTip.value as THREE.Vector3).copy(pos);
      u.uTipActive.value = THREE.MathUtils.lerp(u.uTipActive.value, 1, 0.2);
    } else {
      u.uTipActive.value = THREE.MathUtils.lerp(u.uTipActive.value, 0, 0.12);
    }
  }

  update(dt: number) {
    this.time += dt;
    this.surfMat.uniforms.uTime.value = this.time;
    const ring = this.surfMat.uniforms.uRing.value as THREE.Vector4;
    if (ring.w > 0.001) {
      ring.z += dt * 0.55;
      ring.w *= Math.exp(-dt * 1.4);
      if (ring.z > 1.4) ring.w = 0;
    }
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.t += dt;
      const k = r.t / r.life;
      r.mesh.scale.setScalar(0.05 + k * 0.5);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.42 * (1 - k);
      if (k >= 1) {
        this.group.remove(r.mesh);
        this.ripples.splice(i, 1);
        this.ripplePool.push(r.mesh);
      }
    }
    for (const w of this.weeds) {
      w.mesh.rotation.z = w.base + Math.sin(this.time * 0.7 + w.phase) * 0.08;
    }
  }
}
