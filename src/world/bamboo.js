// 竹。近景 / 中景 / 遠景の 3 段 LOD をインスタンス描画する。
// 近景だけ節(ふし)の凹凸を実ジオメトリで作り、遠くは頂点数を落とす。
import * as THREE from 'three';
import { heightAt } from './ground.js';
import { bambooTexture, canopyTexture, sasaTexture } from './textures.js';

/**
 * 稈(かん)の断面プロファイルを回転させて 1 本ぶんのジオメトリを作る。
 * @param {object} o
 */
function makeCulm({
  height = 15,
  baseRadius = 0.062,
  topRadius = 0.026,
  radialSeg = 10,
  nodeDetail = true,
  nodeSpacing = 0.34,
  bend = 0.22,
  detailUpTo = 7,
}) {
  const profile = []; // {y, r}
  const radiusAt = (y) => {
    const t = y / height;
    // 下は太く、上に向かってゆるやかに細る
    return baseRadius * Math.pow(1 - t, 0.42) + topRadius * t;
  };
  if (nodeDetail) {
    let y = 0;
    let spacing = nodeSpacing;
    profile.push({ y: 0, r: radiusAt(0) * 1.06 });
    while (y < detailUpTo) {
      y += spacing;
      spacing = Math.min(0.52, spacing * 1.045);
      const r = radiusAt(y);
      profile.push({ y: y - 0.028, r: r * 1.0 });
      profile.push({ y: y - 0.008, r: r * 1.085 });  // 節のふくらみ
      profile.push({ y: y + 0.014, r: r * 1.045 });
      profile.push({ y: y + 0.05, r: r * 0.995 });
    }
    let yy = y;
    while (yy < height) {
      yy += 0.85;
      profile.push({ y: Math.min(yy, height), r: radiusAt(Math.min(yy, height)) });
    }
  } else {
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const y = (i / steps) * height;
      profile.push({ y, r: radiusAt(y) });
    }
  }

  const rows = profile.length;
  const verts = [];
  const uvs = [];
  const idx = [];
  for (let i = 0; i < rows; i++) {
    const { y, r } = profile[i];
    const t = y / height;
    const off = bend * t * t; // わずかにしなる
    for (let j = 0; j <= radialSeg; j++) {
      const a = (j / radialSeg) * Math.PI * 2;
      verts.push(Math.cos(a) * r + off, y, Math.sin(a) * r);
      uvs.push(j / radialSeg, y * 0.55);
    }
  }
  const stride = radialSeg + 1;
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < radialSeg; j++) {
      const a = i * stride + j;
      const b = a + stride;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

function culmMaterial(extra = {}) {
  return new THREE.MeshStandardMaterial({
    map: bambooTexture(),
    roughness: 0.78,
    metalness: 0.0,
    ...extra,
  });
}

/**
 * 竹林をまとめて作る。
 * @param {Function} rng makeRng()
 * @param {object} opts {fast:boolean, avoid:[{x,z,r}]}
 */
export function createBambooForest(rng, opts = {}) {
  const fast = !!opts.fast;
  const group = new THREE.Group();
  group.name = 'bamboo';
  const avoid = opts.avoid || [];

  const tiers = [
    // 近景: 節までしっかり見える
    { count: fast ? 16 : 42, rMin: 3.2, rMax: 12, radialSeg: 10, nodeDetail: true, hMin: 12, hMax: 18, shadow: true },
    // 中景
    { count: fast ? 24 : 78, rMin: 13, rMax: 26, radialSeg: 7, nodeDetail: false, hMin: 11, hMax: 17, shadow: false },
    // 遠景: 霧に溶ける
    { count: fast ? 40 : 190, rMin: 26, rMax: 46, radialSeg: 5, nodeDetail: false, hMin: 10, hMax: 16, shadow: false },
  ];

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  tiers.forEach((tier, ti) => {
    const geo = makeCulm({
      height: 15,
      baseRadius: 0.062,
      topRadius: 0.026,
      radialSeg: tier.radialSeg,
      nodeDetail: tier.nodeDetail && !fast,
      bend: 0.22,
    });
    const mat = culmMaterial();
    const inst = new THREE.InstancedMesh(geo, mat, tier.count);
    inst.castShadow = tier.shadow;
    inst.receiveShadow = false;
    inst.name = 'bambooTier' + ti;
    let placed = 0;
    let guard = 0;
    while (placed < tier.count && guard < tier.count * 40) {
      guard++;
      const a = rng.range(0, Math.PI * 2);
      // 手前は少し疎に、奥は密に見えるように半径を偏らせる
      const r = Math.sqrt(rng()) * (tier.rMax - tier.rMin) + tier.rMin;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 2;
      let blocked = false;
      for (const av of avoid) {
        if (Math.hypot(x - av.x, z - av.z) < av.r) { blocked = true; break; }
      }
      if (blocked) continue;
      const y = heightAt(x, z);
      const hScale = rng.range(tier.hMin, tier.hMax) / 15;
      const rScale = rng.range(0.78, 1.25);
      dummy.position.set(x, y - 0.06, z);
      dummy.rotation.set(rng.range(-0.045, 0.045), rng.range(0, Math.PI * 2), rng.range(-0.045, 0.045));
      dummy.scale.set(rScale, hScale, rScale);
      dummy.updateMatrix();
      inst.setMatrixAt(placed, dummy.matrix);
      // 若い竹 <-> 古い竹の色幅 + 遠景ほど淡く
      const age = rng();
      const fade = ti === 2 ? 0.86 : ti === 1 ? 0.95 : 1.0;
      color.setRGB(
        (0.86 + age * 0.26) * fade,
        (0.94 + age * 0.16) * fade,
        (0.80 + age * 0.22) * fade
      );
      inst.setColorAt(placed, color);
      placed++;
    }
    inst.count = placed;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
  });

  // 樹冠: 上を覆う葉のかたまり。空を隠して竹林の中にいる感じを作る
  const canopyCount = fast ? 40 : 260;
  const canopyGeo = new THREE.PlaneGeometry(1, 1);
  const canopyMat = new THREE.MeshStandardMaterial({
    map: canopyTexture(),
    transparent: true,
    alphaTest: 0.28,
    side: THREE.DoubleSide,
    roughness: 0.9,
    depthWrite: true,
  });
  const canopy = new THREE.InstancedMesh(canopyGeo, canopyMat, canopyCount);
  canopy.name = 'canopy';
  for (let i = 0; i < canopyCount; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(2, 40);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r - 2;
    const y = heightAt(x, z) + rng.range(6.5, 15.5);
    const s = rng.range(2.2, 5.4);
    dummy.position.set(x, y, z);
    dummy.rotation.set(rng.range(-0.9, 0.9), rng.range(0, Math.PI * 2), rng.range(-0.5, 0.5));
    dummy.scale.set(s, s * rng.range(0.6, 1.0), s);
    dummy.updateMatrix();
    canopy.setMatrixAt(i, dummy.matrix);
    const k = rng.range(0.72, 1.12);
    color.setRGB(k, k * 1.03, k * 0.9);
    canopy.setColorAt(i, color);
  }
  canopy.instanceMatrix.needsUpdate = true;
  if (canopy.instanceColor) canopy.instanceColor.needsUpdate = true;
  group.add(canopy);

  // 低い笹(下草)。掘る場所の邪魔をしないよう、中景から奥だけに置く
  const sasaCount = fast ? 30 : 190;
  const sasaMat = new THREE.MeshStandardMaterial({
    map: sasaTexture(),
    transparent: true,
    alphaTest: 0.34,
    side: THREE.DoubleSide,
    roughness: 0.86,
    // 下草が黒い落書きに見えないよう、わずかに自ら光らせて持ち上げる
    emissive: 0x2c3a1c,
    emissiveIntensity: 0.55,
  });
  const sasa = new THREE.InstancedMesh(canopyGeo, sasaMat, sasaCount);
  sasa.name = 'sasa';
  for (let i = 0; i < sasaCount; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(8.5, 32);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r - 2;
    const y = heightAt(x, z);
    const s = rng.range(0.5, 1.35);
    dummy.position.set(x, y + s * 0.45, z);
    dummy.rotation.set(rng.range(-0.25, 0.25), rng.range(0, Math.PI * 2), rng.range(-0.2, 0.2));
    dummy.scale.set(s * 1.5, s, s);
    dummy.updateMatrix();
    sasa.setMatrixAt(i, dummy.matrix);
    const k = rng.range(0.6, 1.0);
    color.setRGB(k, k * 1.05, k * 0.85);
    sasa.setColorAt(i, color);
  }
  sasa.instanceMatrix.needsUpdate = true;
  if (sasa.instanceColor) sasa.instanceColor.needsUpdate = true;
  group.add(sasa);

  if (!fast) {
    // 切り株と倒れた竹。実寸の手がかりになる
    const stumpGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.22, 10, 1, false);
    const stumpMat = culmMaterial({ color: 0xbfae86 });
    const stumps = new THREE.InstancedMesh(stumpGeo, stumpMat, 9);
    for (let i = 0; i < 9; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(4, 20);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 2;
      dummy.position.set(x, heightAt(x, z) + 0.09, z);
      dummy.rotation.set(rng.range(-0.1, 0.1), rng.range(0, 6.28), rng.range(-0.1, 0.1));
      dummy.scale.setScalar(rng.range(0.85, 1.2));
      dummy.updateMatrix();
      stumps.setMatrixAt(i, dummy.matrix);
    }
    stumps.instanceMatrix.needsUpdate = true;
    stumps.castShadow = true;
    stumps.receiveShadow = true;
    group.add(stumps);

    const fallenGeo = new THREE.CylinderGeometry(0.05, 0.062, 5.5, 8, 1, false);
    fallenGeo.rotateZ(Math.PI / 2);
    const fallen = new THREE.InstancedMesh(fallenGeo, culmMaterial({ color: 0xa89b74 }), 4);
    for (let i = 0; i < 4; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(7, 22);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 2;
      dummy.position.set(x, heightAt(x, z) + 0.055, z);
      dummy.rotation.set(rng.range(-0.06, 0.06), rng.range(0, 6.28), rng.range(-0.04, 0.04));
      dummy.scale.setScalar(rng.range(0.8, 1.15));
      dummy.updateMatrix();
      fallen.setMatrixAt(i, dummy.matrix);
    }
    fallen.instanceMatrix.needsUpdate = true;
    fallen.castShadow = false;
    group.add(fallen);
  }

  return group;
}
