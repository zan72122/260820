import * as THREE from 'three';
import { makeRng } from '../util/math';

export const WATER_Y = -0.32;

/**
 * 釣り口の水面。通常は濃紺で中は見せない。
 * ・糸の出入りによる小さな波紋
 * ・魚が近づいたときだけの局所的な反射変化（一度だけの銀の筋）
 */
export class HoleWater {
  mesh: THREE.Mesh;
  private uniforms: {
    uTime: { value: number };
    uRippleT: { value: number };
    uEntry: { value: THREE.Vector2 };
    uEntryActivity: { value: number };
    uFishGlow: { value: number };
  };

  constructor(radius: number) {
    this.uniforms = {
      uTime: { value: 0 },
      uRippleT: { value: 10 },
      uEntry: { value: new THREE.Vector2(0, 0) },
      uEntryActivity: { value: 0 },
      uFishGlow: { value: 0 }
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv * 2.0 - 1.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform float uTime;
        uniform float uRippleT;
        uniform vec2 uEntry;
        uniform float uEntryActivity;
        uniform float uFishGlow;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                     mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
        }

        void main() {
          float r = length(vUv);
          // 濃紺の水面。中は見せない
          vec3 deep = vec3(0.031, 0.075, 0.118);
          vec3 mid = vec3(0.055, 0.118, 0.173);
          float n = noise(vUv * 5.0 + vec2(uTime * 0.12, uTime * 0.07));
          float n2 = noise(vUv * 11.0 - vec2(uTime * 0.05, uTime * 0.1));
          vec3 col = mix(deep, mid, n * 0.55 + n2 * 0.2);

          // 縁の暗さ（釣り口の影）
          col *= 0.55 + 0.45 * smoothstep(1.0, 0.55, r);

          // 糸の入水点まわりの連続的な小波紋
          float de = length(vUv - uEntry);
          float entryRip = sin(de * 46.0 - uTime * 7.0) * exp(-de * 7.0) * uEntryActivity;
          col += vec3(0.05, 0.09, 0.11) * max(entryRip, 0.0);

          // 単発のリング波紋
          float ringR = uRippleT * 0.9;
          float ring = exp(-pow((r - ringR) * 14.0, 2.0)) * exp(-uRippleT * 2.2);
          col += vec3(0.10, 0.15, 0.17) * ring;

          // 魚が浮上するときの一度だけの細い銀の反射
          float streak = exp(-pow((vUv.x * 2.2 - vUv.y) * 6.0, 2.0)) * exp(-r * 1.8);
          col += vec3(0.62, 0.7, 0.72) * streak * uFishGlow;

          // 空の淡い写り込み
          col += vec3(0.03, 0.045, 0.055) * (0.4 + 0.6 * noise(vUv * 3.0 + uTime * 0.03));

          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    this.mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = WATER_Y;
  }

  triggerRipple() {
    this.uniforms.uRippleT.value = 0;
  }

  set entryActivity(v: number) {
    this.uniforms.uEntryActivity.value = v;
  }
  get entryActivity() {
    return this.uniforms.uEntryActivity.value;
  }

  set fishGlow(v: number) {
    this.uniforms.uFishGlow.value = v;
  }
  get fishGlow() {
    return this.uniforms.uFishGlow.value;
  }

  setEntry(x: number, z: number, radius: number) {
    this.uniforms.uEntry.value.set(x / radius, -z / radius);
  }

  update(dt: number) {
    this.uniforms.uTime.value += dt;
    this.uniforms.uRippleT.value += dt;
  }
}

/**
 * 水中。最初の因果表示のためのカットアウェイ空間。
 * 湖全体を透明にはせず、釣り口の下の局所的な体積だけを描く。
 */
export class Underwater {
  root = new THREE.Group();
  private shaft: THREE.Mesh;
  private motes: THREE.Points;
  private moteBase: Float32Array;

  constructor() {
    // 深さ方向のグラデーションで閉じた円筒空間
    const wallGeo = new THREE.CylinderGeometry(3.0, 2.6, 3.6, 36, 1, true);
    const wallMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { uTop: { value: WATER_Y } },
      vertexShader: /* glsl */ `
        varying float vY;
        void main() {
          vY = (modelMatrix * vec4(position, 1.0)).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying float vY;
        uniform float uTop;
        void main() {
          float d = clamp((uTop - vY) / 3.4, 0.0, 1.0);
          vec3 top = vec3(0.075, 0.180, 0.259);
          vec3 bottom = vec3(0.012, 0.035, 0.059);
          gl_FragColor = vec4(mix(top, bottom, pow(d, 0.75)), 1.0);
        }
      `
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = WATER_Y - 1.8;
    this.root.add(wall);
    const bottom = new THREE.Mesh(
      new THREE.CircleGeometry(2.65, 36),
      new THREE.MeshBasicMaterial({ color: 0x03101a })
    );
    bottom.rotation.x = Math.PI / 2;
    bottom.position.y = WATER_Y - 3.55;
    this.root.add(bottom);

    // 水面下から見上げた面（薄明るい天井）
    const ceiling = new THREE.Mesh(
      new THREE.CircleGeometry(3.0, 36),
      new THREE.MeshBasicMaterial({
        color: 0x2c4a5e,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.9
      })
    );
    ceiling.rotation.x = -Math.PI / 2;
    ceiling.position.y = WATER_Y - 0.005;
    this.root.add(ceiling);

    // 釣り口から差す淡い光条
    const shaftGeo = new THREE.CylinderGeometry(0.13, 0.5, 2.6, 20, 1, true);
    const shaftMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {},
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        void main() {
          float a = vUv.y * vUv.y * 0.10;
          gl_FragColor = vec4(0.45, 0.62, 0.72, a);
        }
      `
    });
    this.shaft = new THREE.Mesh(shaftGeo, shaftMat);
    this.shaft.position.y = WATER_Y - 1.3;
    this.root.add(this.shaft);

    // 浮遊する微細な粒子
    const rng = makeRng(91);
    const count = 130;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rng() - 0.5) * 1.6;
      pos[i * 3 + 1] = WATER_Y - 0.15 - rng() * 2.6;
      pos[i * 3 + 2] = (rng() - 0.5) * 1.6;
    }
    this.moteBase = pos.slice();
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(
      moteGeo,
      new THREE.PointsMaterial({
        color: 0x9fc2cc,
        size: 0.0045,
        transparent: true,
        opacity: 0.4,
        depthWrite: false
      })
    );
    this.root.add(this.motes);

    // 水中の照明（水中の魚にだけ効くよう座標を下に）
    const uwLight = new THREE.HemisphereLight(0x4d7a8e, 0x081720, 1.1);
    uwLight.position.set(0, WATER_Y, 0);
    this.root.add(uwLight);
  }

  update(time: number) {
    const attr = this.motes.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] = this.moteBase[i] + Math.sin(time * 0.12 + i) * 0.04;
      arr[i + 1] = this.moteBase[i + 1] + Math.sin(time * 0.07 + i * 1.7) * 0.05;
      arr[i + 2] = this.moteBase[i + 2] + Math.cos(time * 0.09 + i * 0.9) * 0.04;
    }
    attr.needsUpdate = true;
  }
}
