// 掘る場所ひとつぶん。土(高さ場)・落ち葉・たけのこ・ひび割れ・土けむりをまとめて持つ。
// 土は本物の破壊シミュレーションではなく、極座標の高さ場をへこませて「掘れている感」を出す。
import * as THREE from 'three';
import { soilTexture, soilNormalTexture, strataTexture, crackTexture, radialTexture, leafTexture } from '../world/textures.js';
import { clamp, smoothstep } from '../core/rng.js';
import { createTakenoko } from './takenoko.js';

export const SITE_RADIUS = 0.62;
export const MAX_DEPTH = 0.30;
export const BURY_Y = -0.285;      // たけのこの根元の深さ
const SECTORS = 48;
const RINGS = [0, 0.055, 0.105, 0.155, 0.205, 0.26, 0.32, 0.39, 0.46, 0.54, SITE_RADIUS];
const SKIRT_DEPTH = 0.85;
const WALL_HALF_WIDTH = 2.6;  // 断面のかべの広さ(片側)
const WALL_DEPTH = 1.5;       // 断面のかべの深さ

/** 半径ごとの掘れる量(内側はしっかり、ふちに向かってなだらかに) */
function radialProfile(r) {
  return 1 - smoothstep(0.30, 0.60, r);
}

export class DigSite {
  /**
   * @param {object} o {rng, position:THREE.Vector3, surfaceAt(x,z), hintLevel, viewAzimuth, fast}
   */
  constructor(o) {
    this.rng = o.rng;
    this.fast = !!o.fast;
    this.surfaceAt = o.surfaceAt;
    this.position = o.position.clone();
    this.hintLevel = o.hintLevel ?? 0;
    this.viewAzimuth = o.viewAzimuth ?? 0;
    this.depth = new Float32Array(SECTORS); // 各セクタの掘り下げ量(m)
    this.dirty = true;
    this.collapseAmount = 0;
    this.brushed = 0;
    this.done = false;

    this.group = new THREE.Group();
    this.group.name = 'digsite';
    this.group.position.copy(this.position);

    this._buildSoil();
    this._buildLitter();
    this._buildTakenoko();
    this._buildHints();
    this._buildParticles();
    this._buildClods();
    this.updateGeometry();
  }

  // ---------- 生成 ----------

  _baseY(lx, lz) {
    return this.surfaceAt(this.position.x + lx, this.position.z + lz) - this.position.y;
  }

  _buildSoil() {
    const rings = RINGS.length;
    const count = rings * SECTORS;
    const pos = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const col = new Float32Array(count * 3);
    const idx = [];
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < SECTORS; j++) {
        const k = i * SECTORS + j;
        const a = (j / SECTORS) * Math.PI * 2;
        const r = RINGS[i];
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        pos[k * 3] = x;
        pos[k * 3 + 2] = z;
        uv[k * 2] = (this.position.x + x) * 1.7;
        uv[k * 2 + 1] = (this.position.z + z) * 1.7;
        col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = 1;
      }
    }
    for (let i = 0; i < rings - 1; i++) {
      for (let j = 0; j < SECTORS; j++) {
        const j2 = (j + 1) % SECTORS;
        const a = i * SECTORS + j;
        const b = i * SECTORS + j2;
        const c = (i + 1) * SECTORS + j;
        const d = (i + 1) * SECTORS + j2;
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    this.soilGeo = geo;

    this.soilMat = new THREE.MeshStandardMaterial({
      map: soilTexture(),
      normalMap: soilNormalTexture(),
      normalScale: new THREE.Vector2(1.55, 1.55),
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    this.soil = new THREE.Mesh(geo, this.soilMat);
    this.soil.castShadow = false;
    this.soil.receiveShadow = !this.fast;
    this.soil.userData.digSite = this;
    this.soil.name = 'siteSoil';
    this.group.add(this.soil);

    // ふちから下へ伸ばす壁と底。横から見ても土の塊として閉じて見えるように
    const skirtPos = [];
    const skirtUv = [];
    const skirtIdx = [];
    for (let j = 0; j < SECTORS; j++) {
      const a = (j / SECTORS) * Math.PI * 2;
      const x = Math.cos(a) * SITE_RADIUS;
      const z = Math.sin(a) * SITE_RADIUS;
      const yTop = this._baseY(x, z) - 0.03;
      skirtPos.push(x, yTop, z, x, yTop - SKIRT_DEPTH, z);
      skirtUv.push(j / SECTORS * 4, 0, j / SECTORS * 4, 1.4);
    }
    for (let j = 0; j < SECTORS; j++) {
      const a = j * 2;
      const b = ((j + 1) % SECTORS) * 2;
      skirtIdx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    // 底
    const baseIndex = SECTORS * 2;
    skirtPos.push(0, this._baseY(0, 0) - SKIRT_DEPTH, 0);
    skirtUv.push(0.5, 0.5);
    for (let j = 0; j < SECTORS; j++) {
      skirtIdx.push(baseIndex, ((j + 1) % SECTORS) * 2 + 1, j * 2 + 1);
    }
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute('position', new THREE.Float32BufferAttribute(skirtPos, 3));
    sgeo.setAttribute('uv', new THREE.Float32BufferAttribute(skirtUv, 2));
    sgeo.setIndex(skirtIdx);
    sgeo.computeVertexNormals();
    this.skirtMat = new THREE.MeshStandardMaterial({
      map: strataTexture(),
      roughness: 0.97,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    this.skirt = new THREE.Mesh(sgeo, this.skirtMat);
    this.group.add(this.skirt);

    // 断面表示用のかべ(掘った形にあわせて毎回作りなおす)。
    // 画面の端まで土で埋まって見えるよう、掘り場よりずっと広くとる。
    const wallSeg = 72;
    const wgeo = new THREE.BufferGeometry();
    wgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((wallSeg + 1) * 2 * 3), 3));
    wgeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((wallSeg + 1) * 2 * 2), 2));
    const widx = [];
    for (let i = 0; i < wallSeg; i++) {
      const a = i * 2;
      widx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
    wgeo.setIndex(widx);
    this.wallSeg = wallSeg;
    this.wallMat = new THREE.MeshStandardMaterial({
      map: strataTexture(),
      roughness: 0.96,
      side: THREE.DoubleSide,
      metalness: 0,
    });
    this.wall = new THREE.Mesh(wgeo, this.wallMat);
    this.wall.visible = false;
    this.wall.renderOrder = 1;
    this.group.add(this.wall);
  }

  _buildLitter() {
    // 上にかぶさった落ち葉。これを払うところからゲームが始まる
    const n = this.fast ? 30 : 82 + Math.round(this.hintLevel * 12);
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshStandardMaterial({
      map: leafTexture(this.hintLevel > 1 ? 'wet' : 'dry'),
      alphaTest: 0.4,
      side: THREE.DoubleSide,
      roughness: 0.92,
    });
    const inst = new THREE.InstancedMesh(geo, mat, n);
    inst.receiveShadow = !this.fast;
    inst.name = 'siteLitter';
    const dummy = new THREE.Object3D();
    this.leaves = [];
    // 分かりやすい場所ほど、先端のまわりを空けて頭が見えるようにする
    const clear = [0.115, 0.10, 0.075, 0.05, 0.03][Math.min(4, this.hintLevel)];
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const r = clear + Math.sqrt(this.rng()) * (0.36 - clear);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = this._baseY(x, z) + 0.012 + this.rng.range(0, 0.02);
      const s = this.rng.range(0.09, 0.16);
      const rot = this.rng.range(0, Math.PI * 2);
      const tilt = this.rng.range(-0.4, 0.4);
      this.leaves.push({ x, z, y, s, rot, tilt, state: 1, t: 0, vy: 0, spin: this.rng.range(-4, 4) });
      dummy.position.set(x, y, z);
      dummy.rotation.set(-Math.PI / 2 + tilt * 0.35, rot, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    this.litter = inst;
    this.litterDummy = dummy;
    this.group.add(inst);
  }

  _buildTakenoko() {
    const t = createTakenoko(this.rng, { fast: this.fast });
    // ヒントが弱い場所ほど先端の出かたを小さくする
    const height = t.userData.height;
    const exposure = [0.088, 0.068, 0.042, 0.02, 0.002][Math.min(4, this.hintLevel)];
    this.exposure = exposure;
    const baseY = exposure - height;
    t.position.set(0, baseY, 0);
    const tilt = this.rng.range(0.02, 0.075);
    const tiltDir = this.rng.range(0, Math.PI * 2);
    t.rotation.set(Math.cos(tiltDir) * tilt, this.rng.range(0, 6.28), Math.sin(tiltDir) * tilt);
    this.takenoko = t;
    this.takenokoBaseY = baseY;
    this.group.add(t);
  }

  _buildHints() {
    // 地面のひび割れ
    const g = new THREE.PlaneGeometry(0.72, 0.72);
    g.rotateX(-Math.PI / 2);
    const crackOpacity = [0.95, 0.8, 0.6, 0.42, 0.3][Math.min(4, this.hintLevel)];
    this.crack = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({
        map: crackTexture(),
        transparent: true,
        opacity: crackOpacity,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -6,
        polygonOffsetUnits: -6,
      })
    );
    this.crack.position.y = this._baseY(0, 0) + 0.016;
    this.crack.renderOrder = 2;
    this.group.add(this.crack);

    // 見つけやすくするための光の輪(ヒントが必要になったときだけ出す)
    const rg = new THREE.PlaneGeometry(1.5, 1.5);
    rg.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(
      rg,
      new THREE.MeshBasicMaterial({
        map: radialTexture('rgba(255,242,180,0.9)', 'rgba(255,220,120,0)', 2.6),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    this.ring.position.y = this._baseY(0, 0) + 0.03;
    this.ring.renderOrder = 7;
    this.ring.visible = false;
    this.group.add(this.ring);
    this.ringPulse = 0;

    // 抜いたあとに残る穴の暗がり
    const hg = new THREE.CircleGeometry(0.2, 20);
    hg.rotateX(-Math.PI / 2);
    this.hole = new THREE.Mesh(
      hg,
      new THREE.MeshBasicMaterial({
        map: radialTexture('rgba(10,7,4,0.95)', 'rgba(20,14,8,0)', 1.5),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    this.hole.renderOrder = 3;
    this.hole.visible = false;
    this.group.add(this.hole);
  }

  /** 掘り出した土の塊。掘るほど、ふちに積もっていく */
  _buildClods() {
    const n = this.fast ? 10 : 30;
    const geo = new THREE.IcosahedronGeometry(0.021, 0);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i, pos.getX(i) * 1.35, pos.getY(i) * 0.42, pos.getZ(i) * 1.35);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      map: soilTexture(),
      color: 0xc9ab84,
      roughness: 0.98,
      metalness: 0,
    });
    this.clods = new THREE.InstancedMesh(geo, mat, n);
    this.clods.castShadow = !this.fast;
    this.clods.receiveShadow = !this.fast;
    this.clods.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.clodState = [];
    const dummy = new THREE.Object3D();
    dummy.scale.setScalar(0.0001);
    dummy.updateMatrix();
    for (let i = 0; i < n; i++) {
      // 黄金角で並べると、掘り進むにつれて全周へ均等に積もっていく
      const a = i * 2.399 + this.rng.range(-0.12, 0.12);
      const r = this.rng.range(0.345, 0.44);
      this.clodState.push({
        a,
        r,
        s: this.rng.range(0.55, 1.25),
        rot: this.rng.range(0, 6.28),
        tilt: this.rng.range(-0.4, 0.4),
      });
      this.clods.setMatrixAt(i, dummy.matrix);
    }
    this.clodShown = 0;
    this.clodDummy = dummy;
    this.group.add(this.clods);
  }

  _buildParticles() {
    const n = this.fast ? 24 : 90;
    const geo = new THREE.IcosahedronGeometry(0.013, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a382a, roughness: 1, vertexColors: false });
    this.particles = new THREE.InstancedMesh(geo, mat, n);
    this.particles.frustumCulled = false;
    this.particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pState = [];
    const dummy = new THREE.Object3D();
    dummy.scale.setScalar(0.001);
    dummy.updateMatrix();
    for (let i = 0; i < n; i++) {
      this.pState.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 1, rx: 0, ry: 0 });
      this.particles.setMatrixAt(i, dummy.matrix);
    }
    this.pDummy = dummy;
    this.pNext = 0;
    this.group.add(this.particles);
  }

  // ---------- 状態 ----------

  get materials() {
    return [this.soilMat, this.skirtMat, this.litter.material, this.crack.material, this.clods.material];
  }

  /** セクタ番号(0..SECTORS-1)を角度から */
  _sectorOf(angle) {
    let a = angle % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    return (a / (Math.PI * 2)) * SECTORS;
  }

  depthAtAngle(angle) {
    const f = this._sectorOf(angle);
    const i0 = Math.floor(f) % SECTORS;
    const i1 = (i0 + 1) % SECTORS;
    const t = f - Math.floor(f);
    return this.depth[i0] * (1 - t) + this.depth[i1] * t;
  }

  /** サイトのローカル座標での地表の高さ */
  surfaceYLocal(lx, lz) {
    const r = Math.hypot(lx, lz);
    const base = this._baseY(lx, lz);
    if (r > SITE_RADIUS) return base;
    const d = this.depthAtAngle(Math.atan2(lz, lx));
    return base - d * radialProfile(r);
  }

  get digProgress() {
    let s = 0;
    for (let i = 0; i < SECTORS; i++) s += this.depth[i];
    return clamp(s / SECTORS / MAX_DEPTH, 0, 1);
  }

  get brushProgress() {
    return clamp(this.brushed / Math.max(1, this.leaves.length * 0.68), 0, 1);
  }

  /** 掘る。角度の進みぶんだけ、その付近のセクタを深くする */
  dig(angle, dAngle, rate = 0.5) {
    const amt = Math.min(0.6, Math.abs(dAngle));
    if (amt <= 0) return 0;
    const center = this._sectorOf(angle);
    let gained = 0;
    // 指のまわり広めのセクタを、なだらかに深くする。
    // 一周でしっかり進むので、2周ほどで掘りきれる = 4歳児でも飽きない
    for (let k = -8; k <= 8; k++) {
      const i = (Math.round(center) + k + SECTORS * 2) % SECTORS;
      const w = Math.exp(-(k * k) / 18);
      const before = this.depth[i];
      this.depth[i] = Math.min(MAX_DEPTH, before + MAX_DEPTH * amt * rate * w);
      gained += this.depth[i] - before;
    }
    if (gained > 0) this.dirty = true;
    return gained;
  }

  /** のこりを自動でならす(最後のひと押しでイライラさせない) */
  finishDig(dt) {
    let moved = false;
    for (let i = 0; i < SECTORS; i++) {
      if (this.depth[i] < MAX_DEPTH) {
        this.depth[i] = Math.min(MAX_DEPTH, this.depth[i] + dt * 0.75);
        moved = true;
      }
    }
    if (moved) this.dirty = true;
    return !moved;
  }

  /** 落ち葉を払う。世界座標の点の近くの葉を飛ばす */
  brushAt(worldPoint, radius = 0.15) {
    const lx = worldPoint.x - this.position.x;
    const lz = worldPoint.z - this.position.z;
    let n = 0;
    for (const lf of this.leaves) {
      if (lf.state !== 1) continue;
      if (Math.hypot(lf.x - lx, lf.z - lz) < radius) {
        lf.state = 2;
        lf.t = 0;
        lf.vy = 0.35 + this.rng() * 0.5;
        lf.dx = (lf.x - lx) * 2.6 + this.rng.range(-0.2, 0.2);
        lf.dz = (lf.z - lz) * 2.6 + this.rng.range(-0.2, 0.2);
        this.brushed++;
        n++;
      }
    }
    return n;
  }

  brushAll() {
    for (const lf of this.leaves) {
      if (lf.state === 1) {
        lf.state = 2;
        lf.t = 0;
        lf.vy = 0.3;
        lf.dx = this.rng.range(-0.5, 0.5);
        lf.dz = this.rng.range(-0.5, 0.5);
        this.brushed++;
      }
    }
  }

  spawnDirt(worldPos, count = 4, power = 1) {
    for (let i = 0; i < count; i++) {
      const p = this.pState[this.pNext];
      this.pNext = (this.pNext + 1) % this.pState.length;
      p.life = 0.7 + this.rng() * 0.5;
      p.maxLife = p.life;
      p.x = worldPos.x - this.position.x + this.rng.range(-0.03, 0.03);
      p.y = worldPos.y - this.position.y + 0.02;
      p.z = worldPos.z - this.position.z + this.rng.range(-0.03, 0.03);
      const a = this.rng.range(0, Math.PI * 2);
      const sp = this.rng.range(0.25, 0.85) * power;
      p.vx = Math.cos(a) * sp * 0.55;
      p.vz = Math.sin(a) * sp * 0.55;
      p.vy = this.rng.range(0.7, 1.7) * power;
      p.s = this.rng.range(0.55, 1.5);
      p.rx = this.rng.range(0, 6.28);
      p.ry = this.rng.range(-8, 8);
    }
  }

  /** 引き抜いたあと、土がくずれて穴になる */
  setCollapse(t) {
    this.collapseAmount = t;
    this.dirty = true;
    this.hole.visible = t > 0.001;
    this.hole.material.opacity = t * 0.85;
    this.hole.position.y = this._baseY(0, 0) - MAX_DEPTH * (1 - t * 0.45) + 0.01;
  }

  setCrossSection(on) {
    this.wall.visible = on;
    if (on) this.updateWall();
  }

  /** 断面のかべを、いま掘れている形にあわせて作る */
  updateWall() {
    const dir = new THREE.Vector3(Math.cos(this.viewAzimuth + Math.PI / 2), 0, Math.sin(this.viewAzimuth + Math.PI / 2));
    const pos = this.wall.geometry.attributes.position;
    const uv = this.wall.geometry.attributes.uv;
    const n = this.wallSeg;
    const rimY = this._baseY(0, 0);
    const halfW = WALL_HALF_WIDTH;
    for (let i = 0; i <= n; i++) {
      const s = (i / n - 0.5) * 2 * halfW;
      const lx = dir.x * s;
      const lz = dir.z * s;
      const top = this.surfaceYLocal(lx, lz);
      const bot = rimY - WALL_DEPTH;
      pos.setXYZ(i * 2, lx, top, lz);
      pos.setXYZ(i * 2 + 1, lx, bot, lz);
      const u = ((s + halfW) / (halfW * 2)) * 5;
      uv.setXY(i * 2, u, (rimY - top) / WALL_DEPTH);
      uv.setXY(i * 2 + 1, u, 1.0);
    }
    pos.needsUpdate = true;
    uv.needsUpdate = true;
    this.wall.geometry.computeVertexNormals();
    this.wall.geometry.computeBoundingSphere();
  }

  updateGeometry() {
    const pos = this.soilGeo.attributes.position;
    const col = this.soilGeo.attributes.color;
    const rings = RINGS.length;
    for (let i = 0; i < rings; i++) {
      const r = RINGS[i];
      const prof = radialProfile(r);
      for (let j = 0; j < SECTORS; j++) {
        const k = i * SECTORS + j;
        const x = pos.getX(k);
        const z = pos.getZ(k);
        let d = this.depth[j] * prof;
        if (this.collapseAmount > 0) {
          // くずれて半分ほど埋まりもどる
          d *= 1 - this.collapseAmount * 0.5;
        }
        // 外周は地面とぴったり合わせ、内側はわずかに持ち上げて継ぎ目を隠す
        const lift = i >= rings - 2 ? 0.001 : 0.006;
        pos.setY(k, this._baseY(x, z) + lift - d);
        // 掘る前は乾いた明るい土、掘るほど冷たく濡れた黒土になる。
        // この色差が「掘れている」いちばん強い手がかりになる。
        const w = clamp(d / (MAX_DEPTH * 0.45), 0, 1);
        col.setXYZ(
          k,
          1.46 + (0.30 - 1.46) * w,
          1.34 + (0.29 - 1.34) * w,
          1.14 + (0.32 - 1.14) * w
        );
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.soilGeo.computeVertexNormals();
    this.soilGeo.computeBoundingSphere();
    if (this.wall.visible) this.updateWall();
    this.dirty = false;
  }

  update(dt) {
    if (this.dirty) this.updateGeometry();

    // 掘るほど、地表のひび割れは崩れて消える
    if (this.crack.visible) {
      const p = this.digProgress;
      if (p > 0.05) {
        this.crack.material.opacity = Math.max(0, this.crack.material.opacity - dt * 1.2);
        if (this.crack.material.opacity <= 0.001) this.crack.visible = false;
      }
    }

    // 落ち葉が舞う
    let litterDirty = false;
    for (let i = 0; i < this.leaves.length; i++) {
      const lf = this.leaves[i];
      if (lf.state === 2) {
        lf.t += dt;
        lf.vy -= dt * 1.8;
        lf.y += lf.vy * dt;
        lf.x += lf.dx * dt;
        lf.z += lf.dz * dt;
        lf.rot += lf.spin * dt;
        const k = clamp(1 - lf.t / 1.1, 0, 1);
        this.litterDummy.position.set(lf.x, lf.y, lf.z);
        this.litterDummy.rotation.set(-Math.PI / 2 + lf.tilt * 0.35 + lf.t * 2.2, lf.rot, lf.t * 1.4);
        this.litterDummy.scale.setScalar(lf.s * k);
        this.litterDummy.updateMatrix();
        this.litter.setMatrixAt(i, this.litterDummy.matrix);
        litterDirty = true;
        if (k <= 0) lf.state = 0;
      }
    }
    if (litterDirty) this.litter.instanceMatrix.needsUpdate = true;

    // 土のかけら
    let anyAlive = false;
    for (let i = 0; i < this.pState.length; i++) {
      const p = this.pState[i];
      if (p.life <= 0) continue;
      anyAlive = true;
      p.life -= dt;
      p.vy -= dt * 5.4;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rx += p.ry * dt;
      const floor = this.surfaceYLocal(p.x, p.z);
      if (p.y < floor) {
        p.y = floor;
        p.vy *= -0.22;
        p.vx *= 0.5;
        p.vz *= 0.5;
      }
      const k = clamp(p.life / (p.maxLife || 1), 0, 1);
      this.pDummy.position.set(p.x, p.y, p.z);
      this.pDummy.rotation.set(p.rx, p.rx * 0.7, 0);
      this.pDummy.scale.setScalar(p.s * (0.35 + k * 0.65));
      this.pDummy.updateMatrix();
      this.particles.setMatrixAt(i, this.pDummy.matrix);
      if (p.life <= 0) {
        this.pDummy.scale.setScalar(0.0001);
        this.pDummy.updateMatrix();
        this.particles.setMatrixAt(i, this.pDummy.matrix);
      }
    }
    if (anyAlive) this.particles.instanceMatrix.needsUpdate = true;

    // 掘るにつれて、ふちに掘り出した土が積もる
    const want = Math.floor(this.digProgress * this.clodState.length);
    if (want > this.clodShown) {
      for (let i = this.clodShown; i < want; i++) {
        const c = this.clodState[i];
        const x = Math.cos(c.a) * c.r;
        const z = Math.sin(c.a) * c.r;
        this.clodDummy.position.set(x, this.surfaceYLocal(x, z) + 0.007 * c.s, z);
        this.clodDummy.rotation.set(c.tilt, c.rot, c.tilt * 0.5);
        this.clodDummy.scale.setScalar(c.s);
        this.clodDummy.updateMatrix();
        this.clods.setMatrixAt(i, this.clodDummy.matrix);
      }
      this.clodShown = want;
      this.clods.instanceMatrix.needsUpdate = true;
    }

    // ヒントの光の輪
    if (this.ring.material.opacity > 0.001) {
      this.ringPulse += dt;
      const base = this.ring.userData.target ?? 0;
      this.ring.material.opacity = base * (0.55 + 0.45 * Math.sin(this.ringPulse * 3.1));
      const s = 1 + Math.sin(this.ringPulse * 3.1) * 0.09;
      this.ring.scale.set(s, 1, s);
    }
  }

  showRing(on) {
    this.ring.userData.target = on ? 0.9 : 0;
    this.ring.material.opacity = on ? 0.9 : 0;
    this.ring.visible = on;
    this.ringPulse = 0;
  }

  /** 世界座標のふところ(掘る中心) */
  get center() {
    return this.position;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
  }
}
