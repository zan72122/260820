import * as THREE from 'three'
import { clamp01, lerp } from '../core/math'

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`

const FRAG = /* glsl */ `
varying vec3 vDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec2 uGlowDir;
uniform float uGlowStrength;
uniform float uExposure;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 d = normalize(vDir);
  float up = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(up, 0.55));

  // Residual afterglow sits in one direction only, low over the horizon.
  vec2 flat_ = normalize(vec2(d.x, d.z) + vec2(1e-5));
  float az = max(dot(flat_, uGlowDir), 0.0);
  float band = exp(-max(d.y, 0.0) * 5.5);
  col += uGlow * pow(az, 3.5) * band * uGlowStrength;

  // Below the horizon the sky reads as distant haze over dark ground.
  col = mix(uHorizon * 0.22, col, smoothstep(-0.16, 0.015, d.y));
  col *= uExposure;

  // Ordered-ish dither: wide, low-contrast gradients band badly on phones.
  col += (hash12(gl_FragCoord.xy) - 0.5) * 0.0035;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`

export interface SkyPalette {
  zenith: THREE.Color
  horizon: THREE.Color
  glow: THREE.Color
}

/** Dusk, and the deeper blue the park settles into once the lamps carry it. */
const DUSK: SkyPalette = {
  zenith: new THREE.Color(0.058, 0.086, 0.168),
  horizon: new THREE.Color(0.24, 0.2, 0.196),
  glow: new THREE.Color(0.62, 0.34, 0.17),
}

const NIGHT: SkyPalette = {
  zenith: new THREE.Color(0.024, 0.036, 0.078),
  horizon: new THREE.Color(0.1, 0.09, 0.106),
  glow: new THREE.Color(0.32, 0.17, 0.09),
}

export class Sky {
  readonly mesh: THREE.Mesh
  readonly material: THREE.ShaderMaterial
  readonly key: THREE.DirectionalLight
  readonly hemi: THREE.HemisphereLight
  readonly fog: THREE.FogExp2

  /** 0 = the moment the player arrives, 1 = full night. */
  private nightAmount = 0
  private brightnessScale = 1
  private envTarget: THREE.WebGLRenderTarget | null = null

  constructor(private readonly scene: THREE.Scene) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenith: { value: DUSK.zenith.clone() },
        uHorizon: { value: DUSK.horizon.clone() },
        uGlow: { value: DUSK.glow.clone() },
        uGlowDir: { value: new THREE.Vector2(-0.72, -0.69) },
        uGlowStrength: { value: 1 },
        uExposure: { value: 1 },
      },
    })
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(220, 32, 18), this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -1000
    scene.add(this.mesh)

    this.fog = new THREE.FogExp2(0x0c1018, 0.0165)
    scene.fog = this.fog

    // A single low key from the afterglow side: enough to model the machinery
    // without ever reading as daylight.
    this.key = new THREE.DirectionalLight(0xa9b6d6, 0.8)
    this.key.position.set(-16, 7.5, -13)
    this.key.target.position.set(0, 0.6, -1)
    scene.add(this.key)
    scene.add(this.key.target)

    this.hemi = new THREE.HemisphereLight(0x4a5a7a, 0x14170f, 1.35)
    scene.add(this.hemi)

    scene.environmentIntensity = 1.0
  }

  enableShadows(mapSize: number): void {
    this.key.castShadow = true
    this.key.shadow.mapSize.set(mapSize, mapSize)
    const cam = this.key.shadow.camera
    // Tight bounds around the slide and its run-out: nothing else needs a
    // cast shadow, and a small frustum keeps the map crisp on a phone.
    cam.left = -6.5
    cam.right = 6.5
    cam.top = 13
    cam.bottom = -13
    cam.near = 6
    cam.far = 44
    cam.updateProjectionMatrix()
    this.key.shadow.bias = -0.0009
    this.key.shadow.normalBias = 0.028
    this.key.shadow.radius = 3
  }

  /** Builds a small equirectangular probe from the same palette used by the dome. */
  buildEnvironment(renderer: THREE.WebGLRenderer): void {
    const W = 96
    const H = 48
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(W, H)
    const d = img.data
    const zen = DUSK.zenith
    const hor = DUSK.horizon
    const glow = DUSK.glow
    for (let j = 0; j < H; j++) {
      const theta = (j / (H - 1)) * Math.PI
      const y = Math.cos(theta)
      for (let i = 0; i < W; i++) {
        const phi = (i / W) * Math.PI * 2
        const dx = Math.sin(theta) * Math.cos(phi)
        const dz = Math.sin(theta) * Math.sin(phi)
        const up = clamp01(y)
        let r = lerp(hor.r, zen.r, Math.pow(up, 0.55))
        let g = lerp(hor.g, zen.g, Math.pow(up, 0.55))
        let b = lerp(hor.b, zen.b, Math.pow(up, 0.55))
        const az = Math.max(dx * -0.72 + dz * -0.69, 0)
        const band = Math.exp(-Math.max(y, 0) * 5.5) * Math.pow(az, 3.5)
        r += glow.r * band
        g += glow.g * band
        b += glow.b * band
        if (y < 0) {
          const k = clamp01(1 + y * 5)
          r = lerp(hor.r * 0.16, r, k)
          g = lerp(hor.g * 0.16, g, k)
          b = lerp(hor.b * 0.16, b, k)
        }
        const o = (j * W + i) * 4
        d[o] = clamp01(Math.pow(r, 1 / 2.2)) * 255
        d[o + 1] = clamp01(Math.pow(g, 1 / 2.2)) * 255
        d[o + 2] = clamp01(Math.pow(b, 1 / 2.2)) * 255
        d[o + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    const tex = new THREE.CanvasTexture(canvas)
    tex.mapping = THREE.EquirectangularReflectionMapping
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true

    const pmrem = new THREE.PMREMGenerator(renderer)
    pmrem.compileEquirectangularShader()
    this.envTarget = pmrem.fromEquirectangular(tex)
    this.scene.environment = this.envTarget.texture
    tex.dispose()
    pmrem.dispose()
  }

  /** `night` 0..1 drives the dusk-to-night drift; `scale` is a debug multiplier. */
  setNight(night: number, scale = this.brightnessScale): void {
    this.nightAmount = clamp01(night)
    this.brightnessScale = scale
    const n = this.nightAmount
    const u = this.material.uniforms
    ;(u.uZenith.value as THREE.Color).lerpColors(DUSK.zenith, NIGHT.zenith, n)
    ;(u.uHorizon.value as THREE.Color).lerpColors(DUSK.horizon, NIGHT.horizon, n)
    ;(u.uGlow.value as THREE.Color).lerpColors(DUSK.glow, NIGHT.glow, n)
    u.uExposure.value = scale

    this.key.intensity = lerp(0.8, 0.3, n) * scale
    this.hemi.intensity = lerp(1.35, 0.52, n) * scale
    this.scene.environmentIntensity = lerp(1.0, 0.42, n) * scale
    this.fog.density = lerp(0.0135, 0.021, n)
    this.fog.color.setRGB(lerp(0.055, 0.03, n), lerp(0.07, 0.039, n), lerp(0.105, 0.06, n))
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.envTarget?.dispose()
  }
}
