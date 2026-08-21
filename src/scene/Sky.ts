import {
  AdditiveBlending,
  BackSide,
  type Camera,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import type { LightingState } from '../core/Lighting'
import { clamp, damp, lerp, Rng, TAU } from '../util/math'
import { makeCloudTexture, makeGlowTexture, makeMoonTexture, makeStarSprite } from '../util/textures'

const SKY_R = 900

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`

const skyFrag = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uWarm;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform float uWarmSpread;
uniform float uWarmStrength;
uniform float uMoonGlow;
uniform float uNight;

// cheap ordered dither, kills the banding a smooth sky gradient would otherwise show
float dither(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -1.0, 1.0);

  // vertical gradient, biased so the interesting band sits just above the horizon
  float t = pow(clamp(h * 0.5 + 0.5, 0.0, 1.0), 1.0);
  t = clamp((t - 0.5) * 2.0, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(t, 0.62));

  // warm band around the sun's azimuth, hugging the horizon
  vec3 sunFlat = normalize(vec3(uSunDir.x, 0.0, uSunDir.z));
  vec3 dFlat = normalize(vec3(d.x, 0.001, d.z));
  float az = clamp(dot(dFlat, sunFlat), -1.0, 1.0);
  float azFall = pow(clamp(az * 0.5 + 0.5, 0.0, 1.0), 3.0);
  float vertFall = exp(-max(h, -0.05) / max(uWarmSpread, 0.04));
  float warm = azFall * vertFall * uWarmStrength;
  col = mix(col, uWarm, clamp(warm, 0.0, 0.94));

  // counter-glow opposite the sun during the blue hour
  float anti = pow(clamp(-az * 0.5 + 0.5, 0.0, 1.0), 4.0) * exp(-max(h, 0.0) / 0.34);
  col += vec3(0.05, 0.04, 0.08) * anti * uNight * 0.6;

  // moon halo — atmosphere, not a glow sprite
  float md = clamp(dot(d, normalize(uMoonDir)), -1.0, 1.0);
  float halo = pow(clamp(md, 0.0, 1.0), 220.0) * 0.55 + pow(clamp(md, 0.0, 1.0), 14.0) * 0.06;
  col += vec3(0.62, 0.66, 0.78) * halo * uMoonGlow * uNight;

  // ground-side darkening so the dome never shows below the horizon line
  col = mix(col * 0.55, col, smoothstep(-0.16, 0.02, h));

  col += (dither(gl_FragCoord.xy) - 0.5) * (1.0 / 255.0) * 1.6;
  gl_FragColor = vec4(col, 1.0);
}
`

const moonVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
void main() {
  vUv = uv;
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const moonFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vN;
uniform sampler2D uMap;
uniform vec3 uLight;      // view-space bearing the sunlight arrives from
uniform float uBrightness;
uniform vec3 uSkyTint;
uniform float uEarthshine;

void main() {
  vec3 albedo = texture2D(uMap, vUv).rgb;
  float ndl = dot(normalize(vN), normalize(uLight));
  // soft terminator: a hard edge reads as a cut-out sticker
  float lit = smoothstep(-0.10, 0.26, ndl);
  float limb = pow(clamp(dot(normalize(vN), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 0.32);
  vec3 surface = albedo * (lit * 1.22 + uEarthshine * 0.055) * limb;
  // The disc is always graded against the sky immediately around it: pale and
  // barely there in the afterglow, bright once the sky has dropped away.
  vec3 c = mix(uSkyTint, surface, clamp(uBrightness, 0.0, 1.0));
  gl_FragColor = vec4(c, 1.0);
}
`

const starVert = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute float aMag;
varying float vAlpha;
uniform float uTime;
uniform float uVisibility;
uniform float uScale;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // very slight scintillation, not a disco
  float tw = 0.86 + 0.14 * sin(uTime * 1.7 + aPhase * 6.283);
  vAlpha = uVisibility * aMag * tw;
  gl_PointSize = aSize * uScale * (0.7 + 0.3 * tw);
  gl_Position = projectionMatrix * mv;
}
`

const starFrag = /* glsl */ `
precision mediump float;
varying float vAlpha;
uniform sampler2D uMap;
uniform vec3 uTint;
void main() {
  float a = texture2D(uMap, gl_PointCoord).a;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uTint, a * vAlpha);
}
`

export class Sky {
  readonly group = new Group()
  private dome: Mesh
  private domeMat: ShaderMaterial
  private stars: Points
  private starMat: ShaderMaterial
  private moonPivot = new Group()
  private moon: Mesh
  private moonMat: ShaderMaterial
  private moonHalo: Mesh
  private clouds: { mesh: Mesh; mat: MeshBasicMaterial; drift: number; base: Vector3; lit: number }[] = []
  private moonCloud: Mesh
  private moonCloudB!: Mesh
  private moonCloudMat: MeshBasicMaterial
  private moonCloudX = 0
  private time = 0
  private tmp = new Color()
  private tmpVec = new Vector3()

  constructor(pixelScale: number) {
    this.domeMat = new ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      side: BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      uniforms: {
        uZenith: { value: new Color('#6d84b8') },
        uHorizon: { value: new Color('#ffb478') },
        uWarm: { value: new Color('#ffd0a0') },
        uSunDir: { value: new Vector3(0, 0.1, -1) },
        uMoonDir: { value: new Vector3(0, 0.4, 1) },
        uWarmSpread: { value: 0.5 },
        uWarmStrength: { value: 1 },
        uMoonGlow: { value: 0 },
        uNight: { value: 0 },
      },
    })
    this.dome = new Mesh(new SphereGeometry(SKY_R, 40, 24), this.domeMat)
    this.dome.renderOrder = -100
    this.dome.frustumCulled = false
    this.group.add(this.dome)

    // --- stars -------------------------------------------------------------
    const rng = new Rng(7777)
    const COUNT = 760
    const pos: number[] = []
    const size: number[] = []
    const phase: number[] = []
    const mag: number[] = []
    for (let i = 0; i < COUNT; i++) {
      // cosine-ish distribution over the upper hemisphere
      const u = rng.next()
      const v = rng.next()
      const theta = u * TAU
      const y = Math.pow(v, 0.75)
      const r = Math.sqrt(Math.max(0, 1 - y * y))
      pos.push(Math.cos(theta) * r * 840, y * 840 + 20, Math.sin(theta) * r * 840)
      const bright = Math.pow(rng.next(), 2.6)
      size.push(lerp(1.4, 5.0, bright))
      mag.push(lerp(0.22, 1.0, bright))
      phase.push(rng.next())
    }
    const sg = new BufferGeometry()
    sg.setAttribute('position', new Float32BufferAttribute(pos, 3))
    sg.setAttribute('aSize', new Float32BufferAttribute(size, 1))
    sg.setAttribute('aPhase', new Float32BufferAttribute(phase, 1))
    sg.setAttribute('aMag', new Float32BufferAttribute(mag, 1))
    this.starMat = new ShaderMaterial({
      vertexShader: starVert,
      fragmentShader: starFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
      uniforms: {
        uMap: { value: makeStarSprite() },
        uTime: { value: 0 },
        uVisibility: { value: 0 },
        uScale: { value: pixelScale },
        uTint: { value: new Color('#dfe6ff') },
      },
    })
    this.stars = new Points(sg, this.starMat)
    this.stars.renderOrder = -90
    this.stars.frustumCulled = false
    this.group.add(this.stars)

    // --- moon --------------------------------------------------------------
    this.moonMat = new ShaderMaterial({
      vertexShader: moonVert,
      fragmentShader: moonFrag,
      fog: false,
      uniforms: {
        uMap: { value: makeMoonTexture() },
        uLight: { value: new Vector3(-0.6, 0.25, 0.75) },
        uBrightness: { value: 0.2 },
        uSkyTint: { value: new Color('#8fa0c8') },
        uEarthshine: { value: 0.5 },
      },
    })
    this.moon = new Mesh(new SphereGeometry(25, 32, 20), this.moonMat)
    this.moon.position.set(0, 0, -760)
    this.moon.renderOrder = -80

    const haloTex = makeGlowTexture(128, 3.1)
    this.moonHalo = new Mesh(
      new PlaneGeometry(150, 150),
      new MeshBasicMaterial({
        map: haloTex,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        opacity: 0,
        color: new Color('#c9d6f2'),
        fog: false,
      }),
    )
    this.moonHalo.position.set(0, 0, -759)
    this.moonHalo.renderOrder = -81
    this.moonPivot.add(this.moonHalo, this.moon)
    this.group.add(this.moonPivot)

    // the cloud the moon comes out from behind
    this.moonCloudMat = new MeshBasicMaterial({
      map: makeCloudTexture(256, 55),
      transparent: true,
      depthWrite: false,
      depthTest: false,
      opacity: 0.95,
      fog: false,
      side: DoubleSide,
      blending: NormalBlending,
    })
    this.moonCloud = new Mesh(new PlaneGeometry(300, 96), this.moonCloudMat)
    this.moonCloud.position.set(0, 6, -730)
    this.moonCloud.renderOrder = -79
    this.moonPivot.add(this.moonCloud)
    // A second, offset layer: one wisp leaves a hole the moon shows through,
    // two stacked do not, and the reveal needs something to come out from behind.
    this.moonCloudB = new Mesh(new PlaneGeometry(250, 78), this.moonCloudMat)
    this.moonCloudB.renderOrder = -78
    this.moonPivot.add(this.moonCloudB)

    // --- drifting cloud bank ------------------------------------------------
    const cloudTexes = [makeCloudTexture(256, 11), makeCloudTexture(256, 33), makeCloudTexture(256, 77)]
    for (let i = 0; i < 13; i++) {
      const mat = new MeshBasicMaterial({
        map: rng.pick(cloudTexes),
        transparent: true,
        depthWrite: false,
        depthTest: false,
        opacity: 0.4,
        fog: false,
        side: DoubleSide,
      })
      // Long and low: evening cloud is stratified, not a ball of cotton wool.
      const w = rng.range(260, 640)
      const mesh = new Mesh(new PlaneGeometry(w, w * rng.range(0.11, 0.22)), mat)
      const ang = rng.range(0, TAU)
      const rad = rng.range(620, 800)
      // Kept well clear of the horizon: a cloud plane sitting at eye level slices
      // straight through the town and reads as a smear, not weather.
      const base = new Vector3(Math.sin(ang) * rad, rng.range(95, 330), -Math.cos(ang) * rad)
      mesh.position.copy(base)
      mesh.lookAt(0, base.y * 0.35, 0)
      mesh.renderOrder = -85
      this.clouds.push({ mesh, mat, drift: rng.range(0.35, 1.1), base, lit: rng.next() })
      this.group.add(mesh)
    }
  }

  update(L: LightingState, dt: number, moonReveal: number, camera: Camera): void {
    this.time += dt
    const camPos = camera.position
    this.group.position.set(camPos.x, 0, camPos.z)

    const u = this.domeMat.uniforms
    u.uZenith.value.copy(L.zenith)
    u.uHorizon.value.copy(L.horizon)
    u.uWarm.value.copy(L.warmBand)
    u.uSunDir.value.copy(L.sunDir)
    u.uMoonDir.value.copy(L.moonDir)
    u.uWarmSpread.value = L.warmSpread
    u.uWarmStrength.value = L.warmStrength
    u.uMoonGlow.value = L.moonGlow
    u.uNight.value = L.starVisibility * 0.6 + 0.4

    this.starMat.uniforms.uTime.value = this.time
    this.starMat.uniforms.uVisibility.value = L.starVisibility

    // moon rides its own arc
    const d = L.moonDir
    this.moonPivot.position.set(0, 0, 0)
    const md = new Vector3(d.x, d.y, d.z).normalize().multiplyScalar(760)
    this.moon.position.copy(md)
    this.moon.lookAt(0, 0, 0)
    this.moonHalo.position.copy(md).multiplyScalar(0.985)
    this.moonHalo.lookAt(0, 0, 0)

    // Phase: the terminator is laid out along the sun's *screen* bearing, so the
    // lit limb always faces the afterglow and reads as correct, while how much of
    // the disc is lit stays authored — the real sun-moon elongation this
    // composition allows would give an all-but-invisible new moon.
    const sunView = this.tmpVec.copy(L.sunDir).transformDirection(camera.matrixWorldInverse)
    const n2 = Math.hypot(sunView.x, sunView.y) || 1
    const PHASE = 1.16 // ~66 degrees: a clearly modelled gibbous
    const sp = Math.sin(PHASE)
    this.moonMat.uniforms.uLight.value
      .set((sunView.x / n2) * sp, (sunView.y / n2) * sp, Math.cos(PHASE))
      .normalize()

    // brightness is relative to the sky it sits in, so it never blows out
    const target = lerp(0.1, 1.0, clamp(L.starVisibility * 0.62 + moonReveal * 0.45))
    this.moonMat.uniforms.uBrightness.value = damp(
      this.moonMat.uniforms.uBrightness.value,
      target,
      1.1,
      dt,
    )
    L.skyColorAt(L.moonDir, this.moonMat.uniforms.uSkyTint.value as Color)
    const haloMat = this.moonHalo.material as MeshBasicMaterial
    haloMat.opacity = clamp(moonReveal * (0.1 + L.starVisibility * 0.30))
    haloMat.color.copy(L.zenith).lerp(new Color('#dbe4ff'), 0.65)

    // the cloud slides off the moon once, then keeps drifting
    this.moonCloudX = damp(this.moonCloudX, moonReveal, 0.5, dt)
    this.moonCloud.position.copy(md).multiplyScalar(0.955)
    this.moonCloud.position.x += lerp(-6, -230, this.moonCloudX)
    this.moonCloud.position.y += lerp(2, 26, this.moonCloudX)
    this.moonCloud.lookAt(0, 0, 0)
    this.moonCloudB.position.copy(this.moonCloud.position)
    this.moonCloudB.position.x += lerp(12, 175, this.moonCloudX)
    this.moonCloudB.position.y -= lerp(9, 30, this.moonCloudX)
    this.moonCloudB.lookAt(0, 0, 0)
    this.moonCloudMat.opacity = lerp(0.88, 0.16, this.moonCloudX) * (0.5 + L.cloudOpacity * 0.5)
    // Graded against the sky right behind it, then nudged towards cloud shade:
    // a real evening cloud is a small deviation from its sky, not a white shape.
    L.skyColorAt(L.moonDir, this.tmp)
    this.moonCloudMat.color.copy(this.tmp).lerp(L.cloudShade, 0.34).multiplyScalar(0.97)

    for (const c of this.clouds) {
      const ang = Math.atan2(c.base.x, -c.base.z) + this.time * 0.0032 * c.drift
      const rad = Math.hypot(c.base.x, c.base.z)
      c.mesh.position.set(Math.sin(ang) * rad, c.base.y, -Math.cos(ang) * rad)
      c.mesh.lookAt(0, c.base.y * 0.4, 0)
      // Clouds nearer the sun's bearing keep the last warm light; the rest go to
      // shade. Backlit evening cloud is mostly *darker* than the sky it sits on.
      const toSun = clamp(
        (c.mesh.position.x * L.sunDir.x + c.mesh.position.z * L.sunDir.z) /
          (Math.hypot(c.mesh.position.x, c.mesh.position.z) || 1) *
          0.5 +
          0.5,
      )
      const warmth = clamp(toSun * 0.75 + c.lit * 0.25)
      this.tmp.copy(L.cloudShade).lerp(L.cloudLit, warmth)
      c.mat.color.copy(this.tmp).multiplyScalar(0.82)
      c.mat.opacity = L.cloudOpacity * lerp(0.2, 0.46, warmth)
    }
  }

  setPixelScale(s: number): void {
    this.starMat.uniforms.uScale.value = s
  }

  /** World position of the moon disc, for the camera to lean towards. */
  moonWorldPosition(out = new Vector3()): Vector3 {
    return out.copy(this.moon.position).add(this.group.position)
  }
}
