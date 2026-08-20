import * as THREE from 'three'

/**
 * 「ここを さわってね」を示す目印。
 * 4歳児が迷わないよう、大きく・脈打つ・常に画面上で同じくらいの大きさ。
 */

function ringTexture(size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.clearRect(0, 0, size, size)
  const cx = size / 2
  g.lineCap = 'round'
  const segs = 4
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2 + 0.22
    const a1 = ((i + 1) / segs) * Math.PI * 2 - 0.22
    g.beginPath()
    g.arc(cx, cx, size * 0.36, a0, a1)
    g.strokeStyle = 'rgba(255, 236, 200, 0.98)'
    g.lineWidth = size * 0.055
    g.stroke()
  }
  g.beginPath()
  g.arc(cx, cx, size * 0.36, 0, Math.PI * 2)
  g.strokeStyle = 'rgba(255, 190, 110, 0.35)'
  g.lineWidth = size * 0.14
  g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function arrowTexture(size = 128) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.clearRect(0, 0, size, size)
  g.beginPath()
  g.moveTo(size * 0.5, size * 0.86)
  g.lineTo(size * 0.16, size * 0.24)
  g.lineTo(size * 0.84, size * 0.24)
  g.closePath()
  g.fillStyle = 'rgba(255, 226, 170, 0.95)'
  g.fill()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

type Marker = {
  group: THREE.Group
  ring: THREE.Sprite
  arrow: THREE.Sprite
  anchor: THREE.Vector3
  visible: boolean
  value: number
  phase: number
  size: number
}

export class MarkerLayer {
  readonly group = new THREE.Group()
  private ringTex = ringTexture()
  private arrowTex = arrowTexture()
  private markers: Marker[] = []
  private clock = 0

  constructor() {
    this.group.name = 'markers'
    this.group.renderOrder = 10
  }

  add(anchor: THREE.Vector3, size = 1) {
    const ring = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.ringTex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
        fog: false,
      }),
    )
    const arrow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.arrowTex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        opacity: 0,
        fog: false,
      }),
    )
    const g = new THREE.Group()
    g.add(ring)
    g.add(arrow)
    g.renderOrder = 10
    this.group.add(g)
    const m: Marker = {
      group: g,
      ring,
      arrow,
      anchor: anchor.clone(),
      visible: false,
      value: 0,
      phase: this.markers.length * 0.7,
      size,
    }
    this.markers.push(m)
    return this.markers.length - 1
  }

  setAnchor(i: number, p: THREE.Vector3) {
    this.markers[i].anchor.copy(p)
  }
  setVisible(i: number, v: boolean) {
    if (this.markers[i]) this.markers[i].visible = v
  }
  hideAll() {
    for (const m of this.markers) m.visible = false
  }

  update(dt: number, camera: THREE.Camera) {
    this.clock += dt
    const camPos = new THREE.Vector3()
    camera.getWorldPosition(camPos)
    for (const m of this.markers) {
      const target = m.visible ? 1 : 0
      m.value += (target - m.value) * Math.min(1, dt * 7)
      if (m.value < 0.002) {
        m.group.visible = false
        continue
      }
      m.group.visible = true
      m.group.position.copy(m.anchor)
      const dist = camPos.distanceTo(m.anchor)
      // 画面上でほぼ一定の大きさに
      const s = Math.max(0.9, dist * 0.085) * m.size
      const pulse = 1 + Math.sin(this.clock * 3.1 + m.phase) * 0.11
      m.ring.scale.setScalar(s * pulse * m.value)
      m.ring.position.set(0, 0, 0)
      ;(m.ring.material as THREE.SpriteMaterial).opacity = m.value * (0.72 + 0.28 * pulse)
      ;(m.ring.material as THREE.SpriteMaterial).rotation = this.clock * 0.55

      const bob = Math.sin(this.clock * 2.6 + m.phase) * s * 0.11
      m.arrow.scale.setScalar(s * 0.42 * m.value)
      m.arrow.position.set(0, s * 0.78 + bob, 0)
      ;(m.arrow.material as THREE.SpriteMaterial).opacity = m.value * 0.9
    }
  }

  anchorOf(i: number) {
    return this.markers[i].anchor
  }
}
