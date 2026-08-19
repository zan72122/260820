import * as THREE from 'three'
import { MeshBuilder, put } from './geom'
import { COLORS, COMBINE } from './config'
import { clamp, lerp, smoothstep } from './rng'

/* ------------------------------------------------------------------ *
 * The machine.  Local frame: origin on the ground between the tracks,
 * +Z is forward, +X is the machine's right, +Y up.
 * ------------------------------------------------------------------ */

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
const cyl = (rt: number, rb: number, h: number, s = 12, open = false) =>
  new THREE.CylinderGeometry(rt, rb, h, s, 1, open)

/* ---- rubber crawler loop -------------------------------------------- */
const TRK_R = 0.28
const TRK_C = 1.16
const TRK_STRAIGHT = TRK_C * 2
const TRK_ARC = Math.PI * TRK_R
const TRK_PERIM = 2 * TRK_STRAIGHT + 2 * TRK_ARC

function trackPose(s: number): { y: number; z: number; ang: number } {
  let t = ((s % TRK_PERIM) + TRK_PERIM) % TRK_PERIM
  if (t < TRK_STRAIGHT) return { z: -TRK_C + t, y: 0, ang: 0 }
  t -= TRK_STRAIGHT
  if (t < TRK_ARC) {
    const a = (t / TRK_ARC) * Math.PI
    return { z: TRK_C + TRK_R * Math.sin(a), y: TRK_R - TRK_R * Math.cos(a), ang: a }
  }
  t -= TRK_ARC
  if (t < TRK_STRAIGHT) return { z: TRK_C - t, y: 2 * TRK_R, ang: Math.PI }
  t -= TRK_STRAIGHT
  const a = (t / TRK_ARC) * Math.PI
  return { z: -TRK_C - TRK_R * Math.sin(a), y: 2 * TRK_R - (TRK_R - TRK_R * Math.cos(a)), ang: Math.PI + a }
}

export interface CombineParts {
  root: THREE.Group
}

export class Combine {
  readonly root = new THREE.Group()

  /** header pivots about X at the front of the feeder house */
  readonly headerPivot = new THREE.Group()
  private reel = new THREE.Group()
  private headerAuger = new THREE.Group()
  private knife = new THREE.Group()

  /** unloading auger */
  readonly augerYaw = new THREE.Group()
  readonly augerPitch = new THREE.Group()
  private spoutAnchor = new THREE.Object3D()

  /** internals, only shown during the cut-away */
  readonly interior = new THREE.Group()
  private drum = new THREE.Group()
  private fan = new THREE.Group()
  private sieve = new THREE.Group()
  private feedSlats = new THREE.Group()
  private elevatorFlights = new THREE.Group()
  private flowBits!: THREE.InstancedMesh
  private flowSeed: Float32Array

  private treads!: THREE.InstancedMesh
  private treadCount = 0
  private trackPhase = 0

  private tankGrain!: THREE.Mesh
  private tankHeap!: THREE.Mesh

  private shellMats: THREE.Material[] = []
  private cutawayAmount = 0

  private beacon!: THREE.Mesh
  private exhaustPuffT = 0

  /** 0 = fully raised, 1 = cutting height */
  headerDown = 0
  /** 0 = stowed alongside, 1 = swung out over the trailer */
  augerOut = 0
  augerSide: 1 | -1 = -1
  tankFill = 0
  running = 1
  speedFrac = 0

  private tmpV = new THREE.Vector3()
  private tmpM = new THREE.Matrix4()
  private tmpQ = new THREE.Quaternion()
  private tmpE = new THREE.Euler()
  private tmpS = new THREE.Vector3(1, 1, 1)

  constructor(private paintRough: THREE.Texture, private grainTex: THREE.Texture) {
    this.flowSeed = new Float32Array(0)
    this.build()
  }

  /* ---------------------------------------------------------------- */

  private mkPaint(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.52,
      metalness: 0.34,
      roughnessMap: this.paintRough,
    })
  }
  private mkDark(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.08,
    })
  }

  private addMesh(b: MeshBuilder, mat: THREE.Material, parent: THREE.Object3D, shadow = true) {
    if (b.idx.length === 0) return null
    const m = new THREE.Mesh(b.build(), mat)
    m.castShadow = shadow
    m.receiveShadow = true
    parent.add(m)
    return m
  }

  private build() {
    this.buildChassisAndTracks()
    this.buildBody()
    this.buildTank()
    this.buildCab()
    this.buildFeederAndHeader()
    this.buildUnloadingAuger()
    this.buildInterior()
    this.root.add(this.headerPivot, this.interior)
  }

  /* ------------------------------ tracks ----------------------------- */

  private buildChassisAndTracks() {
    const b = new MeshBuilder()
    const dark = COLORS.chassisDark
    const steel = COLORS.steelDark

    // main frame rails + cross members
    put(b, box(1.9, 0.17, 3.1), COLORS.chassis, [0, 0.62, -0.12])
    put(b, box(2.02, 0.1, 0.5), COLORS.chassis, [0, 0.55, 1.15])

    for (const sx of [-1, 1]) {
      const x = sx * 0.76
      // track frame beam
      put(b, box(0.16, 0.2, 2.5), steel, [x, 0.4, -0.05])
      // drive sprocket at the rear, idler at the front, road wheels between
      put(b, cyl(0.3, 0.3, 0.2, 16), dark, [x, 0.28, -TRK_C], [0, 0, Math.PI / 2])
      put(b, cyl(0.26, 0.26, 0.2, 16), dark, [x, 0.28, TRK_C], [0, 0, Math.PI / 2])
      for (const z of [-0.62, 0, 0.62]) {
        put(b, cyl(0.16, 0.16, 0.17, 10), steel, [x, 0.17, z], [0, 0, Math.PI / 2])
      }
      // sprocket teeth
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2
        put(
          b,
          box(0.16, 0.09, 0.08),
          COLORS.steelDark,
          [x, 0.28 + Math.cos(a) * 0.3, -TRK_C + Math.sin(a) * 0.3],
          [a, 0, 0],
        )
      }
      // the rubber belt itself: two runs plus the wrapped ends
      put(b, box(0.44, 0.055, TRK_STRAIGHT), COLORS.rubber, [x, 0.028, 0])
      put(b, box(0.44, 0.055, TRK_STRAIGHT), COLORS.rubber, [x, 2 * TRK_R - 0.028, 0])
      for (const [cz, r] of [
        [TRK_C, TRK_R],
        [-TRK_C, TRK_R],
      ]) {
        put(b, cyl(r, r, 0.44, 18, true), COLORS.rubber, [x, r, cz], [0, 0, Math.PI / 2])
      }
    }
    this.addMesh(b, this.mkDark(), this.root)

    // moulded lugs, marching around the loop
    const per = 22
    this.treadCount = per * 2
    const tb = new MeshBuilder()
    put(tb, box(0.5, 0.05, 0.13), 0x2a2d30, [0, 0.025, 0])
    put(tb, box(0.2, 0.045, 0.1), 0x35383b, [0, 0.06, 0])
    const tm = new THREE.InstancedMesh(tb.build(), this.mkDark(), this.treadCount)
    tm.castShadow = true
    tm.receiveShadow = true
    tm.frustumCulled = false
    this.treads = tm
    this.root.add(tm)
  }

  /* ------------------------------- body ------------------------------ */

  private buildBody() {
    const shell = new MeshBuilder()
    const hard = new MeshBuilder()
    const P = COLORS.paint
    const PD = COLORS.paintDark

    // separator housing — the big painted box the crop travels through
    put(shell, box(1.88, 1.2, 3.0), P, [0, 1.32, -0.28])
    // shoulder panel and belt-line moulding
    put(hard, box(1.94, 0.09, 3.02), PD, [0, 1.86, -0.28])
    put(hard, box(1.95, 0.07, 3.04), 0xf0e4cc, [0, 1.05, -0.28])
    // rear straw hood, sloping down and back
    put(shell, box(1.7, 0.9, 0.7), P, [0, 1.35, -1.95], [0.35, 0, 0])
    put(hard, box(1.55, 0.06, 0.62), PD, [0, 0.95, -2.12], [0.5, 0, 0])
    // chopper mouth
    put(hard, box(1.5, 0.34, 0.12), COLORS.chassisDark, [0, 0.82, -2.02])
    for (let i = 0; i < 7; i++) {
      put(hard, box(0.04, 0.3, 0.1), COLORS.steelDark, [-0.6 + i * 0.2, 0.82, -2.05])
    }

    // engine compartment, right rear, with a louvred grille
    put(shell, box(0.9, 0.62, 1.05), PD, [0.62, 2.1, -1.15])
    for (let i = 0; i < 6; i++) {
      put(hard, box(0.02, 0.055, 1.0), COLORS.steelDark, [1.075, 1.88 + i * 0.1, -1.15])
    }
    // exhaust stack
    put(hard, cyl(0.055, 0.065, 0.9, 10), COLORS.steelDark, [0.9, 2.75, -0.72])
    put(hard, cyl(0.075, 0.075, 0.08, 10), 0x2a2a2a, [0.9, 3.2, -0.72])

    // side steps + hand rail
    put(hard, box(0.06, 0.5, 0.06), COLORS.steel, [1.0, 1.55, 0.42])
    put(hard, box(0.06, 0.06, 0.9), COLORS.steel, [1.0, 1.8, 0.42])
    for (let i = 0; i < 3; i++) {
      put(hard, box(0.34, 0.04, 0.14), COLORS.steelDark, [1.02, 0.72 + i * 0.3, 0.55])
    }

    // head lamps and a beacon
    for (const sx of [-1, 1]) {
      put(hard, cyl(0.09, 0.09, 0.06, 10), 0xf7efd0, [sx * 0.7, 1.72, 1.24], [Math.PI / 2, 0, 0])
    }
    this.addMesh(hard, this.mkPaint(), this.root)
    const shellMesh = this.addMesh(shell, this.mkPaint(), this.root)
    if (shellMesh) this.shellMats.push(shellMesh.material as THREE.Material)

    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xffa424,
      emissive: 0xff7a00,
      emissiveIntensity: 0.6,
      roughness: 0.4,
    })
    this.beacon = new THREE.Mesh(cyl(0.075, 0.09, 0.13, 10), beaconMat)
    this.beacon.position.set(0.5, 2.78, 0.32)
    this.root.add(this.beacon)
  }

  /* ------------------------------- tank ------------------------------ */

  private buildTank() {
    const frame = new MeshBuilder()
    const P = COLORS.paint
    const S = COLORS.steel
    const y0 = 1.9
    const y1 = 2.62
    const cx = -0.1
    const w = 1.62
    const d = 1.9
    const cz = -0.42

    // corner posts + rails: the tank reads as a framed box with sight panels
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        put(frame, box(0.08, y1 - y0, 0.08), P, [cx + sx * w * 0.5, (y0 + y1) / 2, cz + sz * d * 0.5])
      }
      put(frame, box(0.07, 0.07, d), P, [cx + sx * w * 0.5, y0, cz])
      put(frame, box(0.07, 0.07, d), P, [cx + sx * w * 0.5, y1, cz])
    }
    put(frame, box(w, 0.07, 0.07), P, [cx, y0, cz - d * 0.5])
    put(frame, box(w, 0.07, 0.07), P, [cx, y0, cz + d * 0.5])
    put(frame, box(w, 0.07, 0.07), P, [cx, y1, cz - d * 0.5])
    put(frame, box(w, 0.07, 0.07), P, [cx, y1, cz + d * 0.5])
    // floor pan sloping to the unloading auger
    put(frame, box(w - 0.05, 0.06, d - 0.05), COLORS.steelDark, [cx, y0 + 0.02, cz])
    // grab rail across the top
    for (let i = 0; i < 5; i++) put(frame, box(0.035, 0.035, d), S, [cx - 0.6 + i * 0.3, y1 + 0.02, cz])
    this.addMesh(frame, this.mkPaint(), this.root)

    // sight panels
    const glass = new THREE.MeshStandardMaterial({
      color: 0xd7e6ea,
      roughness: 0.12,
      metalness: 0,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const panels = new THREE.Group()
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(d - 0.12, y1 - y0 - 0.1), glass)
      p.position.set(cx + sx * w * 0.5, (y0 + y1) / 2, cz)
      p.rotation.y = (sx * Math.PI) / 2
      panels.add(p)
    }
    for (const sz of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.12, y1 - y0 - 0.1), glass)
      p.position.set(cx, (y0 + y1) / 2, cz + sz * d * 0.5)
      panels.add(p)
    }
    this.root.add(panels)

    // the grain itself: a slab that grows plus a heaped crown
    const grainMat = new THREE.MeshStandardMaterial({
      map: this.grainTex,
      bumpMap: this.grainTex,
      bumpScale: 0.6,
      roughness: 0.85,
      metalness: 0,
      color: 0xffffff,
    })
    this.grainTex.repeat.set(2.4, 2.4)
    const slab = new THREE.Mesh(box(w - 0.1, 1, d - 0.1), grainMat)
    slab.position.set(cx, y0 + 0.05, cz)
    slab.scale.y = 0.001
    slab.castShadow = false
    slab.receiveShadow = true
    this.tankGrain = slab
    this.root.add(slab)

    const heap = new THREE.Mesh(cyl(0.02, (w - 0.1) * 0.62, 0.3, 16), grainMat)
    heap.position.set(cx, y0, cz)
    heap.visible = false
    this.tankHeap = heap
    this.root.add(heap)
  }

  /* -------------------------------- cab ------------------------------ */

  private buildCab() {
    const b = new MeshBuilder()
    const cx = 0.52
    const cy = 2.28
    const cz = 0.72
    const w = 0.92
    const h = 0.86
    const d = 1.0
    // pillars
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        put(b, box(0.07, h, 0.07), COLORS.paint, [cx + sx * w * 0.5, cy, cz + sz * d * 0.5])
    put(b, box(w + 0.14, 0.1, d + 0.14), COLORS.paint, [cx, cy + h / 2 + 0.04, cz])
    put(b, box(w, 0.06, d), COLORS.chassisDark, [cx, cy - h / 2, cz])
    // seat + column
    put(b, box(0.38, 0.1, 0.36), 0x2c2f33, [cx, cy - h / 2 + 0.28, cz - 0.16])
    put(b, box(0.38, 0.44, 0.09), 0x2c2f33, [cx, cy - h / 2 + 0.5, cz - 0.34])
    put(b, cyl(0.035, 0.035, 0.34, 8), COLORS.steelDark, [cx, cy - h / 2 + 0.36, cz + 0.28], [0.5, 0, 0])
    put(b, cyl(0.13, 0.13, 0.025, 14), 0x1e2124, [cx, cy - h / 2 + 0.5, cz + 0.36], [0.5, 0, 0])
    // mirror
    put(b, box(0.03, 0.03, 0.3), COLORS.steelDark, [cx + w * 0.5 + 0.16, cy + 0.34, cz + 0.4], [0, 0.5, 0])
    put(b, box(0.05, 0.2, 0.14), 0x22262a, [cx + w * 0.5 + 0.3, cy + 0.34, cz + 0.5])
    this.addMesh(b, this.mkPaint(), this.root)

    const glassMat = new THREE.MeshStandardMaterial({
      color: COLORS.glass,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const g = new THREE.Group()
    const front = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.06), glassMat)
    front.position.set(cx, cy, cz + d * 0.5)
    g.add(front)
    for (const sx of [-1, 1]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(d - 0.06, h - 0.06), glassMat)
      s.position.set(cx + sx * w * 0.5, cy, cz)
      s.rotation.y = (sx * Math.PI) / 2
      g.add(s)
    }
    this.root.add(g)
    this.shellMats.push(glassMat)
  }

  /* -------------------- feeder house + cutting header ----------------- */

  private buildFeederAndHeader() {
    // feeder house: a sloped throat from the header up into the body
    const fh = new MeshBuilder()
    const len = 1.15
    put(fh, box(1.18, 0.66, len), COLORS.paint, [0, 0.95, 1.72], [-0.42, 0, 0])
    put(fh, box(1.24, 0.06, len * 0.9), COLORS.paintDark, [0, 1.28, 1.68], [-0.42, 0, 0])
    // lift rams
    for (const sx of [-1, 1]) {
      put(fh, cyl(0.05, 0.05, 0.62, 8), COLORS.steelDark, [sx * 0.66, 0.86, 1.52], [-0.95, 0, 0])
      put(fh, cyl(0.032, 0.032, 0.5, 8), COLORS.steel, [sx * 0.66, 0.72, 1.83], [-0.95, 0, 0])
    }
    const fm = this.addMesh(fh, this.mkPaint(), this.root)
    if (fm) this.shellMats.push(fm.material as THREE.Material)

    // ---- header, hung off a pivot so it can be raised and lowered ----
    this.headerPivot.position.set(0, 0.66, 2.16)
    const hw = COMBINE.headerWidth / 2

    const hb = new MeshBuilder()
    // back wall + floor pan
    put(hb, box(hw * 2, 0.5, 0.09), COLORS.paint, [0, 0.12, -0.02])
    put(hb, box(hw * 2, 0.05, 0.86), COLORS.paintDark, [0, -0.17, 0.44], [-0.08, 0, 0])
    // side walls
    for (const sx of [-1, 1]) put(hb, box(0.07, 0.5, 0.92), COLORS.paint, [sx * hw, 0.08, 0.42])
    // crop dividers: long pointed snouts that part the standing rice
    for (const sx of [-1, 1]) {
      put(hb, cyl(0.005, 0.09, 0.62, 8), COLORS.paint, [sx * hw, 0.04, 1.02], [Math.PI / 2, 0, 0])
      put(hb, box(0.05, 0.16, 0.5), COLORS.paint, [sx * hw, 0.16, 0.86])
    }
    // cutter bar with triangular knife sections
    put(hb, box(hw * 2, 0.06, 0.1), COLORS.steelDark, [0, -0.22, 0.86])
    const n = 20
    for (let i = 0; i < n; i++) {
      const x = -hw + 0.06 + (i / (n - 1)) * (hw * 2 - 0.12)
      put(hb, cyl(0.002, 0.055, 0.13, 3), COLORS.steel, [x, -0.2, 0.95], [Math.PI / 2, 0, Math.PI / 2])
    }
    // stubble guards under the bar
    for (let i = 0; i < 10; i++) {
      const x = -hw + 0.12 + (i / 9) * (hw * 2 - 0.24)
      put(hb, box(0.05, 0.03, 0.2), COLORS.steelDark, [x, -0.25, 0.94])
    }
    this.addMesh(hb, this.mkPaint(), this.headerPivot)

    // header auger: draws the cut crop to the centre
    const ab = new MeshBuilder()
    put(ab, cyl(0.19, 0.19, hw * 1.85, 14), COLORS.steelDark, [0, 0, 0], [0, 0, Math.PI / 2])
    for (const sgn of [-1, 1]) {
      for (let i = 0; i < 26; i++) {
        const t = i / 25
        const a = sgn * t * Math.PI * 3.4
        const x = sgn * (0.06 + t * (hw * 0.9))
        put(
          ab,
          box(0.055, 0.13, 0.06),
          COLORS.steel,
          [x, Math.cos(a) * 0.25, Math.sin(a) * 0.25],
          [-a, 0, 0],
        )
      }
    }
    // retracting fingers at the centre feed the throat
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      put(ab, cyl(0.014, 0.014, 0.26, 6), COLORS.steel, [-0.02 + i * 0.05, Math.cos(a) * 0.28, Math.sin(a) * 0.28], [a, 0, 0])
    }
    this.headerAuger.position.set(0, 0.06, 0.42)
    this.addMesh(ab, this.mkPaint(), this.headerAuger)
    this.headerPivot.add(this.headerAuger)

    // pick-up reel with tine bars
    const rb = new MeshBuilder()
    put(rb, cyl(0.05, 0.05, hw * 1.9, 8), COLORS.steelDark, [0, 0, 0], [0, 0, Math.PI / 2])
    for (const sx of [-1, 1]) {
      put(rb, cyl(0.34, 0.34, 0.04, 6, true), COLORS.paint, [sx * hw * 0.92, 0, 0], [0, 0, Math.PI / 2])
      put(rb, cyl(0.34, 0.34, 0.04, 6, true), COLORS.paint, [sx * hw * 0.3, 0, 0], [0, 0, Math.PI / 2])
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const y = Math.cos(a) * 0.34
      const z = Math.sin(a) * 0.34
      put(rb, box(hw * 1.85, 0.05, 0.05), COLORS.steelDark, [0, y, z])
      for (let j = 0; j < 11; j++) {
        const x = -hw * 0.9 + (j / 10) * hw * 1.8
        put(rb, cyl(0.008, 0.012, 0.19, 5), 0xe8e2d2, [x, y - 0.09, z], [0, 0, 0])
      }
    }
    this.reel.position.set(0, 0.52, 0.6)
    this.addMesh(rb, this.mkPaint(), this.reel)
    this.headerPivot.add(this.reel)

    // a thin sliver that flickers with the knife stroke
    const kb = new MeshBuilder()
    put(kb, box(hw * 1.9, 0.02, 0.03), 0xdfe6ea, [0, 0, 0])
    this.knife.position.set(0, -0.19, 0.9)
    this.addMesh(kb, this.mkPaint(), this.knife, false)
    this.headerPivot.add(this.knife)
  }

  /* -------------------------- unloading auger ------------------------- */

  private buildUnloadingAuger() {
    this.augerYaw.position.set(-0.12, 2.52, -1.28)
    this.root.add(this.augerYaw)
    this.augerYaw.add(this.augerPitch)

    const b = new MeshBuilder()
    const L = 3.05
    // pivot knuckle
    put(b, cyl(0.17, 0.17, 0.26, 12), COLORS.paintDark, [0, 0, 0])
    // tube runs out along +Z of the pitch group
    put(b, cyl(0.145, 0.145, L, 14), COLORS.paint, [0, 0, L / 2], [Math.PI / 2, 0, 0])
    // banding + a rest hoop
    for (let i = 1; i < 5; i++) {
      put(b, cyl(0.158, 0.158, 0.05, 14), COLORS.paintDark, [0, 0, (i / 5) * L], [Math.PI / 2, 0, 0])
    }
    // spout elbow, angled down
    put(b, cyl(0.16, 0.19, 0.42, 12), COLORS.paintDark, [0, -0.16, L + 0.02], [0.5, 0, 0])
    put(b, cyl(0.2, 0.22, 0.14, 12), COLORS.chassisDark, [0, -0.36, L + 0.11])
    // deflector flap
    put(b, box(0.34, 0.02, 0.2), COLORS.steelDark, [0, -0.42, L + 0.24], [0.4, 0, 0])
    this.addMesh(b, this.mkPaint(), this.augerPitch)

    this.spoutAnchor.position.set(0, -0.44, L + 0.1)
    this.augerPitch.add(this.spoutAnchor)
  }

  /* ------------------------------ interior ---------------------------- */

  private buildInterior() {
    this.interior.visible = false
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.45 })

    // feeder chain slats climbing the throat
    const slat = new MeshBuilder()
    put(slat, box(0.95, 0.05, 0.09), 0x8d949a, [0, 0, 0])
    put(slat, box(0.06, 0.06, 0.06), 0x60686e, [-0.5, 0, 0])
    put(slat, box(0.06, 0.06, 0.06), 0x60686e, [0.5, 0, 0])
    const slatGeo = slat.build()
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(slatGeo, mat)
      this.feedSlats.add(m)
    }
    this.interior.add(this.feedSlats)

    // threshing cylinder with rasp bars
    const db = new MeshBuilder()
    put(db, cyl(0.3, 0.3, 1.25, 14), 0x7d858b, [0, 0, 0], [0, 0, Math.PI / 2])
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      put(db, box(1.3, 0.07, 0.07), 0xb9c0c4, [0, Math.cos(a) * 0.32, Math.sin(a) * 0.32], [-a, 0, 0])
      for (let j = 0; j < 9; j++) {
        put(db, box(0.03, 0.045, 0.05), 0xd7dde0, [-0.55 + j * 0.14, Math.cos(a) * 0.36, Math.sin(a) * 0.36], [-a, 0, 0])
      }
    }
    this.addMesh(db, mat, this.drum, false)
    this.drum.position.set(0, 1.34, 0.62)
    this.interior.add(this.drum)

    // concave grate under the cylinder + upper cover
    const st = new MeshBuilder()
    for (let i = 0; i < 13; i++) {
      const a = Math.PI * (0.12 + (i / 12) * 0.76)
      put(st, box(1.3, 0.03, 0.035), 0x9aa2a8, [0, 1.34 - Math.sin(a) * 0.42, 0.62 - Math.cos(a) * 0.42], [a, 0, 0])
    }
    for (let i = 0; i < 8; i++) {
      put(st, box(0.03, 0.03, 0.86), 0x9aa2a8, [-0.6 + i * 0.17, 1.0, 0.62], [0.0, 0, 0])
    }
    // straw walker deck sloping to the rear
    put(st, box(1.4, 0.04, 1.5), 0x6f767c, [0, 1.16, -0.62], [0.16, 0, 0])
    for (let i = 0; i < 7; i++) put(st, box(1.35, 0.09, 0.04), 0x878e94, [0, 1.28 - i * 0.03, -0.1 - i * 0.2])
    // clean-grain elevator casing
    put(st, box(0.26, 1.5, 0.3), 0x5f666c, [-0.66, 1.35, -0.05], [-0.32, 0, 0])
    this.addMesh(st, mat, this.interior, false)

    // cleaning fan
    const fb = new MeshBuilder()
    put(fb, cyl(0.1, 0.1, 0.8, 10), 0x8d949a, [0, 0, 0], [0, 0, Math.PI / 2])
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      put(fb, box(0.76, 0.24, 0.03), 0xc3cace, [0, Math.cos(a) * 0.14, Math.sin(a) * 0.14], [-a, 0, 0])
    }
    this.addMesh(fb, mat, this.fan, false)
    this.fan.position.set(0, 0.86, 0.9)
    this.interior.add(this.fan)

    // oscillating cleaning shoe
    const sb = new MeshBuilder()
    put(sb, box(1.3, 0.03, 1.3), 0x9aa2a8, [0, 0, 0], [0.1, 0, 0])
    for (let i = 0; i < 11; i++) put(sb, box(1.28, 0.05, 0.03), 0xb4bbbf, [0, 0.03, -0.6 + i * 0.12])
    put(sb, box(1.24, 0.03, 1.15), 0x8b9298, [0, -0.16, 0.04], [0.1, 0, 0])
    this.addMesh(sb, mat, this.sieve, false)
    this.sieve.position.set(0, 0.78, 0.15)
    this.interior.add(this.sieve)

    // elevator flights carrying clean grain up to the tank
    const eb = new MeshBuilder()
    put(eb, box(0.18, 0.03, 0.1), 0xc9d0d4, [0, 0, 0])
    const eGeo = eb.build()
    for (let i = 0; i < 7; i++) this.elevatorFlights.add(new THREE.Mesh(eGeo, mat))
    this.interior.add(this.elevatorFlights)

    // material flowing through: stalk, then grain and straw going separate ways
    const bits = new MeshBuilder()
    put(bits, box(0.055, 0.035, 0.055), 0xffffff, [0, 0, 0])
    const bm = new THREE.InstancedMesh(bits.build(), new THREE.MeshLambertMaterial({ vertexColors: true }), 96)
    bm.frustumCulled = false
    bm.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    bm.setColorAt(0, new THREE.Color(1, 1, 1))
    this.flowBits = bm
    this.flowSeed = new Float32Array(96)
    for (let i = 0; i < 96; i++) this.flowSeed[i] = i / 96 + Math.random() * 0.01
    this.interior.add(bm)
  }

  /* ------------------------------ runtime ----------------------------- */

  setCutaway(v: number) {
    this.cutawayAmount = v
    const show = v > 0.01
    this.interior.visible = show
    for (const m of this.shellMats) {
      const mm = m as THREE.MeshStandardMaterial
      const target = lerp(mm.userData.baseOpacity ?? 1, 0.13, v)
      if (mm.userData.baseOpacity === undefined) mm.userData.baseOpacity = mm.opacity
      mm.opacity = lerp(mm.userData.baseOpacity, 0.13, v)
      mm.transparent = target < 0.999
      mm.depthWrite = target > 0.9
      mm.needsUpdate = false
    }
  }

  worldSpout(out: THREE.Vector3): THREE.Vector3 {
    return this.spoutAnchor.getWorldPosition(out)
  }

  worldIntake(out: THREE.Vector3): THREE.Vector3 {
    out.set(0, 0.55, 0.55)
    return this.headerPivot.localToWorld(out)
  }

  update(dt: number, now: number) {
    // header height: pivots down until the cutter bar skims the mud
    this.headerPivot.rotation.x = lerp(0.34, -0.02, this.headerDown)

    const spin = this.running * (0.35 + this.speedFrac * 0.65)
    this.reel.rotation.x -= dt * 4.2 * spin
    this.headerAuger.rotation.x += dt * 7.5 * spin
    this.knife.position.x = Math.sin(now * 62) * 0.018 * this.running
    this.knife.visible = this.headerDown > 0.5

    // crawler belts
    this.trackPhase += dt * this.speedFrac * COMBINE.speed
    const perSide = this.treadCount / 2
    let idx = 0
    for (const sx of [-1, 1]) {
      for (let i = 0; i < perSide; i++) {
        const s = this.trackPhase + (i / perSide) * TRK_PERIM
        const p = trackPose(s)
        this.tmpE.set(Math.PI - p.ang, 0, 0)
        this.tmpQ.setFromEuler(this.tmpE)
        this.tmpV.set(sx * 0.76, p.y, p.z)
        this.tmpM.compose(this.tmpV, this.tmpQ, this.tmpS)
        this.treads.setMatrixAt(idx++, this.tmpM)
      }
    }
    this.treads.instanceMatrix.needsUpdate = true

    // unloading auger: swings out to the chosen side, then lifts a little
    const swing = smoothstep(0, 0.75, this.augerOut)
    const lift = smoothstep(0.45, 1, this.augerOut)
    this.augerYaw.rotation.y = lerp(Math.PI, Math.PI / 2 - this.augerSide * (Math.PI / 2 - 0.12), swing)
    this.augerPitch.rotation.x = lerp(-0.06, -0.3, lift)

    // grain level in the tank
    const f = clamp(this.tankFill, 0, 1)
    const h = 0.6 * f
    this.tankGrain.scale.y = Math.max(0.001, h)
    this.tankGrain.position.y = 1.95 + h / 2
    this.tankHeap.visible = f > 0.55
    this.tankHeap.position.y = 1.95 + h
    this.tankHeap.scale.setScalar(clamp((f - 0.5) * 2, 0.01, 1))

    this.beacon.rotation.y += dt * 6
    const bm = this.beacon.material as THREE.MeshStandardMaterial
    bm.emissiveIntensity = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(now * 7))

    if (this.cutawayAmount > 0.01) this.updateInterior(dt, now)
    this.exhaustPuffT += dt
  }

  private updateInterior(dt: number, now: number) {
    const spin = 0.4 + this.speedFrac * 0.6
    this.drum.rotation.x -= dt * 9 * spin
    this.fan.rotation.x += dt * 14 * spin
    this.sieve.position.z = 0.15 + Math.sin(now * 11) * 0.05
    this.sieve.position.y = 0.78 + Math.cos(now * 11) * 0.012

    // feeder slats climb the throat and loop back
    const slats = this.feedSlats.children
    for (let i = 0; i < slats.length; i++) {
      const t = ((now * 0.55 + i / slats.length) % 1)
      const s = slats[i]
      s.position.set(0, lerp(0.62, 1.16, t), lerp(2.05, 1.16, t))
      s.rotation.x = -0.42
    }
    const flights = this.elevatorFlights.children
    for (let i = 0; i < flights.length; i++) {
      const t = (now * 0.7 + i / flights.length) % 1
      const f = flights[i]
      f.position.set(-0.66, lerp(0.62, 2.0, t), lerp(0.35, -0.5, t))
      f.rotation.x = -0.32
    }

    // stalk in, grain down, straw out the back
    const c = new THREE.Color()
    const grain = new THREE.Color(0xe4bd63)
    const straw = new THREE.Color(0xdccb96)
    const stalk = new THREE.Color(0xc4b45e)
    for (let i = 0; i < this.flowSeed.length; i++) {
      const t = (now * 0.42 + this.flowSeed[i] * 4.7) % 1
      const w = (this.flowSeed[i] * 37) % 1
      const j = ((this.flowSeed[i] * 91) % 1) - 0.5
      let x = 0
      let y = 0
      let z = 0
      let sc = 1
      if (t < 0.3) {
        // up the feeder throat, still whole stalks
        const k = t / 0.3
        x = j * 0.85
        y = lerp(0.6, 1.2, k)
        z = lerp(2.1, 1.1, k)
        c.copy(stalk)
        sc = 1.35
      } else if (t < 0.5) {
        // through the threshing cylinder
        const k = (t - 0.3) / 0.2
        const a = k * 4.2
        x = j * 1.1
        y = 1.34 - Math.cos(a) * 0.42
        z = lerp(1.1, 0.2, k) - Math.sin(a) * 0.1
        c.copy(stalk).lerp(grain, k)
        sc = lerp(1.3, 0.85, k)
      } else if (w < 0.45) {
        // separated grain: down through the sieve, up the elevator, into the tank
        const k = (t - 0.5) / 0.5
        if (k < 0.35) {
          x = j * 1.15
          y = lerp(1.1, 0.78, k / 0.35)
          z = lerp(0.3, 0.1, k / 0.35)
        } else if (k < 0.6) {
          const q = (k - 0.35) / 0.25
          x = lerp(j * 1.15, -0.66, q)
          y = lerp(0.78, 0.62, q)
          z = lerp(0.1, 0.35, q)
        } else {
          const q = (k - 0.6) / 0.4
          x = -0.66
          y = lerp(0.62, 2.05, q)
          z = lerp(0.35, -0.5, q)
        }
        c.copy(grain)
        sc = 0.7
      } else {
        // straw: over the walkers and out of the hood
        const k = (t - 0.5) / 0.5
        x = j * 1.2
        y = lerp(1.28, 0.92, k)
        z = lerp(0.1, -2.1, k)
        c.copy(straw)
        sc = lerp(1.2, 1.5, k)
      }
      this.tmpV.set(x, y, z)
      this.tmpQ.setFromEuler(this.tmpE.set(now * 3 + i, now * 2.2 + i, 0))
      this.tmpM.compose(this.tmpV, this.tmpQ, this.tmpS.setScalar(sc))
      this.flowBits.setMatrixAt(i, this.tmpM)
      this.flowBits.setColorAt(i, c)
      this.tmpS.setScalar(1)
    }
    this.flowBits.instanceMatrix.needsUpdate = true
    if (this.flowBits.instanceColor) this.flowBits.instanceColor.needsUpdate = true
  }
}
