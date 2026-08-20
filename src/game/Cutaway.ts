import * as THREE from 'three'
import { NOISE_GLSL } from '../world/shaders'
import { noiseTexture } from '../world/noise'

/**
 * The optional "look again" moment, offered only after the first root is in the
 * boat: a short section through the bed that shows the stalks you touched
 * leading down to a chain of joints running sideways underground. Never shown
 * before the first discovery.
 */
export class Cutaway {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(38, 1, 0.05, 40)
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.34)
  private root: THREE.Mesh | null = null
  private stalks = new THREE.Group()
  t = 0
  active = false

  private readonly W = 1.4
  private readonly D = 0.62
  private readonly H = 0.52

  constructor(env: THREE.Texture) {
    this.scene.environment = env
    this.scene.background = new THREE.Color(0x9aa6a6)
    const key = new THREE.DirectionalLight(0xffeccb, 2.2)
    key.position.set(2.2, 3, 2.5)
    this.scene.add(key)
    this.scene.add(new THREE.HemisphereLight(0xb9c8d2, 0x4a4437, 0.55))

    const soilMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 })
    soilMat.clippingPlanes = [this.plane]
    soilMat.side = THREE.DoubleSide
    soilMat.onBeforeCompile = (sh) => {
      sh.uniforms.uNoise = { value: noiseTexture() }
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSoilP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSoilP = position;')
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${NOISE_GLSL}\nvarying vec3 vSoilP;`)
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           // bedded clay: silt on top, denser and darker with depth
           float layer = fbm(vec2(vSoilP.x*2.6, vSoilP.y*9.0));
           float band = fbm(vec2(vSoilP.x*11.0, vSoilP.y*30.0));
           vec3 c = mix(vec3(0.175,0.160,0.126), vec3(0.086,0.078,0.064), smoothstep(0.02,-0.34, vSoilP.y));
           c *= 0.84 + 0.30*layer;
           c *= 0.93 + 0.14*band;
           diffuseColor.rgb *= c;`,
        )
    }
    soilMat.customProgramCacheKey = () => 'cutsoil'
    const soil = new THREE.Mesh(new THREE.BoxGeometry(this.W, this.H, this.D), soilMat)
    soil.position.y = -this.H / 2
    this.scene.add(soil)

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x6a6252,
      roughness: 0.18,
      metalness: 0,
      transparent: true,
      opacity: 0.86,
      side: THREE.DoubleSide,
    })
    waterMat.clippingPlanes = [this.plane]
    const water = new THREE.Mesh(new THREE.BoxGeometry(this.W, 0.15, this.D), waterMat)
    water.position.y = 0.075
    this.scene.add(water)
    this.scene.add(this.stalks)
  }

  setRoot(geometry: THREE.BufferGeometry) {
    if (this.root) {
      this.scene.remove(this.root)
      this.root.geometry.dispose()
    }
    this.stalks.clear()

    const g = geometry.clone()
    g.computeBoundingBox()
    const bb = g.boundingBox!
    const c = bb.getCenter(new THREE.Vector3())
    g.translate(-c.x, -c.y, -c.z)
    const span = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z)
    const mat = new THREE.MeshStandardMaterial({ color: 0xd9cdb0, roughness: 0.55 })
    this.root = new THREE.Mesh(g, mat)
    const s = Math.min(1.2, (this.W * 0.72) / Math.max(0.2, span))
    this.root.scale.setScalar(s)
    this.root.position.set(0, -0.17, 0.02)
    // lay the chain across the section rather than into it
    this.root.rotation.y = -Math.atan2(bb.max.z - bb.min.z, bb.max.x - bb.min.x) * 0.5
    this.scene.add(this.root)

    // the cut stalks the player sees at the surface, joined to the joints below
    const stalkMat = new THREE.MeshStandardMaterial({ color: 0x4b4934, roughness: 0.8 })
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * this.W * 0.24
      const h = 0.17 + 0.29 + i * 0.02
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, h, 6), stalkMat)
      stalk.position.set(x, -0.17 + h / 2, 0.02)
      stalk.rotation.z = (i - 1) * 0.09
      this.stalks.add(stalk)
    }
  }

  start() {
    this.active = true
    this.t = 0
  }
  stop() {
    this.active = false
  }

  update(dt: number, aspect: number) {
    this.t += dt
    const open = Math.min(1, Math.max(0, (this.t - 0.4) / 1.6))
    this.plane.constant = this.D * 0.5 + 0.02 - open * (this.D * 0.5 + 0.03)
    const a = -0.28 + Math.sin(this.t * 0.28) * 0.2
    const portrait = aspect < 1
    const dist = portrait ? 2.05 : 1.5
    this.camera.position.set(Math.sin(a) * dist, 0.34 + 0.08 * Math.cos(this.t * 0.3), Math.cos(a) * dist)
    this.camera.lookAt(0, -0.12, 0)
    this.camera.aspect = aspect
    this.camera.fov = portrait ? 44 : 38
    this.camera.updateProjectionMatrix()
    return this.t
  }
}
