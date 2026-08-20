import * as THREE from 'three'
import type { Environment } from './environment'
import { makeGrassBlade } from './textures'
import { groundHeight, wearAmount, L } from './layout'
import { clamp, lerp, makeRng, rand, smoothstep } from '../core/util'

/**
 * 河川敷の草。ビルボードの房をインスタンス描画する。
 * 逆光で穂が透ける表現（translucency）を入れて、夕方の空気を出す。
 */

const VERT = /* glsl */ `
precision highp float;
attribute vec3 iOffset;
attribute vec2 iSize;
attribute vec3 iTint;
attribute float iPhase;

uniform float uTime;
uniform float uWind;

varying vec2 vUv;
varying vec3 vTint;
varying vec3 vWorld;
varying float vUp;

void main() {
  vUv = uv;
  vTint = iTint;
  vUp = position.y;

  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(0.0, 1.0, 0.0);

  float sway = sin(uTime * 1.15 + iPhase) * 0.62 + sin(uTime * 2.35 + iPhase * 1.7) * 0.38;
  float bend = pow(position.y, 1.7) * sway * uWind * iSize.y * 0.42;

  vec3 world = iOffset
    + camRight * (position.x * iSize.x)
    + up * (position.y * iSize.y);
  world.x += bend;
  world.z += bend * 0.55;

  vWorld = world;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform vec3 uAmbient;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform vec3 uCamPos;

varying vec2 vUv;
varying vec3 vTint;
varying vec3 vWorld;
varying float vUp;

void main() {
  vec4 tex = texture2D(uMap, vUv);
  if (tex.a < 0.42) discard;

  vec3 V = normalize(uCamPos - vWorld);
  float dist = length(uCamPos - vWorld);

  // 根元は暗く、穂先は明るい
  float ao = mix(0.34, 1.0, pow(vUp, 0.75));
  vec3 base = tex.rgb * vTint * ao;

  // 上からの光
  float sky = clamp(uSunDir.y * 0.5 + 0.55, 0.0, 1.0);
  vec3 col = base * (uAmbient + uSunColor * sky * 0.55);

  // 逆光の透過（夕方、穂が金色に光る）
  float trans = pow(clamp(dot(-V, uSunDir), 0.0, 1.0), 3.2);
  col += base * uSunColor * trans * 1.05 * pow(vUp, 1.3);

  float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  col = mix(col, uFogColor, clamp(f, 0.0, 1.0));

  gl_FragColor = vec4(col, 1.0);
}
`

export class GrassField {
  readonly mesh: THREE.InstancedMesh
  private uni: Record<string, THREE.IUniform>
  private clock = 0

  constructor(quality: number) {
    const target = Math.round(lerp(20000, 54000, clamp(quality, 0, 1)))
    const rng = makeRng(20260820)

    const offsets: number[] = []
    const sizes: number[] = []
    const tints: number[] = []
    const phases: number[] = []

    const xMin = -190
    const xMax = 250
    const zMin = 92
    const zMax = 212
    let tries = 0
    while (offsets.length / 3 < target && tries < target * 9) {
      tries++
      const x = rand(rng, xMin, xMax)
      const z = rand(rng, zMin, zMax)
      const w = wearAmount(x, z)
      // よく踏まれる所ほど生えていない
      const density = Math.pow(1 - w, 1.7)
      if (rng() > density) continue
      // カメラが見る辺りを厚めに
      const focus = 0.62 + 0.38 * smoothstep(340, 50, Math.hypot(x - 70, z - 168))
      if (rng() > focus) continue

      const y = groundHeight(x, z)
      if (y < -0.2) continue

      // 水際のヨシは背が高い
      const reed = smoothstep(L.near.slopeTop + 8, L.near.shore + 2, z)
      const h = rand(rng, 0.20, 0.40) + reed * rand(rng, 0.6, 1.7)
      const wd = rand(rng, 0.62, 1.25) * (1 + reed * 0.35)

      offsets.push(x, y - 0.04, z)
      sizes.push(wd, h)
      const g = rand(rng, 0.62, 0.98)
      const dry = Math.pow(rng(), 2.2)
      tints.push(
        lerp(0.50, 0.86, dry) * g,
        lerp(0.56, 0.76, dry) * g,
        lerp(0.32, 0.44, dry) * g,
      )
      phases.push(rng() * Math.PI * 2)
    }

    const count = offsets.length / 3
    const quad = new THREE.PlaneGeometry(1, 1, 1, 1)
    quad.translate(0, 0.5, 0)
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = quad.index
    geo.attributes.position = quad.attributes.position
    geo.attributes.uv = quad.attributes.uv
    geo.setAttribute('iOffset', new THREE.InstancedBufferAttribute(new Float32Array(offsets), 3))
    geo.setAttribute('iSize', new THREE.InstancedBufferAttribute(new Float32Array(sizes), 2))
    geo.setAttribute('iTint', new THREE.InstancedBufferAttribute(new Float32Array(tints), 3))
    geo.setAttribute('iPhase', new THREE.InstancedBufferAttribute(new Float32Array(phases), 1))
    geo.instanceCount = count
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(20, 3, 165), 460)

    this.uni = {
      uTime: { value: 0 },
      uWind: { value: 0.16 },
      uMap: { value: makeGrassBlade(128) },
      uSunColor: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3() },
      uAmbient: { value: new THREE.Color() },
      uFogColor: { value: new THREE.Color() },
      uFogDensity: { value: 0.002 },
      uCamPos: { value: new THREE.Vector3() },
    }

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uni,
      side: THREE.DoubleSide,
      fog: false,
    })

    this.mesh = new THREE.InstancedMesh(geo, mat, count)
    this.mesh.frustumCulled = false
    this.mesh.name = 'grass'
  }

  update(dt: number, camera: THREE.Camera, env: Environment) {
    this.clock += dt
    this.uni.uTime.value = this.clock
    ;(this.uni.uCamPos.value as THREE.Vector3).copy(camera.position)
    ;(this.uni.uSunColor.value as THREE.Color)
      .copy(env.sunColor)
      .multiplyScalar(env.sun.intensity * 0.36)
    ;(this.uni.uSunDir.value as THREE.Vector3).copy(env.sunDir)
    ;(this.uni.uAmbient.value as THREE.Color)
      .copy(env.hemi.color)
      .lerp(env.hemi.groundColor, 0.45)
      .multiplyScalar(env.hemi.intensity * 0.62 + env.ambient.intensity)
    ;(this.uni.uFogColor.value as THREE.Color).copy(env.fogColor)
    this.uni.uFogDensity.value = env.fog.density
  }
}
