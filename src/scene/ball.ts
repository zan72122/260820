import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { BALL_RADIUS, IN } from '../util/units';
import type { Rng } from '../util/rng';
import { buildBallMaps } from '../textures/ballSurface';

/**
 * ハウスボール。指穴3つはCSGで実際に開ける（どの角度から見ても実ジオメトリ）。
 * グリップ中心を +Y 極付近に置き、穴はボール中心へ向けて掘る。
 */
export function buildBall(rng: Rng, fast: boolean, baseHue?: number): THREE.Mesh {
  const maps = buildBallMaps(rng, fast, baseHue);
  const ballMat = new THREE.MeshPhysicalMaterial({
    map: maps.map,
    roughnessMap: maps.roughnessMap,
    roughness: 1,
    metalness: 0,
    clearcoat: fast ? 0 : 0.8,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.0,
  });
  // 穴の内壁: 掘りっぱなしの樹脂（艶なし・暗い）
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x101018, roughness: 0.9, metalness: 0 });

  const sphereGeo = new THREE.SphereGeometry(BALL_RADIUS, fast ? 32 : 96, fast ? 24 : 64);
  const ballBrush = new Brush(sphereGeo, ballMat);
  ballBrush.updateMatrixWorld();

  const evaluator = new Evaluator();
  evaluator.useGroups = true;

  // 標準的なコンベンショナルグリップ配置（インチ）:
  // 指穴2つ(径7/8in)が横に約1.2in間隔、サム穴(径1in)は指穴中心から約4.3in下
  const fingerR = (0.875 / 2) * IN;
  const thumbR = (1.0 / 2) * IN;
  const holeDepth = 1.6 * IN;
  const span = 4.3 * IN; // サム-指のスパン（球面弦長ベースの近似）

  interface HoleSpec {
    r: number;
    // グリップ中心(+Y極)からの球面上オフセット角
    dPolar: number; // 前後（+で-Z側=サム方向）
    dAzimuth: number; // 左右
  }
  const spanAngle = span / BALL_RADIUS;
  const fingerSep = (1.9 * IN) / BALL_RADIUS;
  const holes: HoleSpec[] = [
    { r: fingerR, dPolar: -spanAngle * 0.35, dAzimuth: -fingerSep / 2 },
    { r: fingerR, dPolar: -spanAngle * 0.35, dAzimuth: fingerSep / 2 },
    { r: thumbR, dPolar: spanAngle * 0.65, dAzimuth: 0.02 },
  ];

  let result = ballBrush;
  for (const spec of holes) {
    const cyl = new THREE.CylinderGeometry(spec.r, spec.r * 0.96, holeDepth * 2, fast ? 12 : 24);
    const brush = new Brush(cyl, holeMat);
    // 球面上の位置: +Y極から前後(dPolar: z軸回り? 前後=X軸回転)・左右(Z軸回転)にずらす
    const dir = new THREE.Vector3(0, 1, 0)
      .applyAxisAngle(new THREE.Vector3(1, 0, 0), spec.dPolar)
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), spec.dAzimuth)
      .normalize();
    // シリンダ（高さ 2*holeDepth）の中心を球面上に置く → 表面から holeDepth の深さまで掘れる
    brush.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    brush.position.copy(dir.clone().multiplyScalar(BALL_RADIUS));
    brush.updateMatrixWorld();
    result = evaluator.evaluate(result, brush, SUBTRACTION);
  }

  const mesh = result;
  mesh.castShadow = !fast;
  mesh.receiveShadow = true;
  return mesh;
}
