import * as THREE from 'three';
import { PIN_HEIGHT } from '../util/units';
import type { Rng } from '../util/rng';
import { buildPinMaps } from '../textures/pinPaint';
import { pinRadiusAt } from './pinProfile';

export interface PinAssets {
  geometry: THREE.LatheGeometry;
  material: THREE.Material;
}

/** ピンのジオメトリ（実プロファイルの回転体、UVのvは高さに線形） */
export function buildPinAssets(rng: Rng, fast: boolean): PinAssets {
  const n = fast ? 32 : 72;
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  for (let i = 0; i <= n; i++) {
    const h = (i / n) * PIN_HEIGHT;
    pts.push(new THREE.Vector2(pinRadiusAt(h), h));
  }
  const geometry = new THREE.LatheGeometry(pts, fast ? 24 : 56);
  geometry.computeVertexNormals();

  const maps = buildPinMaps(rng, fast);
  const material = new THREE.MeshPhysicalMaterial({
    map: maps.map,
    roughnessMap: maps.roughnessMap,
    roughness: 1,
    metalness: 0,
    clearcoat: fast ? 0 : 0.65,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.9,
  });
  return { geometry, material };
}

/**
 * ピン1本のメッシュ。ラックされたピンの向きはまちまちなので
 * シード乱数でY回転をばらし、共有テクスチャでも個体差が出るようにする。
 */
export function makePinMesh(assets: PinAssets, rng: Rng, fast: boolean): THREE.Mesh {
  const mesh = new THREE.Mesh(assets.geometry, assets.material);
  mesh.rotation.y = rng() * Math.PI * 2;
  mesh.castShadow = !fast;
  mesh.receiveShadow = true;
  return mesh;
}
