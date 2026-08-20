// ---------------------------------------------------------------------------
// 炭酸の泡。Object3D は 1 個だけ。位置は全部頂点シェーダで計算するので
// CPU コストは毎フレーム uniform 数個の更新のみ。
// ---------------------------------------------------------------------------
import * as THREE from '../vendor/three/three.module.min.js';
import { makeBubbleSprite } from './textures.js';

const VS = /* glsl */`
attribute vec4 aSeed;   // x:角度 y:半径 z:位相 w:乱数
attribute vec2 aGate;   // x:出現しきい値 y:速度乱数
uniform float uTime, uBurst, uWaveY, uSurfaceY, uPixel, uSize, uIdle;
varying float vAlpha;

void main(){
  float speed = mix(0.10, 0.30, aGate.y) * (0.35 + uBurst * 1.5);
  float phase = fract(aSeed.z + uTime * speed);
  float yStart = 0.012;
  float span = max(uSurfaceY - yStart, 0.001);
  float y = yStart + phase * span;

  // 内壁半径の近似（胴→肩→首）
  float rMax = mix(0.0268, 0.0225, smoothstep(0.100, 0.118, y));
  rMax = mix(rMax, 0.0130, smoothstep(0.118, 0.140, y));
  rMax = mix(rMax, 0.0058, smoothstep(0.140, 0.157, y));
  rMax = mix(rMax, 0.0105, smoothstep(0.158, 0.166, y));

  float ang = aSeed.x * 6.2831853 + phase * 1.2;
  float rad = aSeed.y * rMax * 0.94;
  vec3 p = vec3(cos(ang) * rad, y, sin(ang) * rad);
  p.x += sin(uTime * 3.3 + aSeed.z * 24.0) * 0.00075;
  p.z += cos(uTime * 2.9 + aSeed.w * 19.0) * 0.00075;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dia = (0.00035 + aSeed.w * 0.0011) * uSize * (1.0 + uBurst * 0.55);
  gl_PointSize = clamp(dia * uPixel / max(-mv.z, 0.02), 1.0, 40.0);
  gl_Position = projectionMatrix * mv;

  // 開栓前はごく一部だけ、開栓時は下から上へ一斉に
  float alive = step(aGate.x, mix(uIdle, 1.0, uBurst));
  alive *= step(y, uWaveY);
  float fadeTop = 1.0 - smoothstep(0.90, 1.0, phase);
  float fadeBot = smoothstep(0.0, 0.05, phase);
  vAlpha = alive * fadeTop * fadeBot * (0.45 + 0.55 * uBurst);
}`;

const FS = /* glsl */`
uniform sampler2D uMap;
varying float vAlpha;
void main(){
  vec4 t = texture2D(uMap, gl_PointCoord);
  float a = t.a * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(t.rgb, a);
  #include <colorspace_fragment>
}`;

export class Bubbles {
  constructor(count, sprite) {
    const seeds = new Float32Array(count * 4);
    const gates = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      seeds[i * 4 + 0] = Math.random();
      seeds[i * 4 + 1] = Math.sqrt(Math.random());
      seeds[i * 4 + 2] = Math.random();
      seeds[i * 4 + 3] = Math.random();
      gates[i * 2 + 0] = Math.random();
      gates[i * 2 + 1] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    g.setAttribute('aGate', new THREE.BufferAttribute(gates, 2));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.09, 0), 0.12);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VS,
      fragmentShader: FS,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uBurst: { value: 0 },
        uWaveY: { value: 1 },
        uSurfaceY: { value: 0.18 },
        uPixel: { value: 800 },
        uSize: { value: 1 },
        uIdle: { value: 0.05 },
        uMap: { value: sprite || makeBubbleSprite() },
      },
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    this.burst = 0;
    this.wave = 1;
  }

  /** 開栓の瞬間: 下から上へ泡が立ち上がる */
  pop() {
    this.burst = 1.0;
    this.wave = 0.0;
  }

  update(dt, time, surfaceY) {
    this.burst = Math.max(0, this.burst - dt * 0.26);
    this.wave = Math.min(1.0, this.wave + dt * 2.3);
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uBurst.value = this.burst * this.burst * (3 - 2 * this.burst);
    u.uWaveY.value = 0.012 + this.wave * 0.34;
    u.uSurfaceY.value = surfaceY;
  }

  setPixelScale(v) { this.material.uniforms.uPixel.value = v; }
}

/** ビー玉の下側に張り付く気泡（開栓前の「なんだろう？」を作る） */
export class MarbleCling {
  constructor(sprite, count = 34) {
    const pos = new Float32Array(count * 3);
    const rnd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.0028 + Math.random() * 0.0048;
      pos[i * 3 + 0] = Math.cos(a) * r;
      pos[i * 3 + 1] = -0.0068 - Math.random() * 0.0040;
      pos[i * 3 + 2] = Math.sin(a) * r * 0.6;
      rnd[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uTime: { value: 0 }, uPixel: { value: 800 }, uFade: { value: 1 },
        uMap: { value: sprite },
      },
      vertexShader: /* glsl */`
        attribute float aRand;
        uniform float uTime, uPixel, uFade;
        varying float vA;
        void main(){
          vec3 p = position;
          p.y += sin(uTime * 2.2 + aRand * 31.0) * 0.0004;
          p.x += cos(uTime * 1.7 + aRand * 17.0) * 0.0003;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = clamp((0.00055 + aRand * 0.0010) * uPixel / max(-mv.z, 0.02), 1.0, 30.0);
          gl_Position = projectionMatrix * mv;
          vA = uFade * (0.45 + 0.55 * sin(uTime * 1.3 + aRand * 12.0));
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uMap; varying float vA;
        void main(){
          vec4 t = texture2D(uMap, gl_PointCoord);
          float a = t.a * vA;
          if (a < 0.01) discard;
          gl_FragColor = vec4(t.rgb, a);
          #include <colorspace_fragment>
        }`,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
  }
  update(time, fade, pixel) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uFade.value = fade;
    this.material.uniforms.uPixel.value = pixel;
  }
}
