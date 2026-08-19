// 餅 -- 実ジオメトリの変形メッシュ
// 粒(cohesion=0) -> まとまり -> びよーんと伸びる(stretch) までを
// 頂点位置の再計算で表現する。臼の底(USU_FLOOR)にローカル原点を置く。
import * as THREE from '../vendor/three.module.js';
import * as TEX from './textures.js';

export const USU_FLOOR = 0.398;   // 臼の内底の高さ
export const MOCHI_R0 = 0.202;    // 臼の中で広がった餅の半径
export const REST_H = 0.106;      // つき上がった餅の厚み

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

/* ばね (臨界減衰より少し揺れる) */
class Spring {
  constructor(k = 90, d = 7) { this.v = 0; this.x = 0; this.k = k; this.d = d; }
  kick(a) { this.v += a; }
  step(dt, target = 0) {
    const steps = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.v += (-(this.x - target) * this.k - this.v * this.d) * h;
      this.x += this.v * h;
    }
    return this.x;
  }
}

export class MochiMass {
  constructor(scene) {
    this.SEG = 56; this.RINGS = 44;
    const geo = new THREE.SphereGeometry(1, this.SEG, this.RINGS);
    geo.deleteAttribute('normal');
    geo.computeVertexNormals();
    this.geo = geo;
    const uv = geo.attributes.uv.array;
    const n = geo.attributes.position.count;
    this.azim = new Float32Array(n);
    this.tParam = new Float32Array(n);
    this.ring = new Uint16Array(n);
    this.grain = new Float32Array(n);
    this.lump = new Float32Array(n);
    const noise = TEX.makeValueNoise(1234);
    const noise2 = TEX.makeValueNoise(99);
    for (let i = 0; i < n; i++) {
      const u = uv[i * 2], t = uv[i * 2 + 1];
      const a = u * Math.PI * 2;
      this.azim[i] = a;
      this.tParam[i] = t;
      this.ring[i] = Math.round(t * this.RINGS);
      // 継ぎ目が割れないよう円筒座標のノイズを使う
      const cx = Math.cos(a) * 2 + 3, cz = Math.sin(a) * 2 + 3;
      this.grain[i] = (TEX.fbm(noise, cx * 13.0, t * 34, 3) - 0.5) * 2;
      this.lump[i] = (TEX.fbm(noise2, cx * 3.4, cz * 3.4 + t * 7, 3) - 0.5) * 2;
    }

    this.normalMap = TEX.riceGrainNormal(512);
    this.mat = new THREE.MeshPhysicalMaterial({
      color: 0xe6dcc4,
      roughness: 0.56,
      metalness: 0.0,
      clearcoat: 0.28,
      clearcoatRoughness: 0.55,
      sheen: 1.0,
      sheenColor: new THREE.Color(0xfff2df),
      sheenRoughness: 0.62,
      normalMap: this.normalMap,
      normalScale: new THREE.Vector2(1.5, 1.5),
      envMapIntensity: 0.9,
      emissive: new THREE.Color(0xffe6cc),
      emissiveIntensity: 0.035,
      map: TEX.mochiSurfaceMap(),
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.position.set(0, USU_FLOOR, 0);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    // 状態
    this.cohesion = 0;
    this.topY = REST_H;          // 餅の頂点の高さ (ローカル)
    this.targetTopY = REST_H;
    this.attached = false;       // 杵に付いているか
    this.squash = new Spring(150, 9);
    this.swayX = new Spring(70, 5.5);
    this.swayZ = new Spring(70, 5.5);
    this.ripple = 0; this.rippleAge = 9;
    this.harm = [0, 0, 0];
    this.harmPhase = [0, 1.7, 3.4];
    this.leanX = 0; this.leanZ = 0;
    this._up = new THREE.Vector3(0, 1, 0);
    this.time = 0;
    this.stretchPeak = 0;
    this.visualR0 = MOCHI_R0;
    this.scaleAll = 1;

    this._ringR = new Float32Array(this.RINGS + 1);
    this._ringY = new Float32Array(this.RINGS + 1);
    this._ringW = new Float32Array(this.RINGS + 1);
    this._ringShape = new Float32Array(this.RINGS + 1);
    this.newShape(0.0);
  }

  newShape(amount = 1) {
    for (let i = 0; i < 3; i++) {
      this.harm[i] = (Math.random() - 0.5) * 0.19 * amount;
      this.harmPhase[i] = Math.random() * Math.PI * 2;
    }
    this.leanX = (Math.random() - 0.5) * 0.075 * amount;
    this.leanZ = (Math.random() - 0.5) * 0.075 * amount;
  }

  hit(power = 1) {
    this.squash.kick(-9.5 * power);
    this.ripple = 0.16 * power; this.rippleAge = 0;
    this.swayX.kick((Math.random() - 0.5) * 1.2);
    this.swayZ.kick((Math.random() - 0.5) * 1.2);
  }

  /* 手返し: 餅を少し回して折り込む */
  fold() {
    this.mesh.rotation.y += 0.55 + Math.random() * 0.5;
    this.squash.kick(-2.2);
    this.swayX.kick((Math.random() - 0.5) * 2.0);
  }

  get stretch() {
    return clamp((this.topY - REST_H) / 0.52, 0, 1.35);
  }

  /* 現在の伸びに応じた杵側の付着半径 */
  topRadius() {
    return mix(MOCHI_R0, 0.062, clamp(this.stretch * 1.4, 0, 1));
  }

  update(dt) {
    this.time += dt;
    const s0 = clamp(this.stretch, 0, 1.35);
    const s = clamp(s0, 0, 1);
    const q = this.squash.step(dt, 0);
    this.rippleAge += dt;
    const swayX = this.swayX.step(dt, 0) * 0.012;
    const swayZ = this.swayZ.step(dt, 0) * 0.012;

    // --- 高さ H と 体積保存的な半径 ---
    const H = Math.max(0.03, this.topY * (1 + q * 0.055));
    const coh = this.cohesion;

    const RINGS = this.RINGS;
    // 高さ方向のリング配分: 伸びるほど首(中央)に多く割り当てる
    const wB = (t) => Math.exp(-Math.pow(t / 0.22, 2));
    const wT = (t) => Math.exp(-Math.pow((1 - t) / 0.18, 2));
    let cum = 0;
    for (let j = 0; j <= RINGS; j++) {
      const t = j / RINGS;
      const w = mix(1.0, 0.80 + 1.5 * (1 - Math.min(1, wB(t) + wT(t))), s);
      this._ringW[j] = w; cum += w;
    }
    let acc = 0;
    for (let j = 0; j <= RINGS; j++) {
      this._ringY[j] = (acc / cum) * H;
      acc += this._ringW[j];
    }
    this._ringY[RINGS] = H;

    // 半径は「絶対高さ」で決める: 臼の中の塊 / 細い首 / 杵に付いた頭
    const R0 = this.visualR0 * (1 - 0.34 * s) * (1 - q * 0.030);
    const rTop = mix(R0, 0.083, s);
    const neckMin = 0.026 + 0.008 * (1 - coh);
    const rNeck = mix(R0, neckMin, Math.pow(s, 0.55));
    const hB = 0.082 + 0.075 * (1 - s);   // 下の塊の高さ
    const hT = 0.062 + 0.115 * (1 - s);   // 上の塊の高さ
    const capB = 0.020 + 0.010 * (1 - s);
    const capT = 0.026 + 0.014 * (1 - s);
    const cap = (x, k) => { const u = clamp(x / k, 0, 1); return Math.sqrt(1 - (1 - u) * (1 - u)); };

    const rip = this.ripple * Math.exp(-this.rippleAge * 6.5);
    for (let j = 0; j <= RINGS; j++) {
      const t = j / RINGS;
      const Y = this._ringY[j];
      const gb = Math.exp(-Math.pow(Y / hB, 2));
      const gt = Math.exp(-Math.pow((H - Y) / hT, 2));
      // 首は重みで下ほどわずかに太る
      const sag = 1 + 0.22 * s * Math.pow(clamp(1 - Y / Math.max(H, 1e-4), 0, 1), 2.2);
      let r = (rNeck * sag + (R0 - rNeck) * gb + (rTop - rNeck) * gt);
      // 粒のうちは山盛り、つくほど平たく広がる
      r *= 1 - 0.40 * (1 - coh) * (1 - s) * Math.pow(clamp(Y / Math.max(H, 1e-4), 0, 1), 1.5);
      r = Math.max(r, 0.012);
      r *= cap(Y, capB) * cap(H - Y, capT);
      r *= 1 + rip * Math.sin(t * 9.0 - this.rippleAge * 22.0);
      this._ringShape[j] = s * Math.exp(-Math.pow((t - 0.55) / 0.36, 2));
      this._ringR[j] = r;
    }

    const grainAmp = 0.0125 * Math.pow(1 - coh, 1.1);
    const lumpAmp = 0.0290 * Math.pow(1 - coh, 1.35);
    const pos = this.geo.attributes.position.array;
    const n = this.geo.attributes.position.count;
    const h1 = this.harm, hp = this.harmPhase;

    for (let i = 0; i < n; i++) {
      const j = this.ring[i];
      const a = this.azim[i];
      const t = this.tParam[i];
      const sw = this._ringShape[j];
      const ang = 1 + sw * (h1[0] * Math.sin(2 * a + hp[0]) + h1[1] * Math.sin(3 * a + hp[1]) + h1[2] * Math.sin(5 * a + hp[2]));
      let r = this._ringR[j] * ang;
      const poleFade = smoothstep(0.0, 0.13, t) * smoothstep(1.0, 0.87, t);
      r += (this.grain[i] * grainAmp + this.lump[i] * lumpAmp) * poleFade;
      const lat = smoothstep(0.05, 1.0, t);
      const bend = s * Math.sin(Math.PI * clamp(t, 0, 1)) * H;
      const i3 = i * 3;
      pos[i3] = -Math.cos(a) * r + swayX * lat + this.leanX * bend;
      pos[i3 + 1] = this._ringY[j];
      pos[i3 + 2] = Math.sin(a) * r + swayZ * lat + this.leanZ * bend;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();

    // --- マテリアルを cohesion で変化させる ---
    const c = this.mat.color;
    c.setRGB(mix(0.855, 0.985, coh), mix(0.800, 0.971, coh), mix(0.680, 0.948, coh));
    c.convertSRGBToLinear();
    this.mat.roughness = mix(0.58, 0.20, coh);
    this.mat.clearcoat = mix(0.22, 1.0, coh);
    this.mat.clearcoatRoughness = mix(0.62, 0.11, coh);
    this.mat.normalScale.setScalar(mix(2.6, 0.18, coh));
    this.mat.envMapIntensity = mix(0.7, 1.5, coh);
    this.mat.sheenRoughness = mix(0.75, 0.35, coh);
  }

  /* 表面上の点 (グレイン配置用) */
  surfacePoint(theta, t, out) {
    const j = clamp(Math.round(t * this.RINGS), 0, this.RINGS);
    const r = this._ringR[j];
    out.set(-Math.cos(theta) * r, this._ringY[j], Math.sin(theta) * r);
    out.applyAxisAngle(this._up, this.mesh.rotation.y);
    out.y += USU_FLOOR;
    return out;
  }
}

/* ---------- ちぎった餅 (丸める対象) ---------- */
export class MochiBlob {
  constructor(scene, radius = 0.062) {
    const geo = new THREE.SphereGeometry(1, 30, 22);
    this.geo = geo;
    const n = geo.attributes.position.count;
    this.base = new Float32Array(geo.attributes.position.array);
    this.noise = new Float32Array(n);
    const noise = TEX.makeValueNoise(Math.floor(Math.random() * 9999));
    const uv = geo.attributes.uv.array;
    for (let i = 0; i < n; i++) {
      const a = uv[i * 2] * Math.PI * 2, t = uv[i * 2 + 1];
      const polar = Math.sin(t * Math.PI);            // 極では 0
      this.noise[i] = (TEX.fbm(noise, Math.cos(a) * 1.6 + 3, Math.sin(a) * 1.6 + t * 3 + 3, 3) - 0.5) * 2 * polar;
    }
    this.mat = new THREE.MeshPhysicalMaterial({
      color: 0xf6f1e6, roughness: 0.28, clearcoat: 0.85, clearcoatRoughness: 0.20,
      sheen: 1, sheenColor: new THREE.Color(0xfff0dc), sheenRoughness: 0.42,
      envMapIntensity: 1.1, emissive: new THREE.Color(0xffe0c0), emissiveIntensity: 0.05,
      normalMap: MochiBlob.skin || (MochiBlob.skin = TEX.mochiSkinNormal()),
      normalScale: new THREE.Vector2(0.5, 0.5),
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.r = radius;
    this.roundness = 0;      // 0: いびつ 1: まん丸
    this.flat = 0;           // 下面の潰れ
    this.spin = 0;
    this.squash = new Spring(180, 10);
    this.phase = Math.random() * 10;
    this.done = false;
  }
  update(dt, time) {
    const q = this.squash.step(dt, 0);
    const rough = (1 - this.roundness);
    const pos = this.geo.attributes.position.array;
    const n = this.geo.attributes.position.count;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const bx = this.base[i3], by = this.base[i3 + 1], bz = this.base[i3 + 2];
      const polar = Math.sqrt(Math.max(0, 1 - by * by));
      const wob = Math.sin(time * 7 + this.phase + by * 4) * 0.02 * (0.3 + rough) * polar;
      const k = 1 + this.noise[i] * 0.22 * rough + wob * rough;
      let y = by * k;
      // 接地面の潰れ
      const fl = this.flat * 0.34;
      if (y < -1 + fl) y = mix(y, -1 + fl, 0.85);
      const widen = 1 + this.flat * 0.16;
      pos[i3] = bx * k * (1 + q * 0.10) * widen;
      pos[i3 + 1] = y * (1 - q * 0.22) * (1 - this.flat * 0.36);
      pos[i3 + 2] = bz * k * (1 + q * 0.10) * widen;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
    this.mesh.scale.setScalar(this.r);
    this.mat.roughness = mix(0.40, 0.17, this.roundness);
    this.mat.clearcoat = mix(0.55, 1.0, this.roundness);
  }
  dispose(scene) { scene.remove(this.mesh); this.geo.dispose(); this.mat.dispose(); }
}

/* ---------- 引き離すときの餅の糸 ---------- */
export class MochiString {
  constructor(scene, mat) {
    this.N = 14; this.SEG = 10;
    this.geo = new THREE.CylinderGeometry(1, 1, 1, this.SEG, this.N - 1, true);
    this.base = new Float32Array(this.geo.attributes.position.array);
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.a = new THREE.Vector3(); this.b = new THREE.Vector3();
  }
  set(a, b, thickness, progress) {
    this.a.copy(a); this.b.copy(b);
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-4) { this.mesh.visible = false; return; }
    const pos = this.geo.attributes.position.array;
    const n = this.geo.attributes.position.count;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const v = this.base[i3 + 1] + 0.5;         // 0..1
      const taper = Math.pow(Math.sin(Math.PI * clamp(v, 0, 1)), 0.55);
      const neck = mix(1, 0.10, progress);
      const r = thickness * mix(0.35 + 0.65 * taper, taper, 0.6) * neck;
      pos[i3] = this.base[i3] * r * 2;
      pos[i3 + 1] = (v - 0.5) * len;
      pos[i3 + 2] = this.base[i3 + 2] * r * 2;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
    this.mesh.position.copy(a).addScaledVector(dir, 0.5);
    this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    this.mesh.visible = true;
  }
  hide() { this.mesh.visible = false; }
}

export { Spring, clamp, mix, smoothstep };
