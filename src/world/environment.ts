import * as THREE from 'three'
import { clamp, lerp, smoothstep } from '../core/util'

/**
 * 空・太陽・空気（フォグ）をひとつの「時刻」パラメータで動かす。
 *   t = 0 … 夕方（陽が川下に低く残っている）
 *   t = 1 … 花火の夜（深い青と街明かり）
 * 全部の見えかたをここで一括りにして、切り替わりが一枚の絵として動くようにする。
 */

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w; // 常に最奥
}
`

const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;

uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uHorizonWarm;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uCityGlow;
uniform float uSunGlow;
uniform float uNight;
uniform float uCloud;
uniform float uTime;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}

void main() {
  vec3 dir = normalize(vDir);
  float h = clamp(dir.y, -0.15, 1.0);
  float up = clamp(h, 0.0, 1.0);

  vec3 col = mix(uHorizon, uZenith, pow(up, 0.42));

  // 陽の残っている方角だけ、地平が暖かくなる
  vec3 flatDir = normalize(vec3(dir.x, 0.0, dir.z));
  vec3 flatSun = normalize(vec3(uSunDir.x, 0.0, uSunDir.z));
  float az = clamp(dot(flatDir, flatSun), 0.0, 1.0);
  float band = pow(az, 3.4) * pow(1.0 - up, 4.2);
  col = mix(col, uHorizonWarm, clamp(band * 1.25 * uSunGlow, 0.0, 1.0));
  // 地平線ぎわの薄い明るみ（どの方角にも少しある）
  col = mix(col, uHorizon * 1.16, pow(1.0 - up, 9.0) * 0.55);

  // 雲（地平近くにたなびく層）
  vec2 cp = dir.xz / max(abs(dir.y) + 0.10, 0.10);
  float clouds = fbm(cp * 0.85 + vec2(uTime * 0.0035, uTime * 0.0012));
  float coverage = smoothstep(0.46, 0.78, clouds) * uCloud;
  coverage *= smoothstep(0.02, 0.30, up) * (1.0 - smoothstep(0.42, 0.95, up) * 0.75);
  vec3 cloudLit = mix(uHorizon * 0.55, uHorizonWarm * 1.25, pow(az, 1.6));
  vec3 cloudDark = mix(uZenith * 0.75, uHorizon * 0.6, 0.5);
  vec3 cloudCol = mix(cloudDark, cloudLit, pow(az, 1.1) * uSunGlow);
  col = mix(col, cloudCol, clamp(coverage, 0.0, 0.92));

  // 太陽（薄雲越しに滲む）
  float cs = clamp(dot(dir, uSunDir), 0.0, 1.0);
  float disc = pow(cs, 900.0) * 8.0 + pow(cs, 90.0) * 0.9;
  col += uSunColor * disc * uSunGlow * (1.0 - coverage * 0.7);
  col += uSunColor * pow(cs, 6.0) * 0.30 * uSunGlow;

  // 街あかりのにじみ（夜）
  float glowBand = pow(1.0 - clamp(abs(h) * 7.0, 0.0, 1.0), 2.2);
  col += uCityGlow * glowBand * uNight;

  // 星
  if (uNight > 0.01) {
    vec3 q = floor(dir * 340.0);
    float s = hash13(q);
    float star = smoothstep(0.9972, 0.9998, s);
    float tw = 0.65 + 0.35 * sin(uTime * 2.1 + s * 90.0);
    float mask = smoothstep(0.02, 0.35, up) * (1.0 - coverage);
    col += vec3(0.92, 0.95, 1.0) * star * tw * mask * uNight * 0.95;
  }

  gl_FragColor = vec4(col, 1.0);
}
`

type Palette = {
  zenith: THREE.Color
  horizon: THREE.Color
  horizonWarm: THREE.Color
  sunColor: THREE.Color
  cityGlow: THREE.Color
  fog: THREE.Color
  fogDensity: number
  sunIntensity: number
  sunElevation: number
  hemiSky: THREE.Color
  hemiGround: THREE.Color
  hemiIntensity: number
  ambient: number
  exposure: number
  sunGlow: number
  cloud: number
  bloom: number
}

const DUSK: Palette = {
  zenith: new THREE.Color('#1c3a6e'),
  horizon: new THREE.Color('#93a0b6'),
  horizonWarm: new THREE.Color('#ff8a42'),
  sunColor: new THREE.Color('#ffab63'),
  cityGlow: new THREE.Color('#000000'),
  fog: new THREE.Color('#9d97a0'),
  fogDensity: 0.00135,
  sunIntensity: 2.6,
  sunElevation: 0.085,
  hemiSky: new THREE.Color('#7d95c2'),
  hemiGround: new THREE.Color('#63513c'),
  hemiIntensity: 1.05,
  ambient: 0.20,
  exposure: 1.0,
  sunGlow: 1.0,
  cloud: 0.85,
  bloom: 0.30,
}

const NIGHT: Palette = {
  zenith: new THREE.Color('#050a16'),
  horizon: new THREE.Color('#1a2947'),
  horizonWarm: new THREE.Color('#463f52'),
  sunColor: new THREE.Color('#2a2438'),
  cityGlow: new THREE.Color('#332b3c'),
  fog: new THREE.Color('#121e39'),
  fogDensity: 0.0024,
  sunIntensity: 0.0,
  sunElevation: -0.11,
  hemiSky: new THREE.Color('#2e4373'),
  hemiGround: new THREE.Color('#171b26'),
  hemiIntensity: 0.50,
  ambient: 0.11,
  exposure: 1.16,
  sunGlow: 0.0,
  cloud: 0.55,
  bloom: 0.95,
}

/** 夕方→夜のあいだの中間色。単純な線形補間だと濁るので、要所で味付けする。 */
function mixPalette(t: number, out: Palette): Palette {
  const k = smoothstep(0, 1, t)
  // 陽が沈む前後で暖色が一度強くなる（マジックアワー）
  const magic = Math.sin(clamp(t, 0, 1) * Math.PI) * 0.5

  out.zenith.copy(DUSK.zenith).lerp(NIGHT.zenith, k)
  out.horizon.copy(DUSK.horizon).lerp(NIGHT.horizon, k)
  out.horizonWarm.copy(DUSK.horizonWarm).lerp(NIGHT.horizonWarm, k * k)
  out.horizonWarm.offsetHSL(0, magic * 0.06, -magic * 0.02)
  out.sunColor.copy(DUSK.sunColor).lerp(NIGHT.sunColor, k)
  out.sunColor.offsetHSL(-magic * 0.035, 0, 0) // 沈むほど赤く
  out.cityGlow.copy(DUSK.cityGlow).lerp(NIGHT.cityGlow, k * k)
  out.fog.copy(DUSK.fog).lerp(NIGHT.fog, k)
  out.hemiSky.copy(DUSK.hemiSky).lerp(NIGHT.hemiSky, k)
  out.hemiGround.copy(DUSK.hemiGround).lerp(NIGHT.hemiGround, k)

  out.fogDensity = lerp(DUSK.fogDensity, NIGHT.fogDensity, k)
  out.sunIntensity = DUSK.sunIntensity * Math.pow(1 - k, 1.5)
  out.sunElevation = lerp(DUSK.sunElevation, NIGHT.sunElevation, k)
  out.hemiIntensity = lerp(DUSK.hemiIntensity, NIGHT.hemiIntensity, k)
  out.ambient = lerp(DUSK.ambient, NIGHT.ambient, k)
  out.exposure = lerp(DUSK.exposure, NIGHT.exposure, k)
  out.sunGlow = Math.pow(1 - k, 1.25)
  out.cloud = lerp(DUSK.cloud, NIGHT.cloud, k)
  out.bloom = lerp(DUSK.bloom, NIGHT.bloom, k * k)
  return out
}

export class Environment {
  readonly sky: THREE.Mesh
  readonly sun: THREE.DirectionalLight
  readonly moon: THREE.DirectionalLight
  readonly hemi: THREE.HemisphereLight
  readonly ambient: THREE.AmbientLight
  readonly fog: THREE.FogExp2
  readonly sunDir = new THREE.Vector3()

  /** 0 = 夕方, 1 = 夜 */
  time = 0
  private p: Palette
  private uni: Record<string, THREE.IUniform>
  private clock = 0

  constructor(scene: THREE.Scene, shadowQuality: number) {
    this.p = {
      zenith: new THREE.Color(),
      horizon: new THREE.Color(),
      horizonWarm: new THREE.Color(),
      sunColor: new THREE.Color(),
      cityGlow: new THREE.Color(),
      fog: new THREE.Color(),
      fogDensity: 0,
      sunIntensity: 0,
      sunElevation: 0,
      hemiSky: new THREE.Color(),
      hemiGround: new THREE.Color(),
      hemiIntensity: 0,
      ambient: 0,
      exposure: 1,
      sunGlow: 1,
      cloud: 1,
      bloom: 0,
    }

    this.uni = {
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uHorizonWarm: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uSunColor: { value: new THREE.Color() },
      uCityGlow: { value: new THREE.Color() },
      uSunGlow: { value: 1 },
      uNight: { value: 0 },
      uCloud: { value: 1 },
      uTime: { value: 0 },
    }

    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 32),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        uniforms: this.uni,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
        toneMapped: true,
      }),
    )
    this.sky.scale.setScalar(1)
    this.sky.frustumCulled = false
    this.sky.renderOrder = -1000
    scene.add(this.sky)

    this.fog = new THREE.FogExp2(0xffffff, 0.002)
    scene.fog = this.fog

    this.sun = new THREE.DirectionalLight(0xffffff, 1)
    this.sun.castShadow = true
    const s = this.sun.shadow
    s.mapSize.set(shadowQuality, shadowQuality)
    s.camera.near = 1
    s.camera.far = 620
    s.camera.left = -160
    s.camera.right = 160
    s.camera.top = 160
    s.camera.bottom = -160
    s.bias = -0.0007
    s.normalBias = 0.35
    scene.add(this.sun)
    scene.add(this.sun.target)

    this.moon = new THREE.DirectionalLight(0xa8c0ea, 0)
    scene.add(this.moon)
    scene.add(this.moon.target)

    this.hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1)
    scene.add(this.hemi)

    this.ambient = new THREE.AmbientLight(0xffffff, 0.1)
    scene.add(this.ambient)

    this.setTime(0)
  }

  setTime(t: number) {
    this.time = clamp(t, 0, 1)
    const p = mixPalette(this.time, this.p)

    // 太陽は川下（-X）に低く。カメラは基本そちらを向くので逆光になる。
    const el = p.sunElevation
    this.sunDir.set(-0.82, el, -0.57).normalize()

    this.sun.position.copy(this.sunDir).multiplyScalar(300)
    this.sun.target.position.set(0, 0, 120)
    this.sun.color.copy(p.sunColor)
    this.sun.intensity = p.sunIntensity
    this.sun.castShadow = p.sunIntensity > 0.05

    this.moon.position.set(220, 260, 180)
    this.moon.target.position.set(0, 0, 60)
    this.moon.intensity = 0.68 * smoothstep(0.35, 1, this.time)

    this.hemi.color.copy(p.hemiSky)
    this.hemi.groundColor.copy(p.hemiGround)
    this.hemi.intensity = p.hemiIntensity
    this.ambient.intensity = p.ambient

    this.fog.color.copy(p.fog)
    this.fog.density = p.fogDensity

    ;(this.uni.uZenith.value as THREE.Color).copy(p.zenith)
    ;(this.uni.uHorizon.value as THREE.Color).copy(p.horizon)
    ;(this.uni.uHorizonWarm.value as THREE.Color).copy(p.horizonWarm)
    ;(this.uni.uSunColor.value as THREE.Color).copy(p.sunColor)
    ;(this.uni.uCityGlow.value as THREE.Color).copy(p.cityGlow)
    ;(this.uni.uSunDir.value as THREE.Vector3).copy(this.sunDir)
    this.uni.uSunGlow.value = p.sunGlow
    this.uni.uNight.value = smoothstep(0.25, 1, this.time)
    this.uni.uCloud.value = p.cloud
  }

  get exposure() {
    return this.p.exposure
  }
  get bloomStrength() {
    return this.p.bloom
  }
  get fogColor() {
    return this.p.fog
  }
  get horizonColor() {
    return this.p.horizon
  }
  get horizonWarm() {
    return this.p.horizonWarm
  }
  get zenithColor() {
    return this.p.zenith
  }
  get sunColor() {
    return this.p.sunColor
  }
  get sunGlow() {
    return this.p.sunGlow
  }
  get nightAmount() {
    return smoothstep(0.25, 1, this.time)
  }

  private fwd = new THREE.Vector3()
  private flatSun = new THREE.Vector3()

  update(dt: number, camera: THREE.Camera) {
    this.clock += dt
    this.uni.uTime.value = this.clock

    // 空気の色は「どっちを向いているか」で変わる。逆光側は暖かく、反対は冷たく。
    camera.getWorldDirection(this.fwd)
    this.fwd.y = 0
    this.fwd.normalize()
    this.flatSun.set(this.sunDir.x, 0, this.sunDir.z).normalize()
    const az = clamp(this.fwd.dot(this.flatSun), 0, 1)
    this.fog.color
      .copy(this.p.horizon)
      .lerp(this.p.horizonWarm, Math.pow(az, 2.2) * 0.62 * this.p.sunGlow)
      .lerp(this.p.zenith, 0.10)

    this.sky.position.copy(camera.position)
    this.sky.scale.setScalar(4000)
    // 影のカメラをプレイヤーが見ている辺りに寄せる
    const focus = new THREE.Vector3(0, 0, 150)
    camera.getWorldDirection(focus)
    focus.multiplyScalar(70).add(camera.position)
    focus.y = 3
    this.sun.target.position.copy(focus)
    this.sun.position.copy(this.sunDir).multiplyScalar(280).add(focus)
    this.sun.target.updateMatrixWorld()
    this.moon.target.position.copy(focus)
    this.moon.position.copy(focus).add(new THREE.Vector3(180, 220, 140))
    this.moon.target.updateMatrixWorld()
  }
}
