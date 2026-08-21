import * as THREE from 'three';
import { mergeParts } from '../gfx/merge';
import { leafAlbedo, makeRng, podAlbedo, podNormal, podRough, soilAlbedo } from '../gfx/textures';

/** Per-run variation. The rules never change, only the crop does. */
export interface PlantVariant {
  podCount: number;
  podScale: number;
  podSpread: number;
  clumpCount: number;
  wetness: number; // 0 dusty dry .. 1 damp: damp soil clings longer and falls in bigger lumps
  seed: number;
}

const UP = new THREE.Vector3(0, 1, 0);

function leafletGeo(seg = 2): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(0.044, 0.064, 1, seg);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const t = (y + 0.032) / 0.064; // 0 base .. 1 tip
    // a peanut leaflet is a rounded obovate blade: wide most of its length and
    // only slightly narrowed at the stalk, never a spike
    const width = Math.sin(Math.PI * Math.min(1, Math.max(0, t * 0.72 + 0.22))) ** 0.45;
    pos.setX(i, x * width);
    pos.setZ(i, -Math.abs(x) * 0.35 - t * 0.008); // slight cupping
  }
  g.computeVertexNormals();
  return g;
}

/** A peanut pod: two lobes with a waist, faintly pointed at the tip. */
function podGeo(N = 11, radial = 8): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = (t - 0.5) * 0.038;
    const lobes = 1 - 0.3 * Math.exp(-((t - 0.5) ** 2) / 0.006) - 0.1 * Math.exp(-((t - 0.28) ** 2) / 0.02);
    const r = 0.0086 * Math.sin(Math.PI * t) ** 0.5 * lobes;
    pts.push(new THREE.Vector2(Math.max(0.0002, r), y));
  }
  const g = new THREE.LatheGeometry(pts, radial);
  g.computeVertexNormals();
  return g;
}

function clumpGeo(seed: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.05, 1);
  const rng = makeRng(seed);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const k = 0.82 + rng() * 0.34;
    pos.setXYZ(i, pos.getX(i) * k * 1.15, pos.getY(i) * k * 0.8, pos.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

/** Shared geometry and materials: three silhouette variants, built once. */
export class PlantAssets {
  readonly foliage: THREE.BufferGeometry[] = [];
  /** Cheap silhouettes for the instanced crop that is only scenery. */
  readonly foliageLod: THREE.BufferGeometry[] = [];
  readonly roots: THREE.BufferGeometry[] = [];
  readonly pod = podGeo();
  readonly podLod = podGeo(7, 6);
  readonly clumps = [clumpGeo(3), clumpGeo(19), clumpGeo(57)];
  readonly foliageMat: THREE.MeshStandardMaterial;
  readonly rootMat: THREE.MeshStandardMaterial;
  readonly podMat: THREE.MeshStandardMaterial;
  readonly clumpMat: THREE.MeshStandardMaterial;
  readonly pegMat: THREE.MeshStandardMaterial;
  readonly peg = new THREE.CylinderGeometry(0.0024, 0.0018, 1, 4);
  readonly uniforms = { uTime: { value: 0 } };

  constructor() {
    const leaf = leafletGeo(3);
    const leafLod = leafletGeo(2);
    for (let v = 0; v < 3; v++) this.foliage.push(this.buildFoliage(leaf, 900 + v * 37, 1));
    for (let v = 0; v < 3; v++) this.foliageLod.push(this.buildFoliage(leafLod, 900 + v * 37, 0.34));
    for (let v = 0; v < 3; v++) this.roots.push(this.buildRoots(500 + v * 91));
    leaf.dispose();
    leafLod.dispose();

    this.foliageMat = new THREE.MeshStandardMaterial({
      map: leafAlbedo(),
      roughness: 0.82,
      metalness: 0,
      side: THREE.DoubleSide,
      vertexColors: false,
    });
    this.applySway(this.foliageMat);

    this.rootMat = new THREE.MeshStandardMaterial({ color: 0xc0a878, roughness: 0.95, metalness: 0 });
    this.applySway(this.rootMat);

    this.podMat = new THREE.MeshStandardMaterial({
      map: podAlbedo(),
      roughnessMap: podRough(),
      normalMap: podNormal(),
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughness: 0.86,
      metalness: 0,
      color: 0xd4c6a5,
    });

    const soil = soilAlbedo().clone();
    soil.repeat.set(2, 2);
    soil.needsUpdate = true;
    this.clumpMat = new THREE.MeshStandardMaterial({ map: soil, color: 0xa08a64, roughness: 1, flatShading: true });
    // the pegs the pods actually grow on, so nothing floats
    this.pegMat = new THREE.MeshStandardMaterial({ color: 0x9c8352, roughness: 0.97, metalness: 0 });
  }

  /**
   * Sway/shake in the vertex shader: no per-leaf CPU work, and the same
   * material drives every plant. aSway is 0 at the crown, 1 at the tip.
   */
  private applySway(mat: THREE.MeshStandardMaterial) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.uniforms.uSway = { value: 0.35 };
      shader.uniforms.uShake = { value: 0 };
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           attribute float aSway;
           attribute float aPhase;
           uniform float uTime; uniform float uSway; uniform float uShake;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float sw = aSway * aSway;
           float t = uTime + aPhase;
           transformed.x += sin(t * 1.7) * 0.012 * sw * uSway;
           transformed.z += cos(t * 1.31 + aPhase) * 0.010 * sw * uSway;
           transformed.x += sin(t * 17.0) * 0.026 * sw * uShake;
           transformed.y -= abs(sin(t * 17.0)) * 0.006 * sw * uShake;`
        );
      (mat.userData as { shader?: THREE.WebGLProgramParametersWithUniforms }).shader = shader;
    };
    mat.customProgramCacheKey = () => 'sway';
  }

  private buildFoliage(leaf: THREE.BufferGeometry, seed: number, detail: number): THREE.BufferGeometry {
    const rng = makeRng(seed);
    const parts: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
    const stemGeo = new THREE.CylinderGeometry(0.006, 0.009, 1, detail < 1 ? 3 : 4, 1, true);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const stems = detail < 1 ? 7 : 11 + Math.floor(rng() * 4);
    for (let s = 0; s < stems; s++) {
      const az = (s / stems) * Math.PI * 2 + rng() * 0.5;
      const lean = 0.55 + rng() * 0.6; // peanut plants sprawl outward
      const len = 0.26 + rng() * 0.2;
      e.set(Math.cos(az) * lean, 0, -Math.sin(az) * lean);
      q.setFromEuler(e);
      const base = new THREE.Vector3(0, 0.01, 0);
      const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      m.compose(base.clone().addScaledVector(dir, len * 0.5), q, new THREE.Vector3(1, len, 1));
      parts.push({ geo: stemGeo, matrix: m.clone() });
      // leaflets in pairs of four along the stem
      const nodes = detail < 1 ? 3 : 4 + Math.floor(rng() * 2);
      for (let n = 0; n < nodes; n++) {
        const along = 0.4 + (n / nodes) * 0.62;
        const p = base.clone().addScaledVector(dir, len * along);
        for (let l = 0; l < 4; l++) {
          const la = az + (l < 2 ? -0.6 : 0.6) + (l % 2 === 0 ? -0.42 : 0.42) + rng() * 0.2;
          const tilt = -0.25 - rng() * 0.5 + (1 - along) * 0.3;
          e.set(tilt, la, 0.1 * (rng() - 0.5));
          q.setFromEuler(e);
          const lp = p.clone().add(new THREE.Vector3(Math.sin(la) * 0.03, 0.006, Math.cos(la) * 0.03));
          // fewer, larger leaflets keep the silhouette of the scenery crop
          const k = (0.85 + rng() * 0.4) * (detail < 1 ? 1.7 : 1);
          m.compose(lp.add(new THREE.Vector3(0, 0, 0)), q, new THREE.Vector3(k, k, k));
          const leafPart = leaf.clone();
          leafPart.translate(0, 0.03, 0); // pivot at the petiole end
          parts.push({ geo: leafPart, matrix: m.clone() });
        }
      }
    }
    stemGeo.dispose();
    const merged = mergeParts(parts, {
      aSway: { itemSize: 1, value: (_x, y) => [Math.min(1, Math.max(0, y / 0.44))] },
      aPhase: { itemSize: 1, value: (x, _y, z) => [(x * 7.3 + z * 3.1) % 6.28] },
    });
    parts.forEach((p) => {
      if (p.geo !== stemGeo) p.geo.dispose();
    });
    return merged;
  }

  private buildRoots(seed: number): THREE.BufferGeometry {
    const rng = makeRng(seed);
    const parts: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    // taproot
    const tap = new THREE.CylinderGeometry(0.0075, 0.0018, 0.18, 5);
    m.makeTranslation(0, -0.09, 0);
    parts.push({ geo: tap, matrix: m.clone() });
    // lateral roots and the pegs that carry the pods
    const lat = new THREE.CylinderGeometry(0.0022, 0.001, 1, 3);
    const n = 20 + Math.floor(rng() * 10);
    for (let i = 0; i < n; i++) {
      const az = rng() * Math.PI * 2;
      const down = 0.5 + rng() * 1.0;
      const len = 0.04 + rng() * 0.075;
      const dir = new THREE.Vector3(Math.cos(az), -down, Math.sin(az)).normalize();
      q.setFromUnitVectors(UP, dir);
      const start = new THREE.Vector3(0, -0.012 - rng() * 0.075, 0);
      m.compose(start.addScaledVector(dir, len * 0.5), q, new THREE.Vector3(1, len, 1));
      parts.push({ geo: lat, matrix: m.clone() });
    }
    // withering vine stubs at the crown
    const vine = new THREE.CylinderGeometry(0.0035, 0.002, 1, 3);
    for (let i = 0; i < 5; i++) {
      const az = rng() * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(az), 0.35, Math.sin(az)).normalize();
      q.setFromUnitVectors(UP, dir);
      const len = 0.08 + rng() * 0.07;
      m.compose(new THREE.Vector3(0, 0, 0).addScaledVector(dir, len * 0.5), q, new THREE.Vector3(1, len, 1));
      parts.push({ geo: vine, matrix: m.clone() });
    }
    const merged = mergeParts(parts, {
      aSway: { itemSize: 1, value: (_x, y) => [Math.min(1, Math.max(0, -y / 0.3)) * 0.5] },
      aPhase: { itemSize: 1, value: (x, _y, z) => [(x * 5.1 + z * 2.7) % 6.28] },
    });
    tap.dispose();
    lat.dispose();
    vine.dispose();
    return merged;
  }
}

export type ShedFn = (worldPos: THREE.Vector3, size: number, wet: number) => void;

/**
 * One plant the player is actually working on: individually rigged, with its
 * own pods and its own clinging soil. Everything else in the field is
 * instanced scenery.
 */
export class HeroPlant {
  readonly group = new THREE.Group(); // world placement, owned by the Game
  readonly body = new THREE.Group(); // what the inverter rotates
  readonly pods: THREE.InstancedMesh;
  private readonly pegs: THREE.InstancedMesh;
  private readonly clumps: THREE.InstancedMesh;
  private readonly foliage: THREE.Mesh;
  private readonly roots: THREE.Mesh;
  private podBase: { pos: THREE.Vector3; quat: THREE.Quaternion; scale: number; dangle: number }[] = [];
  private clumpBase: { pos: THREE.Vector3; quat: THREE.Quaternion; scale: number; threshold: number }[] = [];
  private shedDone: boolean[] = [];
  private soil = 1;
  private podReveal = 0;
  private shakeEnergy = 0;
  private t = 0;
  readonly variant: PlantVariant;

  constructor(assets: PlantAssets, variant: PlantVariant) {
    this.variant = variant;
    const rng = makeRng(variant.seed);
    const v = Math.floor(rng() * 3);

    this.foliage = new THREE.Mesh(assets.foliage[v], assets.foliageMat);
    this.foliage.castShadow = true;
    this.roots = new THREE.Mesh(assets.roots[(v + 1) % 3], assets.rootMat);
    this.roots.castShadow = true;

    this.pods = new THREE.InstancedMesh(assets.pod, assets.podMat, variant.podCount);
    this.pods.castShadow = true;
    this.pods.receiveShadow = true;
    this.pods.frustumCulled = false;

    this.pegs = new THREE.InstancedMesh(assets.peg, assets.pegMat, variant.podCount);
    this.pegs.castShadow = true;
    this.pegs.frustumCulled = false;

    this.clumps = new THREE.InstancedMesh(assets.clumps[v], assets.clumpMat, variant.clumpCount);
    this.clumps.castShadow = true;
    this.clumps.frustumCulled = false;

    // pods hang off the pegs in the root zone, clustered like a real plant:
    // dense near the crown, thinning outward and downward
    for (let i = 0; i < variant.podCount; i++) {
      const az = rng() * Math.PI * 2;
      const rad = variant.podSpread * (0.2 + rng() * 0.8) ** 0.85;
      const depth = -0.015 - rng() * 0.12;
      const pos = new THREE.Vector3(Math.cos(az) * rad, depth, Math.sin(az) * rad);
      const dir = new THREE.Vector3(Math.cos(az) * 0.5, -1, Math.sin(az) * 0.5).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir);
      quat.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rng() * Math.PI));
      this.podBase.push({
        pos,
        quat,
        scale: variant.podScale * (0.82 + rng() * 0.4),
        dangle: rng() * 6.28,
      });
    }

    for (let i = 0; i < variant.clumpCount; i++) {
      const az = rng() * Math.PI * 2;
      const rad = (0.025 + rng() * 0.085) * (0.75 + variant.wetness * 0.5);
      const pos = new THREE.Vector3(Math.cos(az) * rad, -0.015 - rng() * 0.085, Math.sin(az) * rad);
      const quat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rng() * 6.28, rng() * 6.28, rng() * 6.28)
      );
      this.clumpBase.push({
        pos,
        quat,
        scale: (0.7 + rng() * 0.9) * (0.85 + variant.wetness * 0.5),
        // damp clods hang on longer; a few stubborn lumps stay on the roots
        threshold: rng() * (0.72 + variant.wetness * 0.3),
      });
      this.shedDone.push(false);
    }

    this.body.add(this.foliage, this.roots, this.pods, this.pegs, this.clumps);
    this.group.add(this.body);
    this.writePods();
    this.writeClumps();
  }

  /** 1 = plant still packed in soil, 0 = clean roots. Never goes back up. */
  setSoil(v: number, onShed?: ShedFn) {
    const next = Math.min(this.soil, Math.max(0, v));
    if (next === this.soil) return;
    this.soil = next;
    for (let i = 0; i < this.clumpBase.length; i++) {
      if (!this.shedDone[i] && this.soil < this.clumpBase[i].threshold) {
        this.shedDone[i] = true;
        if (onShed) {
          const w = this.body.localToWorld(this.clumpBase[i].pos.clone());
          onShed(w, this.clumpBase[i].scale, this.variant.wetness);
        }
      }
    }
    this.writeClumps();
    this.writePods();
  }

  get soilLevel() {
    return this.soil;
  }

  get podRevealLevel() {
    return this.podReveal;
  }

  /** 0 = pods tucked into the root mass, 1 = pods swung out and readable. */
  setPodReveal(v: number) {
    this.podReveal = Math.max(this.podReveal, Math.min(1, Math.max(0, v)));
    this.writePods();
  }

  shake(amount: number) {
    this.shakeEnergy = Math.min(1.4, this.shakeEnergy + amount);
  }

  get shaking() {
    return this.shakeEnergy;
  }

  private writePods() {
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const crown = new THREE.Vector3(0, -0.012, 0);
    const q = new THREE.Quaternion();
    const dir = new THREE.Vector3();
    for (let i = 0; i < this.podBase.length; i++) {
      const b = this.podBase[i];
      // before the flip the pods sit tight against the root ball and are
      // buried in the clinging soil; the flip swings them clear
      const out = 0.82 + 0.18 * this.podReveal;
      p.copy(b.pos).multiplyScalar(out);
      p.y = b.pos.y * (0.8 + 0.2 * this.podReveal);
      const dangle = Math.sin(this.t * 2.1 + b.dangle) * 0.02 * this.podReveal;
      p.x += dangle;
      const k = b.scale * (0.78 + 0.22 * this.podReveal);
      s.set(k, k, k);
      this.pods.setMatrixAt(i, m.compose(p, b.quat, s));
      // a peg running from the crown out to the pod
      dir.copy(p).sub(crown);
      const len = Math.max(0.005, dir.length());
      q.setFromUnitVectors(UP, dir.clone().normalize());
      this.pegs.setMatrixAt(
        i,
        m.compose(crown.clone().addScaledVector(dir, 0.5), q, s.set(1, len, 1))
      );
    }
    this.pods.instanceMatrix.needsUpdate = true;
    this.pegs.instanceMatrix.needsUpdate = true;
  }

  private writeClumps() {
    const m = new THREE.Matrix4();
    const s = new THREE.Vector3();
    for (let i = 0; i < this.clumpBase.length; i++) {
      const b = this.clumpBase[i];
      const alive = this.shedDone[i] ? 0 : 1;
      const k = b.scale * alive * (0.55 + 0.45 * Math.min(1, this.soil + 0.25));
      s.set(k, k, k);
      this.clumps.setMatrixAt(i, m.compose(b.pos, b.quat, s));
    }
    this.clumps.instanceMatrix.needsUpdate = true;
  }

  update(dt: number) {
    this.t += dt;
    if (this.shakeEnergy > 0) {
      this.shakeEnergy = Math.max(0, this.shakeEnergy - dt * 1.6);
      this.writePods();
    }
    // a little secondary motion so the vines feel like they have weight
    const wobble = this.shakeEnergy * 0.09;
    this.body.rotation.z += (Math.sin(this.t * 13) * wobble - this.body.rotation.z) * Math.min(1, dt * 6);
  }

  dispose() {
    this.pods.dispose();
    this.pegs.dispose();
    this.clumps.dispose();
  }
}
