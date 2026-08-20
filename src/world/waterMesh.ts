import * as THREE from 'three';
import { clamp } from '../core/util';
import type { TextureSet } from '../gfx/textures';
import type { Terrain } from './terrain';
import type { Water } from './water';
import { CELL, NX, NZ, WORLD_D, WORLD_W } from './layout';

const N = NX * NZ;
const VISIBLE = 0.00045;

/**
 * The water surface is a second height-field mesh. It is never painted blue:
 * colour comes from what is behind it (alpha), what is above it (environment
 * reflection) and how fast it is moving (roughness, foam).
 */
export class WaterMesh {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshPhysicalMaterial;
  private geo: THREE.BufferGeometry;
  private pos: THREE.BufferAttribute;
  private nrm: THREE.BufferAttribute;
  private aDepth: THREE.BufferAttribute;
  private aFlow: THREE.BufferAttribute;
  private index: THREE.BufferAttribute;
  private idxArr: Uint16Array;
  private shown = new Float32Array(N);
  private shownVx = new Float32Array(N);
  private shownVz = new Float32Array(N);
  private uTime = { value: 0 };
  private indexTimer = 0;

  constructor(tex: TextureSet, private terrain: Terrain, private water: Water) {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(N * 3);
    const n = new Float32Array(N * 3);
    const uv = new Float32Array(N * 2);
    for (let z = 0; z < NZ; z++) {
      for (let x = 0; x < NX; x++) {
        const i = z * NX + x;
        p[i * 3] = (x / (NX - 1) - 0.5) * WORLD_W;
        p[i * 3 + 1] = 0;
        p[i * 3 + 2] = (z / (NZ - 1) - 0.5) * WORLD_D;
        n[i * 3 + 1] = 1;
        uv[i * 2] = x / (NX - 1);
        uv[i * 2 + 1] = z / (NZ - 1);
      }
    }
    this.pos = new THREE.BufferAttribute(p, 3);
    this.nrm = new THREE.BufferAttribute(n, 3);
    this.aDepth = new THREE.BufferAttribute(new Float32Array(N), 1);
    this.aFlow = new THREE.BufferAttribute(new Float32Array(N * 2), 2);
    this.pos.setUsage(THREE.DynamicDrawUsage);
    this.nrm.setUsage(THREE.DynamicDrawUsage);
    this.aDepth.setUsage(THREE.DynamicDrawUsage);
    this.aFlow.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pos);
    g.setAttribute('normal', this.nrm);
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('aDepth', this.aDepth);
    g.setAttribute('aFlow', this.aFlow);

    this.idxArr = new Uint16Array((NX - 1) * (NZ - 1) * 6);
    this.index = new THREE.BufferAttribute(this.idxArr, 1);
    this.index.setUsage(THREE.DynamicDrawUsage);
    g.setIndex(this.index);
    g.setDrawRange(0, 0);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.hypot(WORLD_W, WORLD_D));
    this.geo = g;

    tex.waterNormal.repeat.set(1, 1);
    this.material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.06,
      metalness: 0,
      ior: 1.333,
      normalMap: tex.waterNormal,
      normalScale: new THREE.Vector2(1, 1),
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      envMapIntensity: 1.15,
      premultipliedAlpha: false,
    });

    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uTime;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute float aDepth;
attribute vec2 aFlow;
varying float vDepth;
varying vec2 vFlow;
varying vec2 vWUv;
varying vec3 vTanX;
varying vec3 vTanZ;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
  vDepth = aDepth;
  vFlow = aFlow;
  vWUv = position.xz;
  vTanX = normalize( ( modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0) ).xyz );
  vTanZ = normalize( ( modelViewMatrix * vec4(0.0, 0.0, 1.0, 0.0) ).xyz );`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uTime;
varying float vDepth;
varying vec2 vFlow;
varying vec2 vWUv;
varying vec3 vTanX;
varying vec3 vTanZ;
float wFoam;`,
        )
        .replace(
          '#include <map_fragment>',
          /* glsl */ `
          float dep = vDepth;
          float spd = length( vFlow );
          float deepK = clamp( dep * 7.5, 0.0, 1.0 );
          // silty shallows over sand, darker absorption only where it is deep
          vec3 shallow = vec3( 0.315, 0.278, 0.212 );
          vec3 deep    = vec3( 0.052, 0.070, 0.064 );
          diffuseColor.rgb = mix( shallow, deep, deepK );
          diffuseColor.a = smoothstep( 0.0004, 0.0055, dep ) * mix( 0.20, 0.92, deepK );
          wFoam = smoothstep( 0.32, 1.15, spd ) * smoothstep( 0.0006, 0.0035, dep );
          wFoam += smoothstep( 0.0045, 0.0012, dep ) * smoothstep( 0.12, 0.6, spd ) * 0.55;
          wFoam = clamp( wFoam, 0.0, 1.0 );
          diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.80, 0.815, 0.80 ), wFoam * 0.8 );
          diffuseColor.a = clamp( diffuseColor.a + wFoam * 0.45, 0.0, 1.0 );
          `,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          /* glsl */ `
          float roughnessFactor = clamp( mix( 0.028, 0.30, clamp( spd * 0.75, 0.0, 1.0 ) ) + wFoam * 0.45, 0.02, 1.0 );
          `,
        )
        .replace(
          '#include <normal_fragment_maps>',
          /* glsl */ `
          float sp = min( spd, 2.0 );
          vec2 dir = sp > 0.004 ? vFlow / max( sp, 0.004 ) : vec2( 0.0, 1.0 );
          vec2 uvA = vWUv * 1.35 - dir * uTime * ( 0.05 + sp * 0.30 );
          vec2 uvB = vWUv * 3.10 + vec2( 0.09, -0.05 ) * uTime - dir * uTime * ( 0.03 + sp * 0.18 );
          vec3 nA = texture2D( normalMap, uvA ).xyz * 2.0 - 1.0;
          vec3 nB = texture2D( normalMap, uvB ).xyz * 2.0 - 1.0;
          vec3 mapN = normalize( vec3( nA.xy + nB.xy, nA.z * nB.z ) );
          mapN.xy *= normalScale * ( 0.22 + sp * 1.05 );
          normal = normalize( vTanX * mapN.x + vTanZ * mapN.y + normal * mapN.z );
          `,
        );
    };
    this.material.customProgramCacheKey = () => 'water-surface-v1';

    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.renderOrder = 3;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.updateMatrix();
  }

  reset() {
    this.shown.fill(0);
    this.shownVx.fill(0);
    this.shownVz.fill(0);
  }

  update(dt: number, elapsed: number) {
    this.uTime.value = elapsed;
    const d = this.water.depth;
    const h = this.terrain.height;
    const p = this.pos.array as Float32Array;
    const nn = this.nrm.array as Float32Array;
    const ad = this.aDepth.array as Float32Array;
    const af = this.aFlow.array as Float32Array;
    const s = this.shown;
    const k = clamp(dt * 13, 0, 1);
    const kv = clamp(dt * 7, 0, 1);

    // temporal smoothing keeps the surface calm instead of shimmering
    for (let i = 0; i < N; i++) {
      s[i] += (d[i] - s[i]) * k;
      this.shownVx[i] += (this.water.velX[i] - this.shownVx[i]) * kv;
      this.shownVz[i] += (this.water.velZ[i] - this.shownVz[i]) * kv;
    }

    for (let i = 0; i < N; i++) {
      const dd = s[i];
      p[i * 3 + 1] = h[i] + Math.max(dd, 0) + 0.0012;
      ad[i] = dd;
      af[i * 2] = this.shownVx[i];
      af[i * 2 + 1] = this.shownVz[i];
    }

    const inv = 1 / (2 * CELL);
    for (let z = 0; z < NZ; z++) {
      const zm = z > 0 ? z - 1 : z;
      const zp = z < NZ - 1 ? z + 1 : z;
      for (let x = 0; x < NX; x++) {
        const i = z * NX + x;
        const xm = x > 0 ? x - 1 : x;
        const xp = x < NX - 1 ? x + 1 : x;
        const dx = (p[(z * NX + xp) * 3 + 1] - p[(z * NX + xm) * 3 + 1]) * inv;
        const dz = (p[(zp * NX + x) * 3 + 1] - p[(zm * NX + x) * 3 + 1]) * inv;
        const nx = -dx;
        const ny = 1;
        const nz = -dz;
        const l = Math.hypot(nx, ny, nz);
        nn[i * 3] = nx / l;
        nn[i * 3 + 1] = ny / l;
        nn[i * 3 + 2] = nz / l;
      }
    }

    this.pos.needsUpdate = true;
    this.nrm.needsUpdate = true;
    this.aDepth.needsUpdate = true;
    this.aFlow.needsUpdate = true;

    this.indexTimer -= dt;
    if (this.indexTimer <= 0) {
      this.rebuildIndex();
      this.indexTimer = 0.09;
    }
  }

  /** Only submit quads that actually hold water: no wasted overdraw. */
  private rebuildIndex() {
    const s = this.shown;
    const idx = this.idxArr;
    let c = 0;
    for (let z = 0; z < NZ - 1; z++) {
      const r0 = z * NX;
      const r1 = r0 + NX;
      for (let x = 0; x < NX - 1; x++) {
        const a = r0 + x;
        const b = a + 1;
        const cc = r1 + x;
        const dd = cc + 1;
        if (s[a] < VISIBLE && s[b] < VISIBLE && s[cc] < VISIBLE && s[dd] < VISIBLE) continue;
        idx[c++] = a;
        idx[c++] = cc;
        idx[c++] = b;
        idx[c++] = b;
        idx[c++] = cc;
        idx[c++] = dd;
      }
    }
    this.index.needsUpdate = true;
    this.geo.setDrawRange(0, c);
  }

  dispose() {
    this.geo.dispose();
    this.material.dispose();
  }
}
