import * as THREE from 'three'
import { WORKTOP } from '../core/dims'
import { tileTexture, woodTexture, windowTexture } from '../core/textures'
import { Rng, damp } from '../core/math'

/**
 * Counter-top oven with a real window: the casing is open at the front, the
 * liner is five inward-facing planes, and the door is four bars around glass —
 * so the pan is genuinely visible through the door while it bakes.
 */
export class Oven {
  readonly root = new THREE.Group()
  readonly door = new THREE.Group()
  readonly interior = new THREE.Group()
  readonly rackY = 0.085
  readonly glow: THREE.PointLight
  /** Dropped to near zero for the short cut-away beat during baking. */
  glassFade = 1
  private openTarget = 0
  private openValue = 0
  private glassMat: THREE.MeshStandardMaterial
  private liner: THREE.MeshStandardMaterial

  constructor() {
    const W = 0.58
    const H = 0.4
    const D = 0.34
    const T = 0.03
    const steel = new THREE.MeshStandardMaterial({ color: 0x63676b, roughness: 0.42, metalness: 0.6 })
    const dark = new THREE.MeshStandardMaterial({ color: 0x4b443b, roughness: 0.6, metalness: 0.35 })
    this.liner = new THREE.MeshStandardMaterial({
      color: 0x8a6b4e,
      roughness: 0.55,
      metalness: 0.35,
      emissive: new THREE.Color(0x3d1a08),
      side: THREE.FrontSide,
    })

    // --- casing, open at the front -----------------------------------------
    const casing = new THREE.Group()
    const panel = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), steel)
      m.position.set(x, y, z)
      m.castShadow = true
      m.receiveShadow = true
      return m
    }
    casing.add(
      panel(T, H, D, -W / 2 + T / 2, H / 2, -D / 2),
      panel(T, H, D, W / 2 - T / 2, H / 2, -D / 2),
      panel(W, T, D, 0, H - T / 2, -D / 2),
      panel(W, T, D, 0, T / 2, -D / 2),
      panel(W, H, T, 0, H / 2, -D + T / 2),
    )

    // --- liner: five inward-facing planes, nothing blocking the opening -----
    const inset = T + 0.002
    const iw = W - inset * 2
    const ih = H - inset * 2
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(iw, D - inset), this.liner)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0, inset, -(D - inset) / 2 - 0.001)
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(iw, D - inset), this.liner)
    ceil.rotation.x = Math.PI / 2
    ceil.position.set(0, H - inset, -(D - inset) / 2 - 0.001)
    const back = new THREE.Mesh(new THREE.PlaneGeometry(iw, ih), this.liner)
    back.position.set(0, H / 2, -D + inset)
    const left = new THREE.Mesh(new THREE.PlaneGeometry(D - inset, ih), this.liner)
    left.rotation.y = Math.PI / 2
    left.position.set(-W / 2 + inset, H / 2, -(D - inset) / 2 - 0.001)
    const right = new THREE.Mesh(new THREE.PlaneGeometry(D - inset, ih), this.liner)
    right.rotation.y = -Math.PI / 2
    right.position.set(W / 2 - inset, H / 2, -(D - inset) / 2 - 0.001)
    this.interior.add(floor, ceil, back, left, right)

    // --- rack ---------------------------------------------------------------
    const barMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.45, metalness: 0.85 })
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, D - 0.1, 6), barMat)
      b.rotation.x = Math.PI / 2
      b.position.set(-0.2 + i * 0.05, this.rackY, -D / 2 - 0.015)
      this.interior.add(b)
    }
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, W - 0.1, 6), barMat)
    rail.rotation.z = Math.PI / 2
    rail.position.set(0, this.rackY, -0.1)
    const rail2 = rail.clone()
    rail2.position.z = -D + 0.08
    this.interior.add(rail, rail2)

    this.glow = new THREE.PointLight(0xffa04a, 1.1, 1.1, 2)
    this.glow.position.set(0, H * 0.78, -D * 0.5)
    this.interior.add(this.glow)

    // --- door: bars around a real pane, hinged at the bottom front ----------
    const Hd = H - 0.015
    const bar = 0.062
    const bars = [
      [W, bar, 0, bar / 2],
      [W, bar, 0, Hd - bar / 2],
      [bar, Hd - bar * 2, -W / 2 + bar / 2, Hd / 2],
      [bar, Hd - bar * 2, W / 2 - bar / 2, Hd / 2],
    ]
    for (const [w, h, x, y] of bars) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.026), dark)
      m.position.set(x, y, 0.014)
      m.castShadow = true
      this.door.add(m)
    }
    this.glassMat = new THREE.MeshStandardMaterial({
      color: 0x30302c,
      roughness: 0.08,
      metalness: 0.55,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(W - bar * 2, Hd - bar * 2), this.glassMat)
    glass.position.set(0, Hd / 2, 0.016)
    glass.renderOrder = 4
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, W - 0.06, 12), steel)
    handle.rotation.z = Math.PI / 2
    handle.position.set(0, Hd - 0.012, 0.05)
    handle.castShadow = true
    this.door.add(glass, handle)
    this.door.position.set(0, 0, 0.002)

    this.root.add(casing, this.interior, this.door)
    this.root.name = 'oven'
  }

  set open(v: number) {
    this.openTarget = Math.max(0, Math.min(1, v))
  }
  get openAmount() {
    return this.openValue
  }
  /** The pane clears while the door swings down, and for the cut-away beat. */
  update(dt: number) {
    this.openValue = damp(this.openValue, this.openTarget, 5.2, dt)
    this.door.rotation.x = -this.openValue * Math.PI * 0.5
    this.glassMat.opacity = (0.24 - this.openValue * 0.2) * this.glassFade
  }
}

export interface Kitchen {
  root: THREE.Group
  oven: Oven
  worktopY: number
}

export function buildKitchen(quality: 'high' | 'low'): Kitchen {
  const root = new THREE.Group()
  root.name = 'kitchen'

  // ---- worktop -------------------------------------------------------------
  const wood = woodTexture()
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(WORKTOP.width, WORKTOP.thickness, WORKTOP.depth),
    new THREE.MeshStandardMaterial({ map: wood, color: 0xffffff, roughness: 0.62, metalness: 0.02 }),
  )
  top.position.set(0, -WORKTOP.thickness / 2, WORKTOP.centerZ)
  top.receiveShadow = true
  top.name = 'worktop'

  const cabinet = new THREE.Mesh(
    new THREE.BoxGeometry(WORKTOP.width - 0.04, 0.86, WORKTOP.depth - 0.06),
    new THREE.MeshStandardMaterial({ color: 0xdcd6cb, roughness: 0.8, metalness: 0 }),
  )
  cabinet.position.set(0, -0.045 - 0.43, WORKTOP.centerZ - 0.02)
  cabinet.receiveShadow = true

  // ---- walls ---------------------------------------------------------------
  const tiles = tileTexture()
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 2.6),
    new THREE.MeshStandardMaterial({ map: tiles, color: 0xffffff, roughness: 0.85, metalness: 0 }),
  )
  backWall.position.set(0, 0.5, -1.02)
  backWall.receiveShadow = true

  const leftWall = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.MeshStandardMaterial({ color: 0xe6e2da, roughness: 0.92, metalness: 0 }),
  )
  leftWall.rotation.y = Math.PI / 2
  leftWall.position.set(-1.2, 0.5, -0.2)

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4),
    new THREE.MeshStandardMaterial({ color: 0xb9b0a3, roughness: 0.95, metalness: 0 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.92

  // ---- window on the right, the room's key light ---------------------------
  const winGroup = new THREE.Group()
  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.86, 0.78),
    new THREE.MeshBasicMaterial({ map: windowTexture(), color: 0xffffff, toneMapped: false }),
  )
  pane.rotation.y = -Math.PI / 2
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: 0.7 })
  const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.8, 0.02), frameMat)
  mullionV.position.set(0.01, 0, 0)
  const mullionH = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.02, 0.88), frameMat)
  mullionH.position.set(0.01, 0.05, 0)
  const surround = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.9, 0.98), frameMat)
  surround.position.set(0.02, 0, 0)
  winGroup.add(surround, pane, mullionV, mullionH)
  winGroup.position.set(1.14, 0.62, -0.4)

  // ---- background dressing -------------------------------------------------
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0xcfc4b2, roughness: 0.75 })
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.022, 0.16), shelfMat)
  shelf.position.set(0.5, 0.66, -0.95)
  shelf.castShadow = false
  const shelf2 = shelf.clone()
  shelf2.position.y = 0.9

  const rng = new Rng(1717)
  const jarGeo = new THREE.CylinderGeometry(0.032, 0.034, 0.1, 14)
  const jarMats = [0xe8dfcd, 0xd8c8ab, 0xc9d2c4, 0xe3d3c0].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.05 }),
  )
  const dress = new THREE.Group()
  for (let i = 0; i < 8; i++) {
    const j = new THREE.Mesh(jarGeo, jarMats[i % jarMats.length])
    const onTop = i > 3
    j.position.set(-0.82 + (i % 4) * 0.2 + rng.range(-0.02, 0.02), (onTop ? 0.86 : 0.62) + 0.061, -0.95)
    j.scale.setScalar(rng.range(0.8, 1.15))
    dress.add(j)
  }

  const oven = new Oven()
  oven.root.position.set(-0.52, 0, -0.52)

  root.add(top, cabinet, backWall, leftWall, floor, winGroup, shelf, shelf2, dress, oven.root)
  if (quality === 'high') {
    const bowlStack = new THREE.Group()
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07 - i * 0.006, 0.05 - i * 0.006, 0.03, 20),
        new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: 0.5 }),
      )
      b.position.set(0.62, 0.016 + i * 0.026, -0.24)
      b.castShadow = true
      bowlStack.add(b)
    }
    root.add(bowlStack)
  }

  return { root, oven, worktopY: 0 }
}
