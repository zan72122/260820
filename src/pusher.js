// ---------------------------------------------------------------------------
// 玉押し（ラムネに付いてくる、あの樹脂の押し具）。
// 「これは押すものだ」と言葉なしで伝えるのはこの形だけ。
// スカートの裏が瓶口のリムに当たるまで、ちょうど 6mm 沈むように作ってある。
// ---------------------------------------------------------------------------
import * as THREE from '../vendor/three/three.module.min.js';

export const PUSH_TRAVEL = 0.006; // 沈み込む量（m）

export function buildPusher(color = 0x2f9fd0) {
  const pts = [];
  const P = (r, y) => pts.push(new THREE.Vector2(r, y));
  // 原点 = 押しピンの先端
  P(0.0000, 0.0000);
  P(0.0040, 0.0000);
  P(0.0054, 0.0006);
  P(0.0057, 0.0070);
  P(0.0060, 0.0083); // ここから下が瓶口に入る
  P(0.0165, 0.0083); // 瓶のリムに当たるスカート
  P(0.0168, 0.0098);
  P(0.0150, 0.0112);
  P(0.0092, 0.0126);
  P(0.0090, 0.0250);
  P(0.0104, 0.0262);
  P(0.0126, 0.0276);
  P(0.0128, 0.0316);
  P(0.0118, 0.0338);
  P(0.0080, 0.0350);
  P(0.0000, 0.0356);

  const geo = new THREE.LatheGeometry(pts, 28);
  geo.computeVertexNormals();

  const mat = new THREE.MeshPhysicalMaterial({
    color, metalness: 0, roughness: 0.34,
    clearcoat: 0.8, clearcoatRoughness: 0.18,
    envMapIntensity: 1.1, sheen: 0.3, sheenColor: new THREE.Color(0xffffff),
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  group.userData.material = mat;
  return group;
}
