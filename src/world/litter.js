// 落ち葉・小枝・小石・苔。地面の情報量と「なにか埋まってそう」の下地になる。
import * as THREE from 'three';
import { heightAt, groundNormalAt } from './ground.js';
import { leafTexture, radialTexture } from './textures.js';

export function leafMaterial(kind) {
  return new THREE.MeshStandardMaterial({
    map: leafTexture(kind),
    transparent: false,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
    roughness: kind === 'wet' ? 0.55 : 0.95,
    metalness: 0,
  });
}

/**
 * 地面に伏せた落ち葉を1枚ぶんの姿勢で置く
 */
export function layLeaf(dummy, x, z, rng, size = 1, lift = 0.012) {
  const n = groundNormalAt(x, z);
  dummy.position.set(x, heightAt(x, z) + lift + rng.range(0, 0.012), z);
  dummy.up.set(0, 1, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  const spin = new THREE.Quaternion().setFromAxisAngle(n, rng.range(0, Math.PI * 2));
  const tilt = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(rng.range(-1, 1), 0, rng.range(-1, 1)).normalize(),
    rng.range(-0.32, 0.32)
  );
  dummy.quaternion.copy(tilt).multiply(spin).multiply(q);
  const s = size * rng.range(0.7, 1.25);
  dummy.scale.set(s * 0.092, s * 0.092, s * 0.092);
  dummy.updateMatrix();
}

export function createLitter(rng, opts = {}) {
  const fast = !!opts.fast;
  // 掘る場所の近くは、その場所が持つ落ち葉にまかせる。
  // 接写のときに大きな葉がレンズの前に立ちはだかるのを防ぐ。
  const avoid = opts.avoid || [];
  const blocked = (x, z) => {
    for (const a of avoid) if (Math.hypot(x - a.x, z - a.z) < a.r) return true;
    return false;
  };
  const group = new THREE.Group();
  group.name = 'litter';
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  const layers = [
    // 手元は落ち葉のじゅうたん。竹林の地面はほとんど葉でできている
    { kind: 'dry', count: fast ? 400 : 3200, rMax: 9, size: 1.0 },
    { kind: 'wet', count: fast ? 200 : 1500, rMax: 8, size: 1.05 },
    { kind: 'dry', count: fast ? 260 : 1800, rMax: 18, rMin: 8, size: 1.15 },
    { kind: 'dry', count: fast ? 200 : 1100, rMax: 34, rMin: 17, size: 1.35 },
  ];
  const geo = new THREE.PlaneGeometry(1, 1);
  for (const L of layers) {
    const inst = new THREE.InstancedMesh(geo, leafMaterial(L.kind), L.count);
    inst.receiveShadow = !fast;
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < L.count; i++) inst.setMatrixAt(i, hidden);
    let placed = 0;
    for (let i = 0; i < L.count; i++) {
      const a = rng.range(0, Math.PI * 2);
      const rMin = L.rMin || 0.6;
      const r = Math.sqrt(rng()) * (L.rMax - rMin) + rMin;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 2;
      if (blocked(x, z)) continue;
      placed = i + 1;
      layLeaf(dummy, x, z, rng, L.size);
      inst.setMatrixAt(i, dummy.matrix);
      const k = rng.range(0.72, 1.2);
      color.setRGB(k, k * rng.range(0.94, 1.02), k * rng.range(0.86, 1.0));
      inst.setColorAt(i, color);
    }
    void placed;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
  }

  // 小枝
  const twigGeo = new THREE.CylinderGeometry(0.008, 0.011, 0.34, 5);
  twigGeo.rotateZ(Math.PI / 2);
  const twigCount = fast ? 30 : 170;
  const twigs = new THREE.InstancedMesh(
    twigGeo,
    new THREE.MeshStandardMaterial({ color: 0x6d5a3c, roughness: 0.96 }),
    twigCount
  );
  twigs.castShadow = !fast;
  twigs.receiveShadow = !fast;
  for (let i = 0; i < twigCount; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng()) * 16 + 0.8;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r - 2;
    if (blocked(x, z)) { twigs.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); continue; }
    dummy.position.set(x, heightAt(x, z) + 0.012, z);
    dummy.rotation.set(rng.range(-0.15, 0.15), rng.range(0, 6.28), rng.range(-0.12, 0.12));
    dummy.scale.set(rng.range(0.7, 1.9), rng.range(0.8, 1.3), rng.range(0.8, 1.3));
    dummy.updateMatrix();
    twigs.setMatrixAt(i, dummy.matrix);
  }
  twigs.instanceMatrix.needsUpdate = true;
  group.add(twigs);

  // 小石
  const stoneGeo = new THREE.IcosahedronGeometry(0.05, 0);
  const stoneCount = fast ? 20 : 90;
  const stones = new THREE.InstancedMesh(
    stoneGeo,
    new THREE.MeshStandardMaterial({ color: 0x6b6458, roughness: 0.92 }),
    stoneCount
  );
  stones.castShadow = !fast;
  stones.receiveShadow = !fast;
  for (let i = 0; i < stoneCount; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng()) * 15 + 0.8;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r - 2;
    if (blocked(x, z)) { stones.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); continue; }
    dummy.position.set(x, heightAt(x, z) + 0.018, z);
    dummy.rotation.set(rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28));
    dummy.scale.set(rng.range(0.5, 1.6), rng.range(0.4, 0.9), rng.range(0.5, 1.6));
    dummy.updateMatrix();
    stones.setMatrixAt(i, dummy.matrix);
    const k = rng.range(0.7, 1.15);
    color.setRGB(k, k, k * 0.96);
    stones.setColorAt(i, color);
  }
  stones.instanceMatrix.needsUpdate = true;
  if (stones.instanceColor) stones.instanceColor.needsUpdate = true;
  group.add(stones);

  // 苔のパッチ(地面に貼りつく円盤)
  if (!fast) {
    const mossGeo = new THREE.CircleGeometry(0.5, 12);
    mossGeo.rotateX(-Math.PI / 2);
    const mossMat = new THREE.MeshStandardMaterial({
      color: 0x46603a,
      map: radialTexture('rgba(126,150,98,0.62)', 'rgba(108,132,86,0)', 3.0),
      transparent: true,
      depthWrite: false,
      roughness: 0.98,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const mossCount = 34;
    const moss = new THREE.InstancedMesh(mossGeo, mossMat, mossCount);
    for (let i = 0; i < mossCount; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = Math.sqrt(rng()) * 18 + 0.9;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 2;
      dummy.position.set(x, heightAt(x, z) + 0.006, z);
      dummy.rotation.set(0, rng.range(0, 6.28), 0);
      dummy.scale.set(rng.range(0.35, 0.95), 1, rng.range(0.35, 0.95));
      dummy.updateMatrix();
      moss.setMatrixAt(i, dummy.matrix);
      const k = rng.range(0.6, 1.0);
      color.setRGB(k * 0.92, k, k * 0.78);
      moss.setColorAt(i, color);
    }
    moss.instanceMatrix.needsUpdate = true;
    if (moss.instanceColor) moss.instanceColor.needsUpdate = true;
    group.add(moss);
  }

  return group;
}
