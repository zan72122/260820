import * as THREE from 'three';
import { clamp01, fbm, lerp, makeRng, Rng, rrange, smoothstep } from '../core/util';
import { perf } from '../core/perf';
import { settings } from '../core/settings';
import { DigSite } from './digsite';
import { LeafClump, LeafPlacement, leafTint } from './foliage';
import { Strand } from './strand';
import { makeFineRoots, makeTuberGeometry, makeTuberMaterial, rootMaterial, TuberMaterial, TuberParams } from './tuber';
import { terrainHeight } from './terrain';

export type ClusterKind = 'chunky' | 'slender' | 'oneBig' | 'curved' | 'hidden';

export type TuberInstance = {
  group: THREE.Group;
  mesh: THREE.Mesh;
  material: TuberMaterial;
  restPos: THREE.Vector3;
  restQuat: THREE.Quaternion;
  hangOffset: THREE.Vector3;
  hangQuat: THREE.Quaternion;
  delay: number;
  follow: number;
  popped: boolean;
  strand: Strand;
  headLocal: THREE.Vector3;
  azimuth: number;
  length: number;
};

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);

function clusterSpec(kind: ClusterKind, rng: Rng): TuberParams[] {
  const mk = (length: number, radius: number, bend: number, bias: number): TuberParams => ({
    length,
    radius,
    bend,
    bias,
    seed: Math.floor(rng() * 1000),
  });
  switch (kind) {
    case 'chunky':
      return Array.from({ length: 4 }, () =>
        mk(rrange(rng, 0.19, 0.235), rrange(rng, 0.040, 0.049), rrange(rng, -0.02, 0.02), rrange(rng, 0.35, 0.65)),
      );
    case 'slender':
      return Array.from({ length: 5 }, () =>
        mk(rrange(rng, 0.26, 0.325), rrange(rng, 0.024, 0.030), rrange(rng, -0.03, 0.03), rrange(rng, 0.3, 0.7)),
      );
    case 'oneBig':
      return [
        mk(0.30, 0.055, rrange(rng, -0.02, 0.02), 0.6),
        ...Array.from({ length: 3 }, () =>
          mk(rrange(rng, 0.11, 0.15), rrange(rng, 0.022, 0.029), rrange(rng, -0.02, 0.02), 0.5),
        ),
      ];
    case 'curved':
      return Array.from({ length: 4 }, () =>
        mk(rrange(rng, 0.23, 0.28), rrange(rng, 0.031, 0.040), rrange(rng, 0.045, 0.085) * (rng() > 0.5 ? 1 : -1), 0.55),
      );
    case 'hidden':
    default:
      return Array.from({ length: 4 }, (_, i) =>
        mk(
          i === 3 ? 0.17 : rrange(rng, 0.20, 0.26),
          i === 3 ? 0.036 : rrange(rng, 0.030, 0.042),
          rrange(rng, -0.03, 0.03),
          0.5,
        ),
      );
  }
}

/** One hill: vine, leaves, crown, the cluster underneath and the soil over it. */
export class Plant {
  readonly group = new THREE.Group();
  readonly cluster = new THREE.Group();
  readonly digSite: DigSite;
  readonly tubers: TuberInstance[] = [];
  readonly crownWorld: THREE.Vector3;
  readonly vineCurve: THREE.CatmullRomCurve3;
  readonly vineTipWorld = new THREE.Vector3();
  readonly revealTipWorld = new THREE.Vector3();
  readonly leaves: LeafClump;
  readonly crownLeaves: LeafClump;
  readonly crackAngle: number;
  readonly kind: ClusterKind;
  onPop: ((tuber: TuberInstance, index: number) => void) | null = null;

  private vineMesh: THREE.Mesh;
  private vineUniforms: {
    uTime: THREE.IUniform<number>;
    uTrace: THREE.IUniform<number>;
    uTension: THREE.IUniform<number>;
    uWind: THREE.IUniform<number>;
  };
  private crownKnot: THREE.Mesh;
  private rng: Rng;
  private pull = 0;
  private shakePhase = 0;
  private shakeAmount = 0;
  private mud = 1;
  private time = 0;
  private strandMat: THREE.MeshStandardMaterial;
  private lifted = false;

  constructor(x: number, z: number, kind: ClusterKind, seed: number, vineHeading: number) {
    this.rng = makeRng(seed);
    this.kind = kind;
    const rng = this.rng;
    this.crownWorld = new THREE.Vector3(x, terrainHeight(x, z), z);
    this.crackAngle = vineHeading + Math.PI * 0.5 + rrange(rng, -0.35, 0.35);
    this.digSite = new DigSite(this.crownWorld, this.crackAngle, rng);

    this.cluster.position.copy(this.crownWorld);
    this.strandMat = rootMaterial().clone();

    /* ---- vine: runs out along the row and ends in a leafy tip ---- */
    const pts: THREE.Vector3[] = [];
    const span = rrange(rng, 1.35, 1.7);
    const steps = 9;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const d = t * span;
      const wig = Math.sin(t * 5.2 + seed) * 0.13 * t + (fbm(t * 4 + seed, 2, 2, seed | 0) - 0.5) * 0.12;
      const wx = x + Math.cos(vineHeading) * d - Math.sin(vineHeading) * wig;
      const wz = z + Math.sin(vineHeading) * d + Math.cos(vineHeading) * wig;
      pts.push(new THREE.Vector3(wx, terrainHeight(wx, wz) + 0.014 + Math.sin(t * 7) * 0.006, wz));
    }
    this.vineTipWorld.copy(pts[pts.length - 1]);
    // curve runs tip -> crown so trace progress reads as "toward the plant"
    this.vineCurve = new THREE.CatmullRomCurve3(pts.slice().reverse(), false, 'catmullrom', 0.4);

    const built = this.buildVine();
    this.vineMesh = built.mesh;
    this.vineUniforms = built.uniforms;
    this.group.add(this.vineMesh);

    /* ---- leaves along the vine and bunched over the crown ---- */
    const placements: LeafPlacement[] = [];
    const vineLeaves = Math.round(40 * (perf.fast ? 0.6 : 1));
    for (let i = 0; i < vineLeaves; i++) {
      const t = clamp01(0.04 + (i / vineLeaves) * 0.94 + rrange(rng, -0.03, 0.03));
      const p = this.vineCurve.getPointAt(t).clone();
      const side = i % 2 === 0 ? 1 : -1;
      const tan = this.vineCurve.getTangentAt(t);
      const lateral = new THREE.Vector3().crossVectors(UP, tan).normalize().multiplyScalar(side);
      p.addScaledVector(lateral, rrange(rng, 0.01, 0.05));
      const dir = new THREE.Vector3()
        .copy(UP)
        .addScaledVector(lateral, rrange(rng, 0.5, 1.15))
        .addScaledVector(tan, rrange(rng, -0.3, 0.3))
        .normalize();
      placements.push({ pos: p, dir, scale: rrange(rng, 0.095, 0.16), tint: leafTint(rng) });
    }
    this.leaves = new LeafClump(placements, rng);
    this.group.add(this.leaves.group);

    const crownPlacements: LeafPlacement[] = [];
    const crownLeaves = Math.round(34 * (perf.fast ? 0.6 : 1));
    for (let i = 0; i < crownLeaves; i++) {
      const a = rng() * Math.PI * 2;
      const r = rrange(rng, 0.05, 0.44);
      const wx = x + Math.cos(a) * r;
      const wz = z + Math.sin(a) * r;
      const p = new THREE.Vector3(wx, terrainHeight(wx, wz) + rrange(rng, 0.02, 0.09), wz);
      const dir = new THREE.Vector3(Math.cos(a) * rrange(rng, 0.2, 0.8), 1, Math.sin(a) * rrange(rng, 0.2, 0.8)).normalize();
      crownPlacements.push({ pos: p, dir, scale: rrange(rng, 0.105, 0.175), tint: leafTint(rng) });
    }
    this.crownLeaves = new LeafClump(crownPlacements, rng);
    this.group.add(this.crownLeaves.group);

    /* ---- crown knot ---- */
    this.crownKnot = this.buildCrown(rng);
    this.cluster.add(this.crownKnot);

    /* ---- the cluster itself ---- */
    this.buildCluster(kind, rng);

    this.group.add(this.digSite.group);
    this.group.add(this.cluster);
  }

  private buildVine() {
    const geo = new THREE.TubeGeometry(this.vineCurve, 96, 0.011, 7, false);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    const centre = new THREE.Vector3();
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const t = uv.getX(i);
      this.vineCurve.getPointAt(clamp01(t), centre);
      v.fromBufferAttribute(pos, i).sub(centre);
      // thicker at the crown, knotted at the nodes where leaves come off
      const taper = lerp(1.35, 0.72, t);
      const node = 1 + Math.pow(Math.abs(Math.sin(t * Math.PI * 9)), 8) * 0.55;
      v.multiplyScalar(taper * node);
      pos.setXYZ(i, centre.x + v.x, centre.y + v.y, centre.z + v.z);
    }
    geo.computeVertexNormals();

    const uniforms = {
      uTime: { value: 0 },
      uTrace: { value: -1 },
      uTension: { value: 0 },
      uWind: { value: 1 },
    };
    const mat = new THREE.MeshStandardMaterial({
      color: 0x6d7a44,
      roughness: 0.92,
      metalness: 0,
    });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uTime;
           uniform float uTrace;
           uniform float uTension;
           uniform float uWind;
           varying float vT;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vT = uv.x;
           float sway = sin(uTime * 1.3 + uv.x * 6.0) * 0.006 * uWind * (1.0 - uv.x);
           transformed.x += sway;
           transformed.z += cos(uTime * 1.1 + uv.x * 5.0) * 0.005 * uWind * (1.0 - uv.x);
           // the stem draws taut just ahead of the finger
           float front = exp(-pow((uv.x - uTrace) * 8.0, 2.0));
           transformed.y += front * uTension * 0.026;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vT;')
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
           // older wood near the crown goes purple-brown, the tip stays green
           diffuseColor.rgb = mix(diffuseColor.rgb * vec3(1.05, 0.94, 0.72), diffuseColor.rgb * vec3(0.62, 0.55, 0.52), smoothstep(0.55, 1.0, vT));`,
        );
    };
    mat.customProgramCacheKey = () => 'vine-mat';
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return { mesh, uniforms };
  }

  private buildCrown(rng: Rng) {
    const g = new THREE.IcosahedronGeometry(0.052, 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const n = fbm(p.getX(i) * 22, p.getZ(i) * 22 + p.getY(i) * 11, 3, 9);
      const s = 0.78 + n * 0.55;
      p.setXYZ(i, p.getX(i) * s * 1.25, p.getY(i) * s * 0.85, p.getZ(i) * s * 1.25);
    }
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b573c, roughness: 0.95, metalness: 0 });
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.y = -0.012;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // cut stems poking out of the crown
    for (let i = 0; i < 4; i++) {
      const a = rng() * Math.PI * 2;
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.009, rrange(rng, 0.03, 0.07), 5),
        new THREE.MeshStandardMaterial({ color: 0x7c7d4a, roughness: 0.9 }),
      );
      stem.position.set(Math.cos(a) * 0.03, 0.03, Math.sin(a) * 0.03);
      stem.rotation.set(rrange(rng, -0.5, 0.5), 0, rrange(rng, -0.5, 0.5));
      stem.castShadow = true;
      mesh.add(stem);
    }
    return mesh;
  }

  private buildCluster(kind: ClusterKind, rng: Rng) {
    const specs = clusterSpec(kind, rng);
    const n = specs.length;
    const baseAngle = this.crackAngle - Math.PI * 0.5;
    const mat = makeTuberMaterial();

    specs.forEach((spec, i) => {
      // spread around the crown but never evenly: a real cluster is lopsided
      const azimuth = baseAngle + (i / n) * Math.PI * 2 + rrange(rng, -0.42, 0.42);
      const alignedToCrack = i === 0;
      const pitch = alignedToCrack ? rrange(rng, 0.08, 0.15) : rrange(rng, 0.12, 0.30);
      const headR = rrange(rng, 0.028, 0.06);
      const headDepth = alignedToCrack ? 0.042 : rrange(rng, 0.058, 0.078);

      const geo = makeTuberGeometry(spec);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const roots = new THREE.Mesh(makeFineRoots(spec, rng), this.strandMat);
      roots.castShadow = false;

      const g = new THREE.Group();
      g.add(mesh, roots);

      const dir = new THREE.Vector3(Math.cos(azimuth), -Math.sin(pitch), Math.sin(azimuth)).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(FORWARD, dir);
      const restPos = new THREE.Vector3(Math.cos(azimuth) * headR, -headDepth, Math.sin(azimuth) * headR);

      if (kind === 'hidden' && i === n - 1) {
        // one root strays out under a clod, found only after brushing wide
        restPos.set(Math.cos(azimuth) * 0.3, -0.05, Math.sin(azimuth) * 0.3);
      }

      g.position.copy(restPos);
      g.quaternion.copy(quat);

      const hangDir = new THREE.Vector3(Math.cos(azimuth) * 0.78, -1, Math.sin(azimuth) * 0.78).normalize();
      const hangQuat = new THREE.Quaternion().setFromUnitVectors(FORWARD, hangDir);
      const hangOffset = new THREE.Vector3(
        Math.cos(azimuth) * 0.085,
        -0.075 - i * 0.018,
        Math.sin(azimuth) * 0.085,
      );

      const strand = new Strand(this.strandMat, 10, 6, (t) => lerp(0.011, 0.0055, t));

      const inst: TuberInstance = {
        group: g,
        mesh,
        material: mat,
        restPos,
        restQuat: quat,
        hangOffset,
        hangQuat,
        delay: i * 0.13 + rrange(rng, 0, 0.05),
        follow: 0,
        popped: false,
        strand,
        headLocal: restPos.clone(),
        azimuth,
        length: spec.length,
      };
      this.tubers.push(inst);
      this.cluster.add(g);
      this.cluster.add(strand.mesh);

      if (alignedToCrack) {
        // the first purple the player will ever see, right under the fissure
        const tipLocal = new THREE.Vector3(0, 0, spec.length * 0.62).applyQuaternion(quat).add(restPos);
        this.revealTipWorld.copy(tipLocal).add(this.crownWorld);
      }
    });
  }

  /** 0..1 along the vine, tip -> crown. */
  setTrace(t: number, tension: number) {
    this.vineUniforms.uTrace.value = t;
    this.vineUniforms.uTension.value = tension;
  }

  setWind(v: number) {
    this.vineUniforms.uWind.value = v;
    this.leaves.setWind(v);
    this.crownLeaves.setWind(v);
  }

  /** 0 = canopy closed over the hill, 1 = swept aside, crown bare. */
  setCanopyOpen(amount: number) {
    this.crownLeaves.setOpen(amount, this.crownWorld);
  }

  setPull(p: number) {
    this.pull = clamp01(p);
    if (this.pull > 0.02) this.lifted = true;
  }

  get pullAmount() {
    return this.pull;
  }

  addShake(amount: number) {
    this.shakeAmount = clamp01(this.shakeAmount + amount);
    this.mud = clamp01(this.mud - amount * 0.5);
  }

  get mudLevel() {
    return this.mud;
  }

  /** World position of the whole cluster, for camera framing. */
  clusterCentre(out = new THREE.Vector3()) {
    out.set(0, 0, 0);
    for (const t of this.tubers) out.add(t.group.getWorldPosition(new THREE.Vector3()));
    out.multiplyScalar(1 / Math.max(1, this.tubers.length));
    return out;
  }

  /** Midpoint of the body — the part that has to come out of the soil. */
  tuberMid(t: TuberInstance, out = new THREE.Vector3()) {
    out.set(0, 0, t.length * 0.5);
    t.group.updateMatrixWorld();
    return out.applyMatrix4(t.group.matrixWorld);
  }

  /** True once soil no longer covers the body of this tuber. */
  isExposed(t: TuberInstance) {
    return this.digSite.maskAt(this.tuberMid(t)) > 0.45;
  }

  update(dt: number, time: number, sunViewDir: THREE.Vector3) {
    this.time = time;
    this.leaves.update(time, sunViewDir);
    this.crownLeaves.update(time, sunViewDir);
    this.vineUniforms.uTime.value = time;
    this.digSite.update(dt);

    const rise = this.pull * 0.46;
    this.cluster.position.y = this.crownWorld.y + rise;

    this.shakeAmount = Math.max(0, this.shakeAmount - dt * 0.9);
    this.shakePhase += dt * 15;
    const swing = this.lifted ? Math.sin(this.shakePhase) * this.shakeAmount * 0.34 * settings.motionScale : 0;

    const tmpA = new THREE.Vector3();
    const tmpB = new THREE.Vector3();
    const sag = new THREE.Vector3(0, -1, 0);

    this.tubers.forEach((t, i) => {
      const gate = clamp01((this.pull - t.delay * 0.55) / (1 - t.delay * 0.55 + 0.001));
      const target = smoothstep(gate);
      // each root gives way at its own moment, not on a shared timeline
      t.follow = lerp(t.follow, target, 1 - Math.exp(-(4.5 + i * 0.6) * dt));
      if (!t.popped && t.follow > 0.12) {
        t.popped = true;
        this.onPop?.(t, i);
      }

      tmpA.copy(t.restPos);
      tmpB.copy(t.hangOffset);
      // while rising, the tuber stays where the soil left it until its root pulls
      tmpA.y -= rise * (1 - t.follow) * 0.92;
      t.group.position.lerpVectors(tmpA, tmpB, t.follow);
      if (swing !== 0) {
        t.group.position.x += Math.cos(t.azimuth) * swing * 0.05 * t.follow;
        t.group.position.z += Math.sin(t.azimuth) * swing * 0.05 * t.follow;
      }
      t.group.quaternion.slerpQuaternions(t.restQuat, t.hangQuat, t.follow);
      if (swing !== 0 && t.follow > 0.2) {
        t.group.rotateOnWorldAxis(UP, swing * 0.25);
      }

      const mudU = t.material.userData.uMud;
      mudU.value = this.mud;
      t.material.userData.uWet.value = lerp(1, 0.55, 1 - this.mud);

      // keep the visible root between crown and tuber
      const head = t.group.position.clone();
      const dirBack = head.clone().normalize().multiplyScalar(-0.02);
      strandUpdate(t.strand, dirBack, head, sag, 0.012 + t.follow * 0.03);
    });
  }

  get elapsed() {
    return this.time;
  }

  /** Strip everything but the worked soil, once the child has moved on. */
  retire() {
    for (const obj of [this.vineMesh, this.leaves.group, this.crownLeaves.group, this.cluster]) {
      this.group.remove(obj);
    }
    this.leaves.dispose();
    this.crownLeaves.dispose();
    this.vineMesh.geometry.dispose();
    // the cluster itself may already be sitting in the crate: leave it alone
    this.tubers.length = 0;
  }
}

function strandUpdate(strand: Strand, from: THREE.Vector3, to: THREE.Vector3, sagDir: THREE.Vector3, sag: number) {
  strand.update(from, to, sagDir, sag);
}
