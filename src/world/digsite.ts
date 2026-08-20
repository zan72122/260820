import * as THREE from 'three';
import { clamp01, fbm, Rng, rrange, smoothstep } from '../core/util';
import { soilTextures } from '../gfx/textures';
import { addSoilDetail } from '../gfx/soilDetail';
import { terrainHeight } from './terrain';
import { DIG_REACH } from '../game/layout';

const PATCH_HALF = 0.95;
const DIP_DEPTH = 0.26;
const DIP_SPREAD = 0.26;
const GRID = 96;
const MASK_RES = 96;

/** Soil the player can actually move: one hill's worth, nothing more. */
export class DigSite {
  readonly group = new THREE.Group();
  readonly topsoil: THREE.Mesh;
  readonly subsoil: THREE.Mesh;
  readonly clods: THREE.Group = new THREE.Group();
  readonly centre: THREE.Vector3;

  private maskData: Uint8Array;
  private maskPixels: Uint8Array;
  private maskTex: THREE.DataTexture;
  private uniforms: {
    uMask: THREE.IUniform<THREE.Texture>;
    uLift: THREE.IUniform<number>;
    uCrack: THREE.IUniform<number>;
    uHeaveDir: THREE.IUniform<THREE.Vector2>;
  };
  private clodItems: Array<{
    mesh: THREE.Mesh;
    home: THREE.Vector3;
    offset: THREE.Vector3;
    spin: THREE.Vector3;
    state: 'intact' | 'cracked' | 'falling' | 'gone';
    vel: THREE.Vector3;
    r: number;
  }> = [];
  private clearedCache = 0;
  private dirty = false;

  constructor(centre: THREE.Vector3, readonly crackAngle: number, rng: Rng) {
    this.centre = centre.clone();
    this.group.position.copy(this.centre);

    this.maskData = new Uint8Array(MASK_RES * MASK_RES);
    // RGBA8 rather than R8: it is the one texture format every mobile GL
    // driver samples the same way, in both shader stages.
    this.maskPixels = new Uint8Array(MASK_RES * MASK_RES * 4);
    this.maskTex = new THREE.DataTexture(this.maskPixels, MASK_RES, MASK_RES, THREE.RGBAFormat);
    this.maskTex.minFilter = THREE.LinearFilter;
    this.maskTex.magFilter = THREE.LinearFilter;
    this.maskTex.wrapS = this.maskTex.wrapT = THREE.ClampToEdgeWrapping;
    this.maskTex.needsUpdate = true;

    this.uniforms = {
      uMask: { value: this.maskTex },
      uLift: { value: 0 },
      uCrack: { value: 0 },
      uHeaveDir: { value: new THREE.Vector2(Math.cos(crackAngle), Math.sin(crackAngle)) },
    };

    this.subsoil = this.buildSubsoil();
    this.topsoil = this.buildTopsoil();
    this.group.add(this.subsoil, this.topsoil, this.clods);
    this.buildClods(rng);
  }

  /** Height of the undisturbed hill surface, patch-local. */
  private topY(lx: number, lz: number) {
    const wx = this.centre.x + lx;
    const wz = this.centre.z + lz;
    const r = Math.hypot(lx, lz);
    // the crown of a live hill is pushed up by what is growing under it
    const mound = 0.075 * Math.exp(-(r * r) / 0.055) + 0.03 * Math.exp(-(r * r) / 0.11);
    return terrainHeight(wx, wz) - this.centre.y + mound + 0.004;
  }

  /** Height of the loose soil floor revealed once the topsoil is moved. */
  private bowlY(lx: number, lz: number) {
    const base = this.topY(lx, lz) - 0.004;
    return base - DIP_DEPTH * Math.exp(-(lx * lx + lz * lz) / DIP_SPREAD);
  }

  /** Distance from a patch-local point to the single fissure over the crown. */
  private crackDist(lx: number, lz: number) {
    const ca = Math.cos(this.crackAngle);
    const sa = Math.sin(this.crackAngle);
    const along = lx * ca + lz * sa;
    const across = -lx * sa + lz * ca;
    const wobble = (fbm(along * 3.2 + 4, 0.5, 3, 17) - 0.5) * 0.09;
    const ends = clamp01((Math.abs(along) - 0.42) * 3.2); // fades out away from the crown
    return Math.abs(across - wobble) + ends * 0.5;
  }

  private grid(yFn: (lx: number, lz: number) => number) {
    const n = GRID + 1;
    const pos = new Float32Array(n * n * 3);
    const uv = new Float32Array(n * n * 2);
    const col = new Float32Array(n * n * 3);
    const bowl = new Float32Array(n * n);
    const crack = new Float32Array(n * n);
    const c = new THREE.Color();
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const lx = (i / GRID - 0.5) * PATCH_HALF * 2;
        const lz = (j / GRID - 0.5) * PATCH_HALF * 2;
        pos[k * 3] = lx;
        pos[k * 3 + 1] = yFn(lx, lz);
        pos[k * 3 + 2] = lz;
        uv[k * 2] = i / GRID;
        uv[k * 2 + 1] = j / GRID;
        bowl[k] = this.bowlY(lx, lz);
        crack[k] = this.crackDist(lx, lz);
        const shade = 0.9 + fbm((this.centre.x + lx) * 0.4, (this.centre.z + lz) * 0.4, 3, 63) * 0.4;
        c.setRGB(shade, shade * 0.99, shade * 0.97);
        col[k * 3] = c.r;
        col[k * 3 + 1] = c.g;
        col[k * 3 + 2] = c.b;
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const a = j * n + i;
        const b = a + 1;
        const cc = a + n;
        const d = cc + 1;
        idx.push(a, cc, b, b, cc, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aBowlY', new THREE.BufferAttribute(bowl, 1));
    g.setAttribute('aCrack', new THREE.BufferAttribute(crack, 1));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  private soilMaterial(darken: number) {
    const tex = soilTextures();
    return new THREE.MeshStandardMaterial({
      map: tex.map,
      normalMap: tex.normalMap,
      roughnessMap: tex.roughnessMap,
      normalScale: new THREE.Vector2(1.2, 1.2),
      vertexColors: true,
      color: new THREE.Color(1 - darken, 1 - darken * 1.05, 1 - darken * 1.12),
      roughness: 1,
      metalness: 0,
    });
  }

  private buildSubsoil() {
    const g = this.grid((lx, lz) => this.bowlY(lx, lz));
    // The floor of a fresh hole is damp, dark and slightly glossy.
    const mat = this.soilMaterial(0.22);
    mat.roughness = 0.8;
    addSoilDetail(mat);
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    mesh.renderOrder = 0;
    return mesh;
  }

  private buildTopsoil() {
    const g = this.grid((lx, lz) => this.topY(lx, lz));
    const mat = this.soilMaterial(0.0);
    const u = this.uniforms;
    const worldOrigin = new THREE.Vector2(this.centre.x, this.centre.z);
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uMask = u.uMask;
      shader.uniforms.uLift = u.uLift;
      shader.uniforms.uCrack = u.uCrack;
      shader.uniforms.uHeaveDir = u.uHeaveDir;
      shader.uniforms.uWorldOrigin = { value: worldOrigin };
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           attribute float aBowlY;
           attribute float aCrack;
           uniform sampler2D uMask;
           uniform float uLift;
           uniform float uCrack;
           uniform vec2 uHeaveDir;
           uniform vec2 uWorldOrigin;
           varying float vMaskV;
           varying float vCrackV;
           varying vec2 vSoilUv;

           const float DIP_D = ${DIP_DEPTH.toFixed(3)};
           const float DIP_S = ${DIP_SPREAD.toFixed(3)};
           const float HALF = ${PATCH_HALF.toFixed(3)};

           float dipAt(vec2 p) { return DIP_D * exp(-dot(p, p) / DIP_S); }

           float heaveAt(vec2 p) {
             float side = 0.5 + 0.5 * dot(normalize(p + vec2(1e-4)), uHeaveDir);
             return uLift * exp(-dot(p, p) / 0.30) * (0.042 + 0.058 * side);
           }

           float crackAt(vec2 p) {
             float along = dot(p, uHeaveDir);
             float across = dot(p, vec2(-uHeaveDir.y, uHeaveDir.x));
             float ends = clamp((abs(along) - 0.42) * 3.2, 0.0, 1.0);
             return abs(across) + ends * 0.5;
           }

           /** Vertical offset of the worked surface from its undisturbed height. */
           vec2 maskUv(vec2 p) { return clamp(p / (2.0 * HALF) + 0.5, 0.0, 1.0); }

           float dispAt(vec2 p) {
             float m = texture2D(uMask, maskUv(p)).r;
             float sink = smoothstep(0.06, 0.94, m) * 0.82;
             float groove = uCrack * exp(-pow(crackAt(p) / 0.075, 2.0)) * 0.072;
             float rim = smoothstep(0.55, 0.18, m) * smoothstep(0.06, 0.30, m) * 0.018;
             return heaveAt(p) * (1.0 - sink) - sink * (dipAt(p) + 0.004) - groove + rim;
           }`,
        )
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
           {
             // shading has to follow the soil we just moved, or every hole
             // reads as a flat cut instead of a dug hollow
             float e = 0.028;
             vec2 p0 = position.xz;
             float gx = (dispAt(p0 + vec2(e, 0.0)) - dispAt(p0 - vec2(e, 0.0))) / (2.0 * e);
             float gz = (dispAt(p0 + vec2(0.0, e)) - dispAt(p0 - vec2(0.0, e))) / (2.0 * e);
             objectNormal = normalize(objectNormal + vec3(-gx, 0.0, -gz));
           }`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vMaskV = texture2D(uMask, maskUv(position.xz)).r;
           vCrackV = aCrack;
           transformed.y += dispAt(position.xz);
           vSoilUv = (transformed.xz + uWorldOrigin) * 1.15;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           varying float vMaskV;
           varying float vCrackV;
           varying vec2 vSoilUv;
           uniform float uCrack;`,
        )
        .replace(
          '#include <map_fragment>',
          `#ifdef USE_MAP
             vec4 sampledDiffuseColor = texture2D( map, vSoilUv );
             diffuseColor *= sampledDiffuseColor;
           #endif
           float dug = smoothstep(0.05, 0.55, vMaskV);
           // exposed soil is wet: darker, cooler, and clearly not the dry crown
           diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.42, 0.40, 0.44), dug);
           float seam = exp(-pow(vCrackV / (0.019 + 0.05 * uCrack), 2.0));
           diffuseColor.rgb *= 1.0 - 0.70 * seam * (0.5 + 0.5 * uCrack);`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `float roughnessFactor = roughness;
           #ifdef USE_ROUGHNESSMAP
             roughnessFactor *= texture2D( roughnessMap, vSoilUv ).g;
           #endif
           roughnessFactor = mix(roughnessFactor, 0.66, smoothstep(0.05, 0.6, vMaskV));`,
        )
        .replace('#include <normal_fragment_maps>', `
           #ifdef USE_NORMALMAP_TANGENTSPACE
             vec3 mapN2 = texture2D( normalMap, vSoilUv ).xyz * 2.0 - 1.0;
             mapN2.xy *= normalScale;
             normal = normalize( tbn * mapN2 );
           #endif
        `);
    };
    addSoilDetail(mat, 'vSoilUv');
    mat.customProgramCacheKey = () => 'digsite-topsoil';
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    return mesh;
  }

  private buildClods(rng: Rng) {
    const tex = soilTextures();
    const mat = new THREE.MeshStandardMaterial({
      map: tex.map,
      normalMap: tex.normalMap,
      roughnessMap: tex.roughnessMap,
      color: 0xcbbba1,
      roughness: 1,
      metalness: 0,
    });
    addSoilDetail(mat);
    const count = 15;
    for (let i = 0; i < count; i++) {
      const ang = rng() * Math.PI * 2;
      const rad = rrange(rng, 0.13, 0.46);
      const lx = Math.cos(ang) * rad;
      const lz = Math.sin(ang) * rad;
      const size = rrange(rng, 0.026, 0.055) * (1 - rad * 0.35);
      const g = new THREE.IcosahedronGeometry(size, 2);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let v = 0; v < p.count; v++) {
        const n = fbm(p.getX(v) * 44 + i * 3, p.getZ(v) * 44, 3, i * 7);
        const s = 0.72 + n * 0.6;
        p.setXYZ(v, p.getX(v) * s * 1.15, p.getY(v) * s * 0.72, p.getZ(v) * s);
      }
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, mat);
      const home = new THREE.Vector3(lx, this.topY(lx, lz) + size * 0.32, lz);
      mesh.position.copy(home);
      mesh.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.clods.add(mesh);
      this.clodItems.push({
        mesh,
        home,
        offset: new THREE.Vector3(),
        spin: new THREE.Vector3(rrange(rng, -2, 2), rrange(rng, -2, 2), rrange(rng, -2, 2)),
        state: 'intact',
        vel: new THREE.Vector3(),
        r: size,
      });
    }
  }

  setLift(v: number) {
    this.uniforms.uLift.value = v;
  }

  setCrack(v: number) {
    this.uniforms.uCrack.value = v;
    if (v > 0.25) {
      for (const it of this.clodItems) {
        if (it.state === 'intact' && it.home.length() < 0.5) {
          it.state = 'cracked';
          const dir = new THREE.Vector3(it.home.x, 0, it.home.z).normalize().multiplyScalar(0.02);
          it.offset.copy(dir);
        }
      }
    }
  }

  /** Brush soil away at a world point. Returns how much new ground was cleared. */
  paint(worldPoint: THREE.Vector3, radius = 0.13, amount = 0.55) {
    let lx = worldPoint.x - this.centre.x;
    let lz = worldPoint.z - this.centre.z;
    // never let the worked area run past the opening cut in the terrain
    const reach = Math.hypot(lx, lz);
    if (reach > DIG_REACH) {
      lx *= DIG_REACH / reach;
      lz *= DIG_REACH / reach;
    }
    const u = (lx / (PATCH_HALF * 2) + 0.5) * MASK_RES;
    const v = (lz / (PATCH_HALF * 2) + 0.5) * MASK_RES;
    const rad = (radius / (PATCH_HALF * 2)) * MASK_RES;
    const r2 = rad * rad;
    let added = 0;
    const i0 = Math.max(0, Math.floor(u - rad));
    const i1 = Math.min(MASK_RES - 1, Math.ceil(u + rad));
    const j0 = Math.max(0, Math.floor(v - rad));
    const j1 = Math.min(MASK_RES - 1, Math.ceil(v + rad));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const d2 = (i - u) * (i - u) + (j - v) * (j - v);
        if (d2 > r2) continue;
        const fall = 1 - smoothstep(Math.sqrt(d2 / r2));
        const k = j * MASK_RES + i;
        const prev = this.maskData[k];
        const next = Math.min(255, prev + amount * 255 * fall);
        if (next > prev) {
          this.maskData[k] = next;
          added += (next - prev) / 255;
        }
      }
    }
    if (added > 0) {
      this.dirty = true;
      this.clearedCache = -1;
      // knock loose any clod the hand passes over
      for (const it of this.clodItems) {
        if (it.state === 'gone' || it.state === 'falling') continue;
        if (Math.hypot(it.home.x - lx, it.home.z - lz) < radius * 1.5) {
          it.state = 'falling';
          it.vel.set((it.home.x - lx) * 1.6, 0.35, (it.home.z - lz) * 1.6);
        }
      }
    }
    return added;
  }

  /** 0..1 coverage over the crown area that matters for revealing the crop. */
  get cleared() {
    if (this.clearedCache >= 0) return this.clearedCache;
    let sum = 0;
    let n = 0;
    const c = MASK_RES / 2;
    const rad = MASK_RES * 0.17;
    for (let j = 0; j < MASK_RES; j++) {
      for (let i = 0; i < MASK_RES; i++) {
        if ((i - c) * (i - c) + (j - c) * (j - c) > rad * rad) continue;
        sum += this.maskData[j * MASK_RES + i] / 255;
        n++;
      }
    }
    this.clearedCache = n ? clamp01(sum / n) : 0;
    return this.clearedCache;
  }

  /** Has this exact spot been brushed? Used to decide if a tuber is exposed. */
  maskAt(worldPoint: THREE.Vector3) {
    const lx = worldPoint.x - this.centre.x;
    const lz = worldPoint.z - this.centre.z;
    const i = Math.round((lx / (PATCH_HALF * 2) + 0.5) * MASK_RES);
    const j = Math.round((lz / (PATCH_HALF * 2) + 0.5) * MASK_RES);
    if (i < 0 || j < 0 || i >= MASK_RES || j >= MASK_RES) return 0;
    return this.maskData[j * MASK_RES + i] / 255;
  }

  /** Test hook: clear the whole worked area at once. */
  fillAll() {
    for (let j = 0; j < MASK_RES; j++) {
      for (let i = 0; i < MASK_RES; i++) {
        const lx = ((i / MASK_RES) - 0.5) * PATCH_HALF * 2;
        const lz = ((j / MASK_RES) - 0.5) * PATCH_HALF * 2;
        if (Math.hypot(lx, lz) < DIG_REACH) this.maskData[j * MASK_RES + i] = 255;
      }
    }
    this.dirty = true;
    this.clearedCache = -1;
  }

  /** Clear a small disc without the player touching it (the crack reveal). */
  seedReveal(worldPoint: THREE.Vector3, radius = 0.05) {
    this.paint(worldPoint, radius, 1.0);
  }

  update(dt: number) {
    if (this.dirty) {
      const px = this.maskPixels;
      for (let i = 0; i < this.maskData.length; i++) {
        const v = this.maskData[i];
        px[i * 4] = v;
        px[i * 4 + 1] = v;
        px[i * 4 + 2] = v;
        px[i * 4 + 3] = 255;
      }
      this.maskTex.needsUpdate = true;
      this.dirty = false;
    }
    for (const it of this.clodItems) {
      if (it.state === 'falling') {
        it.vel.y -= 6.5 * dt;
        it.offset.addScaledVector(it.vel, dt);
        const floor = this.bowlY(it.home.x + it.offset.x, it.home.z + it.offset.z) + it.r * 0.4 - it.home.y;
        if (it.offset.y < floor) {
          it.offset.y = floor;
          it.vel.multiplyScalar(0.18);
          it.vel.y = Math.abs(it.vel.y) * 0.25;
          if (it.vel.length() < 0.06) it.state = 'gone';
        }
        it.mesh.position.copy(it.home).add(it.offset);
        it.mesh.rotation.x += it.spin.x * dt;
        it.mesh.rotation.z += it.spin.z * dt;
      } else if (it.state === 'cracked') {
        it.mesh.position.lerp(new THREE.Vector3().copy(it.home).add(it.offset), 1 - Math.exp(-6 * dt));
      }
    }
  }

  dispose() {
    this.maskTex.dispose();
  }
}

export { PATCH_HALF };
