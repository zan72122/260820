/**
 * One sun, one sky, and one shared description of the sheet as a light source.
 * Everything that can be lit by the bounce reads the same uniform block, so the
 * fruit, the leaves, the branch and the bag all agree about where the light
 * came from.
 */
import * as THREE from 'three'
import type { SheetLightState, V3 } from '../sim/lightMath'
import type { QualitySettings } from '../core/quality'

const DEG = Math.PI / 180

export interface BounceUniformBlock {
  uQ0: THREE.IUniform<THREE.Vector3>
  uQ1: THREE.IUniform<THREE.Vector3>
  uQ2: THREE.IUniform<THREE.Vector3>
  uQ3: THREE.IUniform<THREE.Vector3>
  uSheetNormal: THREE.IUniform<THREE.Vector3>
  uSunDir: THREE.IUniform<THREE.Vector3>
  uSheetTint: THREE.IUniform<THREE.Color>
  uSheetAlbedo: THREE.IUniform<number>
  uSunStrength: THREE.IUniform<number>
  uSheetDeployed: THREE.IUniform<number>
  uBounceGain: THREE.IUniform<number>
  uTime: THREE.IUniform<number>
}

export class LightRig {
  readonly sun: THREE.DirectionalLight
  readonly hemi: THREE.HemisphereLight
  readonly sunDir = new THREE.Vector3(0, 1, 0)
  readonly uniforms: BounceUniformBlock
  readonly sheetState: SheetLightState

  private readonly target = new THREE.Object3D()

  constructor(scene: THREE.Scene, q: QualitySettings) {
    this.sun = new THREE.DirectionalLight(0xfff2d8, 3.1)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize)
    this.sun.shadow.bias = -0.0009
    this.sun.shadow.normalBias = 0.016
    this.sun.shadow.radius = q.softShadow ? 2.6 : 1
    const cam = this.sun.shadow.camera
    // Wide enough to hold the fruit, the branch and the whole spread sheet even
    // with the sun low: a tight frustum silently drops the ground shadows.
    cam.left = -2.3
    cam.right = 2.3
    cam.top = 2.3
    cam.bottom = -2.3
    cam.near = 1.2
    cam.far = 11
    cam.updateProjectionMatrix()
    scene.add(this.sun)
    scene.add(this.target)
    this.sun.target = this.target
    this.target.position.set(0, 0.75, 0)

    this.hemi = new THREE.HemisphereLight(0xa9c6e6, 0x77694a, 0.42)
    scene.add(this.hemi)

    this.uniforms = {
      uQ0: { value: new THREE.Vector3() },
      uQ1: { value: new THREE.Vector3() },
      uQ2: { value: new THREE.Vector3() },
      uQ3: { value: new THREE.Vector3() },
      uSheetNormal: { value: new THREE.Vector3(0, 1, 0) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSheetTint: { value: new THREE.Color(0xfff4e6) },
      uSheetAlbedo: { value: 0.74 },
      uSunStrength: { value: 1 },
      uSheetDeployed: { value: 0 },
      uBounceGain: { value: 1.8 },
      uTime: { value: 0 },
    }

    this.sheetState = {
      quad: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      ],
      normal: { x: 0, y: 1, z: 0 },
      albedo: 0.74,
      deployed: 0,
    }
  }

  applyQuality(q: QualitySettings): void {
    this.sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize)
    this.sun.shadow.radius = q.softShadow ? 2.6 : 1
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose()
      this.sun.shadow.map = null
    }
  }

  /** t: 0 = morning low east, 1 = late afternoon. */
  setSunT(t: number): void {
    // Kept near the camera axis so sun, sheet and fruit share one frame.
    const az = (-156 + 42 * t) * DEG
    // A late-summer arc that stays low enough to sit in frame above the sheet.
    const el = (9 + 14 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)))) * DEG
    const ce = Math.cos(el)
    this.sunDir.set(Math.sin(az) * ce, Math.sin(el), Math.cos(az) * ce).normalize()
    this.sun.position.copy(this.sunDir).multiplyScalar(6).add(this.target.position)

    // Warmer and weaker near the ends of the arc.
    const noon = Math.sin(Math.PI * t)
    this.sun.intensity = 1.6 + noon * 1.1
    this.sun.color.setHSL(0.1 - noon * 0.02, 0.42 - noon * 0.2, 0.62 + noon * 0.06)
    this.hemi.intensity = 0.3 + noon * 0.16
    this.uniforms.uSunDir.value.copy(this.sunDir)
    this.uniforms.uSunStrength.value = 0.62 + noon * 0.38
  }

  get sunStrength(): number {
    return this.uniforms.uSunStrength.value
  }

  setSheetQuad(quad: [V3, V3, V3, V3], normal: V3, deployed: number): void {
    for (let i = 0; i < 4; i++) {
      const q = quad[i]
      this.sheetState.quad[i].x = q.x
      this.sheetState.quad[i].y = q.y
      this.sheetState.quad[i].z = q.z
    }
    this.sheetState.normal = normal
    this.sheetState.deployed = deployed
    this.uniforms.uQ0.value.set(quad[0].x, quad[0].y, quad[0].z)
    this.uniforms.uQ1.value.set(quad[1].x, quad[1].y, quad[1].z)
    this.uniforms.uQ2.value.set(quad[2].x, quad[2].y, quad[2].z)
    this.uniforms.uQ3.value.set(quad[3].x, quad[3].y, quad[3].z)
    this.uniforms.uSheetNormal.value.set(normal.x, normal.y, normal.z)
    this.uniforms.uSheetDeployed.value = deployed
  }

  setTime(t: number): void {
    this.uniforms.uTime.value = t
  }
}

/** Snippet shared by every material that accepts bounce light. */
export const BOUNCE_UNIFORM_DECL = /* glsl */ `
uniform vec3 uQ0;
uniform vec3 uQ1;
uniform vec3 uQ2;
uniform vec3 uQ3;
uniform vec3 uSheetNormal;
uniform vec3 uSunDir;
uniform vec3 uSheetTint;
uniform float uSheetAlbedo;
uniform float uSunStrength;
uniform float uSheetDeployed;
uniform float uBounceGain;
uniform float uTime;
varying vec3 vMomoWPos;
varying vec3 vMomoWNrm;
`

export function attachBounceUniforms(target: Record<string, THREE.IUniform>, rig: LightRig): void {
  const u = rig.uniforms as unknown as Record<string, THREE.IUniform>
  for (const key of Object.keys(u)) target[key] = u[key]
}
