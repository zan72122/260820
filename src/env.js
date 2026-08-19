// 古民家の土間 -- 近景(臼・杵) / 中景(蒸籠・のし板) / 遠景(冬の庭)
// 寸法はすべて実寸(メートル)。原点は臼の中心・床面。
import * as THREE from '../vendor/three.module.js';
import * as TEX from './textures.js';

const V2 = (x, y) => new THREE.Vector2(x, y);

export function lathe(pts, seg = 48) {
  return new THREE.LatheGeometry(pts.map(p => V2(p[0], p[1])), seg);
}

/* 冬の空 (equirect) -- 背景と環境光の両方に使う */
export function skyTexture() {
  const w = 1024, h = 512;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.00, '#5d7f9f');
  g.addColorStop(0.34, '#9db6c9');
  g.addColorStop(0.52, '#d6dee2');
  g.addColorStop(0.58, '#e8e0d2');
  g.addColorStop(0.72, '#b8b2a6');
  g.addColorStop(1.00, '#6e6a60');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // 低い冬の陽 (北西寄り)
  const sx = w * 0.70, sy = h * 0.545;
  const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, 210);
  sun.addColorStop(0, 'rgba(255,241,214,0.98)');
  sun.addColorStop(0.16, 'rgba(255,226,178,0.62)');
  sun.addColorStop(0.45, 'rgba(255,214,168,0.20)');
  sun.addColorStop(1, 'rgba(255,214,168,0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);
  // うすい雲
  const noise = TEX.makeValueNoise(11);
  const img = ctx.getImageData(0, 0, w, h);
  for (let y = 0; y < h * 0.55; y++) {
    for (let x = 0; x < w; x++) {
      const n = TEX.fbm(noise, x / w * 6, y / h * 6, 5);
      const a = Math.max(0, n - 0.48) * 1.5 * (1 - y / (h * 0.55));
      const i = (y * w + x) * 4;
      img.data[i] += (238 - img.data[i]) * a;
      img.data[i + 1] += (241 - img.data[i + 1]) * a;
      img.data[i + 2] += (245 - img.data[i + 2]) * a;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function mat(opts) { return new THREE.MeshStandardMaterial(opts); }

/* 同じ形を並べるものは InstancedMesh にまとめて描画回数を減らす */
function instance(geo, material, transforms, cast = true, receive = true) {
  const m = new THREE.InstancedMesh(geo, material, transforms.length);
  const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const pos = new THREE.Vector3(), scl = new THREE.Vector3();
  transforms.forEach((t, i) => {
    pos.set(t.p[0], t.p[1], t.p[2]);
    e.set(t.r ? t.r[0] : 0, t.r ? t.r[1] : 0, t.r ? t.r[2] : 0);
    q.setFromEuler(e);
    const sc = t.s || [1, 1, 1];
    scl.set(sc[0], sc[1], sc[2]);
    mx.compose(pos, q, scl);
    m.setMatrixAt(i, mx);
  });
  m.instanceMatrix.needsUpdate = true;
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}

export function buildWorld(scene, renderer) {
  const g = new THREE.Group();
  scene.add(g);

  /* ---------- 素材 ---------- */
  const woodDark = TEX.woodMaps({ seed: 7, base: [0.30, 0.20, 0.13], light: [0.55, 0.39, 0.25], ringScale: 22 });
  const woodUsu = TEX.woodMaps({ seed: 47, base: [0.42, 0.29, 0.18], light: [0.76, 0.58, 0.39], ringScale: 11, stretch: 18, knots: 0.5 });
  const woodLight = TEX.woodMaps({ seed: 31, base: [0.52, 0.38, 0.24], light: [0.80, 0.64, 0.44], ringScale: 14, stretch: 12 });
  const woodBoard = TEX.woodMaps({ seed: 63, base: [0.58, 0.45, 0.29], light: [0.95, 0.87, 0.71], ringScale: 46, stretch: 22 });
  const doma = TEX.domaMaps();
  const snow = TEX.snowMaps();
  const plaster = TEX.plasterMaps();
  const shoji = TEX.shojiMap();
  const rope = TEX.ropeMap();

  const M = {
    usuWood: new THREE.MeshStandardMaterial({ ...woodUsu, color: 0xbb9367, roughness: 0.78, metalness: 0.0, normalScale: new THREE.Vector2(1.4, 1.4) }),
    kineWood: new THREE.MeshStandardMaterial({ ...woodLight, color: 0xd8b287, roughness: 0.58, metalness: 0.0 }),
    beam: new THREE.MeshStandardMaterial({ map: woodDark.map, normalMap: woodDark.normalMap, color: 0x6c4d33, roughness: 0.85 }),
    plank: new THREE.MeshStandardMaterial({ map: woodLight.map, normalMap: woodLight.normalMap, color: 0xc9a276, roughness: 0.7 }),
    floor: new THREE.MeshStandardMaterial({ ...doma, color: 0xb4a894, roughness: 0.95 }),
    snow: new THREE.MeshStandardMaterial({ ...snow, color: 0xf2f6ff, roughness: 0.66 }),
    wall: new THREE.MeshStandardMaterial({ ...plaster, color: 0xd9cfb6, roughness: 0.96 }),
    shoji: new THREE.MeshStandardMaterial({ map: shoji, color: 0xf3ecdc, roughness: 0.9, emissive: 0x2a2418, emissiveIntensity: 0.4 }),
    rope: new THREE.MeshStandardMaterial({ map: rope, color: 0xd9bd83, roughness: 0.9 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x8e8d88, roughness: 0.88, ...(() => { const d = TEX.domaMaps(256); return { normalMap: d.normalMap }; })() }),
    clay: new THREE.MeshStandardMaterial({ color: 0x6f6155, roughness: 0.92 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 0.55, metalness: 0.7 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xfbf7ee, roughness: 0.9, side: THREE.DoubleSide }),
    bark: new THREE.MeshStandardMaterial({ color: 0x5b4a3c, roughness: 0.95 }),
  };

  const add = (mesh, cast = true, receive = true) => {
    mesh.castShadow = cast; mesh.receiveShadow = receive; g.add(mesh); return mesh;
  };

  /* ---------- 土間の床 ---------- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 8), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -0.4);
  add(floor, false, true);

  /* ---------- 板の間 (一段高い床) 右手 ---------- */
  const ita = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.42, 3.4), M.plank);
  ita.position.set(4.3, 0.21, -1.6);
  add(ita);

  /* ---------- 壁 ---------- */
  // 奥壁: 開口(戸口)を残して 3枚に分割
  const doorW = 3.05, doorH = 2.16, doorCx = 0.05, wallZ = -3.25, wallH = 3.15;
  const wallSeg = (w, h, x, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.16), M.wall);
    m.position.set(x, y, wallZ); return add(m);
  };
  wallSeg(4.4, wallH, doorCx - doorW / 2 - 2.2, wallH / 2);
  wallSeg(4.4, wallH, doorCx + doorW / 2 + 2.2, wallH / 2);
  wallSeg(doorW, wallH - doorH, doorCx, doorH + (wallH - doorH) / 2);
  // 敷居・鴨居
  const sill = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.3, 0.10, 0.30), M.beam);
  sill.position.set(doorCx, 0.03, wallZ); add(sill);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.3, 0.16, 0.28), M.beam);
  lintel.position.set(doorCx, doorH + 0.06, wallZ); add(lintel);
  // 柱
  for (const px of [doorCx - doorW / 2 - 0.09, doorCx + doorW / 2 + 0.09]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, wallH, 0.22), M.beam);
    p.position.set(px, wallH / 2, wallZ); add(p);
  }
  // 左壁 (板壁)
  const lw = new THREE.Mesh(new THREE.BoxGeometry(0.16, wallH, 6.4), M.wall);
  lw.position.set(-3.6, wallH / 2, -0.4); add(lw);
  // 腰板 (下半分を板張りに)
  const wains = new THREE.MeshStandardMaterial({ map: woodDark.map, normalMap: woodDark.normalMap, color: 0x9a7550, roughness: 0.86 });
  const mkWains = (w, x, z, ry) => {
    const grp = new THREE.Group();
    const n = Math.round(w / 0.26);
    for (let i = 0; i < n; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.255, 1.02, 0.05), wains);
      b.position.set(-w / 2 + 0.13 + i * (w / n), 0.51, 0);
      b.castShadow = true; b.receiveShadow = true; grp.add(b);
    }
    const cap2 = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.08), M.beam);
    cap2.position.set(0, 1.04, 0.005); grp.add(cap2);
    grp.position.set(x, 0, z); grp.rotation.y = ry;
    g.add(grp);
  };
  mkWains(4.3, doorCx - doorW / 2 - 2.2, wallZ + 0.09, 0);
  mkWains(4.3, doorCx + doorW / 2 + 2.2, wallZ + 0.09, 0);
  mkWains(6.2, -3.5, -0.4, Math.PI / 2);

  /* ---------- 梁と天井 ---------- */
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(9, 8), new THREE.MeshStandardMaterial({ color: 0x3a2c20, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 3.1, -0.4); add(ceil, false, false);
  for (const bz of [-2.3, -0.9, 0.5]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 7.2, 10), M.beam);
    b.rotation.z = Math.PI / 2; b.rotation.y = 0.02;
    b.position.set(0, 2.82, bz); add(b);
  }
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.85, 0.2), M.beam);
  post.position.set(-2.5, 1.42, 0.4); add(post);

  /* ---------- 戸口の注連縄 (年末年始) ---------- */
  const shime = new THREE.Group();
  {
    const half = doorW / 2 + 0.06;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-half, 0.02, 0),
      new THREE.Vector3(-half * 0.5, -0.055, 0.01),
      new THREE.Vector3(0, -0.075, 0.012),
      new THREE.Vector3(half * 0.5, -0.055, 0.01),
      new THREE.Vector3(half, 0.02, 0),
    ]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.043, 8, false), M.rope);
    tube.castShadow = true;
    shime.add(tube);
    for (let i = 0; i < 4; i++) {
      const u = 0.16 + i * 0.226;
      const pt = curve.getPoint(u);
      const shide = new THREE.Group();
      const s1 = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.15), M.paper);
      s1.position.set(0, -0.075, 0); shide.add(s1);
      const s2 = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.13), M.paper);
      s2.position.set(0.028, -0.185, 0.012); s2.rotation.z = 0.22; shide.add(s2);
      const s3 = new THREE.Mesh(new THREE.PlaneGeometry(0.065, 0.11), M.paper);
      s3.position.set(-0.014, -0.285, 0.02); s3.rotation.z = -0.18; shide.add(s3);
      shide.position.copy(pt); shide.position.z += 0.03;
      shime.add(shide);
      // 房
      const fusa = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.14, 7), M.rope);
      fusa.position.set(pt.x + 0.05, pt.y - 0.09, -0.01); fusa.rotation.x = Math.PI;
      shime.add(fusa);
    }
  }
  shime.position.set(doorCx, doorH - 0.10, wallZ + 0.14);
  shime.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.add(shime);

  /* ---------- 外: 雪の庭 ---------- */
  const outside = new THREE.Group();
  const snowGround = new THREE.Mesh(new THREE.PlaneGeometry(60, 46, 40, 30), M.snow);
  snowGround.rotation.x = -Math.PI / 2;
  snowGround.position.set(0, -0.30, -18);
  {   // 雪面のうねり
    const pa = snowGround.geometry.attributes.position;
    const nz = TEX.makeValueNoise(64);
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i);
      pa.setZ(i, (TEX.fbm(nz, x * 0.05 + 5, y * 0.05 + 5, 4) - 0.5) * 0.55);
    }
    snowGround.geometry.computeVertexNormals();
  }
  snowGround.receiveShadow = true;
  outside.add(snowGround);

  // 濡れ縁下の踏み石と雪だまり
  const step = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.24, 0.8), M.stone);
  step.position.set(doorCx, -0.16, wallZ - 0.62); step.castShadow = step.receiveShadow = true;
  outside.add(step);
  const stepSnow = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10), M.snow);
  stepSnow.scale.set(0.74, 0.075, 0.42);
  stepSnow.position.set(doorCx, -0.045, wallZ - 0.62); outside.add(stepSnow);
  const rnd = TEX.mulberry32(5);
  {
    const tr = [];
    for (let i = 0; i < 16; i++) {
      const r = 0.5 + rnd() * 1.4;
      tr.push({ p: [-9 + rnd() * 18, -0.30, -4 - rnd() * 11], s: [r, r * (0.20 + rnd() * 0.14), r] });
    }
    outside.add(instance(new THREE.SphereGeometry(1, 12, 8), M.snow, tr, false, true));
  }

  // 石灯籠
  const toro = new THREE.Group();
  const tp = [[0.20, 0], [0.20, 0.55], [0.16, 0.58], [0.30, 0.66], [0.28, 0.72], [0.18, 0.76],
  [0.30, 0.80], [0.30, 1.02], [0.42, 1.06], [0.40, 1.14], [0.20, 1.30], [0.10, 1.34], [0.13, 1.42], [0, 1.52]];
  const toroM = new THREE.Mesh(lathe(tp, 12), M.stone);
  toroM.castShadow = true; toro.add(toroM);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.20, 7), M.snow);
  cap.position.y = 1.22; cap.castShadow = true; toro.add(cap);
  toro.position.set(-2.05, -0.28, -5.4); toro.rotation.y = 0.6;
  outside.add(toro);

  // 冬枯れの木 (2本)
  const makeTree = (seed, h) => {
    const tree = new THREE.Group();
    const r2 = TEX.mulberry32(seed);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.19, h, 8), M.bark);
    trunk.position.y = h / 2; trunk.castShadow = true; tree.add(trunk);
    const brs = [], sns = [];
    const tmp = new THREE.Object3D();
    for (let i = 0; i < 24; i++) {
      const len = 0.5 + r2() * 1.3;
      const ang = r2() * Math.PI * 2, tilt = 0.45 + r2() * 0.85;
      tmp.position.set(Math.cos(ang) * 0.16, h * 0.5 + r2() * h * 0.48, Math.sin(ang) * 0.16);
      tmp.rotation.set(Math.sin(ang) * tilt, 0, -Math.cos(ang) * tilt);
      tmp.updateMatrix(); tmp.translateY(len * 0.45);
      brs.push({ p: tmp.position.toArray(), r: [tmp.rotation.x, 0, tmp.rotation.z], s: [1, len / 1.0, 1] });
      if (r2() > 0.55) sns.push({ p: [tmp.position.x, tmp.position.y + 0.05, tmp.position.z], s: [1, 1, 1].map(() => 0.7 + r2() * 0.7) });
    }
    tree.add(instance(new THREE.CylinderGeometry(0.012, 0.045, 1.0, 5), M.bark, brs, true, false));
    if (sns.length) tree.add(instance(new THREE.SphereGeometry(0.07, 6, 5), M.snow, sns, false, false));
    return tree;
  };
  const t1 = makeTree(5, 2.7); t1.position.set(2.55, -0.28, -6.0); outside.add(t1);
  const t2 = makeTree(19, 3.4); t2.position.set(-4.4, -0.28, -8.6); outside.add(t2);

  // 竹垣 (低く、視線を通す)
  const fenceMat = new THREE.MeshStandardMaterial({ map: woodDark.map, normalMap: woodDark.normalMap, color: 0x8b6d4a, roughness: 0.9 });
  const fence = new THREE.Group();
  {
    const tr = [];
    for (let i = -14; i <= 14; i++) tr.push({ p: [i * 0.42, 0.47, 0] });
    fence.add(instance(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 6), fenceMat, tr, true, false));
  }
  for (const by of [0.30, 0.72]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.055, 0.05), fenceMat);
    bar.position.set(0, by, 0.05); fence.add(bar);
  }
  const fenceSnow = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.05, 0.14), M.snow);
  fenceSnow.position.set(0, 0.95, 0); fence.add(fenceSnow);
  fence.position.set(0, -0.30, -10.5);
  outside.add(fence);

  // 集落 (遠景)
  const houseWall = new THREE.MeshStandardMaterial({ color: 0xd9d2c3, roughness: 0.95 });
  const houseWood = new THREE.MeshStandardMaterial({ color: 0x6a5340, roughness: 0.95 });
  const makeHouse = (w, d, h, rot) => {
    const hs = new THREE.Group();
    const bd = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), houseWall);
    bd.position.y = h / 2; hs.add(bd);
    const rf = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.80, h * 0.62, 4), M.snow);
    rf.rotation.y = Math.PI / 4; rf.position.y = h + h * 0.30; hs.add(rf);
    const eave = new THREE.Mesh(new THREE.BoxGeometry(w * 1.12, 0.12, d * 1.12), houseWood);
    eave.position.y = h + 0.02; hs.add(eave);
    hs.rotation.y = rot;
    return hs;
  };
  const village = [[-9, -15.5, 5.5, 4.4, 3.0, 0.25], [-2.5, -19, 6.5, 5, 3.4, -0.15],
  [7.5, -16.5, 5, 4.2, 2.8, 0.4], [15, -21, 7, 5.5, 3.6, -0.3], [-17, -20, 6, 5, 3.2, 0.1]];
  for (const [x, z, w, d, h, r] of village) {
    const hs = makeHouse(w, d, h, r); hs.position.set(x, -0.30, z); outside.add(hs);
  }
  // 生垣の並木
  {
    const trees = [], caps = [];
    for (let i = 0; i < 9; i++) {
      const rr = 0.7 + rnd() * 0.4, hh = (2.4 + rnd() * 1.6) / 3.0;
      const px = -16 + i * 4.2 + rnd() * 1.5, pz = -13.5 - rnd() * 3;
      trees.push({ p: [px, 0.9, pz], s: [rr, hh, rr] });
      caps.push({ p: [px, 0.9 + 1.1, pz], s: [rr * 0.7, 0.9, rr * 0.7] });
    }
    outside.add(instance(new THREE.ConeGeometry(1, 3.0, 7),
      new THREE.MeshStandardMaterial({ color: 0x54614c, roughness: 1 }), trees, false, false));
    outside.add(instance(new THREE.ConeGeometry(1, 1.0, 7), M.snow, caps, false, false));
  }
  // 山なみ
  for (let i = 0; i < 6; i++) {
    const mtn = new THREE.Mesh(new THREE.ConeGeometry(11 + i * 2.6, 6 + (i % 3) * 3.0, 6),
      new THREE.MeshStandardMaterial({ color: 0xc2cfdc, roughness: 1 }));
    mtn.castShadow = false; mtn.receiveShadow = false;
    mtn.position.set(-30 + i * 12, 1.6, -38 - (i % 2) * 8);
    outside.add(mtn);
  }
  // 干し柿 (軒下)
  const kaki = new THREE.Group();
  {
    const strings = [], fruit = [];
    for (let i = 0; i < 7; i++) {
      strings.push({ p: [-0.42 + i * 0.14, -0.46, 0] });
      for (let j = 0; j < 5; j++) fruit.push({ p: [-0.42 + i * 0.14, -0.16 - j * 0.16, 0], s: [1, 0.82, 1] });
    }
    kaki.add(instance(new THREE.CylinderGeometry(0.004, 0.004, 0.92, 4), M.rope, strings, false, false));
    kaki.add(instance(new THREE.SphereGeometry(0.038, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xd2661f, roughness: 0.75 }), fruit, true, false));
  }
  kaki.position.set(0.62, 2.05, wallZ - 0.62);
  outside.add(kaki);
  // 軒 (戸口の外側)
  const eaves = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.14, 1.3), M.beam);
  eaves.position.set(0, 2.62, wallZ - 0.6); eaves.castShadow = true; outside.add(eaves);
  const eavesSnow = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.10, 1.34), M.snow);
  eavesSnow.position.set(0, 2.72, wallZ - 0.6); outside.add(eavesSnow);
  g.add(outside);

  /* ---------- 竈 と 蒸籠 ---------- */
  const clayMaps = TEX.domaMaps(256);
  M.clay = new THREE.MeshStandardMaterial({ color: 0x9d8161, roughness: 0.95, normalMap: clayMaps.normalMap, map: clayMaps.map });
  const kamado = new THREE.Group();
  const body = new THREE.Mesh(lathe([
    [0, 0], [0.50, 0], [0.505, 0.06], [0.475, 0.30], [0.455, 0.50],
    [0.42, 0.58], [0.36, 0.615], [0.315, 0.625], [0.300, 0.60], [0.300, 0.0],
  ], 26), M.clay);
  body.castShadow = body.receiveShadow = true; kamado.add(body);
  // 焚口
  const mouthFrame = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.30, 0.10), M.clay);
  mouthFrame.position.set(0, 0.21, 0.42); mouthFrame.castShadow = true; kamado.add(mouthFrame);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.25, 0.10),
    new THREE.MeshStandardMaterial({ color: 0x140b05, roughness: 1 }));
  mouth.position.set(0, 0.20, 0.455); kamado.add(mouth);
  const mouthIn = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.42, 12, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x1a0f07, roughness: 1, side: THREE.DoubleSide }));
  mouthIn.rotation.x = Math.PI / 2; mouthIn.position.set(0, 0.20, 0.30); kamado.add(mouthIn);
  // 薪
  for (let i = 0; i < 3; i++) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.030, 0.46, 6), M.beam);
    w.rotation.set(Math.PI / 2 - 0.06, (i - 1) * 0.16, 0);
    w.position.set((i - 1) * 0.05, 0.135 + i * 0.03, 0.52);
    w.castShadow = true; kamado.add(w);
  }
  // 焚口の熾火
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xff7a22, emissive: 0xff5a10, emissiveIntensity: 2.4, roughness: 1 }));
  ember.position.set(0, 0.12, 0.36); ember.scale.set(1.5, 0.5, 1.1); kamado.add(ember);
  // 蒸籠 2段
  const seiro = new THREE.Group();
  const seiroMat = new THREE.MeshStandardMaterial({ map: woodLight.map, normalMap: woodLight.normalMap, color: 0xcaa170, roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 2; i++) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.155, 26, 1, true), seiroMat);
    ring.position.y = 0.078 + i * 0.16; ring.castShadow = true; ring.receiveShadow = true;
    seiro.add(ring);
    for (const hy of [0.020, 0.136]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.293, 0.011, 6, 26), M.rope);
      hoop.rotation.x = Math.PI / 2; hoop.position.y = hy + i * 0.16; seiro.add(hoop);
    }
  }
  const riceBed = new THREE.Mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.05, 26),
    new THREE.MeshStandardMaterial({ color: 0xf5efe3, roughness: 0.55, normalMap: TEX.riceGrainNormal(256) }));
  riceBed.position.y = 0.28; seiro.add(riceBed);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.032, 26), seiroMat);
  lid.position.y = 0.336; lid.castShadow = true; seiro.add(lid);
  const lidKnob = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.011, 6, 16), M.rope);
  lidKnob.rotation.x = Math.PI / 2; lidKnob.position.y = 0.356; lid.add(lidKnob);
  lidKnob.position.y = 0.020;
  seiro.position.set(-1.55, 0.615, -1.35);
  g.add(seiro);
  kamado.position.set(-1.55, 0, -1.35);
  g.add(kamado);

  /* ---------- のし板 と 台 ---------- */
  const table = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.8), M.plank);
  top.position.y = 0.66; top.castShadow = top.receiveShadow = true; table.add(top);
  for (const [tx, tz] of [[-0.65, -0.32], [0.65, -0.32], [-0.65, 0.32], [0.65, 0.32]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.63, 0.07), M.beam);
    leg.position.set(tx, 0.315, tz); leg.castShadow = true; table.add(leg);
  }
  // のし板 (白木)
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.035, 0.62),
    new THREE.MeshStandardMaterial({ ...woodBoard, color: 0xe6d5ba, roughness: 0.72 }));
  board.position.set(0, 0.716, 0); board.castShadow = board.receiveShadow = true; table.add(board);
  // 板にはたいた手粉
  const dust = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.5), new THREE.MeshBasicMaterial({
    map: TEX.puffSprite(128, 0.9, 41), transparent: true, opacity: 0.55, depthWrite: false,
  }));
  dust.rotation.x = -Math.PI / 2; dust.position.set(-0.02, 0.7345, 0.02);
  dust.renderOrder = 2;
  table.add(dust);
  // 手粉の入った木鉢
  const bowl = new THREE.Mesh(lathe([[0, 0], [0.13, 0.005], [0.145, 0.05], [0.15, 0.09], [0.14, 0.09], [0.125, 0.05], [0.115, 0.008], [0, 0.008]], 20), M.usuWood);
  bowl.position.set(0.46, 0.735, 0.14); bowl.castShadow = true; table.add(bowl);
  const flourTop = new THREE.Mesh(new THREE.CircleGeometry(0.125, 20), new THREE.MeshStandardMaterial({ color: 0xfdfcf8, roughness: 0.95 }));
  flourTop.rotation.x = -Math.PI / 2; flourTop.position.set(0.46, 0.795, 0.14); table.add(flourTop);
  table.position.set(1.65, 0, -0.35);
  table.rotation.y = -0.30;
  g.add(table);

  /* ---------- 小道具 (土間らしさ) ---------- */
  // 手水の桶
  const oke = new THREE.Group();
  const okeMat = new THREE.MeshStandardMaterial({ map: woodLight.map, normalMap: woodLight.normalMap, color: 0xc9a677, roughness: 0.82 });
  const okeBody = new THREE.Mesh(lathe([
    [0, 0], [0.155, 0], [0.160, 0.02], [0.168, 0.19], [0.170, 0.20],
    [0.152, 0.20], [0.150, 0.02], [0.146, 0.008], [0, 0.006],
  ], 26), okeMat);
  okeBody.castShadow = okeBody.receiveShadow = true; oke.add(okeBody);
  for (const hy of [0.045, 0.155]) {
    const hp = new THREE.Mesh(new THREE.TorusGeometry(0.164, 0.0075, 6, 26),
      new THREE.MeshStandardMaterial({ color: 0x4c4741, roughness: 0.6, metalness: 0.55 }));
    hp.rotation.x = Math.PI / 2; hp.position.y = hy; oke.add(hp);
  }
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.148, 26), new THREE.MeshPhysicalMaterial({
    color: 0x9fc4cf, roughness: 0.06, metalness: 0.0, clearcoat: 1, envMapIntensity: 1.6,
  }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.155; oke.add(water);
  oke.position.set(-0.72, 0, 0.46);
  g.add(oke);

  // 薪の山
  const maki = new THREE.Group();
  const r3 = TEX.mulberry32(88);
  {
    const tr = [];
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < 5 - Math.floor(row / 2); i++) {
        const sc = 0.92 + r3() * 0.22;
        tr.push({
          p: [(r3() - 0.5) * 0.03, 0.04 + row * 0.076, -0.16 + i * 0.082 + (row % 2) * 0.04],
          r: [0, (r3() - 0.5) * 0.08, Math.PI / 2], s: [sc, 1, sc],
        });
      }
    }
    maki.add(instance(new THREE.CylinderGeometry(0.038, 0.040, 0.42, 7), M.beam, tr));
  }
  maki.position.set(-2.62, 0, -1.35); maki.rotation.y = 0.22;
  g.add(maki);

  // 竹ざると大根
  const zaru = new THREE.Group();
  const zaruMesh = new THREE.Mesh(lathe([[0, 0.03], [0.11, 0.0], [0.18, 0.05], [0.19, 0.075], [0.178, 0.072], [0.105, 0.012], [0, 0.038]], 22),
    new THREE.MeshStandardMaterial({ color: 0xd8c493, roughness: 0.9, side: THREE.DoubleSide }));
  zaruMesh.castShadow = true; zaru.add(zaruMesh);
  for (let i = 0; i < 3; i++) {
    const dk = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.044, 0.24, 10),
      new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.62 }));
    dk.rotation.set(Math.PI / 2, 0, (i - 1) * 0.3);
    dk.position.set((i - 1) * 0.05, 0.07, 0);
    dk.castShadow = true; zaru.add(dk);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x4f7a2e, roughness: 0.9 }));
    leaf.scale.set(0.5, 0.5, 1.1);
    leaf.position.set((i - 1) * 0.05 + Math.sin((i - 1) * 0.3) * 0.14, 0.085, 0.14);
    zaru.add(leaf);
  }
  zaru.position.set(-2.30, 0.0, -0.05); zaru.rotation.y = -0.4;
  g.add(zaru);

  // 石臼 (使わないが冬の土間らしさと石の質感のために置く)
  const ishiusu = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x9a978f, roughness: 0.86, metalness: 0.02,
    map: clayMaps.map, normalMap: clayMaps.normalMap,
  });
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.255, 0.16, 26), stoneMat);
  lower.position.y = 0.08; ishiusu.add(lower);
  const upper2 = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.235, 0.15, 26), stoneMat);
  upper2.position.y = 0.235; ishiusu.add(upper2);
  const spout = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.10), stoneMat);
  spout.position.set(0.25, 0.145, 0); ishiusu.add(spout);
  const handleArm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.30), M.beam);
  handleArm.position.set(0.10, 0.325, 0.12); handleArm.rotation.y = -0.5; ishiusu.add(handleArm);
  const handleGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.20, 10), M.beam);
  handleGrip.position.set(0.20, 0.41, 0.24); ishiusu.add(handleGrip);
  const feedHole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a2723, roughness: 1 }));
  feedHole.position.set(-0.09, 0.305, 0.03); ishiusu.add(feedHole);
  ishiusu.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  ishiusu.position.set(-2.34, 0, -0.42);
  ishiusu.rotation.y = 0.85;
  g.add(ishiusu);

  // 沓脱石 (戸口の内側)
  const kutsunugi = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), M.stone);
  kutsunugi.scale.set(0.44, 0.115, 0.26);
  kutsunugi.position.set(doorCx - 0.1, 0.045, wallZ + 0.45);
  kutsunugi.castShadow = kutsunugi.receiveShadow = true;
  g.add(kutsunugi);

  /* ---------- 三方 (鏡餅を載せる) ---------- */
  const sanpo = new THREE.Group();
  const hinoki = new THREE.MeshStandardMaterial({ color: 0xefe0c2, roughness: 0.62 });
  const sTop = new THREE.Mesh(new THREE.BoxGeometry(0.235, 0.016, 0.235), hinoki);
  sTop.position.y = 0.118; sanpo.add(sTop);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.006, 5, 4), hinoki);
  rim.rotation.x = Math.PI / 2; rim.rotation.z = Math.PI / 4; rim.position.y = 0.128; sanpo.add(rim);
  // 三方の胴 (三面に眼象の穴)
  for (let i = 0; i < 4; i++) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.11, 0.010), hinoki);
    const a2 = i * Math.PI / 2;
    side.position.set(Math.sin(a2) * 0.093, 0.058, Math.cos(a2) * 0.093);
    side.rotation.y = a2;
    sanpo.add(side);
    if (i >= 2) {
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.021, 14),
        new THREE.MeshStandardMaterial({ color: 0x2b2018, roughness: 1 }));
      hole.position.set(Math.sin(a2) * 0.099, 0.058, Math.cos(a2) * 0.099);
      hole.rotation.y = a2;
      sanpo.add(hole);
    }
  }
  const sBase = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.012, 0.20), hinoki);
  sBase.position.y = 0.006; sanpo.add(sBase);
  // 四方紅の紙
  const sPaper = new THREE.Mesh(new THREE.PlaneGeometry(0.215, 0.215),
    new THREE.MeshStandardMaterial({ color: 0xfffaf4, roughness: 0.92, side: THREE.DoubleSide }));
  sPaper.rotation.x = -Math.PI / 2; sPaper.rotation.z = Math.PI / 4; sPaper.position.y = 0.128;
  sanpo.add(sPaper);
  sanpo.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  sanpo.position.set(1.205, 0.734, -0.385);
  sanpo.rotation.y = -0.30;
  g.add(sanpo);

  /* ---------- 裸電球 ---------- */
  const bulbG = new THREE.Group();
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 5), new THREE.MeshStandardMaterial({ color: 0x151210 }));
  cord.position.y = 0.25; bulbG.add(cord);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.13, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x3d4a44, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }));
  shade.position.y = -0.03; bulbG.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), new THREE.MeshStandardMaterial({ color: 0xfff0cf, emissive: 0xffd9a0, emissiveIntensity: 3.2 }));
  bulb.position.y = -0.09; bulbG.add(bulb);
  bulbG.position.set(-0.15, 2.45, 0.15);
  g.add(bulbG);

  /* ---------- 照明 ---------- */
  const sun = new THREE.DirectionalLight(0xffdcae, 4.2);
  sun.position.set(-4.2, 3.4, -8.6);
  sun.target.position.set(0.2, 0.5, -0.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 22;
  sun.shadow.camera.left = -4.5; sun.shadow.camera.right = 4.5;
  sun.shadow.camera.top = 4.5; sun.shadow.camera.bottom = -3.0;
  sun.shadow.bias = -0.0012;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xc4dcf0, 0x7d6b56, 1.35);
  scene.add(hemi);

  const fire = new THREE.PointLight(0xff8a30, 2.2, 4.0, 2);
  fire.position.set(-1.55, 0.25, -0.98);
  scene.add(fire);

  const lamp = new THREE.PointLight(0xffd7a0, 5.0, 6.0, 2);
  lamp.position.set(-0.15, 2.33, 0.15);
  lamp.castShadow = false;
  scene.add(lamp);

  // 餅を照らす柔らかいキーライト (近景の質感用)
  const key = new THREE.SpotLight(0xfff1de, 4.2, 5.2, 0.85, 0.55, 1.5);
  key.position.set(1.5, 2.35, 1.7);
  key.target.position.set(0, 0.45, 0);
  scene.add(key, key.target);

  // 近景 (餅) 用のやわらかい前光。つやを出すため。
  const glaze = new THREE.PointLight(0xfff2e0, 1.5, 3.0, 2);
  glaze.position.set(0.55, 1.30, 0.95);
  scene.add(glaze);

  /* ---------- 環境反射 ---------- */
  const sky = skyTexture();
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(sky);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.80;
  scene.background = sky;
  scene.backgroundIntensity = 0.9;
  scene.fog = new THREE.Fog(0xcdd9e4, 10, 46);
  pmrem.dispose();

  return {
    group: g, mats: M, sun, fire, lamp, key, hemi, ember, bulb, glaze, oke, water,
    seiro, seiroLid: lid, kamado, table, board, sanpo, flourBowl: bowl,
    doorCx, wallZ, woodLight, woodDark,
  };
}
