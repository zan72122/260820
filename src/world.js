// ---------------------------------------------------------------------------
// 情景。真夏の日本、縁台の上の氷とラムネ。
// 主役は瓶なので、周りは「冷たさ」と「夏の光」を出す最小限に絞る。
// ---------------------------------------------------------------------------
import * as THREE from '../vendor/three/three.module.min.js';
import { makeWood, makeBackdrop, makeIceRough, makeRng, makeFoam, makeContactShadow } from './textures.js';
import { SUN_DIR } from './env.js';
import { makeGlassMaterial } from './bottle.js';

export const BASIN = { x: -0.078, z: -0.018, rimY: 0.078, iceTop: 0.062, bottleBaseY: 0.024 };
export const CUP = { x: 0.148, z: 0.010, innerR: 0.0305, height: 0.104, floorY: 0.012 };

export function buildWorld(scene, quality) {
  const rng = makeRng(4242);

  // --- 縁台 ---------------------------------------------------------------
  const wood = makeWood(11);
  wood.map.repeat.set(2.4, 1.4);
  wood.rough.repeat.set(2.4, 1.4);
  const bench = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.052, 1.05),
    new THREE.MeshStandardMaterial({
      map: wood.map, roughnessMap: wood.rough, roughness: 1, metalness: 0,
      envMapIntensity: 0.55,
    }),
  );
  bench.position.set(0, -0.026, -0.10);
  bench.receiveShadow = true;
  scene.add(bench);

  // 遠景の地面（縁台の向こう側が空にならないように）
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshStandardMaterial({ color: 0x9d8d6c, roughness: 1, metalness: 0, envMapIntensity: 0.5 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.30, -1.0);
  scene.add(ground);

  const skirt = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.20, 0.06),
    new THREE.MeshStandardMaterial({ map: wood.map, roughness: 1, metalness: 0, envMapIntensity: 0.4 }),
  );
  skirt.position.set(0, -0.15, 0.418);
  scene.add(skirt);

  // --- 氷の容器（ブリキのたらい） -----------------------------------------
  const basinPts = [];
  basinPts.push(new THREE.Vector2(0.0000, 0.0000));
  basinPts.push(new THREE.Vector2(0.0880, 0.0000));
  basinPts.push(new THREE.Vector2(0.0920, 0.0035));
  basinPts.push(new THREE.Vector2(0.1140, 0.0700));
  basinPts.push(new THREE.Vector2(0.1185, 0.0762));
  basinPts.push(new THREE.Vector2(0.1165, 0.0788));
  basinPts.push(new THREE.Vector2(0.1112, 0.0766));
  basinPts.push(new THREE.Vector2(0.1082, 0.0700));
  basinPts.push(new THREE.Vector2(0.0858, 0.0045));
  basinPts.push(new THREE.Vector2(0.0000, 0.0045));
  const basin = new THREE.Mesh(
    new THREE.LatheGeometry(basinPts, 48),
    new THREE.MeshStandardMaterial({
      color: 0x9ca4a6, metalness: 0.35, roughness: 0.60,
      envMapIntensity: 1.2, side: THREE.DoubleSide,
    }),
  );
  basin.position.set(BASIN.x, 0, BASIN.z);
  basin.castShadow = true;
  basin.receiveShadow = true;
  scene.add(basin);

  // 溶けた水
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(0.104, 40),
    new THREE.MeshPhysicalMaterial({
      color: 0xcfe6ee, metalness: 0, roughness: 0.015, envMapIntensity: 2.2,
      transparent: true, opacity: 0.40, depthWrite: false,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(BASIN.x, 0.016, BASIN.z);
  water.renderOrder = 1;
  scene.add(water);

  // --- 砕いた氷 -----------------------------------------------------------
  const iceRough = makeIceRough(9);
  const iceMat = makeGlassMaterial(0xcfeaf6, [0.34, 0.18, 0.11], {
    side: THREE.DoubleSide, alphaMin: 0.34, env: 1.25, fres: 1.15, roughness: 0.20,
  });
  iceMat.roughnessMap = iceRough;
  // flatShading は vNormal を消してしまうので、面法線をジオメトリに焼き込む
  const iceGroup = new THREE.Group();
  const count = quality.ice;
  for (let i = 0; i < count; i++) {
    const size = 0.007 + Math.pow(rng(), 1.7) * 0.013;
    const g = new THREE.IcosahedronGeometry(size, rng() < 0.75 ? 1 : 2);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    const jitter = [];
    for (let k = 0; k < 8; k++) jitter.push([rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1, 0.86 + rng() * 0.2]);
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k);
      // 角が溶けて丸くなった塊。低周波のうねりだけ残す。
      let n = 0.90;
      for (const j of jitter) {
        const d = (v.x * j[0] + v.y * j[1] + v.z * j[2]) / size;
        n += 0.105 * Math.sin(d * 2.3 + j[3] * 6.0);
      }
      v.multiplyScalar(n);
      p.setXYZ(k, v.x, v.y * 0.88, v.z);
    }
    // 砕いた氷の平らな割れ面を出すため、面ごとの法線を焼き込む
    const flat = g.toNonIndexed();
    g.dispose();
    flat.computeVertexNormals();
    const m = new THREE.Mesh(flat, iceMat);
    const a = (i / count) * Math.PI * 2 + rng() * 0.8;
    const rad = 0.042 + rng() * 0.052;
    m.position.set(
      BASIN.x + Math.cos(a) * rad,
      0.022 + rng() * 0.036,
      BASIN.z + Math.sin(a) * rad,
    );
    m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    m.renderOrder = 7;
    m.castShadow = false;
    iceGroup.add(m);
  }
  scene.add(iceGroup);

  // --- コップ -------------------------------------------------------------
  const cupPts = [];
  const C = (r, y) => cupPts.push(new THREE.Vector2(r, y));
  C(0.0000, 0.0000);
  C(0.0290, 0.0000);
  C(0.0300, 0.0025);
  C(0.0345, 0.0700);
  C(0.0360, 0.1040);
  C(0.0332, 0.1040);
  C(0.0318, 0.0700);
  C(0.0290, 0.0140);
  C(0.0270, 0.0120);
  C(0.0000, 0.0120);
  const cupGeo = new THREE.LatheGeometry(cupPts, 40);
  cupGeo.computeVertexNormals();
  const cupAbsorb = [0.42, 0.22, 0.18];
  const cupBack = new THREE.Mesh(cupGeo, makeGlassMaterial(0xdff2ee, cupAbsorb, {
    side: THREE.BackSide, alphaMin: 0.13, env: 1.2, fres: 1.1,
  }));
  cupBack.renderOrder = 2;
  const cupFront = new THREE.Mesh(cupGeo, makeGlassMaterial(0xdff2ee, cupAbsorb, {
    side: THREE.FrontSide, alphaMin: 0.09, env: 1.7, fres: 1.35,
  }));
  cupFront.renderOrder = 8;
  const cup = new THREE.Group();
  cup.add(cupBack, cupFront);
  cup.position.set(CUP.x, 0, CUP.z);
  cup.castShadow = true;
  scene.add(cup);

  // コップの中身
  const cupLiquid = new THREE.Mesh(
    new THREE.CylinderGeometry(CUP.innerR, CUP.innerR * 0.94, 1, 32, 1, false),
    new THREE.MeshPhysicalMaterial({
      color: 0x5cc6ba, metalness: 0, roughness: 0.025, envMapIntensity: 1.5,
      transparent: true, opacity: 0.52, depthWrite: false,
    }),
  );
  cupLiquid.renderOrder = 3;
  cupLiquid.visible = false;
  cup.add(cupLiquid);

  const cupFoam = new THREE.Mesh(
    new THREE.CircleGeometry(CUP.innerR * 0.99, 28),
    new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.95, metalness: 0, alphaMap: makeFoam(31),
      transparent: true, opacity: 0, depthWrite: false,
    }),
  );
  cupFoam.rotation.x = -Math.PI / 2;
  cupFoam.renderOrder = 4;
  cup.add(cupFoam);

  // --- 遠景 ---------------------------------------------------------------
  const backdrop = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 3.4, 48, 1, true),
    new THREE.MeshBasicMaterial({
      map: makeBackdrop(5), side: THREE.BackSide, fog: false, toneMapped: true,
    }),
  );
  backdrop.position.y = -0.16;
  scene.add(backdrop);

  // --- 接地影（ガラスに真っ黒な影を落とさせない代わりの柔らかい影） -------
  const shadowTex = makeContactShadow();
  const mkShadow = (r, x, z, op) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(r * 2, r * 2),
      new THREE.MeshBasicMaterial({
        map: shadowTex, transparent: true, opacity: op, depthWrite: false,
        blending: THREE.NormalBlending, fog: false,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.0016, z);
    m.renderOrder = 1;
    scene.add(m);
    return m;
  };
  mkShadow(0.18, BASIN.x + 0.026, BASIN.z + 0.018, 0.55);
  mkShadow(0.062, CUP.x + 0.012, CUP.z + 0.012, 0.5);
  const bottleShadow = mkShadow(0.075, 0, 0, 0.0);
  // 厚いガラスを通った夏の光が木面に落とす、青緑の明るい斑
  const caustic = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.12),
    new THREE.MeshBasicMaterial({
      map: shadowTex, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0x6fd8c8, fog: false,
    }),
  );
  caustic.rotation.x = -Math.PI / 2;
  caustic.position.y = 0.0020;
  caustic.renderOrder = 1;
  scene.add(caustic);

  // --- 光 -----------------------------------------------------------------
  const sun = new THREE.DirectionalLight(0xfff0d4, 2.8);
  sun.position.copy(SUN_DIR).multiplyScalar(2.2);
  sun.target.position.set(0, 0.10, 0);
  scene.add(sun, sun.target);
  if (quality.shadow) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
    const c = sun.shadow.camera;
    c.left = -0.34; c.right = 0.34; c.top = 0.34; c.bottom = -0.34;
    c.near = 0.8; c.far = 3.4;
    c.updateProjectionMatrix();
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.004;
    sun.shadow.radius = 2.2;
  }
  scene.add(new THREE.AmbientLight(0xc6dcea, 0.32));
  const bounce = new THREE.DirectionalLight(0xffe9d0, 0.60);
  bounce.position.set(-0.5, 0.35, 1.0);
  scene.add(bounce);

  scene.fog = new THREE.Fog(0xd3e3ea, 1.3, 5.2);

  return {
    bench, basin, water, ice: iceGroup, cup, cupLiquid, cupFoam,
    backdrop, sun, bottleShadow, caustic,
  };
}

/**
 * 注がれるラムネの流れ。頂点を毎フレーム書き換える固定サイズのチューブ。
 * 生成 / 破棄はしない。
 */
export class PourStream {
  constructor(rings = 16, radial = 7) {
    this.rings = rings; this.radial = radial;
    const verts = rings * radial;
    const pos = new Float32Array(verts * 3);
    const nrm = new Float32Array(verts * 3);
    const idx = [];
    for (let i = 0; i < rings - 1; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * radial + j;
        const b = i * radial + ((j + 1) % radial);
        const c = (i + 1) * radial + j;
        const d = (i + 1) * radial + ((j + 1) % radial);
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.1, 0), 1.0);
    this.geometry = g;
    this.material = new THREE.MeshPhysicalMaterial({
      color: 0x9ee2d8, metalness: 0, roughness: 0.02, envMapIntensity: 2.0,
      transparent: true, opacity: 0.52, depthWrite: false, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.renderOrder = 7;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this._tmp = { p: new THREE.Vector3(), t: new THREE.Vector3(), n1: new THREE.Vector3(), n2: new THREE.Vector3() };
  }

  /** @returns 着水点の world 座標（しぶき用）または null */
  update(start, dir, speed, radius, floorY) {
    const { rings, radial } = this;
    const pos = this.geometry.attributes.position;
    const nrm = this.geometry.attributes.normal;
    const p = this._tmp.p, tan = this._tmp.t, n1 = this._tmp.n1, n2 = this._tmp.n2;
    const g = -9.81;
    // まず着水までの時間を求める
    const vy = dir.y * speed;
    const dy = start.y - floorY;
    const disc = vy * vy + 2 * 9.81 * Math.max(dy, 0.001);
    const tEnd = Math.max(0.02, (vy + Math.sqrt(disc)) / 9.81);
    let land = null;
    for (let i = 0; i < rings; i++) {
      const t = (i / (rings - 1)) * tEnd;
      p.set(
        start.x + dir.x * speed * t,
        start.y + dir.y * speed * t + 0.5 * g * t * t,
        start.z + dir.z * speed * t,
      );
      tan.set(dir.x * speed, dir.y * speed + g * t, dir.z * speed).normalize();
      n1.set(-tan.z, 0, tan.x);
      if (n1.lengthSq() < 1e-8) n1.set(1, 0, 0);
      n1.normalize();
      n2.crossVectors(tan, n1).normalize();
      const rr = radius * (1 - 0.55 * (i / (rings - 1))) * (0.85 + 0.15 * Math.sin(i * 1.7));
      for (let j = 0; j < radial; j++) {
        const a = (j / radial) * Math.PI * 2;
        const ox = Math.cos(a), oy = Math.sin(a);
        const k = (i * radial + j) * 3;
        pos.array[k + 0] = p.x + (n1.x * ox + n2.x * oy) * rr;
        pos.array[k + 1] = p.y + (n1.y * ox + n2.y * oy) * rr;
        pos.array[k + 2] = p.z + (n1.z * ox + n2.z * oy) * rr;
        nrm.array[k + 0] = n1.x * ox + n2.x * oy;
        nrm.array[k + 1] = n1.y * ox + n2.y * oy;
        nrm.array[k + 2] = n1.z * ox + n2.z * oy;
      }
      if (i === rings - 1) land = { x: p.x, y: p.y, z: p.z };
    }
    pos.needsUpdate = true;
    nrm.needsUpdate = true;
    return land;
  }
}
