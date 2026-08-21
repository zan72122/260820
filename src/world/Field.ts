import * as THREE from 'three';
import { crackMask, cutSoilAlbedo, makeRng, soilAlbedo, soilRough } from '../gfx/textures';
import { mergeParts } from '../gfx/merge';
import type { PlantAssets } from './Plant';
import type { Quality } from '../gfx/quality';

export const ROW_SPACING = 1.55;
export const RIDGE_LENGTH = 46;
export const RIDGE_HEIGHT = 0.3;
export const PLANT_SPACING = 0.42;
const SCENERY_SPACING = 0.3;

/**
 * One ridge: the soil body plus the crop standing on it. The soil body carries
 * the dig reveal — everything ahead of the blade is an intact crest, everything
 * behind it is an opened, damp furrow. That transition is the whole point of
 * the machine, so it is done in the shader and updated every frame.
 */
export class Ridge {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly z: number;
  private uniforms = {
    uDigX: { value: -999 },
    uCutMap: { value: cutSoilAlbedo() },
    uCrack: { value: crackMask() },
  };
  private standing: THREE.InstancedMesh[] = [];
  private standRef: { mesh: THREE.InstancedMesh; idx: number; x: number; hidden: boolean; m: THREE.Matrix4 }[] = [];
  private cropCleared = -Infinity;

  constructor(
    z: number,
    assets: PlantAssets,
    seed: number,
    opts: { crop: boolean; density: number; shadows?: boolean }
  ) {
    this.z = z;
    this.group.position.z = z;

    // a full bay of the field: furrow, ridge, furrow. Laid side by side the
    // ridges tile into one corrugated surface with no seams.
    const profile: [number, number][] = [
      [-0.775, -0.075],
      [-0.66, -0.07],
      [-0.5, 0.005],
      [-0.34, 0.13],
      [-0.19, 0.26],
      [-0.08, RIDGE_HEIGHT],
      [0.08, RIDGE_HEIGHT],
      [0.19, 0.26],
      [0.34, 0.13],
      [0.5, 0.005],
      [0.66, -0.07],
      [0.775, -0.075],
    ];
    const segs = 160;
    const geo = new THREE.BufferGeometry();
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const rng = makeRng(seed);
    const jitter: number[] = [];
    for (let i = 0; i <= segs; i++) jitter.push((rng() - 0.5) * 0.018);
    for (let i = 0; i <= segs; i++) {
      const x = -RIDGE_LENGTH * 0.25 + (i / segs) * RIDGE_LENGTH;
      for (let j = 0; j < profile.length; j++) {
        const [pz, py] = profile[j];
        pos.push(x, py + (py > 0.02 ? jitter[i] : 0), pz);
        uv.push(x * 1.7, (pz + 0.78) * 1.9);
      }
    }
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < profile.length - 1; j++) {
        const a = i * profile.length + j;
        const b = a + profile.length;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const albedo = soilAlbedo().clone();
    albedo.repeat.set(1, 1);
    albedo.needsUpdate = true;
    const rough = soilRough().clone();
    rough.repeat.set(1, 1);
    rough.needsUpdate = true;

    const mat = new THREE.MeshStandardMaterial({
      map: albedo,
      roughnessMap: rough,
      roughness: 1,
      metalness: 0,
      color: 0xb59a72,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uDigX = this.uniforms.uDigX;
      shader.uniforms.uCutMap = this.uniforms.uCutMap;
      shader.uniforms.uCrack = this.uniforms.uCrack;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uDigX;
           varying float vDug; varying float vAhead; varying vec3 vLocalPos;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vLocalPos = position;
           float dug = smoothstep(uDigX + 0.22, uDigX - 0.30, position.x);
           vDug = dug;
           // just ahead of the share the crust heaves before it splits
           float ahead = exp(-pow((position.x - uDigX - 0.26) / 0.22, 2.0)) * step(uDigX, position.x);
           vAhead = ahead;
           float crest = smoothstep(0.0, ${RIDGE_HEIGHT.toFixed(3)}, position.y);
           transformed.y += ahead * 0.035 * crest;
           // behind the share the crest is gone: an opened, loosened furrow
           transformed.y -= dug * (position.y * 0.86 + 0.055) * crest;
           transformed.y -= dug * 0.03 * (1.0 - crest);
           transformed.z *= 1.0 + dug * 0.06 * crest;
           // the mesh only has a vertex every 200 mm, so the loosened furrow
           // is shaped at frequencies it can actually carry
           float lump = sin(position.x * 3.1 + position.z * 2.2) * 0.5
                      + sin(position.x * 7.3 - position.z * 4.1) * 0.32
                      + sin(position.x * 1.9 + position.z * 6.0) * 0.24;
           transformed.y += dug * lump * 0.055;`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform sampler2D uCutMap; uniform sampler2D uCrack;
           varying float vDug; varying float vAhead; varying vec3 vLocalPos;`
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
           vec3 cut = texture2D(uCutMap, vLocalPos.xz * vec2(2.1, 3.0)).rgb;
           diffuseColor.rgb = mix(diffuseColor.rgb, cut, vDug * 0.72);
           float cr = texture2D(uCrack, vLocalPos.xz * vec2(0.8, 1.3)).r;
           diffuseColor.rgb *= 1.0 - cr * vAhead * 0.75;`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
           roughnessFactor = mix(roughnessFactor, 0.72, vDug * 0.8);`
        );
    };
    mat.customProgramCacheKey = () => 'ridge';

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);

    if (opts.crop) this.buildCrop(assets, seed, opts.density, opts.shadows !== false);
  }

  private buildCrop(assets: PlantAssets, seed: number, density: number, shadows: boolean) {
    const rng = makeRng(seed + 7);
    const count = Math.floor((RIDGE_LENGTH / SCENERY_SPACING) * density);
    const per = Math.ceil(count / 3) + 1;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (let v = 0; v < 3; v++) {
      const inst = new THREE.InstancedMesh(assets.foliageLod[v], assets.foliageMat, per);
      inst.castShadow = shadows;
      inst.receiveShadow = false;
      inst.count = 0;
      inst.frustumCulled = false;
      this.group.add(inst);
      this.standing.push(inst);
    }
    for (let i = 0; i < count; i++) {
      const x = -RIDGE_LENGTH * 0.25 + (i / count) * RIDGE_LENGTH + (rng() - 0.5) * 0.08;
      p.set(x, RIDGE_HEIGHT - 0.02, (rng() - 0.5) * 0.16);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2);
      const k = 0.88 + rng() * 0.3;
      s.set(k, k * (0.9 + rng() * 0.25), k);
      const mesh = this.standing[i % 3];
      const idx = mesh.count;
      mesh.count = idx + 1;
      mesh.setMatrixAt(idx, m.compose(p, q, s));
      this.standRef.push({ mesh, idx, x, hidden: false, m: m.clone() });
    }
    for (const inst of this.standing) inst.instanceMatrix.needsUpdate = true;
  }

  /** Move the dig front. The scenery crop behind it goes with it. */
  setDig(x: number) {
    this.uniforms.uDigX.value = x;
    // the shader follows every frame; the instance sweep only needs to run
    // when the front has actually moved a plant's width
    if (x <= this.cropCleared + 0.15) return;
    this.cropCleared = x;
    this.hideRange(-Infinity, x);
  }

  /** Start this ridge again from a given point (rounds past the last row). */
  resetDig(x: number) {
    this.uniforms.uDigX.value = x;
    this.cropCleared = x;
  }

  /** Put the scenery crop back, so a ridge can be worked a second time. */
  restoreCrop() {
    if (!this.standRef.length) return;
    const touched = new Set<THREE.InstancedMesh>();
    for (const r of this.standRef) {
      if (!r.hidden) continue;
      r.mesh.setMatrixAt(r.idx, r.m);
      r.hidden = false;
      touched.add(r.mesh);
    }
    for (const t of touched) t.instanceMatrix.needsUpdate = true;
  }

  /** Remove scenery plants in a range, e.g. where hero plants take over. */
  hideRange(x0: number, x1: number) {
    if (!this.standRef.length) return;
    const m = new THREE.Matrix4();
    const zero = new THREE.Vector3(0, 0, 0);
    const touched = new Set<THREE.InstancedMesh>();
    for (const r of this.standRef) {
      if (r.hidden || r.x < x0 || r.x > x1) continue;
      r.mesh.getMatrixAt(r.idx, m);
      r.mesh.setMatrixAt(r.idx, m.scale(zero));
      r.hidden = true;
      touched.add(r.mesh);
    }
    for (const t of touched) t.instanceMatrix.needsUpdate = true;
  }

  get digX() {
    return this.uniforms.uDigX.value;
  }
}

/**
 * The whole set piece: a handful of ridges with crop, a couple of ridges that
 * were harvested before the player arrived, and distant scenery handled by
 * Environment.
 */
export class Field {
  readonly group = new THREE.Group();
  readonly ridges: Ridge[] = [];

  constructor(assets: PlantAssets, quality: Quality) {
    // rows still to be worked: z = 0, -1.55, -3.10 ...
    for (let i = 0; i < 6; i++) {
      const density = i === 0 ? 1 : quality.farDensity * (i < 2 ? 1 : 0.6);
      const r = new Ridge(-i * ROW_SPACING, assets, 100 + i * 13, {
        crop: true,
        density: Math.max(0.3, density),
        // only the rows being worked are worth a shadow pass
        shadows: i < 2,
      });
      this.ridges.push(r);
      this.group.add(r.group);
    }
    // rows already inverted, on the near side. Their opened furrows and turned
    // rows explain the machine's job before a single word is spoken.
    for (let i = 1; i <= 4; i++) {
      const r = new Ridge(i * ROW_SPACING, assets, 400 + i * 29, { crop: false, density: 0 });
      r.setDig(9999);
      this.group.add(r.group);
    }
    this.buildDoneRows(assets);
  }

  ridgeAt(index: number): Ridge {
    return this.ridges[Math.min(index, this.ridges.length - 1)];
  }

  private buildDoneRows(assets: PlantAssets) {
    // one merged "inverted plant" silhouette: root mass up, pods showing
    const parts: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
    const m = new THREE.Matrix4();
    const rng = makeRng(64);
    for (let i = 0; i < 14; i++) {
      const az = rng() * 6.28;
      const rad = 0.04 + rng() * 0.12;
      const p = new THREE.Vector3(Math.cos(az) * rad, -0.03 - rng() * 0.13, Math.sin(az) * rad);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rng() * 6.28, rng() * 6.28, rng() * 6.28));
      const k = 1.1 + rng() * 0.3;
      parts.push({ geo: assets.podLod, matrix: m.compose(p, q, new THREE.Vector3(k, k, k)).clone() });
    }
    const geo = mergeParts(parts, {
      aSway: { itemSize: 1, value: () => [0] },
      aPhase: { itemSize: 1, value: () => [0] },
    });
    const mat = new THREE.MeshStandardMaterial({ color: 0xcbb083, roughness: 0.92, metalness: 0 });
    // the vine mass those rows are lying on, seen edge on as a dark green band
    const vineGeo = new THREE.SphereGeometry(0.23, 7, 4);
    vineGeo.scale(1.6, 0.2, 1.15);
    const vineMat = new THREE.MeshStandardMaterial({ color: 0x4a5b2a, roughness: 0.97, flatShading: true });

    for (let row = 1; row <= 4; row++) {
      const z = row * ROW_SPACING;
      const count = Math.floor(RIDGE_LENGTH / (PLANT_SPACING * 0.95));
      const inst = new THREE.InstancedMesh(geo, mat, count);
      inst.castShadow = true;
      inst.receiveShadow = true;
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3(1, 1, 1);
      const p = new THREE.Vector3();
      for (let i = 0; i < count; i++) {
        const x = -RIDGE_LENGTH * 0.25 + (i / count) * RIDGE_LENGTH;
        p.set(x, 0.115, z + (rng() - 0.5) * 0.14);
        q.setFromEuler(new THREE.Euler(Math.PI + (rng() - 0.5) * 0.3, rng() * 0.6, (rng() - 0.5) * 0.3));
        inst.setMatrixAt(i, m.compose(p, q, s));
      }
      inst.instanceMatrix.needsUpdate = true;
      this.group.add(inst);

      const vines = new THREE.InstancedMesh(vineGeo, vineMat, count);
      vines.castShadow = true;
      vines.receiveShadow = true;
      for (let i = 0; i < count; i++) {
        const x = -RIDGE_LENGTH * 0.25 + (i / count) * RIDGE_LENGTH;
        p.set(x, 0.04, z + (rng() - 0.5) * 0.16);
        q.setFromEuler(new THREE.Euler(0, rng() * 0.5, 0));
        vines.setMatrixAt(i, m.compose(p, q, s));
      }
      vines.instanceMatrix.needsUpdate = true;
      this.group.add(vines);

    }
  }
}
