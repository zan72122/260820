/** 庭の組み立て。近景＝竹筒・水門・水滴・衝突石、中景＝水鉢・支持構造・石・低木、遠景＝小径・垣・樹木・建物。 */
import * as THREE from 'three';
import { buildMaterials, setLeafLighting, type GardenMaterials } from './materials';
import {
  bambooTubeGeometry,
  basinGeometry,
  foliageClump,
  stoneGeometry,
  troughGeometry,
} from './geom';
import { FlowTube, Ripples, SprayField, makeWaterAssets, waterMaterial, type WaterAssets } from './water';
import type { GardenState, TubeState } from '../sim/state';
import type { SimExtras } from '../sim/physics';
import { clamp, lerp, makeRng, smoothstep } from '../util/math';

const FOG_COLOR = 0xb8c1bb;

export interface UnitLayout {
  x: number;
  length: number;
  rOuter: number;
  wall: number;
  pivotY: number;
}

/* ── ひとつの添水 ───────────────────────── */
export class Shishi {
  readonly group = new THREE.Group();
  readonly tubeGroup = new THREE.Group();
  readonly layout: UnitLayout;
  private tubeMesh: THREE.Mesh;
  private innerWater: THREE.Mesh;
  private basinWater: THREE.Mesh;
  private ripples: Ripples;
  private spray: SprayField;
  private inletStream: FlowTube;
  private dumpStream: FlowTube;
  private mouthWorld = new THREE.Vector3();
  private tailWorld = new THREE.Vector3();
  private uvScroll = 0;
  private rng: () => number;
  private innerRadius: number;
  readonly scale: number;

  constructor(
    layout: UnitLayout,
    mats: GardenMaterials,
    assets: WaterAssets,
    seed: number,
    bambooMat: THREE.MeshStandardMaterial,
  ) {
    this.layout = layout;
    this.rng = makeRng(seed);
    this.scale = layout.length / 0.64;
    const s = this.scale;
    this.innerRadius = layout.rOuter - layout.wall;
    this.group.position.set(layout.x, 0, 0);

    const zTail = -0.31 * s;
    const zMouth = 0.33 * s;
    const geo = bambooTubeGeometry({
      zTail,
      zMouth,
      rOuter: layout.rOuter,
      wall: layout.wall,
      zSeptum: 0.02 * s,
      nodes: [zTail + 0.07 * s, -0.06 * s, 0.13 * s, 0.29 * s],
      cutDepth: 0.115 * s,
    });
    this.tubeMesh = new THREE.Mesh(geo, bambooMat);
    this.tubeMesh.castShadow = true;
    this.tubeMesh.receiveShadow = true;
    this.tubeGroup.add(this.tubeMesh);

    // 内部の水（口からわずかに覗く）
    const wgeo = new THREE.CylinderGeometry(this.innerRadius * 0.97, this.innerRadius * 0.97, 1, 20, 1, false);
    wgeo.rotateX(Math.PI / 2);
    wgeo.translate(0, 0, 0.5);
    this.innerWater = new THREE.Mesh(
      wgeo,
      new THREE.MeshPhysicalMaterial({
        color: 0x9fb6b4,
        roughness: 0.08,
        metalness: 0,
        transparent: true,
        opacity: 0.85,
        clearcoat: 0.8,
      }),
    );
    this.innerWater.position.z = 0.02 * s;
    this.tubeGroup.add(this.innerWater);

    this.tubeGroup.position.set(0, layout.pivotY, 0);
    this.group.add(this.tubeGroup);

    /* 支持材：二本の柱と回転軸。接触位置が構造的に説明できる形にする。 */
    const postGeo = new THREE.BoxGeometry(0.05, layout.pivotY + 0.06, 0.058);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, mats.wood);
      post.position.set(sx * (0.115 * s), (layout.pivotY + 0.06) / 2 - 0.03, 0);
      post.rotation.z = sx * 0.02;
      post.castShadow = true;
      post.receiveShadow = true;
      this.group.add(post);
      // 柱を留める楔
      const wedge = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.05, 0.07), mats.wood);
      wedge.position.set(sx * 0.115 * s, layout.pivotY - 0.075, 0);
      this.group.add(wedge);
    }
    const axle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0115, 0.0115, 0.28 * s, 12),
      mats.woodPale,
    );
    axle.rotation.z = Math.PI / 2;
    axle.position.set(0, layout.pivotY, 0);
    axle.castShadow = true;
    this.group.add(axle);

    /* 衝突石：質量と接地を持たせ、打点に摩耗 */
    const tailRestY = layout.pivotY - 0.31 * s * Math.sin(0.185);
    const stoneGeo = stoneGeometry(seed + 3, 3, 0.3);
    stoneGeo.computeBoundingBox();
    const stone = new THREE.Mesh(stoneGeo, mats.impactStone);
    const stoneTop = tailRestY - layout.rOuter - 0.004;
    stone.scale.set(0.37 * s, 0.46 * s, 0.32 * s);
    stone.position.set(0.01 * s, stoneTop - stoneGeo.boundingBox!.max.y * stone.scale.y * 0.93, -0.305 * s);
    stone.rotation.set(0.06, this.rng() * 3, -0.04);
    stone.castShadow = true;
    stone.receiveShadow = true;
    this.group.add(stone);
    // 打点の軽い摩耗（当たり続けた跡）
    const wear = new THREE.Mesh(
      new THREE.CircleGeometry(0.052 * s, 18),
      new THREE.MeshStandardMaterial({
        color: 0x4d4f4c,
        roughness: 0.42,
        metalness: 0,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    wear.rotation.x = -Math.PI / 2;
    wear.position.set(0.005 * s, stoneTop + 0.001, -0.305 * s);
    this.group.add(wear);
    // 石の陰側にだけ苔
    const mossPatch = new THREE.Mesh(new THREE.SphereGeometry(0.155 * s, 18, 12), mats.moss);
    mossPatch.scale.set(1.05, 0.5, 0.95);
    mossPatch.position.copy(stone.position).add(new THREE.Vector3(-0.035 * s, -0.14 * s, -0.03 * s));
    this.group.add(mossPatch);

    /* 水鉢：深さ・縁の厚み・苔の位置を合理的に */
    const basinR = 0.185 * s;
    const basinD = 0.175 * s;
    const basin = new THREE.Mesh(basinGeometry(seed + 7, basinR, basinD), mats.stoneDamp);
    basin.position.set(0.02 * s, 0, 0.33 * s);
    basin.castShadow = true;
    basin.receiveShadow = true;
    this.group.add(basin);
    const basinMoss = new THREE.Mesh(
      new THREE.CylinderGeometry(basinR * 1.012, basinR * 0.94, basinD * 0.3, 18, 1, true, 1.1, 2.3),
      mats.moss,
    );
    basinMoss.position.set(0.02 * s, basinD * 0.19, 0.33 * s);
    this.group.add(basinMoss);

    const bw = new THREE.CircleGeometry(basinR - 0.05, 32);
    bw.rotateX(-Math.PI / 2);
    const bwMat = new THREE.MeshPhysicalMaterial({
      color: 0x394239,
      roughness: 0.05,
      metalness: 0,
      normalMap: assets.ripple,
      normalScale: new THREE.Vector2(0.28, 0.28),
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.4,
    });
    (bwMat.normalMap as THREE.Texture).repeat.set(3, 3);
    this.basinWater = new THREE.Mesh(bw, bwMat);
    this.basinWater.position.set(0.02 * s, basinD - 0.05 * s, 0.33 * s);
    this.group.add(this.basinWater);

    this.ripples = new Ripples(8, 0xd8e4e0);
    this.ripples.group.position.copy(this.basinWater.position).add(new THREE.Vector3(0, 0.002, 0));
    this.group.add(this.ripples.group);

    this.spray = new SprayField(120, assets);
    this.group.add(this.spray.points);

    const wm = waterMaterial(assets, 0.6);
    this.inletStream = new FlowTube(wm, 16, 6);
    this.dumpStream = new FlowTube(waterMaterial(assets, 0.55), 20, 7);
    this.group.add(this.inletStream.mesh, this.dumpStream.mesh);
  }

  get basinWaterY(): number {
    return this.basinWater.position.y;
  }

  mouthPosition(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.mouthWorld);
  }

  /** 二本目は据え付けられるように、少しだけ大きくなりながら現れる。 */
  setPresence(p: number): void {
    this.group.visible = p > 0.02;
    this.group.scale.setScalar(lerp(0.88, 1, p));
  }

  update(t: TubeState, dt: number, spoutPos: THREE.Vector3, flowToMe: number, time: number): void {
    const s = this.scale;
    const L = this.layout;

    /* 衝突後の微振動：竹がわずかにしなる */
    const ring = Math.sin(t.sinceImpact * 54) * Math.exp(-t.sinceImpact * 9.5) * 0.014 * clamp(t.impactVelocity, 0, 2);
    this.tubeGroup.rotation.x = t.angle + ring;
    // 水の重さで支持材がわずかに沈む
    this.tubeGroup.position.y = L.pivotY - t.fillRatio * 0.0045;

    /* 内部の水位（口からわずかに覗く） */
    const area = Math.PI * this.innerRadius * this.innerRadius;
    const len = clamp(t.waterMass / 1000 / area, 0, 0.32 * s);
    this.innerWater.scale.z = Math.max(0.0008, len);
    this.innerWater.visible = t.waterMass > 0.004;

    /* 口と末端の世界座標 */
    this.tubeGroup.updateMatrixWorld();
    this.mouthWorld.set(0, 0, 0.30 * s).applyMatrix4(this.tubeGroup.matrixWorld);
    this.tailWorld.set(0, -L.rOuter, -0.31 * s).applyMatrix4(this.tubeGroup.matrixWorld);

    this.uvScroll -= dt * (0.9 + flowToMe * 3.4);

    /* 上流から口へ落ちる細い水 */
    const local = this.group.worldToLocal(this.mouthWorld.clone());
    const spoutLocal = this.group.worldToLocal(spoutPos.clone());
    const show = flowToMe > 0.004;
    this.inletStream.setVisible(show);
    if (show) {
      const sway = Math.sin(time * 2.3) * 0.004 + Math.sin(time * 5.1) * 0.002;
      const drop = Math.max(0.02, spoutLocal.y - local.y);
      this.inletStream.update(
        (u, out) => {
          // 自由落下の弧
          out.set(
            lerp(spoutLocal.x, local.x, u) + sway * u,
            spoutLocal.y - drop * u * u,
            lerp(spoutLocal.z, local.z, u * 0.92),
          );
        },
        (u) => (0.0022 + flowToMe * 0.0082) * (1 - u * 0.24) * (1 + Math.sin(u * 9 + time * 6) * 0.14),
        this.uvScroll,
      );
      if (this.rng() < flowToMe * 0.9) {
        this.spray.spawn(local.x, local.y + 0.01, local.z, 0, -0.2, 0, 0.16, 0.0022 + flowToMe * 0.003, 0.35);
      }
    }

    /* 排水：筒先から重さのある水が出る */
    const dumping = t.dumpRate > 0.05;
    this.dumpStream.setVisible(dumping);
    if (dumping) {
      const vTan = t.angularVelocity * 0.33 * s;
      const vy = -Math.abs(vTan) * Math.cos(t.angle) - 0.35;
      const vz = -vTan * Math.sin(t.angle) + 0.12;
      const fall = Math.max(0.05, local.y - (this.basinWater.position.y));
      const wide = clamp(t.dumpRate / 2.6, 0.1, 1);
      this.dumpStream.update(
        (u, out) => {
          out.set(local.x, local.y - fall * u * u * 1.02, local.z + vz * u * 0.34);
        },
        (u) => (0.006 + wide * 0.03) * (1 - u * 0.3) * (1 + Math.sin(u * 7 + time * 12) * 0.16),
        this.uvScroll * 1.6,
      );
      const n = Math.floor(1 + wide * 3);
      for (let i = 0; i < n; i++) {
        this.spray.spawn(local.x, local.y, local.z, 0, vy * 0.5, vz * 0.6, 0.55 * wide, 0.003 + wide * 0.006, 0.5);
      }
    }

    /* 鉢の水面と輪 */
    const rip = clamp(t.dumpRate * 0.5, 0, 1);
    const bwMat = this.basinWater.material as THREE.MeshPhysicalMaterial;
    const nm = bwMat.normalMap;
    if (nm) {
      nm.offset.x += dt * (0.02 + rip * 0.35);
      nm.offset.y += dt * (0.014 + rip * 0.2);
    }
    bwMat.normalScale.setScalar(0.22 + rip * 0.7);

    const basinLocalY = this.basinWater.position.y;
    this.spray.update(dt, basinLocalY, (x, z, sp) => {
      const dx = x - this.basinWater.position.x;
      const dz = z - this.basinWater.position.z;
      if (dx * dx + dz * dz < 0.05 * s && sp > 0.4) {
        this.ripples.spawn(x - this.basinWater.position.x, 0, z - this.basinWater.position.z, 0.09 * s, 1.1);
      }
    });
    this.ripples.update(dt);

    /* 口の縁からの滴（余韻の間も残る） */
    if (t.sinceImpact < 2.5 && this.rng() < 0.03) {
      this.spray.spawn(local.x, local.y - 0.01, local.z, 0, -0.1, 0, 0.02, 0.0035, 0.6);
    }
  }
}

/* ── 水路と木製水門 ─────────────────────── */
export class Channel {
  readonly group = new THREE.Group();
  readonly gate = new THREE.Group();
  private gateBoard: THREE.Mesh;
  private stream: FlowTube;
  private jet: FlowTube;
  private branch: FlowTube;
  private branchTrough: THREE.Mesh;
  private branchPost: THREE.Mesh;
  private splitter: THREE.Group;
  private drop: THREE.Mesh;
  private pool: THREE.Mesh;
  private uv = 0;
  readonly spoutA = new THREE.Vector3();
  readonly spoutB = new THREE.Vector3();
  readonly spoutWorldA = new THREE.Vector3();
  readonly spoutWorldB = new THREE.Vector3();
  readonly splitterWorld = new THREE.Vector3();
  private gateZ = 0.42;
  private troughY0 = 0.925;
  private troughY1 = 0.80;
  private z0 = 1.15;
  private z1 = 0.30;

  constructor(mats: GardenMaterials, assets: WaterAssets) {
    this.group.position.set(-0.236, 0, 0.14);
    this.group.rotation.y = 0.85;
    const len = this.z0 - this.z1;
    const trough = new THREE.Mesh(troughGeometry(len, 0.06, 0.009), mats.bambooPole);
    trough.rotation.y = Math.PI;
    trough.position.set(0, this.troughY0, this.z0);
    trough.rotation.x = -Math.atan2(this.troughY0 - this.troughY1, len);
    trough.castShadow = true;
    trough.receiveShadow = true;
    this.group.add(trough);

    for (const [pz, ph] of [
      [1.02, this.yAt(1.02)],
      [0.66, this.yAt(0.66)],
    ] as [number, number][]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, ph, 10), mats.bambooPole);
      post.position.set(-0.06, ph / 2, pz);
      post.castShadow = true;
      this.group.add(post);
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.024, 0.028), mats.wood);
      brace.position.set(-0.005, ph - 0.015, pz);
      this.group.add(brace);
    }

    /* 木製水門：溝の付いた二本の柱の間を横へ滑る板 */
    const gy = this.yAt(this.gateZ);
    this.gate.position.set(0, gy, this.gateZ);
    for (const sx of [-1, 1]) {
      const guide = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.235, 0.05), mats.wood);
      guide.position.set(sx * 0.082, 0.028, 0);
      this.gate.add(guide);
    }
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.018, 0.056), mats.wood);
    sill.position.set(0, -0.093, 0);
    this.gate.add(sill);
    this.gateBoard = new THREE.Mesh(new THREE.BoxGeometry(0.152, 0.185, 0.018), mats.woodFresh);
    this.gateBoard.position.set(0, 0.028, 0);
    this.gateBoard.castShadow = true;
    this.gate.add(this.gateBoard);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.075, 8), mats.wood);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0.038, 0.062, -0.015);
    this.gateBoard.add(handle);
    this.group.add(this.gate);

    /* 水路の水、隙間から出る一筋、分岐 */
    const wm = waterMaterial(assets, 0.5);
    this.stream = new FlowTube(wm, 18, 5);
    this.jet = new FlowTube(waterMaterial(assets, 0.62), 14, 5);
    this.branch = new FlowTube(waterMaterial(assets, 0.55), 14, 5);
    this.group.add(this.stream.mesh, this.jet.mesh, this.branch.mesh);

    /* 二本目へ分ける枝樋と仕切り板 */
    this.branchTrough = new THREE.Mesh(troughGeometry(0.93, 0.05, 0.009), mats.bambooPole);
    this.branchTrough.position.set(0.03, this.yAt(0.5) - 0.014, 0.5);
    this.branchTrough.rotation.y = Math.atan2(-0.409, -0.81);
    this.branchTrough.rotation.x = 0.03;
    this.branchTrough.visible = false;
    this.group.add(this.branchTrough);
    this.branchPost = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.76, 9), mats.bambooPole);
    this.branchPost.position.set(-0.28, 0.38, 0.1);
    this.branchPost.visible = false;
    this.group.add(this.branchPost);

    this.splitter = new THREE.Group();
    const vane = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.105, 0.16), mats.woodFresh);
    vane.position.set(0, 0.042, 0);
    this.splitter.add(vane);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 9), mats.wood);
    knob.position.set(0, 0.1, 0);
    this.splitter.add(knob);
    this.splitter.position.set(0, this.yAt(0.5) - 0.05, 0.5);
    this.splitter.visible = false;
    this.group.add(this.splitter);

    /* 最初の一滴 */
    this.drop = new THREE.Mesh(
      new THREE.SphereGeometry(0.021, 16, 12),
      new THREE.MeshPhysicalMaterial({
        color: 0xcfe0dd,
        roughness: 0.03,
        metalness: 0,
        transparent: true,
        opacity: 0.9,
        clearcoat: 1,
      }),
    );
    this.drop.scale.set(1, 0.8, 1.15);
    this.group.add(this.drop);
    // 水門の手前にたまった水（開く前はここで止まっている）
    this.pool = new THREE.Mesh(
      new THREE.PlaneGeometry(0.085, 0.16),
      new THREE.MeshPhysicalMaterial({
        color: 0x8fa8a6,
        roughness: 0.06,
        metalness: 0,
        transparent: true,
        opacity: 0.85,
        clearcoat: 1,
      }),
    );
    this.pool.rotation.x = -Math.PI / 2;
    this.pool.position.set(0, this.yAt(this.gateZ) - 0.03, this.gateZ + 0.085);
    this.group.add(this.pool);

    this.spoutA.set(0, this.yAt(this.z1) - 0.028, this.z1 - 0.012);
    this.spoutB.set(-0.379, this.yAt(0.5) - 0.05, -0.31);
  }

  private yAt(z: number): number {
    const t = clamp((this.z0 - z) / (this.z0 - this.z1), 0, 1);
    return lerp(this.troughY0, this.troughY1, t);
  }

  gateWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    return this.gateBoard.getWorldPosition(out);
  }

  update(state: GardenState, extras: SimExtras, dt: number, time: number): void {
    this.group.updateMatrixWorld();
    this.spoutWorldA.copy(this.spoutA).applyMatrix4(this.group.matrixWorld);
    this.spoutWorldB.copy(this.spoutB).applyMatrix4(this.group.matrixWorld);
    this.splitter.getWorldPosition(this.splitterWorld);
    const open = state.gateOpening;
    // 指が動いても板はすぐ同じ距離を動かず、木部がたわむ
    this.gateBoard.position.x = open * 0.148;
    this.gateBoard.rotation.z = -state.gateStrain * 0.16;
    this.gateBoard.rotation.y = state.gateStrain * 0.1;
    this.gateBoard.position.y = 0.028 + Math.abs(state.gateStrain) * 0.006;

    this.uv -= dt * (0.7 + state.flowRate * 3.2);
    const flow = state.flowRate;

    /* 上流：水門の手前まで、常に少し流れている */
    const upstreamR = 0.0045 + 0.012 * Math.max(flow, 0.12);
    this.stream.update(
      (u, out) => {
        const z = lerp(this.z0 - 0.05, this.gateZ + 0.03, u);
        out.set(Math.sin(u * 5 + time) * 0.004, this.yAt(z) - 0.031, z);
      },
      () => upstreamR,
      this.uv,
    );

    /* 水門から下流：開度で太さが変わる */
    const on = flow > 0.004;
    this.jet.setVisible(on);
    if (on) {
      this.jet.update(
        (u, out) => {
          const z = lerp(this.gateZ - 0.02, this.z1 + 0.005, u);
          out.set(lerp(open * 0.05, 0, u) + Math.sin(u * 7 + time * 3) * 0.003, this.yAt(z) - 0.031 - u * u * 0.01, z);
        },
        (u) => (0.003 + flow * 0.016) * (1 - u * 0.1) * (1 + Math.sin(u * 11 + time * 8) * 0.1),
        this.uv,
      );
    }

    /* 分岐 */
    const twoTubes = state.splitterPresence > 0.02;
    this.branchTrough.visible = twoTubes;
    this.branchPost.visible = twoTubes;
    this.splitter.visible = twoTubes;
    this.splitter.position.x = (state.splitRatio - 0.5) * 0.09;
    const bFlow = flow * (1 - state.splitRatio);
    this.branch.setVisible(twoTubes && bFlow > 0.004);
    if (twoTubes && bFlow > 0.004) {
      this.branch.update(
        (u, out) => {
          out.set(lerp(0.03, this.spoutB.x, u), lerp(this.yAt(0.5) - 0.036, this.spoutB.y + 0.006, u), lerp(0.5, this.spoutB.z, u));
        },
        (u) => (0.003 + bFlow * 0.015) * (1 - u * 0.12),
        this.uv,
      );
    }

    /* 最初の一滴：水門の隙間で、竹筒の方向へ行きたそうに揺れる */
    this.pool.visible = !state.everOpened || state.flowRate < 0.02;
    if (!state.everOpened) {
      this.drop.visible = true;
      const gy = this.yAt(this.gateZ);
      const wobble = state.firstDrop;
      this.drop.position.set(
        0.006 + Math.sin(time * 3.1) * 0.005,
        gy - 0.028 + Math.sin(time * 2.2) * 0.002,
        this.gateZ - 0.03 - wobble * 0.026,
      );
      const sc = 0.85 + wobble * 0.4;
      this.drop.scale.set(sc, sc * 0.8, sc * 1.35);
    } else {
      this.drop.visible = false;
    }
    void extras;
  }
}

/* ── 庭全体 ─────────────────────────────── */
export class World {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly units: Shishi[] = [];
  readonly channel: Channel;
  readonly materials: GardenMaterials;
  readonly assets: WaterAssets;
  private sun: THREE.DirectionalLight;
  private tmp = new THREE.Vector3();
  private camTarget = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private aspect = 1;

  constructor(tubeLengths: number[]) {
    this.materials = buildMaterials();
    this.assets = makeWaterAssets();
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.05, 60);
    this.scene.fog = new THREE.FogExp2(FOG_COLOR, 0.098);
    this.scene.background = new THREE.Color(0xc3cbc4);

    /* 朝または曇天後の柔らかい光。奥からのわずかな逆光で葉に透過光が出る。 */
    const hemi = new THREE.HemisphereLight(0xc6d2cc, 0x413b2e, 0.6);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xffeddb, 1.45);
    this.sun.position.set(-2.3, 4.2, 3.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 14;
    this.sun.shadow.camera.left = -2.2;
    this.sun.shadow.camera.right = 2.2;
    this.sun.shadow.camera.top = 2.2;
    this.sun.shadow.camera.bottom = -1.6;
    this.sun.shadow.bias = -0.0012;
    this.sun.shadow.normalBias = 0.02;
    this.sun.target.position.set(0.2, 0.4, 0.1);
    this.scene.add(this.sun, this.sun.target);
    const fill = new THREE.DirectionalLight(0xdde6e3, 0.52);
    fill.position.set(2.4, 1.9, -3.2);
    this.scene.add(fill);
    setLeafLighting(this.materials.leaf, this.sun.position, FOG_COLOR);

    this.buildGround();
    this.buildMidground();
    this.buildBackground();

    this.channel = new Channel(this.materials, this.assets);
    this.scene.add(this.channel.group);

    const bamboos = [this.materials.bambooA, this.materials.bambooB];
    tubeLengths.forEach((L, i) => {
      const u = new Shishi(
        { x: i === 0 ? -0.04 : -0.72, length: L, rOuter: 0.047 - i * 0.005, wall: 0.0075, pivotY: 0.24 + L * 0.44 },
        this.materials,
        this.assets,
        900 + i * 131,
        bamboos[i],
      );
      this.units.push(u);
      this.scene.add(u.group);
    });
  }

  private buildGround(): void {
    const g = new THREE.PlaneGeometry(26, 26, 48, 48);
    g.rotateX(-Math.PI / 2);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    const rng = makeRng(77);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const d = Math.hypot(x, z);
      p.setY(i, (rng() - 0.5) * 0.02 + Math.sin(x * 0.6) * Math.cos(z * 0.5) * 0.035 + smoothstep(2, 9, d) * 0.12);
    }
    p.needsUpdate = true;
    g.computeVertexNormals();
    const ground = new THREE.Mesh(g, this.materials.soil);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 小径：踏み固められた土と飛び石
    const pathGeo = new THREE.PlaneGeometry(0.85, 9, 4, 24);
    pathGeo.rotateX(-Math.PI / 2);
    const path = new THREE.Mesh(pathGeo, this.materials.path);
    path.position.set(-2.55, 0.01, 2.9);
    path.rotation.y = 0.2;
    path.receiveShadow = true;
    this.scene.add(path);
    const rng2 = makeRng(303);
    for (let i = 0; i < 7; i++) {
      const st = new THREE.Mesh(stoneGeometry(500 + i * 17, 2, 0.22), this.materials.stone);
      st.scale.set(0.34 + rng2() * 0.14, 0.1, 0.28 + rng2() * 0.12);
      st.position.set(-2.6 + (rng2() - 0.5) * 0.3, 0.028, 0.9 + i * 1.05 + rng2() * 0.2);
      st.rotation.y = rng2() * 3;
      st.receiveShadow = true;
      this.scene.add(st);
    }
  }

  private buildMidground(): void {
    const rng = makeRng(1234);
    // 周囲の石：同じ丸石を均等に並べない
    const spots: [number, number, number][] = [
      [-1.28, 0.0, -0.1], [-1.5, 0.0, 0.75], [1.28, 0.0, 0.12],
      [-0.5, 0.0, 1.35], [1.62, 0.0, 1.05], [-2.0, 0.0, -0.45], [1.02, 0.0, 1.7],
      [-0.34, 0.0, -1.05], [1.9, 0.0, -0.5], [0.32, 0.0, 1.45],
    ];
    spots.forEach(([x, , z], i) => {
      const st = new THREE.Mesh(stoneGeometry(700 + i * 29, 3, 0.34), i % 3 === 0 ? this.materials.stoneDamp : this.materials.stone);
      const sx = 0.13 + rng() * 0.24;
      st.scale.set(sx, sx * (0.45 + rng() * 0.6), sx * (0.7 + rng() * 0.6));
      st.position.set(x, st.scale.y * 0.24 - 0.02, z);
      st.rotation.set((rng() - 0.5) * 0.4, rng() * 6, (rng() - 0.5) * 0.4);
      st.castShadow = true;
      st.receiveShadow = true;
      this.scene.add(st);
      // 苔は湿った陰側の一部だけ
      if (rng() > 0.5) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(sx * 0.34, 14, 10), this.materials.moss);
        m.scale.set(1.05, 0.45, 1);
        m.position.copy(st.position).add(new THREE.Vector3(-0.015, -sx * 0.13, -0.02));
        this.scene.add(m);
      }
    });

    // 水まわりの玉砂利（同じ石を均等に並べない）
    const pebbleGeo = stoneGeometry(880, 1, 0.5);
    const pebbles = new THREE.InstancedMesh(pebbleGeo, this.materials.stone, 420);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < 420; i++) {
      const a = rng() * Math.PI * 2;
      const rad = 0.3 + Math.pow(rng(), 0.7) * 0.72;
      const px = -0.12 + Math.cos(a) * rad * 1.15;
      const pz = 0.02 + Math.sin(a) * rad;
      const sc = 0.017 + rng() * 0.022;
      q.setFromEuler(new THREE.Euler(rng() * 3, rng() * 6, rng() * 3));
      m4.compose(new THREE.Vector3(px, 0.004 + sc * 0.18, pz), q, new THREE.Vector3(sc * 1.3, sc * 0.6, sc));
      pebbles.setMatrixAt(i, m4);
    }
    pebbles.receiveShadow = true;
    this.scene.add(pebbles);

    // 水まわりの湿った地面と苔（日陰・凹部にだけ）
    for (let i = 0; i < 6; i++) {
      const patch = new THREE.Mesh(new THREE.CircleGeometry(0.08 + rng() * 0.08, 12), this.materials.moss);
      patch.rotation.x = -Math.PI / 2;
      patch.rotation.z = rng() * 6;
      patch.position.set(-0.45 - rng() * 0.75, 0.012, -0.2 + (rng() - 0.5) * 1.2);
      this.scene.add(patch);
    }

    // 低木・下草
    const bushSpots: [number, number, number, number][] = [
      [-1.7, 0, 1.3, 0.13], [2.1, 0, 1.5, 0.15], [-2.3, 0, 2.7, 0.19],
      [1.9, 0, 2.9, 0.2], [-1.2, 0, 3.1, 0.13], [2.7, 0, 0.6, 0.16],
      [-2.8, 0, 0.7, 0.15], [0.4, 0, 3.4, 0.14],
    ];
    for (let i = 0; i < bushSpots.length; i++) {
      const [x, , z, s] = bushSpots[i];
      const clump = new THREE.Mesh(foliageClump(1500 + i * 41, 30, s * 1.9, s), this.materials.leaf);
      clump.position.set(x, 0.02, z);
      this.scene.add(clump);
    }

    // 前景の薄い葉：画面の縁にだけ置き、逆光で透けさせる
    const edge: [number, number, number, number][] = [
      [-1.55, 0.66, -0.62, 0.085], [1.6, 0.74, -0.66, 0.08], [-1.72, 0.3, -0.35, 0.07],
    ];
    for (let i = 0; i < edge.length; i++) {
      const [x, y, z, sc] = edge[i];
      const clump = new THREE.Mesh(foliageClump(1900 + i * 53, 12, 0.2, sc), this.materials.leaf);
      clump.position.set(x, y, z);
      clump.rotation.set(0.25, i * 1.7, 0.12);
      this.scene.add(clump);
    }
  }

  private buildBackground(): void {
    const rng = makeRng(4242);
    // 竹垣
    const fenceZ = 5.4;
    const poles: THREE.Matrix4[] = [];
    const poleGeo = new THREE.CylinderGeometry(0.024, 0.028, 1.1, 7);
    const fenceMat = this.materials.bambooPole.clone();
    fenceMat.color = new THREE.Color(0x9c9878);
    const inst = new THREE.InstancedMesh(poleGeo, fenceMat, 150);
    for (let i = 0; i < 150; i++) {
      const m = new THREE.Matrix4();
      m.compose(
        new THREE.Vector3(-8.4 + i * 0.118, 0.54 + (rng() - 0.5) * 0.03, fenceZ + (rng() - 0.5) * 0.05),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng() * 3, (rng() - 0.5) * 0.02)),
        new THREE.Vector3(1, 1, 1),
      );
      inst.setMatrixAt(i, m);
      poles.push(m);
    }
    inst.castShadow = false;
    this.scene.add(inst);
    for (const y of [0.3, 0.86]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 17.6, 8), fenceMat);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0.4, y, fenceZ - 0.05);
      this.scene.add(rail);
    }

    // 垣の手前の刈込み（遠景と中景をつなぐ）
    for (let i = 0; i < 16; i++) {
      const hx = -6.6 + i * 0.86 + (rng() - 0.5) * 0.3;
      const hedge = new THREE.Mesh(foliageClump(3100 + i * 17, 36, 0.9, 0.26), this.materials.leaf);
      hedge.position.set(hx, 0.05 + rng() * 0.1, 4.55 + (rng() - 0.5) * 0.3);
      this.scene.add(hedge);
    }

    // 樹木
    for (let i = 0; i < 7; i++) {
      const h = 3.2 + rng() * 2.6;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.055 + rng() * 0.03, 0.1 + rng() * 0.045, h, 9), this.materials.bark);
      const x = (i < 3 ? -5.6 + i * 1.5 : 2.8 + (i - 3) * 2.0) + rng() * 0.6;
      const z = 6.2 + rng() * 3.0;
      trunk.position.set(x, h / 2, z);
      trunk.rotation.z = (rng() - 0.5) * 0.08;
      this.scene.add(trunk);
      for (let k = 0; k < 3; k++) {
        const canopy = new THREE.Mesh(foliageClump(2600 + i * 31 + k, 40, 1.5, 0.6), this.materials.leaf);
        canopy.position.set(x + (rng() - 0.5) * 0.9, h * (0.62 + k * 0.16), z + (rng() - 0.5) * 0.9);
        this.scene.add(canopy);
      }
    }

    // 建物の一部（縁側と庇）
    const b = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 1.5), this.materials.wood);
    floor.position.set(0, 0.5, 0);
    b.add(floor);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.9, 0.1), this.materials.woodPale);
    wall.position.set(0, 1.5, 0.7);
    b.add(wall);
    const eave = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 2.1), this.materials.wood);
    eave.position.set(0, 2.42, -0.05);
    eave.rotation.x = -0.06;
    b.add(eave);
    for (const px of [-1.4, 0, 1.4]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.85, 0.11), this.materials.wood);
      col.position.set(px, 1.48, -0.6);
      b.add(col);
    }
    b.position.set(-5.2, 0, 8.2);
    b.rotation.y = 0.42;
    this.scene.add(b);
  }

  setViewport(w: number, h: number): void {
    this.aspect = w / h;
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  /** 縦：水路・竹・石を上下方向へ。横：流れと傾斜を同時に。 */
  updateCamera(state: GardenState, dt: number, time: number): void {
    const portrait = this.aspect < 1;
    const b = state.tubes[1].presence;
    if (portrait) {
      // 上に水路、中ほどに竹、下に石。斜めから見て筒の長さが読めるようにする。
      this.camera.fov = 46 + b * 3;
      this.camPos.set(0.62 - b * 0.06, 1.16 + b * 0.1, -1.62 - b * 0.42);
      this.camTarget.set(-b * 0.36, 0.46, 0.3 - b * 0.06);
    } else {
      // 流れと傾きを同時に見せる、ほぼ真横からの視点。
      this.camera.fov = 40 + b * 3;
      this.camPos.set(1.36 - b * 0.08, 0.88 + b * 0.1, -1.32 - b * 0.44);
      this.camTarget.set(0.02 - b * 0.36, 0.44, 0.28 - b * 0.06);
    }
    // ごく小さな呼吸。周期の途中でカメラを切り替えない。
    this.camPos.y += Math.sin(time * 0.31) * 0.008;
    this.camPos.x += Math.sin(time * 0.23) * 0.006;
    this.camera.position.lerp(this.camPos, 1 - Math.pow(0.001, dt));
    this.tmp.copy(this.camTarget);
    this.camera.lookAt(this.tmp);
    this.camera.updateProjectionMatrix();
  }

  update(state: GardenState, extras: SimExtras, dt: number): void {
    const time = state.time;
    this.channel.update(state, extras, dt, time);
    const twoTubes = state.tubes[1].active;
    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      const t = state.tubes[i];
      u.setPresence(t.presence);
      if (t.presence < 0.02) continue;
      const share = twoTubes ? (i === 0 ? state.splitRatio : 1 - state.splitRatio) : i === 0 ? 1 : 0;
      const spout = i === 0 ? this.channel.spoutWorldA : this.channel.spoutWorldB;
      u.update(t, dt, spout, state.flowRate * share, time);
    }
  }

  gateScreenPosition(out: THREE.Vector3): THREE.Vector3 {
    this.channel.gateWorldPosition(out);
    out.project(this.camera);
    return out;
  }

  applyQuality(low: boolean): void {
    this.sun.castShadow = !low;
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.density = low ? 0.11 : 0.098;
  }

  setEnvironment(env: THREE.Texture): void {
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.85;
  }
}
