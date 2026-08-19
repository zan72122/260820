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

  private intake!: THREE.InstancedMesh
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

  /**
   * Marks a material as part of the outer skin.  It has to be flagged
   * transparent up front: three compiles an `OPAQUE` define into the shader
   * when `transparent` is false, which clamps alpha to 1 no matter what we
   * set later, and flipping the flag at runtime would force a recompile
   * mid-shot.
   */
  private markShell(mat: THREE.Material) {
    mat.transparent = true
    mat.depthWrite = true
    mat.opacity = 1
    mat.userData.baseOpacity = mat.opacity
    this.shellMats.push(mat)
    return mat
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
    // chamfered shoulders so the housing is not a plain brick
    for (const sx of [-1, 1]) {
      put(shell, box(0.34, 0.34, 3.0), P, [sx * 0.86, 1.79, -0.28], [0, 0, (sx * Math.PI) / 4])
      // hinged service panels with latches, one each side
      put(shell, box(0.03, 0.62, 1.15), PD, [sx * 0.95, 1.42, -0.55])
      for (const dz of [-1.05, -0.05]) {
        put(shell, box(0.05, 0.1, 0.06), COLORS.steel, [sx * 0.98, 1.42, -0.55 + dz * 0.5])
      }
    }
    // lower front fairing over the feeder throat
    put(shell, box(1.86, 0.42, 0.22), PD, [0, 0.86, 1.2], [-0.5, 0, 0])
    // mud flaps behind the crawlers
    for (const sx of [-1, 1]) put(hard, box(0.5, 0.34, 0.03), 0x24282b, [sx * 0.76, 0.36, -1.62])
    // rear lamp bar
    put(hard, box(1.2, 0.09, 0.07), COLORS.chassisDark, [0, 1.02, -2.16])
    for (const sx of [-1, 1]) put(hard, box(0.16, 0.11, 0.06), 0xc2331f, [sx * 0.46, 1.02, -2.19])
    // tool box on the flank
    put(shell, box(0.42, 0.26, 0.5), PD, [-1.02, 1.3, 0.55])
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
    this.addMesh(shell, this.markShell(this.mkPaint()), this.root)

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
    put(frame, box(w - 0.05, 0.06, d - 0.05), 0x4a4032, [cx, y0 + 0.02, cz])
    // grab rail across the top
    for (let i = 0; i < 5; i++) put(frame, box(0.035, 0.035, d), S, [cx - 0.6 + i * 0.3, y1 + 0.02, cz])
    // cradle the stowed unloading auger rests in
    put(frame, cyl(0.05, 0.05, 0.42, 8), S, [-0.86, y1 + 0.2, cz + 0.72])
    put(frame, box(0.34, 0.06, 0.1), COLORS.chassisDark, [-0.9, y1 + 0.4, cz + 0.72], [0, 0, 0.35])
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

    // A cone on top of the slab: from directly above, a growing heap is the
    // only thing that reads as "the tank is filling up".
    const heap = new THREE.Mesh(cyl(0.02, 1, 1, 18), grainMat)
    heap.position.set(cx, y0, cz)
    heap.visible = false
    heap.receiveShadow = true
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
    glassMat.userData.baseOpacity = glassMat.opacity
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
    this.addMesh(fh, this.markShell(this.mkPaint()), this.root)

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

    // wads of cut crop sweeping across the pan and into the throat: the
    // "the machine is eating it" beat, visible from outside the machine
    const wb = new MeshBuilder()
    const wadA = new THREE.Color(0xcdb257)
    const wadB = new THREE.Color(0xa8a659)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI + 0.4
      put(
        wb,
        box(0.05, 0.05, 0.34),
        i % 2 ? wadA : wadB,
        [Math.cos(a) * 0.05, Math.sin(a) * 0.03, 0],
        [0, 0.3 + i * 0.12, 0],
      )
    }
    const im = new THREE.InstancedMesh(
      wb.build(),
      new THREE.MeshLambertMaterial({ vertexColors: true }),
      10,
    )
    im.frustumCulled = false
    im.castShadow = false
    im.count = 0
    this.intake = im
    this.headerPivot.add(im)

    // a thin sliver that flickers with the knife stroke
    const kb = new MeshBuilder()
    put(kb, box(hw * 1.9, 0.02, 0.03), 0xdfe6ea, [0, 0, 0])
    this.knife.position.set(0, -0.19, 0.9)
    this.addMesh(kb, this.mkPaint(), this.knife, false)
    this.headerPivot.add(this.knife)
  }

  /* -------------------------- unloading auger ------------------------- */

  private buildUnloadingAuger() {
    this.augerYaw.position.set(-0.1, 2.78, -1.46)
    this.root.add(this.augerYaw)
    this.augerYaw.add(this.augerPitch)

    const b = new MeshBuilder()
    const L = 2.85
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

  /**
   * The insides, laid out so the journey reads left to right in a side
   * view: throat -> threshing cylinder -> the split, grain down through
   * the sieve and up the elevator into the tank, straw back over the
   * walkers and out of the hood.  Everything fits inside the housing
   * (x +-0.88, y 0.76..1.86, z -1.7..1.15).
   */
  private buildInterior() {
    this.interior.visible = false
    // a little emissive so the innards stay legible inside a shadowed body
    const steel = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.55,
      metalness: 0.45,
      emissive: 0x3a4046,
      emissiveIntensity: 0.8,
    })

    const DRUM = new THREE.Vector3(0, 1.38, 0.52)

    // --- feeder chain slats climbing the throat ---------------------
    const slat = new MeshBuilder()
    put(slat, box(0.92, 0.05, 0.08), 0x99a1a7, [0, 0, 0])
    for (const sx of [-1, 1]) put(slat, box(0.07, 0.07, 0.07), 0x5f676d, [sx * 0.48, 0, 0])
    const slatGeo = slat.build()
    for (let i = 0; i < 8; i++) this.feedSlats.add(new THREE.Mesh(slatGeo, steel))
    this.interior.add(this.feedSlats)

    // --- threshing cylinder ----------------------------------------
    const db = new MeshBuilder()
    put(db, cyl(0.3, 0.3, 1.42, 14), 0x99a1a7, [0, 0, 0], [0, 0, Math.PI / 2])
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      put(db, box(1.44, 0.06, 0.07), 0xc2c9cd, [0, Math.cos(a) * 0.3, Math.sin(a) * 0.3], [-a, 0, 0])
      for (let j = 0; j < 10; j++) {
        put(db, box(0.035, 0.05, 0.05), 0xe0e5e8, [-0.63 + j * 0.14, Math.cos(a) * 0.34, Math.sin(a) * 0.34], [-a, 0, 0])
      }
    }
    this.addMesh(db, steel, this.drum, false)
    this.drum.position.copy(DRUM)
    this.interior.add(this.drum)

    const st = new MeshBuilder()
    // concave grate wrapping the underside of the cylinder
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * (-0.06 + (i / 12) * 0.62)
      put(
        st,
        box(1.42, 0.03, 0.04),
        0x9aa2a8,
        [0, DRUM.y - Math.cos(a) * 0.4, DRUM.z + Math.sin(a) * 0.4],
        [-a, 0, 0],
      )
    }
    // beater behind the cylinder, then the stepped straw walkers
    put(st, cyl(0.16, 0.16, 1.3, 10), 0x7f878d, [0, 1.32, -0.22], [0, 0, Math.PI / 2])
    for (let i = 0; i < 6; i++) {
      put(st, box(1.4, 0.035, 0.28), 0xa9a583, [0, 1.3 - i * 0.05, -0.5 - i * 0.2])
      put(st, box(1.4, 0.09, 0.03), 0xc3bd96, [0, 1.35 - i * 0.05, -0.62 - i * 0.2])
    }
    // everything on the grain's road is warm; everything on the straw's is pale
    put(st, box(1.34, 0.03, 1.0), 0xc79733, [0, 1.03, 0.3], [0.15, 0, 0])
    put(st, box(0.2, 1.3, 0.24), 0x9c7d3c, [-0.72, 1.38, -0.06], [-0.3, 0, 0])
    this.addMesh(st, steel, this.interior, false)

    // --- cleaning fan ----------------------------------------------
    const fb = new MeshBuilder()
    put(fb, cyl(0.08, 0.08, 0.7, 10), 0x8d949a, [0, 0, 0], [0, 0, Math.PI / 2])
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      put(fb, box(0.66, 0.2, 0.03), 0xc3cace, [0, Math.cos(a) * 0.12, Math.sin(a) * 0.12], [-a, 0, 0])
    }
    this.addMesh(fb, steel, this.fan, false)
    this.fan.position.set(0, 0.94, 0.88)
    this.interior.add(this.fan)

    // --- oscillating cleaning shoe ---------------------------------
    const sb = new MeshBuilder()
    put(sb, box(1.14, 0.025, 0.95), 0x8e9599, [0, 0, 0], [0.09, 0, 0])
    for (let i = 0; i < 9; i++) put(sb, box(1.12, 0.045, 0.025), 0xb9a35e, [0, 0.03, -0.42 + i * 0.105])
    put(sb, box(1.08, 0.025, 0.85), 0x6f767b, [0, -0.11, 0.03], [0.09, 0, 0])
    this.addMesh(sb, steel, this.sieve, false)
    this.sieve.position.set(0, 0.83, 0.02)
    this.interior.add(this.sieve)

    const eb = new MeshBuilder()
    put(eb, box(0.16, 0.03, 0.09), 0xc9d0d4, [0, 0, 0])
    const eGeo = eb.build()
    for (let i = 0; i < 7; i++) this.elevatorFlights.add(new THREE.Mesh(eGeo, steel))
    this.interior.add(this.elevatorFlights)

    // --- what is actually moving through ---------------------------
    const bits = new MeshBuilder()
    put(bits, box(0.095, 0.062, 0.095), 0xffffff, [0, 0, 0])
    const bm = new THREE.InstancedMesh(bits.build(), new THREE.MeshLambertMaterial({ vertexColors: true }), 110)
    bm.frustumCulled = false
    bm.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    bm.setColorAt(0, new THREE.Color(1, 1, 1))
    this.flowBits = bm
    this.flowSeed = new Float32Array(110)
    for (let i = 0; i < 110; i++) this.flowSeed[i] = i / 110
    this.interior.add(bm)
  }

  /* ------------------------------ runtime ----------------------------- */

  setCutaway(v: number) {
    this.cutawayAmount = v
    this.interior.visible = v > 0.01
    for (const m of this.shellMats) {
      const mm = m as THREE.MeshStandardMaterial
      const base = (mm.userData.baseOpacity as number) ?? 1
      mm.opacity = lerp(base, base * 0.2, v)
      mm.depthWrite = v < 0.05
    }
  }

  worldSpout(out: THREE.Vector3): THREE.Vector3 {
    return this.spoutAnchor.getWorldPosition(out)
  }

  /** Top of the exhaust stack, in world space. */
  worldStack(out: THREE.Vector3): THREE.Vector3 {
    out.set(0.9, 3.28, -0.72)
    return this.root.localToWorld(out)
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

    // wads slide in from the full width of the pan and disappear up the throat
    const feeding = this.headerDown > 0.6 && this.speedFrac > 0.15
    this.intake.count = feeding ? 10 : 0
    if (feeding) {
      for (let i = 0; i < 10; i++) {
        const t = (now * 1.05 + i * 0.1) % 1
        const lane = ((i * 0.37) % 1) - 0.5
        this.tmpV.set(
          lane * 2.1 * (1 - t) ,
          -0.16 + t * 0.34 + Math.sin(t * Math.PI) * 0.06,
          0.78 - t * 0.86,
        )
        this.tmpQ.setFromEuler(this.tmpE.set(0, lane * 1.1 * (1 - t) + t * 0.4, t * 0.5))
        this.tmpM.compose(this.tmpV, this.tmpQ, this.tmpS.setScalar(0.75 + t * 0.6))
        this.intake.setMatrixAt(i, this.tmpM)
      }
      this.tmpS.setScalar(1)
      this.intake.instanceMatrix.needsUpdate = true
    }

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
    // Stowed, the tube lies forward over the tank on its cradle — where a
    // real one rests.  Extended, it points out along local ±X.  Both ends
    // are signed so the swing never sweeps across the header.
    const side = this.augerSide
    this.augerYaw.rotation.y = lerp(side * 0.52, side * (Math.PI / 2 - 0.08), swing)
    this.augerPitch.rotation.x = lerp(0.12, -0.2, lift)

    // grain level in the tank
    const f = clamp(this.tankFill, 0, 1)
    const h = 0.5 * f
    const show = f > 0.015
    this.tankGrain.visible = show
    this.tankGrain.scale.y = Math.max(0.001, h)
    this.tankGrain.position.y = 1.95 + h / 2
    this.tankHeap.visible = show
    this.tankHeap.position.y = 1.945 + h
    this.tankHeap.scale.set(0.5 * (0.3 + 0.7 * f), 0.12 + 0.24 * f, 0.58 * (0.3 + 0.7 * f))

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
    this.sieve.position.z = 0.02 + Math.sin(now * 11) * 0.045
    this.sieve.position.y = 0.83 + Math.cos(now * 11) * 0.01

    const slats = this.feedSlats.children
    for (let i = 0; i < slats.length; i++) {
      const t = (now * 0.6 + i / slats.length) % 1
      slats[i].position.set(0, lerp(0.72, 1.3, t), lerp(2.05, 1.12, t))
      slats[i].rotation.x = -0.55
    }
    const flights = this.elevatorFlights.children
    for (let i = 0; i < flights.length; i++) {
      const t = (now * 0.75 + i / flights.length) % 1
      flights[i].position.set(-0.72, lerp(0.8, 1.96, t), lerp(-0.42, 0.24, t))
      flights[i].rotation.x = -0.3
    }

    const c = new THREE.Color()
    const grain = new THREE.Color(0xe8c063)
    const straw = new THREE.Color(0xdccb96)
    const stalk = new THREE.Color(0xbdae5c)
    for (let i = 0; i < this.flowSeed.length; i++) {
      const t = (now * 0.4 + this.flowSeed[i] * 5.3) % 1
      const w = (this.flowSeed[i] * 37) % 1
      const j = (((this.flowSeed[i] * 91) % 1) - 0.5) * 1.3
      let x = 0
      let y = 0
      let z = 0
      let sc = 1
      if (t < 0.26) {
        // whole stalks climbing the throat
        const k = t / 0.26
        x = j * 0.6
        y = lerp(0.72, 1.28, k)
        z = lerp(2.1, 1.1, k)
        c.copy(stalk)
        sc = 1.5
      } else if (t < 0.46) {
        // beaten around the cylinder
        const k = (t - 0.26) / 0.2
        const a = 0.4 + k * 3.4
        x = j * 0.55
        y = 1.38 - Math.cos(a) * 0.36
        z = lerp(1.02, 0.1, k) + Math.sin(a) * 0.08
        c.copy(stalk).lerp(grain, k)
        sc = lerp(1.4, 0.9, k)
      } else if (w < 0.5) {
        // grain: down onto the pan, across the sieve, up the elevator
        const k = (t - 0.46) / 0.54
        if (k < 0.3) {
          x = j * 0.55
          y = lerp(1.1, 0.94, k / 0.3)
          z = lerp(0.45, 0.2, k / 0.3)
        } else if (k < 0.58) {
          const q = (k - 0.3) / 0.28
          x = lerp(j * 0.55, -0.72, q)
          y = lerp(0.94, 0.82, q)
          z = lerp(0.2, -0.4, q)
        } else {
          const q = (k - 0.58) / 0.42
          x = -0.72
          y = lerp(0.82, 1.98, q)
          z = lerp(-0.42, 0.24, q)
        }
        c.copy(grain)
        sc = 0.75
      } else {
        // straw: over the walkers, out of the hood
        const k = (t - 0.46) / 0.54
        x = j * 0.6
        y = lerp(1.24, 0.94, k)
        z = lerp(-0.2, -2.2, k)
        c.copy(straw)
        sc = lerp(1.3, 1.7, k)
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
