import * as THREE from 'three';
import { clamp, smoothstep, valueNoise2 } from '../core/util';
import type { TextureSet } from '../gfx/textures';
import {
  CELL,
  FLOOR_Y,
  NX,
  NZ,
  WORLD_D,
  WORLD_W,
  gridToWorldX,
  gridToWorldZ,
  worldToGridX,
  worldToGridZ,
  type Layout,
} from './layout';

const N = NX * NZ;

export class Terrain {
  readonly height = new Float32Array(N);
  readonly mud = new Float32Array(N);
  readonly wet = new Float32Array(N);
  readonly ao = new Float32Array(N).fill(1);
  /** Per-cell irregularity so wet fronts never look like clean circles. */
  private readonly edgeNoise = new Float32Array(N);

  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshStandardMaterial;
  private readonly geo: THREE.PlaneGeometry;
  private readonly pos: THREE.BufferAttribute;
  private readonly nrm: THREE.BufferAttribute;

  private readonly stateData = new Uint8Array(N * 4);
  readonly stateTex: THREE.DataTexture;

  private shapeDirty = true;
  private aoDirty = true;
  private aoTimer = 0;

  constructor(tex: TextureSet) {
    this.geo = new THREE.PlaneGeometry(WORLD_W, WORLD_D, NX - 1, NZ - 1);
    this.geo.rotateX(-Math.PI / 2);
    this.pos = this.geo.attributes.position as THREE.BufferAttribute;
    this.nrm = this.geo.attributes.normal as THREE.BufferAttribute;
    this.geo.setAttribute('uv1', this.geo.attributes.uv);

    // Unrepeated grid-space UV for the wetness / mud / AO state map.
    const st = new Float32Array(N * 2);
    for (let z = 0; z < NZ; z++) {
      for (let x = 0; x < NX; x++) {
        const i = z * NX + x;
        st[i * 2] = x / (NX - 1);
        st[i * 2 + 1] = z / (NZ - 1);
        this.edgeNoise[i] = valueNoise2(x * 0.42, z * 0.42, 4242);
      }
    }
    this.geo.setAttribute('aState', new THREE.BufferAttribute(st, 2));

    this.stateTex = new THREE.DataTexture(this.stateData, NX, NZ, THREE.RGBAFormat);
    this.stateTex.minFilter = THREE.LinearFilter;
    this.stateTex.magFilter = THREE.LinearFilter;
    this.stateTex.wrapS = this.stateTex.wrapT = THREE.ClampToEdgeWrapping;
    this.stateTex.needsUpdate = true;

    // One texture tile is roughly a hand's width of sand, in both axes.
    const tileM = 0.46;
    for (const t of [tex.sandColor, tex.sandNormal, tex.sandORM]) {
      t.repeat.set(WORLD_W / tileM, WORLD_D / tileM);
      t.needsUpdate = true;
    }

    this.material = new THREE.MeshStandardMaterial({
      map: tex.sandColor,
      normalMap: tex.sandNormal,
      normalScale: new THREE.Vector2(1.5, 1.5),
      roughnessMap: tex.sandORM,
      aoMap: tex.sandORM,
      aoMapIntensity: 0.7,
      envMapIntensity: 0.8,
      roughness: 1,
      metalness: 0,
      color: 0xffffff,
      dithering: true,
    });

    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uState = { value: this.stateTex };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aState;\nvarying vec2 vTerrUv;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n  vTerrUv = aState;');

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform sampler2D uState;\nvarying vec2 vTerrUv;\nfloat gWet; float gMud; float gOcc;',
        )
        .replace(
          '#include <map_fragment>',
          /* glsl */ `
          #include <map_fragment>
          vec4 stx = texture2D( uState, vTerrUv );
          gWet = stx.r; gMud = stx.g; gOcc = stx.b;
          // break up the tiling with a low-frequency second read of the sand
          vec3 macro = texture2D( map, vTerrUv * vec2(1.3, 2.6) ).rgb;
          diffuseColor.rgb *= 0.74 + 0.52 * dot( macro, vec3(0.3333) );
          vec3 dryC = diffuseColor.rgb;
          vec3 wetC = dryC * dryC * 1.18;
          vec3 mudC = mix( vec3(0.150,0.112,0.078), vec3(0.088,0.064,0.044), gWet );
          diffuseColor.rgb = mix( dryC, wetC, gWet * 0.94 );
          diffuseColor.rgb = mix( diffuseColor.rgb, mudC, gMud );
          `,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          /* glsl */ `
          #include <roughnessmap_fragment>
          float rWet = mix( roughnessFactor, 0.085, gWet );
          float rMud = mix( 0.66, 0.14, gWet );
          roughnessFactor = clamp( mix( rWet, rMud, gMud ), 0.05, 1.0 );
          `,
        )
        .replace(
          '#include <normal_fragment_maps>',
          /* glsl */ `
          #include <normal_fragment_maps>
          // a water film smooths the micro relief; mud smooths it further
          normal = normalize( mix( normal, nonPerturbedNormal, clamp( gWet * 0.55 + gMud * 0.32, 0.0, 0.92 ) ) );
          `,
        )
        .replace(
          '#include <aomap_fragment>',
          /* glsl */ `
          #include <aomap_fragment>
          float occ = mix( 1.0, gOcc, 0.85 );
          reflectedLight.indirectDiffuse *= occ;
          reflectedLight.indirectSpecular *= mix( 1.0, gOcc, 0.65 );
          `,
        );
    };
    this.material.customProgramCacheKey = () => 'terrain-sand-v1';

    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.receiveShadow = true;
    // banks and berms should shade their own downstream side
    this.mesh.castShadow = true;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.updateMatrix();
  }

  /* ------------------------------------------------------------- */

  load(layout: Layout) {
    this.height.set(layout.height);
    this.mud.fill(0);
    this.wet.fill(0);
    for (const s of layout.stones) this.stampStone(s.u, s.v, s.r);
    this.shapeDirty = true;
    this.aoDirty = true;
    this.refreshShape();
    this.recomputeAo();
    this.uploadState();
  }

  private stampStone(u: number, v: number, r: number) {
    const gx = u * (NX - 1);
    const gz = v * (NZ - 1);
    const rc = r / CELL;
    const x0 = Math.max(0, Math.floor(gx - rc * 1.4));
    const x1 = Math.min(NX - 1, Math.ceil(gx + rc * 1.4));
    const z0 = Math.max(0, Math.floor(gz - rc * 1.4));
    const z1 = Math.min(NZ - 1, Math.ceil(gz + rc * 1.4));
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - gx, z - gz) / rc;
        if (d >= 1.35) continue;
        const k = 1 - smoothstep(0.55, 1.3, d);
        this.height[z * NX + x] += k * r * 0.62;
      }
    }
  }

  /* ------------------------------------------------------------- */
  /* sampling                                                       */

  heightAtGrid(gx: number, gz: number) {
    const x = clamp(gx, 0, NX - 1.001);
    const z = clamp(gz, 0, NZ - 1.001);
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const fx = x - xi;
    const fz = z - zi;
    const i = zi * NX + xi;
    const a = this.height[i];
    const b = this.height[i + 1];
    const c = this.height[i + NX];
    const d = this.height[i + NX + 1];
    return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
  }

  heightAt(wx: number, wz: number) {
    return this.heightAtGrid(worldToGridX(wx), worldToGridZ(wz));
  }

  normalAt(wx: number, wz: number, out = new THREE.Vector3()) {
    const gx = worldToGridX(wx);
    const gz = worldToGridZ(wz);
    const hl = this.heightAtGrid(gx - 1, gz);
    const hr = this.heightAtGrid(gx + 1, gz);
    const hd = this.heightAtGrid(gx, gz - 1);
    const hu = this.heightAtGrid(gx, gz + 1);
    return out.set(hl - hr, 2 * CELL, hd - hu).normalize();
  }

  /* ------------------------------------------------------------- */
  /* brushes                                                        */

  /** Carve a wide shallow groove and push the spoil up into side berms. */
  dig(wx: number, wz: number, radiusWorld: number, strength: number) {
    const gx = worldToGridX(wx);
    const gz = worldToGridZ(wz);
    const rc = radiusWorld / CELL;
    const x0 = Math.max(0, Math.floor(gx - rc * 1.8));
    const x1 = Math.min(NX - 1, Math.ceil(gx + rc * 1.8));
    const z0 = Math.max(0, Math.floor(gz - rc * 1.8));
    const z1 = Math.min(NZ - 1, Math.ceil(gz + rc * 1.8));
    let moved = 0;
    let rimWeight = 0;
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const i = z * NX + x;
        const d = Math.hypot(x - gx, z - gz) / rc;
        if (d < 1) {
          const k = Math.pow(1 - d * d, 1.2);
          const cut = strength * k * (1 - this.mud[i] * 0.55);
          const before = this.height[i];
          this.height[i] = Math.max(FLOOR_Y, before - cut);
          moved += before - this.height[i];
          this.mud[i] *= 1 - k * 0.5;
        } else if (d < 1.75) {
          rimWeight += smoothstep(0.95, 1.18, d) * smoothstep(1.75, 1.2, d);
        }
      }
    }
    if (moved <= 0) return 0;
    // Part of the spoil piles up along the sides as a bank; the rest is
    // treated as carried away, which keeps repeated passes from exploding.
    if (rimWeight > 0) {
      const deposit = (moved * 0.4) / rimWeight;
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          const d = Math.hypot(x - gx, z - gz) / rc;
          if (d < 1 || d >= 1.75) continue;
          const k = smoothstep(0.95, 1.18, d) * smoothstep(1.75, 1.2, d);
          this.height[z * NX + x] += deposit * k;
        }
      }
    }
    this.shapeDirty = true;
    this.aoDirty = true;
    return moved;
  }

  /** Press a lump of mud down: it squashes, the rim bulges, it seals gaps. */
  pressMud(wx: number, wz: number, radiusWorld: number, amount: number) {
    const gx = worldToGridX(wx);
    const gz = worldToGridZ(wz);
    const rc = radiusWorld / CELL;
    const x0 = Math.max(0, Math.floor(gx - rc * 1.7));
    const x1 = Math.min(NX - 1, Math.ceil(gx + rc * 1.7));
    const z0 = Math.max(0, Math.floor(gz - rc * 1.7));
    const z1 = Math.min(NZ - 1, Math.ceil(gz + rc * 1.7));
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const i = z * NX + x;
        const d = Math.hypot(x - gx, z - gz) / rc;
        if (d >= 1.7) continue;
        // squashed dome: flat-ish centre, bulging rim
        const core = Math.pow(clamp(1 - d * d, 0, 1), 0.85);
        const bulge = smoothstep(1.5, 0.95, d) * smoothstep(0.62, 1.0, d);
        const add = amount * (core * 0.85 + bulge * 0.5);
        this.height[i] += add;
        this.mud[i] = clamp(this.mud[i] + (core * 0.9 + bulge * 0.35) * amount * 90, 0, 1);
        this.wet[i] = Math.max(this.wet[i], (core * 0.6 + bulge * 0.2) * 0.85);
      }
    }
    this.shapeDirty = true;
    this.aoDirty = true;
  }

  /** A landing drop darkens the sand exactly where it fell. */
  wetSpot(wx: number, wz: number, amount: number, radiusCells = 1.6) {
    const gx = worldToGridX(wx);
    const gz = worldToGridZ(wz);
    const x0 = Math.max(0, Math.floor(gx - radiusCells));
    const x1 = Math.min(NX - 1, Math.ceil(gx + radiusCells));
    const z0 = Math.max(0, Math.floor(gz - radiusCells));
    const z1 = Math.min(NZ - 1, Math.ceil(gz + radiusCells));
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - gx, z - gz) / radiusCells;
        if (d >= 1) continue;
        const i = z * NX + x;
        this.wet[i] = clamp(this.wet[i] + amount * (1 - d * d), 0, 1);
      }
    }
  }

  markShapeDirty() {
    this.shapeDirty = true;
    this.aoDirty = true;
  }

  /* ------------------------------------------------------------- */

  private refreshShape() {
    const p = this.pos.array as Float32Array;
    const n = this.nrm.array as Float32Array;
    const h = this.height;
    for (let i = 0; i < N; i++) p[i * 3 + 1] = h[i];
    const inv = 1 / (2 * CELL);
    for (let z = 0; z < NZ; z++) {
      const zm = z > 0 ? z - 1 : z;
      const zp = z < NZ - 1 ? z + 1 : z;
      for (let x = 0; x < NX; x++) {
        const i = z * NX + x;
        const xm = x > 0 ? x - 1 : x;
        const xp = x < NX - 1 ? x + 1 : x;
        const dx = (h[z * NX + xp] - h[z * NX + xm]) * inv * (x > 0 && x < NX - 1 ? 1 : 2);
        const dz = (h[zp * NX + x] - h[zm * NX + x]) * inv * (z > 0 && z < NZ - 1 ? 1 : 2);
        let nx = -dx;
        let ny = 1;
        let nz = -dz;
        const l = Math.hypot(nx, ny, nz);
        n[i * 3] = nx / l;
        n[i * 3 + 1] = ny / l;
        n[i * 3 + 2] = nz / l;
      }
    }
    this.pos.needsUpdate = true;
    this.nrm.needsUpdate = true;
    this.geo.computeBoundingSphere();
    this.shapeDirty = false;
  }

  /**
   * Horizon-angle occlusion over the height field. Sampling outward in four
   * directions means a narrow groove darkens strongly while a wide, shallow
   * basin stays open — which is how sand actually reads.
   */
  private recomputeAo() {
    const h = this.height;
    const dists = [2, 4, 7];
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (let z = 0; z < NZ; z++) {
      for (let x = 0; x < NX; x++) {
        const i = z * NX + x;
        const h0 = h[i];
        let occ = 0;
        for (let d = 0; d < 4; d++) {
          const dx = dirs[d][0];
          const dz = dirs[d][1];
          let maxSlope = 0;
          for (let s = 0; s < 3; s++) {
            const step = dists[s];
            const sx = x + dx * step;
            const sz = z + dz * step;
            if (sx < 0 || sx >= NX || sz < 0 || sz >= NZ) continue;
            const slope = (h[sz * NX + sx] - h0) / (step * CELL);
            if (slope > maxSlope) maxSlope = slope;
          }
          occ += clamp(maxSlope * 1.15, 0, 1);
        }
        this.ao[i] = clamp(1 - (occ / 4) * 0.55, 0.35, 1);
      }
    }
    this.aoDirty = false;
  }

  uploadState() {
    const d = this.stateData;
    for (let i = 0; i < N; i++) {
      // irregular wet boundary: perturb the threshold per cell
      const w = clamp(this.wet[i] * (0.78 + this.edgeNoise[i] * 0.5), 0, 1);
      d[i * 4] = w * 255;
      d[i * 4 + 1] = clamp(this.mud[i], 0, 1) * 255;
      d[i * 4 + 2] = this.ao[i] * 255;
      d[i * 4 + 3] = 255;
    }
    this.stateTex.needsUpdate = true;
  }

  update(dt: number) {
    if (this.shapeDirty) this.refreshShape();
    this.aoTimer -= dt;
    if (this.aoDirty && this.aoTimer <= 0) {
      this.recomputeAo();
      this.aoTimer = 0.12;
    }
    this.uploadState();
  }

  gridWorld(i: number, out: THREE.Vector3) {
    const x = i % NX;
    const z = (i / NX) | 0;
    return out.set(gridToWorldX(x), this.height[i], gridToWorldZ(z));
  }

  dispose() {
    this.geo.dispose();
    this.material.dispose();
    this.stateTex.dispose();
  }
}
