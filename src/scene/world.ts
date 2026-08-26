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
import { clamp, damp, lerp, makeRng, smoothstep } from '../util/math';

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
    const stone = new THREE.Mesh(stoneGeometry(seed + 3, 3, 0.3), mats.impactStone);
    const stoneTop = tailRestY - layout.rOuter - 0.004;
    stone.scale.set(0.46 * s, 0.62 * s, 0.42 * s);
    stone.position.set(0.01 * s, stoneTop - 0.31 * s * 0.62 + 0.03, -0.305 * s);
    stone.rotation.set(0.06, this.rng() * 3, -0.04);
    stone.castShadow = true;
    stone.receiveShadow = true;
    this.group.add(stone);
    // 石の陰側にだけ苔
    const mossPatch = new THREE.Mesh(new THREE.SphereGeometry(0.24 * s, 20, 14), mats.moss);
    mossPatch.scale.set(1, 0.62, 0.92);
    mossPatch.position.copy(stone.position).add(new THREE.Vector3(-0.03, -0.15 * s, -0.02));
    this.group.add(mossPatch);

    /* 水鉢：深さ・縁の厚み・苔の位置を合理的に */
    const basinR = 0.245 * s;
    const basinD = 0.31 * s;
    const basin = new THREE.Mesh(basinGeometry(seed + 7, basinR, basinD), mats.stoneDamp);
    basin.position.set(0.015 * s, 0, 0.30 * s);
    basin.castShadow = true;
    basin.receiveShadow = true;
    this.group.add(basin);
    const basinMoss = new THREE.Mesh(new THREE.CylinderGeometry(basinR * 1.01, basinR * 0.9, basinD * 0.5, 24, 1, true), mats.moss);
    basinMoss.position.set(0.015 * s, basinD * 0.22, 0.30 * s);
    this.group.add(basinMoss);

    const bw = new THREE.CircleGeometry(basinR - 0.062, 32);
    bw.rotateX(-Math.PI / 2);
    const bwMat = new THREE.MeshPhysicalMaterial({
      color: 0x4a5750,
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
    this.basinWater.position.set(0.015 * s, basinD - 0.075 * s, 0.30 * s);
    this.group.add(this.basinWater);

    this.ripples = new Ripples(8, 0xd8e4e0);
    this.ripples.group.position.copy(this.basinWater.position).add(new THREE.Vector3(0, 0.002, 0));
    this.group.add(this.ripples.group);

    this.spray = new SprayField(120, assets);
    this.group.add(this.spray.points);

    const wm = waterMaterial(assets, 0.6);
    this.inletStream = new FlowTube(wm, 16, 6);
    this.dumpStream = new FlowTube(waterMaterial(assets, 0.72), 20, 7);
    this.group.add(this.inletStream.mesh, this.dumpStream.mesh);
  }

  get basinWaterY(): number {
    return this.basinWater.position.y;
  }

  mouthPosition(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.mouthWorld);
  }

  setPresence(p: number): void {
    this.group.visible = p > 0.02;
    this.group.scale.setScalar(lerp(0.86, 1, p));
    this.group.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m && 'opacity' in m && (m as THREE.MeshStandardMaterial).transparent) return;
    });
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
        (u) => (0.004 + flowToMe * 0.0165) * (1 - u * 0.22) * (1 + Math.sin(u * 9 + time * 6) * 0.12),
        this.uvScroll,
      );
      if (this.rng() < flowToMe * 0.9) {
        this.spray.spawn(local.x, local.y + 0.01, local.z, 0, -0.2, 0, 0.16, 0.4 + flowToMe, 0.35);
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
        (u) => (0.008 + wide * 0.052) * (1 - u * 0.3) * (1 + Math.sin(u * 7 + time * 12) * 0.14),
        this.uvScroll * 1.6,
      );
      const n = Math.floor(1 + wide * 3);
      for (let i = 0; i < n; i++) {
        this.spray.spawn(local.x, local.y, local.z, 0, vy * 0.5, vz * 0.6, 0.55 * wide, 0.7 + wide * 1.5, 0.5);
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
      this.spray.spawn(local.x, local.y - 0.01, local.z, 0, -0.1, 0, 0.02, 0.5, 0.6);
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
  private splitter: THREE.Group;
  private drop: THREE.Mesh;
  private uv = 0;
  readonly spoutA = new THREE.Vector3();
  readonly spoutB = new THREE.Vector3();
  private gateZ = 0.86;
  private troughY0 = 0.995;
  private troughY1 = 0.878;
  private z0 = 1.95;
  private z1 = 0.36;

  constructor(mats: GardenMaterials, assets: WaterAssets) {
    const len = this.z0 - this.z1;
    const trough = new THREE.Mesh(troughGeometry(len, 0.082, 0.011), mats.bambooPole);
    trough.rotation.y = Math.PI;
    trough.position.set(0, this.troughY0, this.z0);
    trough.rotation.x = -Math.atan2(this.troughY0 - this.troughY1, len);
    trough.castShadow = true;
    trough.receiveShadow = true;
    this.group.add(trough);

    for (const [pz, ph] of [
      [1.72, this.yAt(1.72)],
      [0.62, this.yAt(0.62)],
    ] as [number, number][]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, ph, 10), mats.bambooPole);
      post.position.set(-0.075, ph / 2, pz);
      post.castShadow = true;
      this.group.add(post);
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.028, 0.03), mats.wood);
      brace.position.set(-0.01, ph - 0.02, pz);
      this.group.add(brace);
    }

    /* 木製水門：溝の付いた二本の柱の間を横へ滑る板 */
    const gy = this.yAt(this.gateZ);
    this.gate.position.set(0, gy, this.gateZ);
    for (const sx of [-1, 1]) {
      const guide = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.2, 0.05), mats.wood);
      guide.position.set(sx * 0.108, 0.055, 0);
      this.gate.add(guide);
    }
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.048), mats.wood);
    sill.position.set(0, -0.045, 0);
    this.gate.add(sill);
    this.gateBoard = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.135, 0.019), mats.woodPale);
    this.gateBoard.position.set(0, 0.028, 0);
    this.gateBoard.castShadow = true;
    this.gate.add(this.gateBoard);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.06, 8), mats.wood);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0.055, 0.082, -0.016);
    this.gateBoard.add(handle);
    this.group.add(this.gate);

    /* 水路の水、隙間から出る一筋、分岐 */
    const wm = waterMaterial(assets, 0.5);
    this.stream = new FlowTube(wm, 18, 5);
    this.jet = new FlowTube(waterMaterial(assets, 0.62), 14, 5);
    this.branch = new FlowTube(waterMaterial(assets, 0.55), 14, 5);
    this.group.add(this.stream.mesh, this.jet.mesh, this.branch.mesh);

    /* 二本目へ分ける枝樋と仕切り板 */
    this.branchTrough = new THREE.Mesh(troughGeometry(0.78, 0.062, 0.01), mats.bambooPole);
    this.branchTrough.position.set(0.02, this.yAt(0.52) - 0.006, 0.52);
    this.branchTrough.rotation.y = -Math.PI / 2 + 0.22;
    this.branchTrough.rotation.z = 0.045;
    this.branchTrough.visible = false;
    this.group.add(this.branchTrough);

    this.splitter = new THREE.Group();
    const vane = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.075, 0.14), mats.woodPale);
    vane.position.set(0, 0.03, 0);
    this.splitter.add(vane);
    this.splitter.position.set(0, this.yAt(0.56), 0.56);
    this.splitter.visible = false;
    this.group.add(this.splitter);

    /* 最初の一滴 */
    this.drop = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 14, 10),
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

    this.spoutA.set(0, this.yAt(this.z1) - 0.028, this.z1 - 0.01);
    this.spoutB.set(0.72, this.yAt(0.52) - 0.055, 0.40);
  }

  private yAt(z: number): number {
    const t = clamp((this.z0 - z) / (this.z0 - this.z1), 0, 1);
    return lerp(this.troughY0, this.troughY1, t);
  }

  gateWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    return this.gateBoard.getWorldPosition(out);
  }

  update(state: GardenState, extras: SimExtras, dt: number, time: number): void {
    const open = state.gateOpening;
    // 指が動いても板はすぐ同じ距離を動かず、木部がたわむ
    this.gateBoard.position.x = open * 0.152;
    this.gateBoard.rotation.z = -state.gateStrain * 0.16;
    this.gateBoard.rotation.y = state.gateStrain * 0.1;
    this.gateBoard.position.y = 0.028 + Math.abs(state.gateStrain) * 0.006;

    this.uv -= dt * (0.7 + state.flowRate * 3.2);
    const flow = state.flowRate;

    /* 上流：水門の手前まで、常に少し流れている */
    const upstreamR = 0.006 + 0.019 * Math.max(flow, 0.12);
    this.stream.update(
      (u, out) => {
        const z = lerp(this.z0 - 0.05, this.gateZ + 0.03, u);
        out.set(Math.sin(u * 5 + time) * 0.004, this.yAt(z) - 0.055, z);
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
          out.set(lerp(open * 0.06, 0, u) + Math.sin(u * 7 + time * 3) * 0.003, this.yAt(z) - 0.055 - u * u * 0.012, z);
        },
        (u) => (0.0035 + flow * 0.026) * (1 - u * 0.1) * (1 + Math.sin(u * 11 + time * 8) * 0.1),
        this.uv,
      );
    }

    /* 分岐 */
    const twoTubes = state.splitterPresence > 0.02;
    this.branchTrough.visible = twoTubes;
    this.splitter.visible = twoTubes;
    this.splitter.position.x = (state.splitRatio - 0.5) * 0.09;
    const bFlow = flow * (1 - state.splitRatio);
    this.branch.setVisible(twoTubes && bFlow > 0.004);
    if (twoTubes && bFlow > 0.004) {
      this.branch.update(
        (u, out) => {
          out.set(lerp(0.03, this.spoutB.x, u), lerp(this.yAt(0.55) - 0.05, this.spoutB.y + 0.01, u), lerp(0.55, this.spoutB.z, u));
        },
        (u) => (0.0035 + bFlow * 0.024) * (1 - u * 0.12),
        this.uv,
      );
    }

    /* 最初の一滴：水門の隙間で、竹筒の方向へ行きたそうに揺れる */
    if (!state.everOpened) {
      this.drop.visible = true;
      const gy = this.yAt(this.gateZ);
      const wobble = state.firstDrop;
      this.drop.position.set(
        0.006 + Math.sin(time * 3.1) * 0.004,
        gy - 0.052 + Math.sin(time * 2.2) * 0.0018,
        this.gateZ - 0.028 - wobble * 0.018,
      );
      const sc = 0.85 + wobble * 0.35;
      this.drop.scale.set(sc, sc * 0.82, sc * 1.2);
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
    this.scene.fog = new THREE.FogExp2(FOG_COLOR, 0.072);
    this.scene.background = new THREE.Color(0xc3cbc4);

    /* 朝または曇天後の柔らかい光。奥からのわずかな逆光で葉に透過光が出る。 */
    const hemi = new THREE.HemisphereLight(0xc7d2ce, 0x453f33, 0.62);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xffeedd, 1.35);
    this.sun.position.set(-2.4, 4.2, 5.4);
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
    const fill = new THREE.DirectionalLight(0xdfe6e4, 0.34);
    fill.position.set(2.6, 2.2, -3.4);
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
        { x: i === 0 ? -0.04 : 0.72, length: L, rOuter: 0.055 - i * 0.006, wall: 0.008, pivotY: 0.3 + L * 0.462 },
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
    path.position.set(-1.85, 0.012, 2.4);
    path.rotation.y = 0.14;
    path.receiveShadow = true;
    this.scene.add(path);
    const rng2 = makeRng(303);
    for (let i = 0; i < 7; i++) {
      const st = new THREE.Mesh(stoneGeometry(500 + i * 17, 2, 0.22), this.materials.stone);
      st.scale.set(0.34 + rng2() * 0.14, 0.1, 0.28 + rng2() * 0.12);
      st.position.set(-1.9 + (rng2() - 0.5) * 0.3, 0.03, 0.5 + i * 1.05 + rng2() * 0.2);
      st.rotation.y = rng2() * 3;
      st.receiveShadow = true;
      this.scene.add(st);
    }
  }

  private buildMidground(): void {
    const rng = makeRng(1234);
    // 周囲の石：同じ丸石を均等に並べない
    const spots: [number, number, number][] = [
      [-0.62, 0.0, -0.15], [0.42, 0.0, -0.5], [-0.95, 0.0, 0.55], [1.15, 0.0, 0.05],
      [-0.35, 0.0, 1.15], [1.5, 0.0, 0.9], [-1.4, 0.0, -0.4], [0.95, 0.0, 1.55],
      [-0.2, 0.0, -0.95], [1.75, 0.0, -0.35],
    ];
    spots.forEach(([x, , z], i) => {
      const st = new THREE.Mesh(stoneGeometry(700 + i * 29, 3, 0.34), i % 3 === 0 ? this.materials.stoneDamp : this.materials.stone);
      const sx = 0.2 + rng() * 0.42;
      st.scale.set(sx, sx * (0.45 + rng() * 0.6), sx * (0.7 + rng() * 0.6));
      st.position.set(x, st.scale.y * 0.24 - 0.02, z);
      st.rotation.set((rng() - 0.5) * 0.4, rng() * 6, (rng() - 0.5) * 0.4);
      st.castShadow = true;
      st.receiveShadow = true;
      this.scene.add(st);
      // 苔は湿った陰側の一部だけ
      if (rng() > 0.45) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(sx * 0.5, 16, 12), this.materials.moss);
        m.scale.set(1, 0.5, 1);
        m.position.copy(st.position).add(new THREE.Vector3(-0.02, -sx * 0.16, -0.02));
        this.scene.add(m);
      }
    });

    // 低木・下草
    const bushSpots: [number, number, number, number][] = [
      [-1.25, 0, 1.1, 0.34], [1.65, 0, 1.35, 0.4], [-1.75, 0, 2.3, 0.5],
      [1.35, 0, 2.5, 0.55], [-0.6, 0, 2.2, 0.3], [2.2, 0, 0.6, 0.42],
    ];
    for (let i = 0; i < bushSpots.length; i++) {
      const [x, , z, s] = bushSpots[i];
      const clump = new THREE.Mesh(foliageClump(1500 + i * 41, 26, s * 1.4, s), this.materials.leaf);
      clump.position.set(x, 0.02, z);
      this.scene.add(clump);
    }

    // 前景の薄い葉（逆光で透ける）
    for (let i = 0; i < 3; i++) {
      const clump = new THREE.Mesh(foliageClump(1900 + i * 53, 16, 0.5, 0.30), this.materials.leaf);
      clump.position.set(-1.05 + i * 1.25, 0.42 + (i % 2) * 0.2, -1.15 - i * 0.12);
      clump.rotation.set(0.2, i * 1.4, 0.1);
      this.scene.add(clump);
    }
  }

  private buildBackground(): void {
    const rng = makeRng(4242);
    // 竹垣
    const fenceZ = 4.6;
    const poles: THREE.Matrix4[] = [];
    const poleGeo = new THREE.CylinderGeometry(0.026, 0.03, 1.35, 7);
    const inst = new THREE.InstancedMesh(poleGeo, this.materials.bambooPole, 90);
    for (let i = 0; i < 90; i++) {
      const m = new THREE.Matrix4();
      m.compose(
        new THREE.Vector3(-5.2 + i * 0.118, 0.66 + (rng() - 0.5) * 0.03, fenceZ + (rng() - 0.5) * 0.05),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng() * 3, (rng() - 0.5) * 0.02)),
        new THREE.Vector3(1, 1, 1),
      );
      inst.setMatrixAt(i, m);
      poles.push(m);
    }
    inst.castShadow = false;
    this.scene.add(inst);
    for (const y of [0.35, 1.02]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 10.6, 8), this.materials.bambooPole);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0.1, y, fenceZ - 0.05);
      this.scene.add(rail);
    }

    // 樹木
    for (let i = 0; i < 5; i++) {
      const h = 3.2 + rng() * 2.6;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09 + rng() * 0.05, 0.16 + rng() * 0.07, h, 9), this.materials.bark);
      const x = -4.6 + i * 2.3 + rng() * 0.8;
      const z = 5.6 + rng() * 2.8;
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
    b.position.set(-4.3, 0, 6.4);
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
      this.camera.fov = 47 + b * 4;
      this.camPos.set(0.06 + b * 0.3, 1.3, -1.98 - b * 0.36);
      this.camTarget.set(0.06 + b * 0.32, 0.63, 0.1);
    } else {
      this.camera.fov = 40 + b * 3;
      this.camPos.set(1.05 + b * 0.16, 1.06, -1.82 - b * 0.3);
      this.camTarget.set(0.14 + b * 0.3, 0.58, 0.05);
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
      const spout = i === 0 ? this.channel.spoutA : this.channel.spoutB;
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
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.density = low ? 0.08 : 0.072;
  }

  setEnvironment(env: THREE.Texture): void {
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.85;
  }
}

export { damp };
