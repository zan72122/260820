// たけのこ本体。皮が重なった円錐で、重さのある固まりとして作る。
import * as THREE from 'three';
import { huskTexture } from '../world/textures.js';
import { clamp } from '../core/rng.js';

export const TAKENOKO_HEIGHT = 0.33;   // 全長 33cm
export const TAKENOKO_RADIUS = 0.052;  // 根元の半径 5.2cm (直径 10cm ほど)

/** 根元(y=0)から先端(y=H)へ向かう半径 */
function radiusProfile(t) {
  // 根元はやや張り出し、中ほどでゆるく、先端は鋭く
  if (t < 0.08) return TAKENOKO_RADIUS * (0.86 + 0.14 * (t / 0.08) + 0.06);
  const u = (t - 0.08) / 0.92;
  return TAKENOKO_RADIUS * Math.pow(1 - u, 0.72) * (1 + 0.06 * Math.sin(u * 3.1));
}

export function createTakenoko(rng, { fast = false } = {}) {
  const group = new THREE.Group();
  group.name = 'takenoko';

  const H = TAKENOKO_HEIGHT;
  const radial = fast ? 12 : 22;
  const rings = fast ? 16 : 34;

  // --- 本体 ---
  const verts = [];
  const uvs = [];
  const cols = [];
  const idx = [];
  const c = new THREE.Color();
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const y = t * H;
    const r = radiusProfile(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      // 皮の重なりでできる細かい凹凸
      const wob = 1 + Math.sin(a * 6 + t * 9) * 0.012 + Math.sin(t * 26) * 0.008;
      verts.push(Math.cos(a) * r * wob, y, Math.sin(a) * r * wob);
      uvs.push(j / radial, t);
      // 土の中にあった根元にはうっすら土がつく(むらのある汚れ)
      const dirt = (1 - clamp((t - 0.05) / 0.5, 0, 1)) * (0.55 + 0.45 * Math.sin(a * 4.3 + t * 11));
      const k = 1 - dirt * 0.22;
      c.setRGB(k, k * (1 - dirt * 0.04), k * (1 - dirt * 0.09));
      cols.push(c.r, c.g, c.b);
    }
  }
  const stride = radial + 1;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * stride + j;
      const b = a + stride;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  bodyGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  bodyGeo.setIndex(idx);
  bodyGeo.computeVertexNormals();
  const bodyMat = new THREE.MeshStandardMaterial({
    map: huskTexture(),
    vertexColors: true,
    roughness: 0.82,
    metalness: 0.0,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = !fast;
  body.receiveShadow = !fast;
  group.add(body);

  // --- 重なった皮(外側にはみ出すふち) ---
  // 先へゆくほど濃く、根元はうすい黄土色。皮のふちだけがわずかに張り出す。
  const sheathCount = fast ? 5 : 9;
  const tipCol = new THREE.Color(0xbfae86);
  const baseCol = new THREE.Color(0xefe2c8);
  for (let i = 0; i < sheathCount; i++) {
    const t = 0.06 + (i / sheathCount) * 0.82;
    const rBot = radiusProfile(t) * 1.015;
    const rTop = radiusProfile(t + 0.075) * 1.032;
    const g = new THREE.CylinderGeometry(rTop, rBot, H * 0.075, fast ? 12 : 20, 1, true);
    // 皮のふちも本体と同じ高さの色を拾うように UV を合わせる。
    // そうしないと 1 枚ごとに全体のグラデーションが縮んで縞に見えてしまう。
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setY(k, t + uv.getY(k) * 0.075);
    uv.needsUpdate = true;
    const col = baseCol.clone().lerp(tipCol, THREE.MathUtils.smoothstep(t, 0.05, 0.88));
    const m = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({
        map: huskTexture(),
        color: col,
        roughness: 0.86,
        side: THREE.FrontSide,
        metalness: 0,
      })
    );
    m.position.y = t * H + H * 0.038;
    m.rotation.y = i * 2.399; // 黄金角でずらす = 自然な互い違い
    // 皮どうしが影を落としあうと縞模様が強く出すぎるので、影は本体だけ
    m.castShadow = false;
    group.add(m);
  }

  // --- 先端の葉先 ---
  const tipMat = new THREE.MeshStandardMaterial({ color: 0x3e4a22, roughness: 0.72, side: THREE.DoubleSide });
  const tipCount = fast ? 2 : 5;
  for (let i = 0; i < tipCount; i++) {
    const g = new THREE.ConeGeometry(0.008, 0.055, 5, 1, true);
    const m = new THREE.Mesh(g, tipMat);
    const a = (i / tipCount) * Math.PI * 2 + rng.range(-0.3, 0.3);
    m.position.set(Math.cos(a) * 0.008, H * 0.985 + 0.02, Math.sin(a) * 0.008);
    m.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35);
    group.add(m);
  }

  // --- 根元の根 (切る前だけ見える) ---
  const rootGroup = new THREE.Group();
  const rootMat = new THREE.MeshStandardMaterial({ color: 0x6b5334, roughness: 0.95 });
  const rootCount = fast ? 4 : 10;
  for (let i = 0; i < rootCount; i++) {
    const g = new THREE.ConeGeometry(0.006, rng.range(0.03, 0.075), 5);
    const m = new THREE.Mesh(g, rootMat);
    const a = (i / rootCount) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const r = TAKENOKO_RADIUS * rng.range(0.5, 0.95);
    m.position.set(Math.cos(a) * r, -0.012, Math.sin(a) * r);
    m.rotation.set(Math.cos(a) * 1.1, 0, -Math.sin(a) * 1.1);
    rootGroup.add(m);
  }
  group.add(rootGroup);

  // --- 切り口(切ったあとに出る明るいクリーム色の面) ---
  const cutGeo = new THREE.CircleGeometry(radiusProfile(0.02), fast ? 12 : 24);
  cutGeo.rotateX(Math.PI / 2);
  const cutMat = new THREE.MeshStandardMaterial({
    color: 0xf3ead2,
    roughness: 0.45,
    metalness: 0,
    emissive: 0x2a2418,
    emissiveIntensity: 0.35,
  });
  const cutFace = new THREE.Mesh(cutGeo, cutMat);
  cutFace.position.y = 0.001;
  cutFace.visible = false;
  group.add(cutFace);

  group.userData = {
    height: H,
    radius: TAKENOKO_RADIUS,
    body,
    cutFace,
    rootGroup,
    radiusAt: (y) => radiusProfile(clamp(y / H, 0, 1)),
    setCut(on) {
      cutFace.visible = on;
      rootGroup.visible = !on;
    },
  };
  return group;
}

/** かごの中に積む用の軽いコピー */
export function createTakenokoLite(rng) {
  const t = createTakenoko(rng, { fast: true });
  t.userData.setCut(true);
  return t;
}
