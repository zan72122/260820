import * as THREE from 'three'
import { noiseTexture } from '../world/noise'
import { NOISE_GLSL } from '../world/shaders'

/**
 * The optional "look again" moment, only offered after the first root is in
 * the boat: a short section through the bed showing that the joints run
 * sideways underground. Never shown before the first discovery.
 */
export class Cutaway {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(38, 1, 0.05, 40)
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.4)
  private root: THREE.Mesh | null = null
  private soil: THREE.Mesh
  private water: THREE.Mesh
  t = 0
  active = false

  constructor(env: THREE.Texture) {
    this.scene.environment = env
    this.scene.background = new THREE.Color(0x8e9a9c)
    const key = new THREE.DirectionalLight(0xffeccb, 2.0)
    key.position.set(2, 3, 2.5)
    this.scene.add(key)
    this.scene.add(new THREE.HemisphereLight(0xb9c8d2, 0x4a4437, 0.6))

    const soilMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 })
    soilMat.clippingPlanes = [this.plane]
    soilMat.clipShadows = false
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
           float layer = fbm(vec2(vSoilP.x*3.0, vSoilP.y*16.0));
           vec3 c = mix(vec3(0.20,0.18,0.14), vec3(0.115,0.105,0.088), smoothstep(-0.05,-0.30, vSoilP.y));
           c *= 0.85 + 0.35*layer;
           diffuseColor.rgb *= c;`,
        )
    }
    soilMat.customProgramCacheKey = () => 'cutsoil'
    this.soil = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.62, 0.8, 1, 1, 1), soilMat)
    this.soil.position.y = -0.31
    this.scene.add(this.soil)

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x4a4a3a,
      roughness: 0.15,
      metalness: 0,
      transparent: true,
      opacity: 0.72,
    })
    waterMat.clippingPlanes = [this.plane]
    this.water = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.8), waterMat)
    this.water.position.y = 0.08
    this.scene.add(this.water)
  }

  setRoot(geometry: THREE.BufferGeometry) {
    if (this.root) {
      this.scene.remove(this.root)
      this.root.geometry.dispose()
    }
    const g = geometry.clone()
    g.computeBoundingBox()
    const bb = g.boundingBox!
    const c = bb.getCenter(new THREE.Vector3())
    g.translate(-c.x, -c.y, -c.z)
    const span = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z)
    const mat = new THREE.MeshStandardMaterial({ color: 0xd6c9ab, roughness: 0.62 })
    this.root = new THREE.Mesh(g, mat)
    const s = Math.min(1, 1.1 / Math.max(0.2, span))
    this.root.scale.setScalar(s)
    this.root.position.set(0, -0.17, 0.02)
    this.root.rotation.y = 0.15
    this.scene.add(this.root)
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
    const open = Math.min(1, Math.max(0, (this.t - 0.35) / 1.5))
    this.plane.constant = 0.42 - open * 0.44
    const a = -0.55 + Math.sin(this.t * 0.32) * 0.22
    const dist = 1.55
    this.camera.position.set(Math.sin(a) * dist, 0.42 + 0.1 * Math.cos(this.t * 0.3), Math.cos(a) * dist)
    this.camera.lookAt(0, -0.16, 0)
    this.camera.aspect = aspect
    this.camera.fov = aspect < 1 ? 46 : 38
    this.camera.updateProjectionMatrix()
    return this.t
  }
}
