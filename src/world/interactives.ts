import * as THREE from 'three'
import { box, merge, strut } from './geom'
import { deckY } from './bridge'
import { groundHeight, L } from './layout'
import type { MaterialLib } from './materials'
import { clamp, damp, easeOutCubic, makeRng, rand } from '../core/util'
import { makeGlow } from './textures'

/** 工事用の縞（黄と黒）。褪せと汚れ込み。 */
function stripeTexture(size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.fillStyle = '#c9a52c'
  g.fillRect(0, 0, size, size)
  g.strokeStyle = '#20211f'
  g.lineWidth = size * 0.16
  for (let i = -2; i < 10; i++) {
    g.beginPath()
    g.moveTo(i * size * 0.24, 0)
    g.lineTo(i * size * 0.24 + size, size)
    g.stroke()
  }
  // 使用感（擦れ・泥はね）
  g.globalAlpha = 0.16
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = Math.random() * size * 0.05
    g.fillStyle = Math.random() > 0.5 ? '#6a5c44' : '#e6e0cf'
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** 通行止めの丸看板。 */
function signTexture(size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.clearRect(0, 0, size, size)
  g.fillStyle = '#d8d2c4'
  g.beginPath()
  g.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#b0342c'
  g.beginPath()
  g.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#efe9dc'
  g.fillRect(size * 0.14, size * 0.42, size * 0.72, size * 0.16)
  g.globalAlpha = 0.15
  for (let i = 0; i < 160; i++) {
    g.fillStyle = '#3a3630'
    g.beginPath()
    g.arc(Math.random() * size, Math.random() * size, Math.random() * size * 0.03, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export type Interactive = {
  readonly anchor: THREE.Vector3
  done: boolean
  activate(): void
  /** もう一度あそぶときに、置かれていた状態へ戻す。 */
  reset(): void
  update(dt: number): void
}

/* ---------------------------------------------------------------- *
 * 橋の通行止めバリケード
 * ---------------------------------------------------------------- */
export class Barricade implements Interactive {
  readonly group = new THREE.Group()
  readonly anchor = new THREE.Vector3()
  done = false
  private pivot = new THREE.Group()
  private target = 0
  private value = 0
  private puff: THREE.Sprite
  private puffLife = -1
  private base: THREE.Vector3

  constructor(x: number, z: number, lib: MaterialLib, seed: number, stripeMat: THREE.Material) {
    const rng = makeRng(seed)
    const y = deckY(z) + 0.05
    this.base = new THREE.Vector3(x, y, z)
    this.group.position.copy(this.base)
    this.group.rotation.y = rand(rng, -0.06, 0.06)
    this.group.add(this.pivot)

    // A 型の脚
    const legs: (THREE.BufferGeometry | null)[] = []
    for (const sx of [-0.62, 0.62]) {
      legs.push(
        strut(
          new THREE.Vector3(sx, 0, -0.34),
          new THREE.Vector3(sx, 1.04, 0),
          0.06,
          0.06,
          1.4,
        ),
      )
      legs.push(
        strut(
          new THREE.Vector3(sx, 0, 0.34),
          new THREE.Vector3(sx, 1.04, 0),
          0.06,
          0.06,
          1.4,
        ),
      )
      legs.push(
        strut(
          new THREE.Vector3(sx, 0.42, -0.2),
          new THREE.Vector3(sx, 0.42, 0.2),
          0.045,
          0.045,
          1.4,
        ),
      )
    }
    const legMesh = new THREE.Mesh(merge(legs), lib.steel)
    legMesh.castShadow = true
    this.pivot.add(legMesh)

    // 縞板 2 段
    const boards = merge([
      box(1.62, 0.26, 0.045, 0, 0.94, 0, 1.0),
      box(1.62, 0.22, 0.045, 0, 0.6, 0, 1.0),
    ])
    const boardMesh = new THREE.Mesh(boards, stripeMat)
    boardMesh.castShadow = true
    this.pivot.add(boardMesh)

    // 重し（土のう）
    const bag = new THREE.Mesh(
      merge([
        box(0.42, 0.12, 0.28, -0.62, 0.06, 0.3, 1.4, 0.2),
        box(0.42, 0.12, 0.28, 0.62, 0.06, -0.3, 1.4, -0.15),
      ]),
      lib.sandbag,
    )
    bag.castShadow = true
    this.group.add(bag)

    this.anchor.set(x, y + 1.15, z)

    this.puff = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlow(64, 1.2),
        color: new THREE.Color('#c8b393'),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.NormalBlending,
        fog: false,
      }),
    )
    this.puff.position.set(x, y + 0.12, z)
    this.puff.scale.setScalar(1.4)
  }

  attachTo(parent: THREE.Object3D) {
    parent.add(this.group)
    parent.add(this.puff)
  }

  activate() {
    if (this.done) return
    this.done = true
    this.target = 1
    this.puffLife = 0
  }

  reset() {
    this.done = false
    this.target = 0
    this.value = 0
    this.puffLife = -1
    ;(this.puff.material as THREE.SpriteMaterial).opacity = 0
    this.pivot.rotation.x = 0
    this.pivot.position.z = 0
  }

  update(dt: number) {
    this.value = damp(this.value, this.target, 3.4, dt)
    const e = easeOutCubic(clamp(this.value, 0, 1))
    this.pivot.rotation.x = -e * (Math.PI / 2) * 0.97
    this.pivot.position.z = e * 0.06
    if (this.puffLife >= 0) {
      this.puffLife += dt
      const t = clamp(this.puffLife / 1.1, 0, 1)
      const m = this.puff.material as THREE.SpriteMaterial
      m.opacity = (1 - t) * 0.34
      this.puff.scale.setScalar(1.2 + t * 2.4)
      this.puff.position.y = this.base.y + 0.12 + t * 0.35
      if (t >= 1) this.puffLife = -1
    }
  }
}

/* ---------------------------------------------------------------- *
 * 通行止めの看板（バリケードが全部下りたら、くるっと向きを変える）
 * ---------------------------------------------------------------- */
export class RoadSign {
  readonly group = new THREE.Group()
  private pivot = new THREE.Group()
  private target = 0
  private value = 0

  constructor(x: number, z: number, lib: MaterialLib) {
    const y = deckY(z) + 0.05
    this.group.position.set(x, y, z)
    this.group.add(this.pivot)
    const legs = merge([
      box(0.07, 1.25, 0.07, -0.28, 0.62, 0, 1.4),
      box(0.07, 1.25, 0.07, 0.28, 0.62, 0, 1.4),
      box(0.66, 0.06, 0.06, 0, 0.3, 0, 1.4),
      box(0.07, 0.9, 0.07, 0, 0.45, 0.42, 1.4),
    ])
    const legMesh = new THREE.Mesh(legs, lib.steel)
    legMesh.castShadow = true
    this.pivot.add(legMesh)

    const disc = new THREE.CircleGeometry(0.42, 24)
    disc.translate(0, 1.42, 0.02)
    const sign = new THREE.Mesh(
      disc,
      new THREE.MeshStandardMaterial({
        map: signTexture(),
        transparent: true,
        roughness: 0.8,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    )
    sign.castShadow = true
    this.pivot.add(sign)
    const post = new THREE.Mesh(box(0.07, 0.6, 0.07, 0, 1.15, 0, 1.4), lib.steel)
    this.pivot.add(post)
  }

  open() {
    this.target = 1
  }

  reset() {
    this.target = 0
    this.value = 0
    this.pivot.rotation.y = 0
    this.pivot.position.x = 0
  }

  update(dt: number) {
    this.value = damp(this.value, this.target, 2.6, dt)
    this.pivot.rotation.y = easeOutCubic(this.value) * Math.PI * 0.62
    this.pivot.position.x = easeOutCubic(this.value) * 1.1
  }
}

/* ---------------------------------------------------------------- *
 * 会場の大元スイッチ（最後の大きな操作）
 * ---------------------------------------------------------------- */
export class MasterLever implements Interactive {
  readonly group = new THREE.Group()
  readonly anchor = new THREE.Vector3()
  done = false
  private arm = new THREE.Group()
  private value = 0
  private target = 0
  private indicator: THREE.Mesh
  private clock = 0

  constructor(lib: MaterialLib) {
    const x = L.hq.x - 3.4
    const z = L.hq.z + 1.6
    const y = groundHeight(x, z)
    this.group.position.set(x, y, z)
    this.group.rotation.y = -0.5

    // 台
    const stand = new THREE.Mesh(
      merge([
        box(0.16, 1.0, 0.16, -0.34, 0.5, 0, 1.4),
        box(0.16, 1.0, 0.16, 0.34, 0.5, 0, 1.4),
        box(0.9, 0.5, 0.44, 0, 1.2, 0, 1.0),
      ]),
      lib.steelDark,
    )
    stand.castShadow = true
    stand.receiveShadow = true
    this.group.add(stand)

    const panel = new THREE.Mesh(box(0.78, 0.36, 0.03, 0, 1.24, 0.23, 1.0), lib.paintYellow)
    this.group.add(panel)

    // レバー
    this.arm.position.set(0, 1.24, 0.2)
    const armGeo = merge([
      box(0.09, 0.62, 0.09, 0, 0.31, 0, 1.4),
    ])
    const armMesh = new THREE.Mesh(armGeo, lib.steel)
    armMesh.castShadow = true
    this.arm.add(armMesh)
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), lib.paintRed)
    knob.position.set(0, 0.64, 0)
    knob.castShadow = true
    this.arm.add(knob)
    this.group.add(this.arm)

    this.indicator = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 10, 8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#2a1008'), fog: false }),
    )
    this.indicator.position.set(0.3, 1.34, 0.25)
    this.group.add(this.indicator)

    this.anchor.set(x, y + 2.1, z)
    this.arm.rotation.x = -0.62
  }

  activate() {
    if (this.done) return
    this.done = true
    this.target = 1
  }

  reset() {
    this.done = false
    this.target = 0
    this.value = 0
    this.arm.rotation.x = -0.62
  }

  update(dt: number) {
    this.clock += dt
    this.value = damp(this.value, this.target, 5.5, dt)
    const e = easeOutCubic(this.value)
    this.arm.rotation.x = -0.62 + e * 1.24
    const m = this.indicator.material as THREE.MeshBasicMaterial
    if (this.done) {
      m.color.setRGB(0.15 + 2.4 * e, 2.6 * e, 0.9 * e)
    } else {
      const blink = 0.5 + 0.5 * Math.sin(this.clock * 3.4)
      m.color.setRGB(0.6 + blink * 2.2, 0.16 + blink * 0.35, 0.05)
    }
  }
}

/** 橋の入口のバリケード一式。 */
export function buildGate(lib: MaterialLib) {
  const group = new THREE.Group()
  group.name = 'gate'
  const stripeMat = new THREE.MeshStandardMaterial({
    map: stripeTexture(),
    roughness: 0.82,
    metalness: 0.05,
  })
  const z = L.bridge.gateZ
  const barricades: Barricade[] = []
  const xs = [-3.1, 0, 3.1]
  xs.forEach((x, i) => {
    const b = new Barricade(x, z + (i === 1 ? -0.25 : 0.15), lib, 1000 + i * 77, stripeMat)
    b.attachTo(group)
    barricades.push(b)
  })
  const sign = new RoadSign(-4.15, z + 1.2, lib)
  group.add(sign.group)
  return { group, barricades, sign }
}
