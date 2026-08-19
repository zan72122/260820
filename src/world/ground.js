// 竹林の地面。ゆるい斜面 + うねり + 掘り跡のための局所的なふくらみ。
import * as THREE from 'three';
import { fbm2, clamp, smoothstep } from '../core/rng.js';
import { groundTexture, groundNormalTexture } from './textures.js';

export const GROUND_SIZE = 80;
const SEG = 132;

/** 世界座標の地形高さ。配置・レイキャスト補正・掘り跡の基準にすべてこれを使う */
export function heightAt(x, z) {
  // 奥に向かってゆるく上がる斜面(竹林らしい傾斜)
  const slope = -z * 0.055 + x * 0.018;
  const big = fbm2(x * 0.035 + 10, z * 0.035 - 4, 3) * 1.35;
  const mid = fbm2(x * 0.12 + 3, z * 0.12 + 7, 3) * 0.28;
  const small = fbm2(x * 0.52 - 8, z * 0.52 + 2, 2) * 0.055;
  // プレイヤーの立つあたりは平らにしておく(遊びやすさ)
  const flat = 1 - smoothstep(2.5, 11.0, Math.hypot(x, z + 1.5)) * 0.62;
  return slope + big * (1 - 0.55 * (1 - flat)) + mid * flat + small;
}

export function groundNormalAt(x, z, e = 0.25) {
  const hL = heightAt(x - e, z);
  const hR = heightAt(x + e, z);
  const hD = heightAt(x, z - e);
  const hU = heightAt(x, z + e);
  return new THREE.Vector3(hL - hR, 2 * e, hD - hU).normalize();
}

export function createGround(opts = {}) {
  const bumps = opts.bumps || []; // {x,z,radius,height}
  const geo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    let y = heightAt(x, z);
    for (const b of bumps) {
      const d = Math.hypot(x - b.x, z - b.z);
      if (d < b.radius) {
        // なめらかなふくらみ = 「なにか埋まっているかも」の手がかり
        y += b.height * Math.pow(Math.cos((d / b.radius) * Math.PI * 0.5), 2);
      }
    }
    pos.setY(i, y);
    // 頂点色で大きなスケールの湿り気・苔・落ち葉の粗密を出す
    const damp = smoothstep(0.3, 0.8, fbm2(x * 0.09 + 41, z * 0.09 - 17, 3) * 0.5 + 0.5);
    const litter = smoothstep(0.32, 0.85, fbm2(x * 0.17 - 23, z * 0.17 + 61, 3) * 0.5 + 0.5);
    const mossy = smoothstep(0.55, 0.95, fbm2(x * 0.24 + 7, z * 0.24 + 3, 2) * 0.5 + 0.5) * damp;
    const r = clamp(0.80 - damp * 0.34 + litter * 0.34, 0.25, 1.35);
    const g = clamp(0.80 - damp * 0.30 + litter * 0.26 + mossy * 0.20, 0.25, 1.35);
    const b2 = clamp(0.78 - damp * 0.36 + litter * 0.14 + mossy * 0.05, 0.20, 1.35);
    c.setRGB(r, g, b2);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    map: groundTexture(26),
    normalMap: groundNormalTexture(26),
    normalScale: new THREE.Vector2(0.9, 0.9),
    vertexColors: true,
    roughness: 0.97,
    metalness: 0.0,
    color: 0xe4ded1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'ground';
  mesh.receiveShadow = true;
  mesh.userData.isGround = true;
  return mesh;
}
