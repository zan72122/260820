// 臼・杵・手 -- 実寸ジオメトリ
import * as THREE from '../vendor/three.module.js';
import { lathe } from './env.js';

/* 木臼 (欅) 外径 0.67m / 内鉢 径 0.47m / 高さ 0.57m */
export function makeUsu(scene, mat) {
  const prof = [
    [0, 0], [0.352, 0], [0.358, 0.045], [0.336, 0.18], [0.325, 0.32],
    [0.342, 0.45], [0.356, 0.526], [0.357, 0.562], [0.330, 0.578],
    [0.276, 0.580], [0.252, 0.562], [0.244, 0.522], [0.238, 0.474],
    [0.224, 0.430], [0.192, 0.407], [0.132, 0.400], [0, 0.398],
  ];
  const m = new THREE.Mesh(lathe(prof, 56), mat);
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  // 割れ止めの縄
  const rope = new THREE.Mesh(new THREE.TorusGeometry(0.331, 0.018, 8, 44), mat);
  rope.rotation.x = Math.PI / 2; rope.position.y = 0.245;
  rope.castShadow = true; scene.add(rope);
  return m;
}

/* 縦杵 -- 原点は打面(頭の底) */
export function makeKine(scene, mat) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(lathe([
    [0, 0], [0.056, 0], [0.066, 0.022], [0.0705, 0.09], [0.0705, 0.20],
    [0.066, 0.272], [0.056, 0.30], [0, 0.30],
  ], 28), mat);
  head.castShadow = true; head.receiveShadow = true;
  g.add(head);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.0225, 0.0245, 1.00, 14), mat);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0, 0.238, 0);
  handle.castShadow = true;
  g.add(handle);
  for (const sx of [-1, 1]) {  // 握り端の膨らみ
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.027, 12, 10), mat);
    cap.position.set(sx * 0.498, 0.238, 0);
    cap.castShadow = true; g.add(cap);
  }
  scene.add(g);
  return g;
}

/* 手 (指先 +Z / 掌 -Y)。割烹着の袖付き */
export function makeArm(scene, opts = {}) {
  const { sleeveColor = 0xf6f3ea, skinColor = 0xdcaa88, scale = 1, withSleeve = true, sleeveR = 1, sleeveLen = 1 } = opts;
  const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.72, metalness: 0 });
  const cloth = new THREE.MeshStandardMaterial({ color: sleeveColor, roughness: 0.92 });
  const g = new THREE.Group();
  const hand = new THREE.Group();

  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), skin);
  palm.scale.set(0.046, 0.017, 0.052);
  palm.position.set(0, 0, 0.012);
  hand.add(palm);

  // 指 4本
  for (let i = 0; i < 4; i++) {
    const len = 0.056 - Math.abs(i - 1.2) * 0.006;
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0088, len * 0.60, 4, 8), skin);
    f.rotation.x = Math.PI / 2 - 0.30;
    f.position.set(-0.027 + i * 0.018, -0.006, 0.050 + len * 0.26);
    hand.add(f);
  }
  // 親指
  const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.0115, 0.030, 4, 8), skin);
  th.rotation.set(Math.PI / 2 - 0.35, 0, 0.95);
  th.position.set(-0.048, -0.004, 0.026);
  hand.add(th);
  // 手首
  const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(0.0245, 0.035, 4, 10), skin);
  wrist.rotation.x = Math.PI / 2;
  wrist.position.set(0, 0.001, -0.045);
  hand.add(wrist);

  g.add(hand);

  if (withSleeve) {
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.0265, 0.055, 4, 12), skin);
    fore.rotation.x = Math.PI / 2;
    fore.position.set(0, 0.002, -0.078);
    g.add(fore);
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.040 * sleeveR, 0.050 * sleeveR, 0.28 * sleeveLen, 16), cloth);
    sl.rotation.x = Math.PI / 2;
    sl.position.set(0, 0.004, -0.106 - 0.14 * sleeveLen);
    g.add(sl);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.039 * sleeveR, 0.0095, 7, 18), cloth);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.set(0, 0.003, -0.106);
    g.add(cuff);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.scale.setScalar(scale * 0.94);
  g.visible = false;
  scene.add(g);
  g.userData.hand = hand;
  return g;
}

/* 鏡餅の上に載せる橙 */
export function makeDaidai(scene) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.052, 20, 16),
    new THREE.MeshStandardMaterial({ color: 0xef8b16, roughness: 0.62 }));
  body.scale.set(1, 0.86, 1);
  g.add(body);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.007, 0.026, 6),
    new THREE.MeshStandardMaterial({ color: 0x5d7a2e, roughness: 0.9 }));
  stem.position.y = 0.052; g.add(stem);
  for (let i = 0; i < 2; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.030, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x3f6b28, roughness: 0.85, side: THREE.DoubleSide }));
    leaf.scale.set(0.42, 0.10, 1);
    leaf.position.set(Math.cos(i * 2.2) * 0.028, 0.056, Math.sin(i * 2.2) * 0.028);
    leaf.rotation.y = i * 2.2; leaf.rotation.z = 0.25;
    g.add(leaf);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.visible = false;
  scene.add(g);
  return g;
}
