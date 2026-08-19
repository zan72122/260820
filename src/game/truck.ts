import * as THREE from 'three'
import { MeshBuilder, put } from './geom'
import { angleDelta, clamp, damp, lerp } from './rng'
import { terrainY } from './terrain'

/* ------------------------------------------------------------------ *
 * The receiver: a kei truck with a grain container on the bed, and the
 * farmer who waits beside it.  Local frame: +Z forward, origin on the
 * ground under the middle of the truck.
 * ------------------------------------------------------------------ */

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
const cyl = (rt: number, rb: number, h: number, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s)

const BIN = { w: 1.34, h: 0.88, d: 1.95, y: 0.78, z: -0.45 }

export class Truck {
  readonly root = new THREE.Group()
  private wheels: THREE.Object3D[] = []
  private grainSlab!: THREE.Mesh
  private grainHeap!: THREE.Mesh
  private farmer = new THREE.Group()
  private farmerArm = new THREE.Group()

  /** 0..1 how full the container is */
  fill = 0
  x = 0
  z = 0
  heading = 0
  private speed = 0
  private targetX = 0
  private targetZ = 0
  private targetHeading = 0
  private mode: 'idle' | 'drive' | 'park' = 'idle'
  private parkT = 0

  constructor(grainTex: THREE.Texture) {
    this.build(grainTex)
  }

  private build(grainTex: THREE.Texture) {
    const b = new MeshBuilder()
    const body = new THREE.Color(0xe6eaec)
    const bodyDark = new THREE.Color(0xb9c0c4)
    const dark = new THREE.Color(0x33373a)
    const steel = new THREE.Color(0x8c9498)
    const bedC = new THREE.Color(0x6e7276)

    // ladder chassis
    put(b, box(1.28, 0.1, 3.0), dark, [0, 0.44, 0])
    // cab-over: the whole front is cab, as a kei truck is
    put(b, box(1.44, 0.9, 1.24), body, [0, 1.16, 0.94])
    put(b, box(1.46, 0.26, 1.26), bodyDark, [0, 0.66, 0.94])
    put(b, box(1.3, 0.12, 0.1), dark, [0, 0.72, 1.56])
    for (const sx of [-1, 1]) {
      put(b, box(0.2, 0.14, 0.1), new THREE.Color(0xf6f0d8), [sx * 0.5, 0.85, 1.56])
      put(b, box(0.04, 0.24, 0.04), dark, [sx * 0.78, 1.62, 1.24], [0, 0, sx * 0.3])
      put(b, box(0.05, 0.16, 0.12), dark, [sx * 0.86, 1.76, 1.24])
    }
    // flat bed with drop sides
    put(b, box(1.44, 0.08, 1.94), bedC, [0, 0.72, -0.45])
    for (const sx of [-1, 1]) put(b, box(0.06, 0.3, 1.94), bedC, [sx * 0.72, 0.9, -0.45])
    put(b, box(1.44, 0.34, 0.06), bedC, [0, 0.92, -1.42])
    put(b, box(1.44, 0.5, 0.05), steel, [0, 1.05, 0.5])

    // grain container
    const binC = new THREE.Color(0x3f6f8e)
    const binD = new THREE.Color(0x2f5670)
    const bw = BIN.w
    const bh = BIN.h
    const bd = BIN.d
    for (const sx of [-1, 1]) put(b, box(0.05, bh, bd), binC, [sx * bw * 0.5, BIN.y + bh / 2, BIN.z])
    for (const sz of [-1, 1]) put(b, box(bw, bh, 0.05), binC, [0, BIN.y + bh / 2, BIN.z + sz * bd * 0.5])
    put(b, box(bw, 0.05, bd), binD, [0, BIN.y, BIN.z])
    for (const sx of [-1, 1]) {
      put(b, box(0.07, 0.07, bd), binD, [sx * bw * 0.5, BIN.y + bh, BIN.z])
      put(b, box(0.06, bh, 0.06), binD, [sx * bw * 0.5, BIN.y + bh / 2, BIN.z - bd * 0.5])
      put(b, box(0.06, bh, 0.06), binD, [sx * bw * 0.5, BIN.y + bh / 2, BIN.z + bd * 0.5])
    }
    put(b, box(bw, 0.07, 0.07), binD, [0, BIN.y + bh, BIN.z - bd * 0.5])
    put(b, box(bw, 0.07, 0.07), binD, [0, BIN.y + bh, BIN.z + bd * 0.5])

    const mesh = new THREE.Mesh(
      b.build(),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.28 }),
    )
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.root.add(mesh)

    // glass
    const glass = new THREE.MeshStandardMaterial({
      color: 0xa9cbd8,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.26, 0.64), glass)
    ws.position.set(0, 1.24, 1.567)
    this.root.add(ws)
    for (const sx of [-1, 1]) {
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.55), glass)
      sw.position.set(sx * 0.723, 1.22, 0.94)
      sw.rotation.y = (sx * Math.PI) / 2
      this.root.add(sw)
    }

    // wheels
    const wb = new MeshBuilder()
    put(wb, cyl(0.3, 0.3, 0.19, 14), new THREE.Color(0x1c1f22), [0, 0, 0], [0, 0, Math.PI / 2])
    put(wb, cyl(0.16, 0.16, 0.2, 12), new THREE.Color(0xbcc2c6), [0, 0, 0], [0, 0, Math.PI / 2])
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      put(wb, box(0.03, 0.1, 0.1), new THREE.Color(0x8f9599), [0, Math.cos(a) * 0.1, Math.sin(a) * 0.1], [a, 0, 0])
    }
    const wgeo = wb.build()
    const wmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.1 })
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const w = new THREE.Mesh(wgeo, wmat)
        w.position.set(sx * 0.66, 0.3, sz * 1.1)
        w.castShadow = true
        this.root.add(w)
        this.wheels.push(w)
      }
    }

    // grain inside the container
    const gm = new THREE.MeshStandardMaterial({
      map: grainTex,
      bumpMap: grainTex,
      bumpScale: 0.7,
      roughness: 0.88,
      metalness: 0,
    })
    this.grainSlab = new THREE.Mesh(box(bw - 0.09, 1, bd - 0.09), gm)
    this.grainSlab.position.set(0, BIN.y, BIN.z)
    this.grainSlab.scale.y = 0.001
    this.grainSlab.receiveShadow = true
    this.root.add(this.grainSlab)
    this.grainHeap = new THREE.Mesh(cyl(0.02, 1, 1, 18), gm)
    this.grainHeap.position.set(0, BIN.y, BIN.z)
    this.grainHeap.visible = false
    this.root.add(this.grainHeap)

    this.buildFarmer()
    this.root.add(this.farmer)
  }

  private buildFarmer() {
    const b = new MeshBuilder()
    const boot = new THREE.Color(0x2f3a3f)
    const trou = new THREE.Color(0x4a5b6b)
    const shirt = new THREE.Color(0xbfae86)
    const skin = new THREE.Color(0xc79a72)
    const cap = new THREE.Color(0x6b7f4a)
    for (const sx of [-1, 1]) {
      put(b, cyl(0.07, 0.08, 0.34, 6), boot, [sx * 0.09, 0.17, 0])
      put(b, cyl(0.075, 0.07, 0.42, 6), trou, [sx * 0.09, 0.55, 0])
    }
    put(b, box(0.34, 0.42, 0.2), shirt, [0, 0.97, 0])
    put(b, box(0.36, 0.07, 0.22), new THREE.Color(0x8a7a52), [0, 0.77, 0])
    put(b, cyl(0.055, 0.055, 0.34, 6), shirt, [-0.22, 0.98, 0], [0, 0, 0.12])
    put(b, cyl(0.06, 0.06, 0.12, 6), skin, [0, 1.24, 0])
    put(b, new THREE.SphereGeometry(0.105, 10, 8), skin, [0, 1.36, 0])
    put(b, cyl(0.11, 0.115, 0.09, 10), cap, [0, 1.43, 0])
    put(b, box(0.2, 0.02, 0.13), cap, [0, 1.4, 0.11])
    // towel round the neck, the way everyone works a paddy in the sun
    put(b, box(0.3, 0.05, 0.14), new THREE.Color(0xe7e2d2), [0, 1.2, 0.02])

    const mesh = new THREE.Mesh(
      b.build(),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }),
    )
    mesh.castShadow = true
    this.farmer.add(mesh)

    // the waving arm is its own group so it can beckon the combine over
    const ab = new MeshBuilder()
    put(ab, cyl(0.055, 0.05, 0.36, 6), shirt, [0, -0.18, 0])
    put(ab, new THREE.SphereGeometry(0.055, 8, 6), skin, [0, -0.37, 0])
    const arm = new THREE.Mesh(
      ab.build(),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }),
    )
    arm.castShadow = true
    this.farmerArm.position.set(0.22, 1.16, 0)
    this.farmerArm.add(arm)
    this.farmer.add(this.farmerArm)
    this.farmer.position.set(1.5, 0, -0.4)
    this.farmer.rotation.y = -Math.PI / 2
  }

  place(x: number, z: number, heading: number) {
    this.x = this.targetX = x
    this.z = this.targetZ = z
    this.heading = this.targetHeading = heading
    this.mode = 'idle'
    this.apply()
  }

  driveTo(x: number, z: number, heading: number) {
    this.targetX = x
    this.targetZ = z
    this.targetHeading = heading
    this.mode = 'drive'
    this.parkT = 0
  }

  get arrived() {
    return this.mode === 'idle' || (this.mode === 'park' && this.parkT >= 1)
  }

  /** Close enough that the auger can start swinging out to meet it. */
  get nearlyThere() {
    if (this.mode !== 'drive') return true
    return Math.hypot(this.targetX - this.x, this.targetZ - this.z) < 2.6
  }

  /** container mouth in world space, where the grain should land */
  binTop(out: THREE.Vector3): THREE.Vector3 {
    out.set(0, BIN.y + 0.1 + this.fill * (BIN.h - 0.18), BIN.z)
    return this.root.localToWorld(out)
  }

  addGrain(f: number) {
    this.fill = clamp(this.fill + f, 0, 1)
  }

  update(dt: number, now: number, beckon: boolean) {
    if (this.mode === 'drive') {
      const dx = this.targetX - this.x
      const dz = this.targetZ - this.z
      const dist = Math.hypot(dx, dz)
      if (dist < 0.55) {
        this.mode = 'park'
      } else {
        const want = Math.atan2(dx, dz)
        const turn = angleDelta(this.heading, want)
        this.heading += clamp(turn, -1.7 * dt, 1.7 * dt)
        this.speed = damp(this.speed, Math.min(6, dist * 1.6 + 1), 3.4, dt)
        this.x += Math.sin(this.heading) * this.speed * dt
        this.z += Math.cos(this.heading) * this.speed * dt
      }
    } else if (this.mode === 'park') {
      // settle exactly into the parking pose so the auger always lines up
      this.parkT = clamp(this.parkT + dt * 1.6, 0, 1)
      const t = this.parkT * this.parkT * (3 - 2 * this.parkT)
      this.x = lerp(this.x, this.targetX, t * 0.35 + dt * 2)
      this.z = lerp(this.z, this.targetZ, t * 0.35 + dt * 2)
      this.heading += angleDelta(this.heading, this.targetHeading) * Math.min(1, dt * 4)
      this.speed = damp(this.speed, 0, 6, dt)
      if (this.parkT >= 1) {
        this.x = this.targetX
        this.z = this.targetZ
        this.heading = this.targetHeading
      }
    } else {
      this.speed = damp(this.speed, 0, 6, dt)
    }

    for (const w of this.wheels) w.rotation.x -= (this.speed / 0.3) * dt

    const f = clamp(this.fill, 0, 1)
    const h = (BIN.h - 0.14) * f
    this.grainSlab.visible = f > 0.004
    this.grainSlab.scale.y = Math.max(0.001, h)
    this.grainSlab.position.y = BIN.y + 0.03 + h / 2
    this.grainHeap.visible = f > 0.004
    this.grainHeap.position.y = BIN.y + 0.025 + h
    this.grainHeap.scale.set(
      (BIN.w - 0.09) * 0.5 * (0.3 + 0.7 * f),
      0.1 + 0.26 * f,
      (BIN.d - 0.09) * 0.5 * (0.3 + 0.7 * f),
    )

    this.farmerArm.rotation.z = beckon ? -1.9 + Math.sin(now * 7) * 0.55 : -0.05
    this.apply()
  }

  private apply() {
    this.root.position.set(this.x, terrainY(this.x, this.z), this.z)
    this.root.rotation.y = this.heading
  }
}
