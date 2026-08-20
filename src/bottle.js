// ---------------------------------------------------------------------------
// ラムネ瓶本体。このゲームの描画予算はほぼ全部ここに集中させる。
//
// 完全な屈折は狙わない。モバイルで壊れるだけで、得られるものが少ない。
// 代わりに次の 5 点に予算を寄せる:
//   1. シルエット（コッド瓶の首とふくらみ）
//   2. 厚み（縁に向かって濃くなる青緑）
//   3. 環境反射
//   4. 中のビー玉が確実に読めること
//   5. 結露
// 手前のガラスと奥のガラスを別メッシュに分け、その間に中身を挟むことで
// 「厚いガラスの中に物が入っている」感じを nested transparency なしで出す。
// ---------------------------------------------------------------------------
import * as THREE from '../vendor/three/three.module.min.js';
import {
  OUTER, INNER, MARBLE_R, MOUTH_Y, DIMPLE,
  innerRadiusAt, outerRadiusAt, dimpleInset, buildVolumeSamples, LIQUID_START_Y,
} from './profile.js';
import { makeCondensation, makeMarbleMatcap, makeFoam, makeRng } from './textures.js';
import { Bubbles, MarbleCling } from './bubbles.js';

export const VARIANTS = [
  { glass: 0x7ecabb, absorb: [1.55, 0.42, 0.86], marble: '#e2f2f0', name: 'aqua'  },
  { glass: 0x8fce9f, absorb: [1.62, 0.36, 1.18], marble: '#e8f2e4', name: 'green' },
  { glass: 0x6fc3d6, absorb: [1.78, 0.62, 0.44], marble: '#dfeef8', name: 'blue'  },
  { glass: 0xa2d4bc, absorb: [1.28, 0.34, 0.92], marble: '#f2efdd', name: 'pale'  },
];

// --- ジオメトリ -------------------------------------------------------------

function rimArc(from, to, steps = 4) {
  // 口元を丸める（接写で一番目立つエッジ）
  const pts = [];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const r = from[1] + (to[1] - from[1]) * t;
    const y = MOUTH_Y + Math.sin(t * Math.PI) * 0.0007;
    pts.push([y, r]);
  }
  return pts;
}

function buildGlassGeometry(segments) {
  const pts = [];
  for (const [y, r] of OUTER) pts.push(new THREE.Vector2(r, y));
  for (const p of rimArc(OUTER[OUTER.length - 1], INNER[0])) pts.push(new THREE.Vector2(p[1], p[0]));
  for (const [y, r] of INNER) pts.push(new THREE.Vector2(r, y));

  const geo = new THREE.LatheGeometry(pts, segments);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.hypot(v.x, v.z);
    if (r < 1e-6) continue;
    const phi = Math.atan2(v.z, v.x);
    const inset = dimpleInset(v.y, phi);
    if (inset <= 0) continue;
    const k = Math.max(0.05, (r - inset) / r);
    pos.setX(i, v.x * k);
    pos.setZ(i, v.z * k);
  }
  geo.computeVertexNormals();
  // 継ぎ目（phi=0 と phi=2PI）の法線を揃えて縦の線が出ないようにする
  const nrm = geo.attributes.normal;
  const stride = pts.length;
  for (let j = 0; j < stride; j++) {
    const a = j, b = segments * stride + j;
    const nx = (nrm.getX(a) + nrm.getX(b)) * 0.5;
    const ny = (nrm.getY(a) + nrm.getY(b)) * 0.5;
    const nz = (nrm.getZ(a) + nrm.getZ(b)) * 0.5;
    const l = Math.hypot(nx, ny, nz) || 1;
    nrm.setXYZ(a, nx / l, ny / l, nz / l);
    nrm.setXYZ(b, nx / l, ny / l, nz / l);
  }
  nrm.needsUpdate = true;
  geo.computeBoundingSphere();
  return geo;
}

function buildLiquidGeometry(segments) {
  const inset = 0.00018;
  const pts = [new THREE.Vector2(0, 0.0080 + inset)];
  const asc = INNER.slice().reverse();
  for (const [y, r] of asc) {
    if (y < 0.0090 || y > 0.1880) continue;
    pts.push(new THREE.Vector2(Math.max(r - inset, 0.0002), y));
  }
  pts.push(new THREE.Vector2(Math.max(innerRadiusAt(0.1880) - inset, 0.0002), 0.1880));
  pts.push(new THREE.Vector2(0, 0.1880));
  const geo = new THREE.LatheGeometry(pts, Math.max(24, segments - 12));
  geo.computeVertexNormals();
  return geo;
}

// --- マテリアル -------------------------------------------------------------

/**
 * 厚いガラス。transmission は使わない（モバイルでの負荷と nested transparency の
 * 破綻を避ける）。代わりに視線と法線の角度から「光が通る距離」を近似して
 * 縁を濃く・不透明にする。厚いガラスらしさはほぼこの 1 式で出る。
 */
export function makeGlassMaterial(color, absorb, opts = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: opts.roughness ?? 0.045,
    envMapIntensity: opts.env ?? 1.7,
    clearcoat: 0.55,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: opts.side ?? THREE.FrontSide,
    premultipliedAlpha: false,
  });
  mat.userData.uniforms = {
    uAlphaMin: { value: opts.alphaMin ?? 0.13 },
    uAbsorb: { value: new THREE.Vector3(...absorb).multiplyScalar(opts.absorbScale ?? 1) },
    uFres: { value: opts.fres ?? 1.35 },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uAlphaMin; uniform vec3 uAbsorb; uniform float uFres;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 gN = normalize( vNormal );
        vec3 gV = normalize( vViewPosition );
        float ndv = clamp( abs( dot( gN, gV ) ), 0.001, 1.0 );
        float fres = pow( 1.0 - ndv, 3.1 );
        float path = 1.0 / max( ndv, 0.14 );
        diffuseColor.rgb *= exp( -uAbsorb * ( path - 0.55 ) );
        diffuseColor.a *= clamp( uAlphaMin + ( 1.0 - uAlphaMin ) * fres * uFres
                                 + pow( 1.0 - ndv, 9.0 ) * 0.12, 0.0, 0.88 );`);
  };
  mat.customProgramCacheKey = () => 'ramune-glass';
  return mat;
}

/** 中身の液体。world 空間の水平面で切るので、傾けても液面が水平を保つ。 */
function makeLiquidMaterial(color) {
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: 0.03,
    envMapIntensity: 1.5,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  mat.userData.uniforms = {
    uLevel: { value: 0.2 },
    uBand: { value: new THREE.Color(0xdffbff) },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform float uLevel;\nuniform vec3 uBand;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if ( vWPos.y > uLevel ) discard;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // 見込み角が浅いほど液を長く通る = 濃く見える
        vec3 lN = normalize( vNormal );
        vec3 lV = normalize( vViewPosition );
        float lndv = clamp( abs( dot( lN, lV ) ), 0.001, 1.0 );
        diffuseColor.a *= clamp( 0.07 + 0.50 * pow( 1.0 - lndv, 1.8 ), 0.0, 1.0 );
        float dLevel = uLevel - vWPos.y;
        float band = 1.0 - smoothstep( 0.0, 0.0020, dLevel );
        totalEmissiveRadiance += uBand * band * 0.30;
        diffuseColor.a = clamp( diffuseColor.a + band * 0.42, 0.0, 1.0 );`);
  };
  mat.customProgramCacheKey = () => 'ramune-liquid';
  return mat;
}

// --- 本体 -------------------------------------------------------------------

export class Bottle {
  constructor(quality, variantIndex = 0, seed = 1) {
    const forced = new URLSearchParams(location.search).get('variant');
    if (forced !== null) variantIndex = parseInt(forced, 10) || 0;
    const V = VARIANTS[variantIndex % VARIANTS.length];
    this.variant = V;
    this.group = new THREE.Group();
    this.quality = quality;
    const rng = makeRng(seed * 7919 + 13);

    // --- ガラス（奥 → 手前の 2 パス）
    const geo = buildGlassGeometry(quality.lathe);
    this.glassGeo = geo;
    this.matBack = makeGlassMaterial(V.glass, V.absorb, {
      side: THREE.BackSide, alphaMin: 0.20, absorbScale: 1.25, env: 1.1, fres: 1.0,
    });
    this.matFront = makeGlassMaterial(V.glass, V.absorb, {
      side: THREE.FrontSide, alphaMin: 0.12, env: 1.9, fres: 1.45,
    });
    const cond = makeCondensation(seed * 31 + 5);
    cond.repeat.set(2, 3.2);
    this.matFront.roughnessMap = cond;
    this.matFront.roughness = 0.17;
    this.condMap = cond;

    this.glassBack = new THREE.Mesh(geo, this.matBack);
    this.glassBack.renderOrder = 2;
    this.glassFront = new THREE.Mesh(geo, this.matFront);
    this.glassFront.renderOrder = 8;
    this.glassFront.castShadow = false;
    this.group.add(this.glassBack, this.glassFront);

    // --- 液体
    this.liquidMat = makeLiquidMaterial(0x4fc0b4);
    this.liquid = new THREE.Mesh(buildLiquidGeometry(quality.lathe), this.liquidMat);
    this.liquid.renderOrder = 3;
    this.group.add(this.liquid);

    // 上から見たときの液面（傾けると意味を失うのでフェードで消す）
    this.surfaceCap = new THREE.Mesh(
      new THREE.CircleGeometry(1, 28),
      new THREE.MeshPhysicalMaterial({
        color: 0xbdeae2, roughness: 0.015, metalness: 0, envMapIntensity: 2.6,
        transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    this.surfaceCap.rotation.x = -Math.PI / 2;
    this.surfaceCap.renderOrder = 4;
    this.group.add(this.surfaceCap);

    // --- ビー玉（matcap の芯 + 環境を映す薄いガラス殻）
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(MARBLE_R * 0.985, 28, 20),
      new THREE.ShaderMaterial({
        uniforms: { uMatcap: { value: makeMarbleMatcap(V.marble) } },
        vertexShader: `
          varying vec3 vVN;
          void main(){
            vVN = normalize( normalMatrix * normal );
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
          }`,
        fragmentShader: `
          uniform sampler2D uMatcap;
          varying vec3 vVN;
          void main(){
            vec2 uv = normalize( vVN ).xy * 0.495 + 0.5;
            vec4 c = texture2D( uMatcap, uv );
            gl_FragColor = vec4( c.rgb, 1.0 );
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    );
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(MARBLE_R, 28, 20),
      new THREE.MeshPhysicalMaterial({
        color: 0x0e2428, metalness: 0, roughness: 0.012,
        envMapIntensity: 2.2, clearcoat: 1, clearcoatRoughness: 0.02,
        transparent: true, opacity: 0.24, depthWrite: false,
      }),
    );
    shell.renderOrder = 5;
    this.marble = new THREE.Group();
    this.marbleCore = core;
    core.renderOrder = 4;
    this.marble.add(core, shell);
    this.marble.position.set(0, 0.1892, 0);
    this.group.add(this.marble);

    // --- 泡
    this.bubbles = new Bubbles(quality.bubbles, null);
    this.group.add(this.bubbles.points);
    this.cling = new MarbleCling(this.bubbles.material.uniforms.uMap.value);
    this.marble.add(this.cling.points);

    // --- 瓶口の泡（開栓の証拠）
    const foamTex = makeFoam(seed * 17 + 3);
    this.foam = new THREE.Mesh(
      new THREE.SphereGeometry(0.0095, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.92, metalness: 0,
        transparent: true, opacity: 0, depthWrite: false, alphaMap: foamTex,
      }),
    );
    this.foam.position.y = MOUTH_Y - 0.0015;
    this.foam.renderOrder = 9;
    this.group.add(this.foam);

    this.puff = new THREE.Sprite(new THREE.SpriteMaterial({
      map: foamTex, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.puff.position.y = MOUTH_Y + 0.004;
    this.puff.scale.setScalar(0.02);
    this.puff.renderOrder = 10;
    this.group.add(this.puff);

    // --- 結露の水滴
    this.buildDroplets(rng, quality.droplets);

    // --- 液量
    this.samples = Bottle.samples || (Bottle.samples = buildVolumeSamples(1100));
    this.fullVolume = this.samples.volume;
    this.volume = this.fullVolume * this.filledFraction(LIQUID_START_Y);
    this.levelLocal = LIQUID_START_Y;
    this.levelWorld = LIQUID_START_Y;
    this.foamAmount = 0;
    this.puffAmount = 0;
  }

  filledFraction(localY) {
    const p = this.samples.points;
    let n = 0;
    for (let i = 0; i < this.samples.count; i++) if (p[i * 3 + 1] < localY) n++;
    return n / this.samples.count;
  }

  buildDroplets(rng, count) {
    if (count <= 0) return;
    const geo = new THREE.SphereGeometry(1, 8, 6);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xf2fdff, metalness: 0, roughness: 0.03,
      envMapIntensity: 2.4, clearcoat: 1,
      transparent: true, opacity: 0.42, depthWrite: false,
    });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const nrm = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const t = rng();
      const y = 0.012 + Math.pow(t, 0.85) * 0.150;
      const phi = rng() * Math.PI * 2;
      const r = outerRadiusAt(y) - dimpleInset(y, phi);
      pos.set(Math.cos(phi) * r, y, Math.sin(phi) * r);
      // 外向き法線（プロファイルの傾きは無視して近似）
      nrm.set(Math.cos(phi), 0.18, Math.sin(phi)).normalize();
      q.setFromUnitVectors(up, nrm);
      const s = 0.00035 + Math.pow(rng(), 2.2) * 0.0013;
      scl.set(s, s * (0.35 + rng() * 0.3), s * (0.85 + rng() * 0.5));
      m.compose(pos.addScaledVector(nrm, s * 0.12), q, scl);
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.renderOrder = 9;
    inst.frustumCulled = false;
    this.droplets = inst;
    this.group.add(inst);
  }

  setEnvMap(env) {
    for (const m of [this.matBack, this.matFront, this.liquidMat, this.surfaceCap.material]) m.envMap = env;
    this.marble.children[1].material.envMap = env;
    if (this.droplets) this.droplets.material.envMap = env;
  }

  /** 残量から world 空間の水平液面高さを二分探索で求める（任意の傾きで正しい） */
  updateLevel() {
    const target = this.volume / this.fullVolume;
    const p = this.samples.points;
    const n = this.samples.count;
    const mat = this.group.matrixWorld.elements;
    // world Y のみ必要
    const ys = this._ys || (this._ys = new Float32Array(n));
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
      const wy = mat[1] * x + mat[5] * y + mat[9] * z + mat[13];
      ys[i] = wy;
      if (wy < lo) lo = wy;
      if (wy > hi) hi = wy;
    }
    if (target >= 0.999) { this.levelWorld = hi + 0.001; }
    else if (target <= 0.0005) { this.levelWorld = lo - 0.001; }
    else {
      const want = target * n;
      for (let it = 0; it < 16; it++) {
        const mid = (lo + hi) * 0.5;
        let c = 0;
        for (let i = 0; i < n; i++) if (ys[i] < mid) c++;
        if (c < want) lo = mid; else hi = mid;
      }
      this.levelWorld = (lo + hi) * 0.5;
    }
    this.liquidMat.userData.uniforms.uLevel.value = this.levelWorld;
    // 瓶ローカルでの液面（泡の上限に使う）
    const inv = this._inv || (this._inv = new THREE.Matrix4());
    inv.copy(this.group.matrixWorld).invert();
    const v = this._tmp || (this._tmp = new THREE.Vector3());
    v.set(0, this.levelWorld, 0).applyMatrix4(inv);
    this.levelLocal = THREE.MathUtils.clamp(v.y, 0.009, 0.1880);
  }

  /** 瓶口の world 座標 */
  mouthWorld(target) {
    return target.set(0, MOUTH_Y, 0).applyMatrix4(this.group.matrixWorld);
  }

  update(dt, time, tiltRad, pixelScale) {
    this.updateLevel();
    // 液面キャップ（傾けたら意味を失うので消す）
    const upright = 1 - THREE.MathUtils.smoothstep(Math.abs(tiltRad), 0.22, 0.55);
    const capMat = this.surfaceCap.material;
    capMat.opacity = 0.42 * upright;
    this.surfaceCap.visible = upright > 0.02;
    if (this.surfaceCap.visible) {
      const r = Math.max(innerRadiusAt(this.levelLocal) - 0.0002, 0.0004);
      this.surfaceCap.scale.setScalar(r);
      // world 水平を保つ
      this.group.updateMatrixWorld();
      this.surfaceCap.position.set(0, this.levelLocal, 0);
      this.group.getWorldQuaternion(this._wq || (this._wq = new THREE.Quaternion()));
      this.surfaceCap.quaternion.copy(this._wq).invert();
      this.surfaceCap.rotateX(-Math.PI / 2);
    }

    this.bubbles.update(dt, time, this.levelLocal);
    this.bubbles.setPixelScale(pixelScale);

    // 未開栓の瓶は炭酸圧で満たされていて、液面がビー玉の底に触れている。
    // その小さな気泡がときどきビー玉に当たり、下側に溜まる。ここが「謎」。
    const wet = THREE.MathUtils.clamp(
      (this.levelLocal - (this.marble.position.y - MARBLE_R * 1.05)) / 0.003, 0, 1);
    const cling = wet * this.clingFade;
    this.cling.update(time, cling, pixelScale);
    this.cling.points.visible = cling > 0.02;

    this.foam.material.opacity = this.foamAmount * 0.85;
    this.foam.visible = this.foamAmount > 0.02;
    this.foam.scale.setScalar(0.75 + this.foamAmount * 0.45);
    this.foamAmount = Math.max(0, this.foamAmount - dt * 0.30);

    this.puff.material.opacity = this.puffAmount * 0.5;
    this.puff.visible = this.puffAmount > 0.02;
    this.puff.scale.setScalar(0.018 + (1 - this.puffAmount) * 0.055);
    this.puffAmount = Math.max(0, this.puffAmount - dt * 1.6);
  }

  pop() {
    this.bubbles.pop();
    this.foamAmount = 1.0;
    this.puffAmount = 1.0;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const list = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of list) {
          for (const k of ['map', 'alphaMap', 'roughnessMap']) if (m[k]) m[k].dispose();
          m.dispose();
        }
      }
    });
  }
}
Bottle.prototype.clingFade = 1;
