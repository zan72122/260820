import * as THREE from 'three';
import { MaterialSet } from './materials';

/**
 * 病院と研究棟をつなぐ明るい屋内通路。
 * 扉線 z=0。手前(+z)が病院側ホール、奥(-z)が研究棟廊下。
 * 横切り廊下は z≈2.6 を x 方向に走る(床の摩耗導線で示す)。
 */
export function buildEnvironment(mats: MaterialSet): THREE.Group {
  const g = new THREE.Group();
  g.name = 'environment';

  // ---- 床(病院側 + 研究棟側を1枚で) ----
  const floorGeo = new THREE.PlaneGeometry(18, 20);
  floorGeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeo, mats.floor);
  floor.position.set(0, 0, 0.5);
  // 8m 周期のテクスチャをワールドへ割り付け
  const uv = floorGeo.attributes.uv as THREE.BufferAttribute;
  const posAttr = floorGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (posAttr.getX(i) + 0) / 8, (posAttr.getZ(i) + 0.5) / 8);
  }
  uv.needsUpdate = true;
  floor.receiveShadow = true;
  g.add(floor);

  // 病院側ホールはやや高い天井(俯瞰ショットも室内に収まる)
  const wallH = 4.0;

  // ---- 扉のある壁(z=0)。開口部 x∈[-2.72, 2.72] ----
  const mkWall = (w: number, h: number, x: number, y: number, z: number, ry = 0): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.16), mats.wall);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    m.castShadow = true;
    g.add(m);
    return m;
  };
  mkWall(6.3, wallH, -5.87, wallH / 2, 0);
  mkWall(6.3, wallH, 5.87, wallH / 2, 0);
  // 開口上の壁(無目より上)
  const overhead = new THREE.Mesh(new THREE.BoxGeometry(5.45, wallH - 2.46, 0.16), mats.wall);
  overhead.position.set(0, 2.46 + (wallH - 2.46) / 2, 0);
  overhead.castShadow = true;
  g.add(overhead);

  // 幅木と腰ガード(病院らしい細部)
  for (const side of [-1, 1]) {
    const guard = new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.18, 0.03), mats.wallGuard);
    guard.position.set(5.87 * side, 0.85, 0.095);
    g.add(guard);
    const base = new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.1, 0.02), mats.wallGuard);
    base.position.set(5.87 * side, 0.05, 0.09);
    g.add(base);
  }

  // ---- 病院側ホールの壁 ----
  mkWall(10, wallH, -9, wallH / 2, 5.5, Math.PI / 2); // 左壁
  // 右壁: 外光の入る窓帯
  const rightWallLow = new THREE.Mesh(new THREE.BoxGeometry(10, 1.0, 0.16), mats.wall);
  rightWallLow.rotation.y = Math.PI / 2;
  rightWallLow.position.set(9, 0.5, 5.5);
  g.add(rightWallLow);
  const rightWallHigh = new THREE.Mesh(new THREE.BoxGeometry(10, wallH - 3.1, 0.16), mats.wall);
  rightWallHigh.rotation.y = Math.PI / 2;
  rightWallHigh.position.set(9, 3.1 + (wallH - 3.1) / 2, 5.5);
  g.add(rightWallHigh);
  // 窓ガラス(外光)
  const winGlass = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.1), mats.glass);
  winGlass.rotation.y = -Math.PI / 2;
  winGlass.position.set(9, 2.05, 5.5);
  g.add(winGlass);
  // 窓框
  for (let i = 0; i <= 5; i++) {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.1, 0.06), mats.aluminum);
    mullion.position.set(9, 2.05, 0.5 + i * 2);
    g.add(mullion);
  }
  // 外の明るさ(窓の向こうの白)
  const outside = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 5),
    new THREE.MeshBasicMaterial({ color: 0xf4f7f4 }),
  );
  outside.rotation.y = -Math.PI / 2;
  outside.position.set(9.6, 2.2, 5.5);
  g.add(outside);

  // 後壁(カメラ後方の保険)
  mkWall(18, wallH, 0, wallH / 2, 10.4);

  // ---- 病院側の天井と照明パネル ----
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(18, 0.1, 10.5), mats.ceiling);
  ceil.position.set(0, wallH + 0.05, 5.25);
  g.add(ceil);
  const panelMat = new THREE.MeshBasicMaterial({ color: 0xf2f1ea });
  for (let ix = -2; ix <= 2; ix++) {
    for (let iz = 0; iz < 4; iz++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), panelMat);
      p.rotation.x = Math.PI / 2;
      p.position.set(ix * 3.2 + 0.4, wallH - 0.005, 1.6 + iz * 2.3);
      g.add(p);
    }
  }
  // 天井設備: 空調吹出口・スプリンクラー
  for (const [x, z] of [
    [-4.2, 3.4],
    [3.8, 6.2],
  ] as const) {
    const diff = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), mats.aluminumDark);
    diff.position.set(x, wallH - 0.03, z);
    g.add(diff);
  }

  // 吊り下げサイン(横切り廊下の存在を示す)
  const sign = makeSign();
  sign.position.set(-3.0, 2.55, 2.6);
  g.add(sign);

  // ---- 研究棟側(扉の向こう、遠景) ----
  const lab = new THREE.Group();
  // 廊下側壁
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.7, 8), mats.wall);
    w.position.set(2.55 * side, 1.35, -4);
    lab.add(w);
  }
  // 低い天井 + 蛍光灯
  const labCeil = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.1, 8), mats.ceiling);
  labCeil.position.set(0, 2.75, -4);
  lab.add(labCeil);
  for (let i = 0; i < 3; i++) {
    const lp = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 1.4), panelMat);
    lp.rotation.x = Math.PI / 2;
    lp.position.set(0, 2.69, -1.6 - i * 2.4);
    lab.add(lp);
  }
  // 突き当たり: 受付カウンターと奥の明かり
  const farWall = new THREE.Mesh(
    new THREE.BoxGeometry(5.3, 2.7, 0.15),
    new THREE.MeshStandardMaterial({ color: 0xcfc9be, roughness: 0.9 }),
  );
  farWall.position.set(0, 1.35, -8);
  lab.add(farWall);
  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 1.05, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x9a8c76, roughness: 0.7 }),
  );
  desk.position.set(-0.6, 0.525, -7.2);
  lab.add(desk);
  // 別の人のシルエット(遠景、動かない)
  const silhouetteMat = new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 1 });
  for (const [x, z, h] of [
    [-1.1, -6.9, 1.62],
    [1.5, -7.4, 1.7],
  ] as const) {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.16, h - 0.75, 4, 8),
      silhouetteMat,
    );
    body.position.set(x, (h - 0.3) / 2 + 0.05, z);
    lab.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), silhouetteMat);
    head.position.set(x, h - 0.1, z);
    lab.add(head);
  }
  // 廊下床の続き(同じ床材)
  g.add(lab);

  // ---- 近くの調度(ベンチ・植栽) ----
  const bench = new THREE.Group();
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.08, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x7a6a52, roughness: 0.65 }),
  );
  seat.position.y = 0.45;
  seat.castShadow = true;
  bench.add(seat);
  for (const sx of [-0.75, 0.75]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.4), mats.steel);
    leg.position.set(sx, 0.225, 0);
    bench.add(leg);
  }
  bench.position.set(-4.6, 0, 1.1);
  g.add(bench);

  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.18, 0.4, 12),
    new THREE.MeshStandardMaterial({ color: 0x6e6e6e, roughness: 0.8 }),
  );
  pot.position.set(4.4, 0.2, 0.9);
  pot.castShadow = true;
  g.add(pot);
  const plant = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x40603c, roughness: 1 }),
  );
  plant.scale.y = 1.4;
  plant.position.set(4.4, 0.85, 0.9);
  g.add(plant);

  return g;
}

function makeSign(): THREE.Group {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#3d4a54';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#eef0ee';
  ctx.font = 'bold 52px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('← がいらい', 24, 64);
  ctx.textAlign = 'right';
  ctx.fillText('けんきゅうとう ↑', 496, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Group();
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.4, 0.04),
    [
      new THREE.MeshStandardMaterial({ color: 0x3d4a54 }),
      new THREE.MeshStandardMaterial({ color: 0x3d4a54 }),
      new THREE.MeshStandardMaterial({ color: 0x3d4a54 }),
      new THREE.MeshStandardMaterial({ color: 0x3d4a54 }),
      new THREE.MeshStandardMaterial({ map: tex }),
      new THREE.MeshStandardMaterial({ map: tex }),
    ],
  );
  sign.add(board);
  for (const sx of [-0.6, 0.6]) {
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 1.25, 6),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.4 }),
    );
    rod.position.set(sx, 0.82, 0);
    sign.add(rod);
  }
  return sign;
}
