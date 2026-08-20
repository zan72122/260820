import * as THREE from 'three'

export type SkyRig = {
  sun: THREE.DirectionalLight
  fill: THREE.HemisphereLight
  envTexture: THREE.Texture
  sunDir: THREE.Vector3
  dispose(): void
}

/**
 * Late-autumn / early-winter harvest morning: low sun, cold pale sky, heavy
 * humidity near the horizon. Built procedurally so there are no HDR downloads.
 */
export function buildSky(scene: THREE.Scene, renderer: THREE.WebGLRenderer): SkyRig {
  const W = 1024
  const H = 512
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!

  const grad = g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0.0, '#39587c')
  grad.addColorStop(0.28, '#6b8ba7')
  grad.addColorStop(0.46, '#adbdc3')
  grad.addColorStop(0.5, '#d5d8cd')
  grad.addColorStop(0.54, '#9ba095')
  grad.addColorStop(0.75, '#6b7164')
  grad.addColorStop(1.0, '#484c44')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)

  // low morning sun glow, azimuth ~ -0.62pi
  const sunU = 0.17
  const sunV = 0.335
  const glow = g.createRadialGradient(sunU * W, sunV * H, 2, sunU * W, sunV * H, H * 0.55)
  glow.addColorStop(0.0, 'rgba(255,240,214,0.95)')
  glow.addColorStop(0.06, 'rgba(255,232,196,0.55)')
  glow.addColorStop(0.3, 'rgba(226,214,190,0.18)')
  glow.addColorStop(1.0, 'rgba(200,200,190,0)')
  g.globalCompositeOperation = 'lighter'
  g.fillStyle = glow
  g.fillRect(0, 0, W, H)
  g.globalCompositeOperation = 'source-over'

  // soft cloud banding, kept low contrast so nothing reads as a cartoon sky
  for (let i = 0; i < 90; i++) {
    const y = H * (0.12 + Math.random() * 0.33)
    const x = Math.random() * W
    const w = 60 + Math.random() * 320
    const h = 6 + Math.random() * 26
    g.fillStyle = `rgba(${218 + Math.random() * 24 | 0},${220 + Math.random() * 20 | 0},220,${0.03 + Math.random() * 0.06})`
    g.beginPath()
    g.ellipse(x, y, w, h, 0, 0, Math.PI * 2)
    g.fill()
  }

  const equirect = new THREE.CanvasTexture(c)
  equirect.mapping = THREE.EquirectangularReflectionMapping
  equirect.colorSpace = THREE.SRGBColorSpace
  equirect.needsUpdate = true

  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromEquirectangular(equirect).texture
  pmrem.dispose()

  scene.background = equirect
  scene.backgroundIntensity = 1.0
  scene.environment = env
  scene.environmentIntensity = 0.72
  scene.fog = new THREE.FogExp2(0xa8b0ad, 0.0125)

  const sunDir = new THREE.Vector3()
  const phi = (0.5 - sunV) * Math.PI // elevation
  const theta = sunU * Math.PI * 2
  sunDir.set(Math.cos(phi) * Math.sin(theta), Math.sin(phi), Math.cos(phi) * Math.cos(theta)).normalize()

  const sun = new THREE.DirectionalLight(0xffe9cc, 2.7)
  sun.position.copy(sunDir).multiplyScalar(40)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 60
  sun.shadow.bias = -0.0012
  sun.shadow.normalBias = 0.035
  const sc = sun.shadow.camera
  sc.left = -3.4
  sc.right = 3.4
  sc.top = 3.4
  sc.bottom = -3.4
  sc.updateProjectionMatrix()
  scene.add(sun)
  scene.add(sun.target)

  const fill = new THREE.HemisphereLight(0xb9c8d2, 0x4a4437, 0.3)
  scene.add(fill)

  return {
    sun,
    fill,
    envTexture: env,
    sunDir,
    dispose() {
      equirect.dispose()
      env.dispose()
    },
  }
}
