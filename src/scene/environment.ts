import * as THREE from 'three';
import { APPROACH_LENGTH, BALL_RADIUS, pinPositions } from '../util/units';
import { mulberry32, uniform, type Rng } from '../util/rng';
import { buildLane, LANE_PITCH } from './lane';
import { LANE_FULL_LENGTH } from '../textures/laneWood';
import { buildBall } from './ball';
import { makePinMesh, type PinAssets } from './pins';
import { colorTexture, makeCanvas } from '../textures/canvas';

/**
 * センターの環境: 隣接レーン・ボールリターン・天井と照明器具・
 * カーペット・奥壁・側壁。中景と遠景の文脈を作り、
 * 「照明器具が実在し、その光が現に当たっている」状態にする。
 */
export function buildCenterEnvironment(rng: Rng, fast: boolean, pinAssets: PinAssets): THREE.Group {
  const group = new THREE.Group();

  // ---- 隣接レーン（各側2本。テクスチャは別シードで生成し複製感を消す） ----
  const neighborOffsets = fast ? [] : [-2, -1, 1, 2];
  for (const k of neighborOffsets) {
    const laneRng = mulberry32(1000 + k * 77);
    // 遠景用: 低解像度テクスチャで十分（fast=trueで生成）。
    // レーン番号はボウラーから見て左→右へ増える（+x側が小さい番号）
    const nl = buildLane(laneRng, true, 7 - k);
    nl.group.position.x = k * LANE_PITCH;
    nl.group.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
    group.add(nl.group);
    for (const p of pinPositions()) {
      const pin = makePinMesh(pinAssets, laneRng, true);
      pin.position.set(p.x + k * LANE_PITCH, 0, p.z);
      pin.castShadow = false;
      group.add(pin);
    }
  }

  // ---- ボールリターン（右隣のレーン8との間、アプローチ上） ----
  if (!fast) group.add(buildBallReturn(rng));

  // ---- カーペット（アプローチ後方の待機エリア） ----
  const carpet = new THREE.Mesh(
    new THREE.PlaneGeometry(LANE_PITCH * 5.4, 4.6),
    new THREE.MeshStandardMaterial({
      map: buildCarpetMap(rng),
      roughness: 0.94,
      metalness: 0,
      envMapIntensity: 0.2,
    }),
  );
  carpet.geometry.rotateX(-Math.PI / 2);
  carpet.position.set(0, -0.001, -APPROACH_LENGTH - 2.3);
  group.add(carpet);

  // ---- 天井と照明器具 ----
  const ceilH = 3.35;
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x141317, roughness: 0.95 });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(LANE_PITCH * 5.4, 28), ceilMat);
  ceiling.geometry.rotateX(Math.PI / 2);
  ceiling.position.set(0, ceilH, 7);
  group.add(ceiling);

  // 灯具: レーンごとに列。手前は明るく、レーン奥は減光（実際の照明計画どおり）
  const fixtureGeo = new THREE.BoxGeometry(0.55, 0.05, 1.15);
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x232228, roughness: 0.6, metalness: 0.4 });
  for (let lx = -2; lx <= 2; lx++) {
    for (const [z, glow] of [
      [-4.2, 1.2],
      [-1.5, 1.2],
      [1.6, 0.95],
      [4.6, 0.65],
      [7.8, 0.45],
      [11.0, 0.3],
    ] as const) {
      const housing = new THREE.Mesh(fixtureGeo, housingMat);
      housing.position.set(lx * LANE_PITCH + uniform(rng, -0.05, 0.05), ceilH - 0.02, z);
      group.add(housing);
      const pane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, 0.95),
        new THREE.MeshStandardMaterial({
          color: 0x2a2118,
          roughness: 0.4,
          emissive: 0xffd9a6,
          emissiveIntensity: glow,
        }),
      );
      pane.geometry.rotateX(Math.PI / 2);
      pane.position.set(housing.position.x, ceilH - 0.051, z);
      group.add(pane);
    }
  }

  // ---- 奥壁（マスキング上部〜天井）と側壁 ----
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(LANE_PITCH * 5.4, ceilH - 1.3),
    new THREE.MeshStandardMaterial({ color: 0x1b2129, roughness: 0.92 }),
  );
  backWall.position.set(0, 1.3 + (ceilH - 1.3) / 2, LANE_FULL_LENGTH + 0.34);
  backWall.rotateY(Math.PI);
  group.add(backWall);

  const sideMat = new THREE.MeshStandardMaterial({ color: 0x16161a, roughness: 0.9 });
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, ceilH + 0.6), sideMat);
    wall.position.set(side * LANE_PITCH * 2.7, ceilH / 2, 8);
    wall.rotateY(side > 0 ? -Math.PI / 2 : Math.PI / 2);
    group.add(wall);
  }

  return group;
}

/** ボールリターンラック: フード＋レール＋待機ボール2球＋送風グリル */
function buildBallReturn(rng: Rng): THREE.Group {
  const g = new THREE.Group();
  const cx = -LANE_PITCH / 2; // レーン7と8（ボウラーの右隣）の中間
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0x26262b,
    roughness: 0.45,
    metalness: 0.15,
    envMapIntensity: 0.8,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xb9bcc0,
    roughness: 0.28,
    metalness: 0.9,
    envMapIntensity: 1.0,
  });

  // 本体（トラック部: 低い箱、上面にレール）
  const bodyLen = 2.1;
  const bodyZ = -2.85;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, bodyLen), shellMat);
  body.position.set(cx, 0.14, bodyZ);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // フード（先端の丸屋根: 半円筒）
  const hood = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.21, 0.42, 24, 1, false, 0, Math.PI),
    shellMat,
  );
  hood.rotation.z = Math.PI / 2;
  hood.rotation.y = Math.PI / 2;
  hood.position.set(cx, 0.28, bodyZ - bodyLen / 2 + 0.02);
  hood.castShadow = true;
  g.add(hood);
  // フード前面の送風グリル（ハンドドライヤー）
  const grill = new THREE.Mesh(
    new THREE.CircleGeometry(0.09, 24),
    new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.8 }),
  );
  grill.position.set(cx, 0.3, bodyZ - bodyLen / 2 - 0.191);
  g.add(grill);
  for (let i = 0; i < 4; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.14 - i * 0.02, 0.008, 0.004), chromeMat);
    slat.position.set(cx, 0.255 + i * 0.028, bodyZ - bodyLen / 2 - 0.193);
    g.add(slat);
  }

  // レール2本（ボールが載る）
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, bodyLen - 0.25, 12), chromeMat);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(cx + s * 0.085, 0.295, bodyZ + 0.1);
    g.add(rail);
  }

  // 待機ボール（色違い、指穴あり）
  const hues = [356, 130];
  hues.forEach((hue, i) => {
    const ball = buildBall(mulberry32(500 + i * 13), false, hue);
    ball.position.set(cx, 0.295 + BALL_RADIUS * 0.72, bodyZ + 0.35 + i * (BALL_RADIUS * 2 + 0.015));
    ball.rotation.set(uniform(rng, 0, 3), uniform(rng, 0, 3), uniform(rng, 0, 3));
    ball.castShadow = true;
    g.add(ball);
  });

  return g;
}

/** 待機エリアのカーペット（濃色ベースに細かなスペックル） */
function buildCarpetMap(rng: Rng): THREE.CanvasTexture {
  const c = makeCanvas(512, 512);
  const { ctx } = c;
  ctx.fillStyle = '#232032';
  ctx.fillRect(0, 0, 512, 512);
  const cols = ['#3a2f4e', '#552f3a', '#2c3a52', '#6b5a3a'];
  for (let i = 0; i < 4200; i++) {
    ctx.fillStyle = cols[Math.floor(uniform(rng, 0, cols.length))]!;
    ctx.globalAlpha = uniform(rng, 0.25, 0.7);
    ctx.beginPath();
    ctx.ellipse(
      uniform(rng, 0, 512),
      uniform(rng, 0, 512),
      uniform(rng, 0.6, 2.4),
      uniform(rng, 0.6, 2.4),
      uniform(rng, 0, 3),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const tex = colorTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 3);
  return tex;
}
