// ---------------------------------------------------------------------------
// The working bed: a real 3D height field of soil ridges (uneri/une) with a
// brushable snow layer on top.
//
// Snow thickness lives in an RGBA data texture that both the snow and the soil
// materials read:
//     R = snow thickness   (0..1 of MAX_SNOW)
//     G = soil looseness   (raised where the player has scrubbed the earth)
//     B = disturbance      (scuff marks left by the hand)
//     A = unused
// Painting into R carves the snow away; the snow mesh displaces in the vertex
// shader and discards where nothing is left, so the soil below is revealed by
// genuine occlusion rather than a fade.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { clamp, clamp01, lerp, fbm, smoothstep } from './util.js';
import { snowGrainTexture, soilTexture, soilBumpTexture } from './textures.js';

// --- bed dimensions (metres) ------------------------------------------------
// Rows run along Z, straight away from the player, so the bed reads as a real
// field receding to the horizon - and so the carrots in a row line up down the
// long axis of a phone held in portrait.
export const BED_W = 2.2;      // across the rows (X)
export const BED_D = 3.0;      // along the rows (Z)
export const MAX_SNOW = 0.34;  // full snow thickness
export const TX = 132, TZ = 180;               // field texture resolution
const SEG_X = 112, SEG_Z = 152;                // snow mesh tessellation
const ORIGIN_X = -BED_W / 2, ORIGIN_Z = -BED_D / 2;
const CUT = 0.006;             // below this thickness the snow is gone
const RIM = 0.05;              // overlap tucked under the surrounding field

// Soil surface shape. The GLSL copy below MUST stay in sync with this.
export function soilHeight(x, z) {
  return (
    0.048 * Math.cos(x * 12.566) +
    0.014 * Math.sin(z * 1.9 + 0.7) +
    0.010 * Math.sin(z * 4.7 + x * 2.6 + 2.1) +
    0.006 * Math.sin(z * 9.7 - x * 6.3 + 0.4) +
    0.003 * Math.sin(z * 19.0 + x * 17.0)
  );
}
export const RIDGE_PERIOD = (2 * Math.PI) / 12.566;   // 0.50 m between rows

/**
 * Natural snow depth over the soil at a point, before anyone has touched it.
 * The worked bed and the surrounding field both use this, so the bed's snow
 * meets the field's snow at exactly the same height and the join disappears.
 * `fade` lets the far field drop the fine detail it can no longer resolve.
 */
export function snowDepthProfile(x, z, fade = 1) {
  const furrow = 0.5 - 0.5 * Math.cos(x * 12.566);
  const d = 0.50                                // ~17 cm on the ridge crests
    + fade * furrow * 0.17                      // drifts settle into the furrows
    + fade * fbm(x * 1.1, z * 1.1, 4) * 0.10
    + fade * fbm(x * 3.7, z * 3.7, 3) * 0.045;
  return MAX_SNOW * clamp01(d);
}
/** Centre line of the ridge nearest to x (carrots grow on the crests). */
export function nearestRidgeX(x) {
  return Math.round(x / RIDGE_PERIOD) * RIDGE_PERIOD;
}

// NOTE: must stay numerically identical to soilHeight() above.
const GLSL_SOIL = /* glsl */`
float soilH(vec2 p){
  return 0.048 * cos(p.x * 12.566)
       + 0.014 * sin(p.y * 1.9 + 0.7)
       + 0.010 * sin(p.y * 4.7 + p.x * 2.6 + 2.1)
       + 0.006 * sin(p.y * 9.7 - p.x * 6.3 + 0.4)
       + 0.003 * sin(p.y * 19.0 + p.x * 17.0);
}
`;

/**
 * The bed's meshes run a little past the hole cut for them and duck a couple
 * of millimetres under the field mesh. Just enough to lose the depth fight,
 * little enough that where the field's coarser edge leaves a sliver, what
 * shows through is the same snow at the same angle instead of a bright crack.
 */
function rimDrop(x, z) {
  const over = Math.max(
    Math.max(Math.abs(x) - BED_W / 2, 0),
    Math.max(Math.abs(z) - BED_D / 2, 0)
  );
  return over * 0.6;
}

export class Field {
  constructor(renderer) {
    this.data = new Uint8Array(TX * TZ * 4);
    this.snow = new Float32Array(TX * TZ);   // 0..1 thickness
    this.loose = new Float32Array(TX * TZ);
    this.scuff = new Float32Array(TX * TZ);
    this.dirty = true;
    this.removedSinceLast = 0;

    this.tex = new THREE.DataTexture(this.data, TX, TZ, THREE.RGBAFormat);
    this.tex.magFilter = THREE.LinearFilter;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.wrapS = this.tex.wrapT = THREE.ClampToEdgeWrapping;
    this.tex.needsUpdate = true;

    const aniso = renderer.capabilities.getMaxAnisotropy();
    this.grain = snowGrainTexture(512);
    this.grain.anisotropy = Math.min(8, aniso);
    this.soilMap = soilTexture(512);
    this.soilMap.anisotropy = Math.min(8, aniso);
    this.soilBump = soilBumpTexture(256);

    this.uniforms = {
      uField: { value: this.tex },
      uOrigin: { value: new THREE.Vector2(ORIGIN_X, ORIGIN_Z) },
      uSize: { value: new THREE.Vector2(BED_W, BED_D) },
      uMaxSnow: { value: MAX_SNOW },
      uGrain: { value: this.grain },
      uCut: { value: CUT },
      uTime: { value: 0 },
    };

    this.reset(true);
    this.group = new THREE.Group();
    this.buildSoil();
    this.buildSnow();
  }

  // --- data ---------------------------------------------------------------
  /** Snow profile of an untouched bed, written into `targetSnow`. */
  computeTarget(mounds = []) {
    if (!this.targetSnow) this.targetSnow = new Float32Array(TX * TZ);
    for (let j = 0; j < TZ; j++) {
      for (let i = 0; i < TX; i++) {
        const k = j * TX + i;
        const x = ORIGIN_X + (i + 0.5) / TX * BED_W;
        const z = ORIGIN_Z + (j + 0.5) / TZ * BED_D;
        let d = snowDepthProfile(x, z) / MAX_SNOW;
        for (const m of mounds) {
          const r = Math.hypot(x - m.x, z - m.z);
          // a carrot underneath lifts the snow into a barely-there dome...
          d += 0.045 * Math.exp(-(r * r) / (2 * 0.15 * 0.15));
          // ...and, from the plant's own radial silhouette, we make sure the
          // layer is deep enough that not one leaf tip gives the game away
          const b = Math.round(r / m.bin);
          if (b < m.prof.length) {
            const top = m.baseY + m.prof[b] + m.margin;   // world height to bury
            const need = (top - soilHeight(x, z)) / MAX_SNOW;
            if (need > d) d = need;
          }
        }
        this.targetSnow[k] = clamp01(d);
      }
    }
  }

  /** Fill the bed with fresh snow immediately. */
  reset(initial = false, mounds = []) {
    this.computeTarget(mounds);
    this.snow.set(this.targetSnow);
    this.loose.fill(0);
    this.scuff.fill(0);
    this.regrowing = false;
    this.dirty = true;
    this.sync();
  }

  /** Let a fresh snowfall bury the bed again over a few seconds. */
  startRegrow(mounds = []) {
    this.computeTarget(mounds);
    this.regrowing = true;
  }

  sync() {
    const d = this.data;
    for (let k = 0, p = 0; k < TX * TZ; k++, p += 4) {
      d[p] = this.snow[k] * 255;
      d[p + 1] = this.loose[k] * 255;
      d[p + 2] = this.scuff[k] * 255;
      d[p + 3] = 255;
    }
    this.tex.needsUpdate = true;
    this.dirty = false;
  }

  worldToTexel(x, z) {
    return [
      ((x - ORIGIN_X) / BED_W) * TX - 0.5,
      ((z - ORIGIN_Z) / BED_D) * TZ - 0.5,
    ];
  }

  /**
   * Sweep snow away around (x,z). Snow is not deleted, it is pushed to the
   * rim of the stroke, so ploughed ridges build up beside the cleared patch.
   * Returns the volume actually shifted (drives sound + particle amount).
   */
  brush(x, z, radius, strength) {
    const [cx, cz] = this.worldToTexel(x, z);
    const rx = (radius / BED_W) * TX, rz = (radius / BED_D) * TZ;
    const i0 = Math.max(0, Math.floor(cx - rx * 1.8));
    const i1 = Math.min(TX - 1, Math.ceil(cx + rx * 1.8));
    const j0 = Math.max(0, Math.floor(cz - rz * 1.8));
    const j1 = Math.min(TZ - 1, Math.ceil(cz + rz * 1.8));
    let moved = 0;
    const push = [];
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = (i - cx) / rx, dz = (j - cz) / rz;
        const r = Math.sqrt(dx * dx + dz * dz);
        const k = j * TX + i;
        if (r < 1) {
          const f = Math.pow(Math.cos(r * Math.PI * 0.5), 0.85);
          const take = Math.min(this.snow[k], strength * f);
          if (take > 0) {
            this.snow[k] -= take;
            moved += take;
          }
          this.scuff[k] = Math.min(1, this.scuff[k] + strength * f * 2.2);
        } else if (r < 1.75) {
          push.push(k);
        }
      }
    }
    if (moved > 0 && push.length) {
      const per = (moved * 0.30) / push.length;
      for (const k of push) this.snow[k] = Math.min(1.25, this.snow[k] + per);
    }
    if (moved > 0) {
      this.dirty = true;
      this.removedSinceLast += moved;
    }
    return moved;
  }

  /** Scrub the damp earth itself - darkens and loosens it. */
  scrub(x, z, radius, strength) {
    const [cx, cz] = this.worldToTexel(x, z);
    const rx = (radius / BED_W) * TX, rz = (radius / BED_D) * TZ;
    const i0 = Math.max(0, Math.floor(cx - rx)), i1 = Math.min(TX - 1, Math.ceil(cx + rx));
    const j0 = Math.max(0, Math.floor(cz - rz)), j1 = Math.min(TZ - 1, Math.ceil(cz + rz));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = (i - cx) / rx, dz = (j - cz) / rz;
        const r2 = dx * dx + dz * dz;
        if (r2 < 1) {
          const k = j * TX + i;
          const f = 1 - r2;
          this.loose[k] = Math.min(1, this.loose[k] + strength * f * 3);
        }
      }
    }
    this.dirty = true;
  }

  /** Average remaining snow thickness (metres) inside a disc. */
  snowAround(x, z, radius) {
    const [cx, cz] = this.worldToTexel(x, z);
    const rx = (radius / BED_W) * TX, rz = (radius / BED_D) * TZ;
    const i0 = Math.max(0, Math.floor(cx - rx)), i1 = Math.min(TX - 1, Math.ceil(cx + rx));
    const j0 = Math.max(0, Math.floor(cz - rz)), j1 = Math.min(TZ - 1, Math.ceil(cz + rz));
    let sum = 0, n = 0;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = (i - cx) / rx, dz = (j - cz) / rz;
        if (dx * dx + dz * dz < 1) { sum += this.snow[j * TX + i]; n++; }
      }
    }
    return n ? (sum / n) * MAX_SNOW : 0;
  }

  snowAt(x, z) {
    const [cx, cz] = this.worldToTexel(x, z);
    const i = clamp(Math.round(cx), 0, TX - 1);
    const j = clamp(Math.round(cz), 0, TZ - 1);
    return this.snow[j * TX + i] * MAX_SNOW;
  }

  /** World-space height of the snow surface (or bare soil where cleared). */
  surfaceY(x, z) {
    return soilHeight(x, z) + this.snowAt(x, z);
  }

  inside(x, z) {
    return x > ORIGIN_X && x < ORIGIN_X + BED_W && z > ORIGIN_Z && z < ORIGIN_Z + BED_D;
  }

  // --- meshes -------------------------------------------------------------
  buildSoil() {
    const g = new THREE.PlaneGeometry(BED_W + RIM * 2, BED_D + RIM * 2,
                                      (SEG_X >> 1) + 2, (SEG_Z >> 1) + 2);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, soilHeight(x, z) - rimDrop(x, z));
    }
    g.computeVertexNormals();

    const map = this.soilMap.clone();
    map.repeat.set(BED_W / 0.18, BED_D / 0.18);
    map.needsUpdate = true;
    const bump = this.soilBump.clone();
    bump.repeat.copy(map.repeat);
    bump.needsUpdate = true;

    const mat = new THREE.MeshStandardMaterial({
      map, bumpMap: bump, bumpScale: 0.85,
      roughness: 0.94, metalness: 0.0,
      color: 0xffffff,
    });
    // Without a distinct cache key three could hand this material's patched
    // program to another MeshStandardMaterial that happens to share the same
    // parameters (the soil cap does) but none of its uniforms.
    mat.customProgramCacheKey = () => 'bedsoil';
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;`)
        .replace('#include <fog_vertex>', `#include <fog_vertex>\n  vWPos = (modelMatrix * vec4(transformed,1.0)).xyz;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', /* glsl */`
          #include <common>
          varying vec3 vWPos;
          uniform sampler2D uField;
          uniform vec2 uOrigin;
          uniform vec2 uSize;
          uniform float uMaxSnow;
        `)
        .replace('#include <map_fragment>', /* glsl */`
          #include <map_fragment>
          vec2 fuv = (vWPos.xz - uOrigin) / uSize;
          vec4 fld = texture2D(uField, clamp(fuv, 0.002, 0.998));
          // a narrow contact shade where the snow wall still stands over the soil
          float occ = 0.0;
          occ += texture2D(uField, clamp(fuv + vec2( 0.006, 0.0), 0.002, 0.998)).r;
          occ += texture2D(uField, clamp(fuv + vec2(-0.006, 0.0), 0.002, 0.998)).r;
          occ += texture2D(uField, clamp(fuv + vec2( 0.0, 0.0045), 0.002, 0.998)).r;
          occ += texture2D(uField, clamp(fuv + vec2( 0.0,-0.0045), 0.002, 0.998)).r;
          occ = clamp(occ * 0.25, 0.0, 1.0);
          float shade = 1.0 - smoothstep(0.05, 0.75, occ) * 0.38;
          // freshly uncovered earth is damp: darker, cooler, glossier
          float wet = clamp(fld.b * 0.6 + fld.g * 0.8, 0.0, 1.0);
          vec3 damp = diffuseColor.rgb * vec3(0.70, 0.66, 0.66);
          diffuseColor.rgb = mix(diffuseColor.rgb, damp, wet * 0.75);
          diffuseColor.rgb *= shade;
          // a dusting of snow grains left behind in the hollows
          float dust = (1.0 - fld.b) * smoothstep(0.0, 0.10, fld.r);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82,0.85,0.90), dust * 0.30);
        `)
        .replace('#include <roughnessmap_fragment>', /* glsl */`
          #include <roughnessmap_fragment>
          roughnessFactor *= mix(1.0, 0.55, clamp(fld.b * 0.6 + fld.g * 0.8, 0.0, 1.0));
        `);
    };
    this.soilMat = mat;
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    mesh.name = 'soil';
    this.soilMesh = mesh;
    this.group.add(mesh);
    this.buildSkirt(map, bump);
  }

  /** Solid earth wall around the bed so no sliver of sky shows under the rim. */
  buildSkirt(map, bump) {
    const N = 40, BOT = -0.42;
    const X0 = ORIGIN_X - RIM, Z0 = ORIGIN_Z - RIM;
    const W = BED_W + RIM * 2, D = BED_D + RIM * 2;
    const pos = [], uv = [], idx = [];
    const edge = [];
    for (let i = 0; i <= N; i++) edge.push([X0 + (i / N) * W, Z0]);
    for (let i = 1; i <= N; i++) edge.push([X0 + W, Z0 + (i / N) * D]);
    for (let i = 1; i <= N; i++) edge.push([X0 + W - (i / N) * W, Z0 + D]);
    for (let i = 1; i <= N; i++) edge.push([X0, Z0 + D - (i / N) * D]);
    for (let i = 0; i < edge.length; i++) {
      const [x, z] = edge[i];
      const top = soilHeight(x, z) - rimDrop(x, z) + 0.02;
      pos.push(x, top, z, x, BOT, z);
      const u = i / N;
      uv.push(u, 1, u, 0);
    }
    for (let i = 0; i < edge.length - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      map, bumpMap: bump, bumpScale: 0.4, color: 0x8f8a82,
      roughness: 0.95, metalness: 0, side: THREE.DoubleSide,
    }));
    m.name = 'bedSkirt';
    this.group.add(m);
  }

  buildSnow() {
    const g = new THREE.PlaneGeometry(BED_W + RIM * 2, BED_D + RIM * 2, SEG_X + 6, SEG_Z + 6);
    g.rotateX(-Math.PI / 2);

    const grain = this.grain.clone();
    grain.repeat.set(BED_W / 0.42, BED_D / 0.42);
    grain.needsUpdate = true;

    const bump = this.grain.clone();
    bump.repeat.set(BED_W / 0.05, BED_D / 0.05);
    bump.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf5f8fd,
      roughness: 0.60,
      metalness: 0.0,
      bumpMap: bump,
      bumpScale: 0.32,
    });
    mat.customProgramCacheKey = () => 'snowfield';
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.uniforms);
      sh.uniforms.uGrainMap = { value: grain };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', /* glsl */`
          #include <common>
          uniform sampler2D uField;
          uniform vec2 uOrigin;
          uniform vec2 uSize;
          uniform float uMaxSnow;
          varying float vDepth;
          varying vec3 vWPos;
          varying float vScuff;
          varying vec3 vWN;
          ${GLSL_SOIL}
          float snowAt(vec2 p){
            vec2 uvv = clamp((p - uOrigin) / uSize, 0.002, 0.998);
            return texture2D(uField, uvv).r * uMaxSnow;
          }
          float surfH(vec2 p){ return soilH(p) + snowAt(p); }
        `)
        .replace('#include <beginnormal_vertex>', /* glsl */`
          vec2 wp2 = position.xz;
          float e = 0.022;
          float hL = surfH(wp2 - vec2(e,0.0));
          float hR = surfH(wp2 + vec2(e,0.0));
          float hD = surfH(wp2 - vec2(0.0,e));
          float hU = surfH(wp2 + vec2(0.0,e));
          vec3 objectNormal = normalize(vec3(hL - hR, 2.0 * e, hD - hU));
          vWN = objectNormal;
        `)
        .replace('#include <begin_vertex>', /* glsl */`
          vec2 fuv = clamp((wp2 - uOrigin) / uSize, 0.002, 0.998);
          vec4 fld = texture2D(uField, fuv);
          vDepth = fld.r * uMaxSnow;
          vScuff = fld.b;
          // outside the bed proper the surface tucks just under the field mesh
          float rim = max(max(abs(wp2.x) - uSize.x * 0.5, 0.0),
                          max(abs(wp2.y) - uSize.y * 0.5, 0.0));
          vec3 transformed = vec3(position.x, soilH(wp2) + vDepth - rim * 0.6, position.z);
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `);

      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', /* glsl */`
          #include <common>
          varying float vDepth;
          varying float vScuff;
          varying vec3 vWPos;
          varying vec3 vWN;
          uniform sampler2D uGrainMap;
          uniform float uCut;
        `)
        .replace('#include <map_fragment>', /* glsl */`
          #include <map_fragment>
          vec2 guv = vWPos.xz / 0.42;
          // the grain map is projected straight down, so fade it out on the
          // steep cut faces of the hollow where it would smear into streaks
          float flatness = smoothstep(0.35, 0.88, vWN.y);
          vec4 grn = texture2D(uGrainMap, guv);
          vec4 grn2 = texture2D(uGrainMap, guv * 4.7 + 0.31);
          // granular edge: the last few millimetres crumble away as specks
          float edgeN = grn2.r * 0.7 + grn.r * 0.3;
          if (vDepth < uCut + edgeN * 0.011) discard;
          float thin = smoothstep(0.10, 0.006, vDepth);
          // packed snow in the drifts, softer powder where untouched
          vec3 snowLit = vec3(0.98, 0.988, 1.0);
          vec3 snowShade = vec3(0.80, 0.855, 0.95);
          float tone = (grn.g * 0.22 + grn2.r * 0.16) * flatness + vScuff * 0.14;
          diffuseColor.rgb *= mix(snowLit, snowShade, clamp(tone, 0.0, 1.0));
          // same faint row banding the surrounding field carries, so the bed
          // is indistinguishable from the rest of the snow until it is dug
          float row = 0.5 + 0.5 * cos(vWPos.x * 12.566);
          diffuseColor.rgb *= mix(0.925, 1.0, row);
          // light bleeding through where the layer is thin: warms toward soil
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.66, 0.60, 0.55), thin * 0.55);
        `)
        .replace('#include <roughnessmap_fragment>', /* glsl */`
          #include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.34, clamp(vScuff, 0.0, 1.0) * 0.5);
        `)
        .replace('#include <emissivemap_fragment>', /* glsl */`
          #include <emissivemap_fragment>
          // ice crystals catching the low winter sun
          vec3 V = normalize(vViewPosition);
          float fres = pow(1.0 - clamp(dot(normalize(normal), V), 0.0, 1.0), 2.0);
          float spark = smoothstep(0.55, 0.95, texture2D(uGrainMap, guv * 8.3).b);
          spark *= smoothstep(0.62, 0.98, texture2D(uGrainMap, guv * 3.1 + 0.7).b + 0.25);
          spark *= flatness;
          totalEmissiveRadiance += vec3(1.0, 0.99, 0.95) * spark * (0.35 + fres * 1.5);
        `);
    };
    this.snowMat = mat;
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.name = 'snow';
    this.snowMesh = mesh;
    // Ray picking uses a flat proxy plane; the real surface is displaced on
    // the GPU so it cannot be raycast directly.
    this.group.add(mesh);
  }

  update(dt) {
    this.uniforms.uTime.value += dt;
    if (this.regrowing) {
      const k = 1 - Math.exp(-1.35 * dt);
      let far = 0;
      for (let i = 0; i < this.snow.length; i++) {
        const d = this.targetSnow[i] - this.snow[i];
        this.snow[i] += d * k;
        if (Math.abs(d) > far) far = Math.abs(d);
        this.loose[i] *= 1 - k;
        this.scuff[i] *= 1 - k;
      }
      this.dirty = true;
      if (far < 0.004) {
        this.snow.set(this.targetSnow);
        this.loose.fill(0);
        this.scuff.fill(0);
        this.regrowing = false;
      }
    }
    if (this.dirty) this.sync();
  }
}
