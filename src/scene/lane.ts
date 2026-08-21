import * as THREE from 'three';
import {
  APPROACH_LENGTH,
  GUTTER_DEPTH,
  GUTTER_WIDTH,
  LANE_LENGTH,
  LANE_WIDTH,
} from '../util/units';
import type { Rng } from '../util/rng';
import { buildLaneMaps, LANE_FULL_LENGTH } from '../textures/laneWood';
import { buildApproachMaps } from '../textures/approachWood';
import { buildMaskingMaps } from '../textures/masking';

/** ガター断面: 幅9.3125in・深さ1.875inの円弧。rim が y=0 に一致する */
function gutterSection(): { R: number; theta: number; cy: number } {
  const w = GUTTER_WIDTH / 2;
  const s = GUTTER_DEPTH;
  const R = (s * s + w * w) / (2 * s);
  const theta = Math.asin(w / R);
  return { R, theta, cy: R - s };
}

function makeGutterGeometry(length: number): THREE.BufferGeometry {
  const { R, theta, cy } = gutterSection();
  const across = 18;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= 1; j++) {
    const z = j * length;
    for (let i = 0; i <= across; i++) {
      const phi = -theta + (2 * theta * i) / across;
      const x = R * Math.sin(phi);
      const y = cy - R * Math.cos(phi);
      positions.push(x, y, z);
      // 凹面の内側法線（円中心 (0, cy) へ向く）
      normals.push(-Math.sin(phi), Math.cos(phi), 0);
      uvs.push(i / across, j);
    }
  }
  for (let i = 0; i < across; i++) {
    const a = i;
    const b = i + 1;
    const c = across + 1 + i;
    const d = across + 1 + i + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

/** ガター手前の端面（円弧と水平線で囲まれた欠円） */
function makeGutterCapGeometry(): THREE.ShapeGeometry {
  const { R, theta, cy } = gutterSection();
  const shape = new THREE.Shape();
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const phi = -theta + (2 * theta * i) / n;
    const x = R * Math.sin(phi);
    const y = cy - R * Math.cos(phi);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape, 1);
}

/** 仕切り幅 10.5in。レーンピッチ = LANE_WIDTH + 2*GUTTER_WIDTH + CAPPING_WIDTH */
export const CAPPING_WIDTH = 10.5 * 0.0254;
export const LANE_PITCH = LANE_WIDTH + 2 * GUTTER_WIDTH + CAPPING_WIDTH;

export interface LaneBuild {
  group: THREE.Group;
  /** 物理コライダー生成に使う寸法情報 */
  dims: {
    laneFullLength: number;
    gutterCenterOffset: number;
  };
}

export function buildLane(rng: Rng, fast: boolean, laneNo = 7): LaneBuild {
  const group = new THREE.Group();
  const laneMaps = buildLaneMaps(rng, fast);
  const approachMaps = buildApproachMaps(rng, fast);

  // ---- レーン面 ----
  const laneMat = new THREE.MeshPhysicalMaterial({
    map: laneMaps.map,
    roughnessMap: laneMaps.roughnessMap,
    roughness: 1,
    metalness: 0,
    clearcoat: fast ? 0 : 0.55,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.9,
  });
  const laneTop = new THREE.Mesh(
    new THREE.PlaneGeometry(LANE_WIDTH, LANE_FULL_LENGTH),
    laneMat,
  );
  laneTop.geometry.rotateX(-Math.PI / 2);
  laneTop.position.set(0, 0, LANE_FULL_LENGTH / 2);
  laneTop.receiveShadow = true;
  group.add(laneTop);

  // レーン土台（ガター越しに見える側面）
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x241a10, roughness: 0.85 });
  const laneBase = new THREE.Mesh(
    new THREE.BoxGeometry(LANE_WIDTH, 0.09, LANE_FULL_LENGTH),
    baseMat,
  );
  laneBase.position.set(0, -0.046, LANE_FULL_LENGTH / 2);
  group.add(laneBase);

  // ---- アプローチ ----
  const approachMat = new THREE.MeshStandardMaterial({
    map: approachMaps.map,
    roughnessMap: approachMaps.roughnessMap,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.5,
  });
  const approach = new THREE.Mesh(
    new THREE.PlaneGeometry(LANE_WIDTH + GUTTER_WIDTH * 2 + 0.6, APPROACH_LENGTH),
    approachMat,
  );
  approach.geometry.rotateX(-Math.PI / 2);
  approach.position.set(0, 0, -APPROACH_LENGTH / 2);
  approach.receiveShadow = true;
  group.add(approach);

  // ---- ガター ----
  const gutterMat = new THREE.MeshStandardMaterial({
    color: 0x141414,
    roughness: 0.42,
    metalness: 0,
    envMapIntensity: 0.7,
  });
  const gutterCenterOffset = LANE_WIDTH / 2 + GUTTER_WIDTH / 2;
  const gutterLen = LANE_LENGTH - 0.95;
  const gutterGeo = makeGutterGeometry(gutterLen);
  const capGeo = makeGutterCapGeometry();
  for (const side of [-1, 1]) {
    const g = new THREE.Mesh(gutterGeo, gutterMat);
    g.position.set(side * gutterCenterOffset, 0, 0);
    g.receiveShadow = true;
    group.add(g);
    const cap = new THREE.Mesh(capGeo, gutterMat);
    cap.position.set(side * gutterCenterOffset, 0, 0);
    cap.rotateY(Math.PI); // 手前向き
    group.add(cap);
    // ピンデッキ脇の平坦ガター
    const flat = new THREE.Mesh(
      new THREE.BoxGeometry(GUTTER_WIDTH, 0.012, LANE_FULL_LENGTH - gutterLen + 0.35),
      gutterMat,
    );
    flat.position.set(
      side * gutterCenterOffset,
      -GUTTER_DEPTH,
      gutterLen + (LANE_FULL_LENGTH - gutterLen + 0.35) / 2,
    );
    group.add(flat);
  }

  // ---- 仕切りキャッピング（実寸: レーンピッチ=レーン+ガター2+仕切り10.5in） ----
  const capMat = new THREE.MeshStandardMaterial({
    color: 0x35281c,
    roughness: 0.42,
    envMapIntensity: 0.7,
  });
  const capW = CAPPING_WIDTH;
  for (const side of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(capW, 0.03, LANE_FULL_LENGTH), capMat);
    strip.position.set(
      side * (LANE_WIDTH / 2 + GUTTER_WIDTH + capW / 2),
      -0.012,
      LANE_FULL_LENGTH / 2,
    );
    strip.receiveShadow = true;
    group.add(strip);
  }

  // ---- キックバック（ピンデッキ側壁） ----
  const kickMat = new THREE.MeshStandardMaterial({
    color: 0x1c1c1f,
    roughness: 0.38,
    envMapIntensity: 0.9,
  });
  const kickStart = LANE_LENGTH - 0.72;
  const kickLen = LANE_FULL_LENGTH - kickStart + 0.45;
  for (const side of [-1, 1]) {
    const kick = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.5, kickLen), kickMat);
    kick.position.set(side * (LANE_WIDTH / 2 + 0.045), 0.25 - GUTTER_DEPTH, kickStart + kickLen / 2);
    kick.castShadow = !fast;
    kick.receiveShadow = true;
    group.add(kick);
  }

  // ---- ピット（奥の暗幕）と床 ----
  const pitMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.96 });
  const pit = new THREE.Mesh(
    new THREE.PlaneGeometry(LANE_WIDTH + GUTTER_WIDTH * 2 + 0.7, 0.8),
    pitMat,
  );
  pit.position.set(0, 0.4 - GUTTER_DEPTH, LANE_FULL_LENGTH + 0.32);
  pit.rotateY(Math.PI);
  group.add(pit);

  // ---- マスキングユニット ----
  const maskingMaps = buildMaskingMaps(rng, fast, laneNo);
  const maskingMat = new THREE.MeshStandardMaterial({
    map: maskingMaps.map,
    roughnessMap: maskingMaps.roughnessMap,
    roughness: 1,
    metalness: 0.25,
    envMapIntensity: 0.8,
  });
  const maskingW = LANE_WIDTH + GUTTER_WIDTH * 2 + 0.7;
  const masking = new THREE.Mesh(new THREE.PlaneGeometry(maskingW, 0.92), maskingMat);
  masking.position.set(0, 0.46 + 0.46, LANE_FULL_LENGTH + 0.18);
  masking.rotateY(Math.PI);
  group.add(masking);
  // マスキング下端の縁金物
  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(maskingW, 0.03, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.35, metalness: 0.7 }),
  );
  lip.position.set(0, 0.455, LANE_FULL_LENGTH + 0.19);
  group.add(lip);

  return {
    group,
    dims: { laneFullLength: LANE_FULL_LENGTH, gutterCenterOffset },
  };
}
