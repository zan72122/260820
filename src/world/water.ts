import * as THREE from 'three'
import type { Environment } from './environment'
import { makeWaterNormal } from './textures'


/** 反射させたい光源（橋の灯り・案内灯・街あかり）。 */
export type ReflectedLight = { pos: THREE.Vector3; color: THREE.Color; power: number }

const MAX_LIGHTS = 12

const VERT = /* glsl */ `
varying vec3 vWorld;
uniform float uTime;
void main() {
  vec3 p = position;
  // ゆるい大きなうねり（頂点で）
  p.z += sin(p.x * 0.011 + uTime * 0.30) * 0.22
       + sin(p.y * 0.021 - uTime * 0.23) * 0.13;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorld;

uniform float uTime;
uniform sampler2D uNormalMap;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunGlow;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uHorizonWarm;
uniform vec3 uDeep;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uNight;
uniform vec3 uLightPos[${MAX_LIGHTS}];
uniform vec3 uLightCol[${MAX_LIGHTS}];
uniform int uLightCount;

vec3 skyColor(vec3 dir) {
  float up = clamp(dir.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(up, 0.42));
  vec3 fd = normalize(vec3(dir.x, 0.0, dir.z));
  vec3 fs = normalize(vec3(uSunDir.x, 0.0, uSunDir.z));
  float az = clamp(dot(fd, fs), 0.0, 1.0);
  float band = pow(az, 2.6) * pow(1.0 - up, 3.4);
  col = mix(col, uHorizonWarm, clamp(band * uSunGlow, 0.0, 1.0));
  float cs = clamp(dot(dir, uSunDir), 0.0, 1.0);
  col += uSunColor * pow(cs, 6.0) * 0.30 * uSunGlow;
  return col;
}

vec3 sampleWaves(vec2 p, float fade) {
  vec3 n = vec3(0.0);
  n += (texture2D(uNormalMap, p * 0.035 + vec2(uTime * 0.0075, uTime * 0.0035)).xyz * 2.0 - 1.0) * 1.0;
  n += (texture2D(uNormalMap, p * 0.011 - vec2(uTime * 0.0045, uTime * 0.0021)).xyz * 2.0 - 1.0) * 0.85;
  n += (texture2D(uNormalMap, p * 0.105 + vec2(-uTime * 0.019, uTime * 0.013)).xyz * 2.0 - 1.0) * 0.55 * fade;
  return normalize(vec3(n.x * 0.42, 1.0, n.y * 0.42));
}

void main() {
  vec3 V = normalize(uCamPos - vWorld);
  float dist = length(uCamPos - vWorld);

  // 細かい波だけ距離で寝かせる（ちらつき対策）。大きなうねりは遠くまで残す。
  float detailFade = 1.0 - clamp(dist / 300.0, 0.0, 1.0);
  vec3 N = sampleWaves(vWorld.xz, detailFade);
  N = normalize(mix(vec3(0.0, 1.0, 0.0), N, 0.55 + 0.45 * clamp(1.0 - dist / 900.0, 0.0, 1.0)));

  // 風のむら。ざらつく所とつるりとした所ができて、川面に帯ができる
  float gust =
      sin(vWorld.x * 0.0285 + uTime * 0.055) * sin(vWorld.z * 0.055 - uTime * 0.041) * 0.42
    + sin(vWorld.x * 0.079 - uTime * 0.031) * 0.22
    + sin(vWorld.z * 0.118 + uTime * 0.024) * 0.14
    + 0.5;
  gust = clamp(gust, 0.0, 1.0);
  float rough = 0.14 + 0.86 * gust;
  N = normalize(mix(vec3(0.0, 1.0, 0.0), N, 0.35 + 0.65 * rough));

  vec3 R = reflect(-V, N);
  R.y = max(R.y, 0.004);          // 水面下へ潜った反射だけ持ち上げる
  vec3 refl = skyColor(normalize(R));
  // ざらついた所は広い範囲の空をならして拾う＝しっとり暗くなる
  vec3 reflWide = skyColor(normalize(vec3(R.x, R.y + 0.52, R.z)));
  refl = mix(refl, reflWide, rough * 0.80);

  // 水は正面から見ると中が見え、寝かせて見るほど鏡になる
  float fres = 0.021 + 0.979 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);

  // 岸際は浅くて濁る
  float shore = 1.0 - smoothstep(70.0, 95.0, abs(vWorld.z));
  vec3 deep = mix(uDeep * 1.35, uDeep, shore);
  deep = mix(deep, vec3(0.15, 0.13, 0.10), (1.0 - shore) * 0.6);

  vec3 col = mix(deep, refl, fres);

  // 太陽のきらめき（逆光の川面）
  vec3 Rv = reflect(-V, N);
  float sunSpec = pow(max(dot(Rv, uSunDir), 0.0), 300.0) * 6.5
                + pow(max(dot(Rv, uSunDir), 0.0), 26.0) * 0.42;
  col += uSunColor * sunSpec * uSunGlow * 2.0 * (0.45 + 0.85 * gust);

  // 灯りの映り込み（縦に伸びる光の帯）
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uLightCount) break;
    vec3 lp = uLightPos[i];
    vec3 toL = lp - vWorld;
    float d = length(toL);
    vec3 Ld = toL / max(d, 0.001);
    float s = pow(max(dot(Rv, Ld), 0.0), 260.0) * 3.4
            + pow(max(dot(Rv, Ld), 0.0), 34.0) * 0.42;
    float atten = 1.0 / (1.0 + d * d * 0.00035);
    col += uLightCol[i] * s * atten * uNight;
  }

  // 岸と橋が水に落とす影（映り込みの暗がり）。川面に構造を与える。
  float shoreRefl = smoothstep(42.0, 93.0, abs(vWorld.z));
  vec3 bankCol = vec3(0.085, 0.078, 0.062) + uSunColor * 0.018 * uSunGlow;
  col = mix(col, bankCol, shoreRefl * 0.66 * fres);
  float underBridge = 1.0 - smoothstep(7.0, 30.0, abs(vWorld.x));
  col = mix(col, bankCol * 0.82, underBridge * 0.55 * fres);

  // 波頭のわずかな白
  float crest = smoothstep(0.86, 1.0, 1.0 - N.y) * detailFade;
  col += vec3(0.9, 0.92, 0.95) * crest * 0.16 * (0.3 + uSunGlow);

  // 空気（フォグ）
  float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  col = mix(col, uFogColor, clamp(f, 0.0, 1.0));

  gl_FragColor = vec4(col, 1.0);
}
`

export class Water {
  readonly mesh: THREE.Mesh
  private uni: Record<string, THREE.IUniform>
  private clock = 0
  private lightPos: THREE.Vector3[] = []
  private lightCol: THREE.Color[] = []

  constructor() {
    for (let i = 0; i < MAX_LIGHTS; i++) {
      this.lightPos.push(new THREE.Vector3())
      this.lightCol.push(new THREE.Color(0, 0, 0))
    }
    this.uni = {
      uTime: { value: 0 },
      uNormalMap: { value: makeWaterNormal(256) },
      uCamPos: { value: new THREE.Vector3() },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uSunColor: { value: new THREE.Color() },
      uSunGlow: { value: 1 },
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uHorizonWarm: { value: new THREE.Color() },
      uDeep: { value: new THREE.Color('#0e1a1c') },
      uFogColor: { value: new THREE.Color() },
      uFogDensity: { value: 0.002 },
      uNight: { value: 0 },
      uLightPos: { value: this.lightPos },
      uLightCol: { value: this.lightCol },
      uLightCount: { value: 0 },
    }

    const geo = new THREE.PlaneGeometry(1900, 300, 190, 30)
    geo.rotateX(-Math.PI / 2)
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: this.uni,
        fog: false,
      }),
    )
    this.mesh.position.set(0, 0, 0)
    this.mesh.renderOrder = 1
    this.mesh.frustumCulled = false
    this.mesh.name = 'river'
  }

  /** 夜に川面へ映り込む灯りを差し替える。 */
  setReflectedLights(lights: ReflectedLight[]) {
    const n = Math.min(lights.length, MAX_LIGHTS)
    for (let i = 0; i < MAX_LIGHTS; i++) {
      if (i < n) {
        this.lightPos[i].copy(lights[i].pos)
        this.lightCol[i].copy(lights[i].color).multiplyScalar(lights[i].power)
      } else {
        this.lightCol[i].setRGB(0, 0, 0)
      }
    }
    this.uni.uLightCount.value = n
  }

  update(dt: number, camera: THREE.Camera, env: Environment) {
    this.clock += dt
    this.uni.uTime.value = this.clock
    ;(this.uni.uCamPos.value as THREE.Vector3).copy(camera.position)
    ;(this.uni.uSunDir.value as THREE.Vector3).copy(env.sunDir)
    ;(this.uni.uSunColor.value as THREE.Color).copy(env.sunColor)
    ;(this.uni.uZenith.value as THREE.Color).copy(env.zenithColor)
    ;(this.uni.uHorizon.value as THREE.Color).copy(env.horizonColor)
    ;(this.uni.uHorizonWarm.value as THREE.Color).copy(env.horizonWarm)
    ;(this.uni.uFogColor.value as THREE.Color).copy(env.fogColor)
    this.uni.uFogDensity.value = env.fog.density
    this.uni.uSunGlow.value = env.sunGlow
    this.uni.uNight.value = env.nightAmount
  }
}
