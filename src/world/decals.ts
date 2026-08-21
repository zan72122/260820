import * as THREE from 'three'
import { buildTextures } from '../core/textures'

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _c = new THREE.Color()
const _up = new THREE.Vector3(0, 1, 0)
const _x = new THREE.Vector3(1, 0, 0)

const FLAT = new THREE.Quaternion().setFromAxisAngle(_x, -Math.PI / 2)

interface Placement {
  pos: THREE.Vector3
  radius: number
  squash: number
  yaw: number
  /** Vertical decals turn to face the camera around Y; ground pools stay flat. */
  billboard: boolean
}

/**
 * The pool of light each fixture throws, drawn as an additive decal rather than
 * a real light. This is what keeps a night park readable on a handful of real
 * lights, and it is why only surfaces near a fitting ever brighten.
 */
export class LightPools {
  readonly mesh: THREE.InstancedMesh
  private readonly places: Placement[] = []

  constructor(capacity: number) {
    const tex = buildTextures()
    const geo = new THREE.PlaneGeometry(1, 1)
    const mat = new THREE.MeshBasicMaterial({
      map: tex.lightPool,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: true,
    })
    this.mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, capacity))
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 2
    this.mesh.count = 0
    const colours = new Float32Array(Math.max(1, capacity) * 3)
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(colours, 3)
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)
  }

  /** Returns the instance index for later level updates. */
  add(
    x: number,
    y: number,
    z: number,
    radius: number,
    opts: { squash?: number; yaw?: number; billboard?: boolean } = {},
  ): number {
    const index = this.places.length
    if (index >= this.mesh.instanceMatrix.count) return -1
    this.places.push({
      pos: new THREE.Vector3(x, y, z),
      radius,
      squash: opts.squash ?? 1,
      yaw: opts.yaw ?? 0,
      billboard: opts.billboard ?? false,
    })
    this.mesh.count = this.places.length
    this.writeMatrix(index, 0)
    return index
  }

  private writeMatrix(index: number, cameraYaw: number): void {
    const pl = this.places[index]
    if (pl.billboard) {
      _q.setFromAxisAngle(_up, cameraYaw)
    } else {
      _q2.setFromAxisAngle(_up, pl.yaw)
      _q.copy(_q2).multiply(FLAT)
    }
    _s.set(pl.radius * 2, pl.radius * 2 * pl.squash, 1)
    _m.compose(pl.pos, _q, _s)
    this.mesh.setMatrixAt(index, _m)
  }

  setLevel(index: number, colour: THREE.ColorRepresentation, level: number): void {
    if (index < 0 || index >= this.places.length || !this.mesh.instanceColor) return
    _c.set(colour)
    _c.multiplyScalar(level)
    this.mesh.instanceColor.setXYZ(index, _c.r, _c.g, _c.b)
  }

  /** Re-aims the vertical decals; ground pools are untouched. */
  update(camera: THREE.Camera): void {
    let dirty = false
    for (let i = 0; i < this.places.length; i++) {
      const pl = this.places[i]
      if (!pl.billboard) continue
      const yaw = Math.atan2(camera.position.x - pl.pos.x, camera.position.z - pl.pos.z)
      this.writeMatrix(i, yaw)
      dirty = true
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  flush(): void {
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}

/**
 * Baked ambient-occlusion discs. Everything that meets the ground gets one so
 * props never float, without paying for a shadow map per fixture.
 */
export class ContactShadows {
  readonly mesh: THREE.InstancedMesh
  private used = 0
  private readonly alphas: Float32Array

  constructor(capacity: number) {
    const tex = buildTextures()
    const geo = new THREE.InstancedBufferGeometry()
    const plane = new THREE.PlaneGeometry(1, 1)
    geo.index = plane.index
    geo.attributes.position = plane.attributes.position
    geo.attributes.uv = plane.attributes.uv
    geo.attributes.normal = plane.attributes.normal
    plane.dispose()

    this.alphas = new Float32Array(capacity)
    const attr = new THREE.InstancedBufferAttribute(this.alphas, 1)
    attr.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('aAlpha', attr)

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uMap: { value: tex.contact } },
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        varying vec2 vUv;
        varying float vAlpha;
        void main() {
          vUv = uv;
          vAlpha = aAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying vec2 vUv;
        varying float vAlpha;
        void main() {
          float a = texture2D(uMap, vUv).a * vAlpha;
          if (a < 0.003) discard;
          gl_FragColor = vec4(0.0, 0.0, 0.0, a);
        }
      `,
    })

    this.mesh = new THREE.InstancedMesh(geo, mat, capacity)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 3
    this.mesh.count = 0
  }

  add(x: number, y: number, z: number, radius: number, opacity: number, squash = 1): void {
    if (this.used >= this.alphas.length) return
    _p.set(x, y + 0.006, z)
    _s.set(radius * 2, radius * 2 * squash, 1)
    _m.compose(_p, FLAT, _s)
    this.mesh.setMatrixAt(this.used, _m)
    this.alphas[this.used] = opacity
    this.used++
    this.mesh.count = this.used
    this.mesh.instanceMatrix.needsUpdate = true
    this.mesh.geometry.getAttribute('aAlpha').needsUpdate = true
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
