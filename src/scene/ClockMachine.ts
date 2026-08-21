import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import type { LightingState } from '../core/Lighting'
import { clamp, damp, lerp, TAU } from '../util/math'
import { makeGlowTexture } from '../util/textures'
import {
  Batch,
  makeGearGeometry,
  makeHandGeometry,
  makeIndexRingGeometry,
  makeRatchetGeometry,
} from './geom'
import { materials } from './materials'

/** Degrees of wheel rotation per ratchet tooth. 30 teeth => 12 deg => 2 minutes on the dial. */
export const TOOTH_ANGLE = TAU / 30

interface Delayed {
  at: number
  fn: () => void
}

/**
 * "Hill Park Kinetic Clock" — a public kinetic-art play installation that borrows
 * the swing next to it as its pendulum.
 *
 * The causal chain is built as real hardware, in this order:
 *   swing passes the low point
 *     -> non-contact sensor on a separate mast sees it (no moving part near the child)
 *     -> a push-rod inside a covered ground conduit rocks the drive lever
 *     -> the pawl drops one tooth on the one-way ratchet wheel
 *     -> the gear train carries it up the column
 *     -> the index ring and the minute hand step forward
 *
 * Nothing a child can reach moves: the whole train sits behind toughened glass
 * inside a bolted-down cabinet, and a guard rail keeps the standing distance.
 */
export class ClockMachine {
  readonly group = new Group()

  /** Mechanism angle in radians, driven by the ratchet. */
  private mechTarget = 0
  private mechCurrent = 0
  private mechVel = 0
  /** The display end of the train lags very slightly behind the ratchet. */
  private handCurrent = 0
  private handVel = 0

  private sensorPulse = 0
  private rodPulse = 0
  private leverPulse = 0
  private pawlPulse = 0

  private queue: Delayed[] = []
  private elapsed = 0

  // parts
  private escapeWheel!: Object3D
  private idlerGear!: Object3D
  private centreWheel!: Object3D
  private indexRing!: Object3D
  private minuteHand!: Object3D
  private hourHand!: Object3D
  private lever!: Object3D
  private pawl!: Object3D
  private linkRod!: Object3D
  private sensorLens!: Mesh
  private sensorLensMat!: MeshStandardMaterial
  private sensorFlash!: Mesh
  private dialFace!: MeshStandardMaterial
  private dialLight!: PointLight
  private dialGlow!: Mesh
  private glassSheen!: MeshStandardMaterial
  private mechLight!: PointLight

  private dialLit = 0
  private tmpColor = new Color()

  /** World position of the sensor head, so the swing can be aimed at it. */
  readonly sensorWorld = new Vector3()
  /** Dial centre in the machine's local frame. */
  private dialLocal = new Vector3()
  private head!: Group

  constructor(sensorLocal: Vector3, sensorAimLocal: Vector3, conduitVia: Vector3[] = []) {
    const M = materials()
    this.buildFoundation(M)
    this.buildFrame(M)
    this.buildMovementBox(M)
    this.buildColumn(M)
    this.buildDial(M)
    this.buildGuardRail(M)
    this.buildSensorPost(M, sensorLocal, sensorAimLocal)
    this.buildConduit(M, [sensorLocal, ...conduitVia, new Vector3(-0.75, 0.06, 0.1)])
  }

  // ---------------------------------------------------------------- geometry

  private buildFoundation(M: ReturnType<typeof materials>): void {
    const plinth = new Mesh(new BoxGeometry(2.15, 0.34, 1.5), M.concrete)
    plinth.position.y = 0.17
    plinth.castShadow = plinth.receiveShadow = true
    this.group.add(plinth)

    const kerb = new Mesh(new BoxGeometry(2.45, 0.1, 1.8), M.concrete)
    kerb.position.y = 0.05
    kerb.receiveShadow = true
    this.group.add(kerb)

    // anchor bolts: the thing is bolted to the ground, not floating
    const boltGeo = new CylinderGeometry(0.032, 0.032, 0.09, 6)
    const nutGeo = new CylinderGeometry(0.05, 0.05, 0.035, 6)
    const bolts = new Batch()
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        bolts.add(boltGeo, { x: sx * 0.82, y: 0.375, z: sz * 0.5 })
        bolts.add(nutGeo, { x: sx * 0.82, y: 0.35, z: sz * 0.5 })
      }
    }
    this.group.add(bolts.build(M.steelGalv))
  }

  private buildFrame(M: ReturnType<typeof materials>): void {
    // two splayed steel legs carrying the cabinet and the column
    const legGeo = new BoxGeometry(0.13, 2.3, 0.13)
    for (const sx of [-1, 1]) {
      const leg = new Mesh(legGeo, M.steelPaint)
      leg.position.set(sx * 0.62, 1.28, 0)
      leg.rotation.z = sx * 0.11
      leg.castShadow = true
      this.group.add(leg)
      const foot = new Mesh(new BoxGeometry(0.3, 0.06, 0.3), M.steelDark)
      foot.position.set(sx * 0.75, 0.36, 0)
      this.group.add(foot)
    }
    const brace = new Mesh(new BoxGeometry(1.3, 0.08, 0.09), M.steelPaint)
    brace.position.set(0, 0.78, 0)
    this.group.add(brace)
    const brace2 = new Mesh(new BoxGeometry(1.42, 0.08, 0.09), M.steelPaint)
    brace2.position.set(0, 2.28, 0)
    this.group.add(brace2)
  }

  private buildMovementBox(M: ReturnType<typeof materials>): void {
    const box = new Group()
    box.position.set(0, 1.56, 0)
    this.group.add(box)

    const W = 1.42
    const H = 1.16
    const D = 0.56

    // brass case: sides, top, bottom, back. Front is glass only.
    const caseParts: [number, number, number, number, number, number][] = [
      [W, 0.07, D, 0, H / 2, 0],
      [W, 0.07, D, 0, -H / 2, 0],
      [0.07, H, D, -W / 2, 0, 0],
      [0.07, H, D, W / 2, 0, 0],
    ]
    const back = new Mesh(new BoxGeometry(W, H, 0.05), M.brassFitting)
    back.position.set(0, 0, -D / 2 + 0.02)
    box.add(back)

    // --- the movement itself, all of it inside the case ---
    const mech = new Group()
    mech.position.set(0, -0.02, 0.04)
    box.add(mech)

    // back plate the train is mounted on
    const plate = new Mesh(new BoxGeometry(W - 0.2, H - 0.2, 0.03), M.brassFitting)
    plate.position.set(0, 0, -0.16)
    mech.add(plate)

    // one-way ratchet / escape wheel, lower left
    const ratchet = new Mesh(makeRatchetGeometry(0.3, 30, 0.035), M.brassInner)
    ratchet.position.set(-0.34, -0.2, 0)
    ratchet.castShadow = true
    this.escapeWheel = ratchet
    mech.add(ratchet)
    mech.add(this.axle(-0.34, -0.2, M))

    // idler pinion
    const idler = new Mesh(makeGearGeometry(0.2, 20, 0.032, { bore: 0.035, spokes: 4 }), M.brassInner)
    idler.position.set(0.0, -0.02, 0)
    idler.castShadow = true
    this.idlerGear = idler
    mech.add(idler)
    mech.add(this.axle(0.0, -0.02, M))

    // centre wheel — sits on the shaft that climbs the column to the dial
    const centre = new Mesh(makeGearGeometry(0.3, 30, 0.034, { bore: 0.04, spokes: 5 }), M.brassInner)
    centre.position.set(0.36, 0.26, 0)
    centre.castShadow = true
    this.centreWheel = centre
    mech.add(centre)
    mech.add(this.axle(0.36, 0.26, M))

    // drive lever: rocked by the push-rod entering from the left through a boot
    const lever = new Group()
    lever.position.set(-0.56, -0.3, 0.05)
    mech.add(lever)
    const leverArm = new Mesh(new BoxGeometry(0.44, 0.045, 0.028), M.brassInner)
    leverArm.position.set(0.2, 0, 0)
    lever.add(leverArm)
    const leverPivot = new Mesh(new CylinderGeometry(0.035, 0.035, 0.05, 10), M.brassFitting)
    leverPivot.rotation.x = Math.PI / 2
    lever.add(leverPivot)
    this.lever = lever

    // pawl carried on the lever, dropping into the ratchet teeth
    const pawl = new Group()
    pawl.position.set(0.4, 0.02, 0.03)
    lever.add(pawl)
    const pawlArm = new Mesh(new BoxGeometry(0.2, 0.03, 0.022), M.brassInner)
    pawlArm.position.set(0.09, 0, 0)
    pawl.add(pawlArm)
    const pawlTip = new Mesh(new BoxGeometry(0.04, 0.055, 0.024), M.brassFitting)
    pawlTip.position.set(0.185, -0.012, 0)
    pawl.add(pawlTip)
    this.pawl = pawl

    // detent spring holding the wheel between steps (this is what stops back-drive)
    const detent = new Mesh(new BoxGeometry(0.17, 0.016, 0.02), M.steelGalv)
    detent.position.set(-0.34, 0.09, 0.03)
    detent.rotation.z = -0.5
    mech.add(detent)

    // push-rod arriving from the conduit through a rubber boot
    const boot = new Mesh(new CylinderGeometry(0.05, 0.06, 0.09, 10), M.rubber)
    boot.rotation.z = Math.PI / 2
    boot.position.set(-W / 2, -0.32, 0.05)
    box.add(boot)
    const rod = new Mesh(new CylinderGeometry(0.021, 0.021, 0.42, 8), M.steelGalv)
    rod.rotation.z = Math.PI / 2
    rod.position.set(-W / 2 - 0.14, -0.32, 0.05)
    box.add(rod)
    this.linkRod = rod

    // Daylight and dial-spill reaching inside the case. Without it the movement
    // is a black hole behind the glass and the causal chain becomes invisible.
    this.mechLight = new PointLight(new Color('#cfd8e6'), 0, 2.6, 2)
    this.mechLight.position.set(0, 0.1, 0.34)
    box.add(this.mechLight)

    // --- protective glazing: this is what keeps fingers out ---
    const glass = new Mesh(new PlaneGeometry(W - 0.1, H - 0.1), M.glass)
    glass.position.set(0, 0, D / 2 + 0.005)
    glass.renderOrder = 6
    box.add(glass)
    // a second, very faint pane gives the glass a visible surface at grazing angles
    this.glassSheen = new MeshStandardMaterial({
      color: new Color('#cfe0ee'),
      transparent: true,
      opacity: 0.05,
      roughness: 0.08,
      metalness: 0,
      depthWrite: false,
      side: DoubleSide,
    })
    const sheen = new Mesh(new PlaneGeometry(W - 0.1, H - 0.1), this.glassSheen)
    sheen.position.set(0, 0, D / 2 + 0.012)
    sheen.renderOrder = 7
    box.add(sheen)

    // glazing bead holding the pane in
    const beads = new Batch()
    const beadGeo = [
      new BoxGeometry(W - 0.05, 0.035, 0.05),
      new BoxGeometry(W - 0.05, 0.035, 0.05),
      new BoxGeometry(0.035, H - 0.05, 0.05),
      new BoxGeometry(0.035, H - 0.05, 0.05),
    ]
    const beadPos: [number, number][] = [
      [0, (H - 0.1) / 2],
      [0, -(H - 0.1) / 2],
      [-(W - 0.1) / 2, 0],
      [(W - 0.1) / 2, 0],
    ]
    beadGeo.forEach((g, i) => beads.add(g, { x: beadPos[i][0], y: beadPos[i][1], z: D / 2 + 0.01 }))
    // the case shell shares one material, so it can share one draw call too
    for (const [w, h, d, x, y, z] of caseParts) beads.add(new BoxGeometry(w, h, d), { x, y, z })
    beads.add(new BoxGeometry(W + 0.16, 0.05, D + 0.2), { x: 0, y: H / 2 + 0.08, z: 0.03 }, { x: -0.09, y: 0, z: 0 })
    box.add(beads.build(M.brassOuter, { cast: true }))

    // --- maintenance access: hinged door with an escutcheon, on the service side ---
    const door = new Mesh(new BoxGeometry(0.05, H - 0.24, D - 0.16), M.steelPaint)
    door.position.set(-W / 2 - 0.03, -0.02, 0)
    box.add(door)
    for (const sz of [-1, 1]) {
      const hinge = new Mesh(new CylinderGeometry(0.022, 0.022, 0.1, 8), M.steelDark)
      hinge.position.set(-W / 2 - 0.05, sz * 0.34, -(D - 0.16) / 2 + 0.02)
      box.add(hinge)
    }
    const lock = new Mesh(new CylinderGeometry(0.035, 0.035, 0.03, 10), M.steelGalv)
    lock.rotation.z = Math.PI / 2
    lock.position.set(-W / 2 - 0.06, -0.02, (D - 0.16) / 2 - 0.06)
    box.add(lock)
    // small blank service plate, the sort every municipal cabinet carries
    const plateM = new Mesh(new BoxGeometry(0.02, 0.14, 0.2), M.steelGalv)
    plateM.position.set(-W / 2 - 0.05, 0.34, 0)
    box.add(plateM)
  }

  private axle(x: number, y: number, M: ReturnType<typeof materials>): Mesh {
    const a = new Mesh(new CylinderGeometry(0.022, 0.022, 0.2, 8), M.steelGalv)
    a.rotation.x = Math.PI / 2
    a.position.set(x, y, -0.06)
    return a
  }

  private buildColumn(M: ReturnType<typeof materials>): void {
    // guarded shaft sleeve carrying the drive up to the dial
    const sleeve = new Mesh(new CylinderGeometry(0.085, 0.1, 1.1, 12), M.brassOuter)
    sleeve.position.set(0.36, 2.66, 0)
    sleeve.castShadow = true
    this.group.add(sleeve)
    for (const y of [2.2, 3.14]) {
      const collar = new Mesh(new TorusGeometry(0.1, 0.022, 6, 16), M.brassFitting)
      collar.position.set(0.36, y, 0)
      collar.rotation.x = Math.PI / 2
      this.group.add(collar)
    }
    // stay wires from the head back to the frame
    for (const sx of [-1, 1]) {
      const stay = new Mesh(new CylinderGeometry(0.012, 0.012, 1.25, 5), M.steelGalv)
      stay.position.set(0.36 + sx * 0.34, 2.72, 0)
      stay.rotation.z = sx * 0.28
      this.group.add(stay)
    }
  }

  private buildDial(M: ReturnType<typeof materials>): void {
    const head = new Group()
    head.position.set(0.36, 3.62, 0)
    this.group.add(head)
    this.head = head
    this.dialLocal.copy(head.position)

    const R = 1.06

    // case drum
    const drum = new Mesh(new CylinderGeometry(R, R, 0.3, 40, 1, true), M.brassOuter)
    drum.rotation.x = Math.PI / 2
    drum.castShadow = true
    head.add(drum)
    const back = new Mesh(new CylinderGeometry(R, R * 0.98, 0.05, 40), M.brassFitting)
    back.rotation.x = Math.PI / 2
    back.position.z = -0.14
    head.add(back)

    // enamel face
    this.dialFace = M.enamel.clone()
    const face = new Mesh(new CylinderGeometry(R * 0.94, R * 0.94, 0.02, 40), this.dialFace)
    face.rotation.x = Math.PI / 2
    face.position.z = -0.05
    head.add(face)

    // minute marks (60) and hour marks (12), engraved brass on enamel
    const minuteGeo = new BoxGeometry(0.016, 0.055, 0.012)
    const hourGeo = new BoxGeometry(0.036, 0.13, 0.016)
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU
      const isHour = i % 5 === 0
      const m = new Mesh(isHour ? hourGeo : minuteGeo, M.blued)
      const r = R * (isHour ? 0.78 : 0.815)
      m.position.set(Math.sin(a) * r, Math.cos(a) * r, -0.035)
      m.rotation.z = -a
      head.add(m)
    }

    // the outer index ring: this is the part that visibly steps one notch per swing
    const ring = new Mesh(makeIndexRingGeometry(R * 0.93, R * 0.86, 30, 0.026), M.brassInner)
    ring.position.z = -0.024
    head.add(ring)
    this.indexRing = ring
    // a fixed fiducial the ring steps past, so a single notch of movement is legible
    const fiducial = new Mesh(new BoxGeometry(0.055, 0.11, 0.022), M.blued)
    fiducial.position.set(0, R * 0.9, 0.005)
    head.add(fiducial)

    // hands
    const minute = new Mesh(makeHandGeometry(R * 0.76, 0.032, 0.018), M.blued)
    minute.position.z = -0.005
    head.add(minute)
    this.minuteHand = minute
    const hour = new Mesh(makeHandGeometry(R * 0.52, 0.048, 0.018), M.blued)
    hour.position.z = -0.024
    head.add(hour)
    this.hourHand = hour
    const boss = new Mesh(new CylinderGeometry(0.055, 0.055, 0.06, 12), M.brassInner)
    boss.rotation.x = Math.PI / 2
    boss.position.z = 0.005
    head.add(boss)

    // bezel + toughened crystal
    const bezel = new Mesh(new TorusGeometry(R * 0.955, 0.045, 8, 44), M.brassOuter)
    bezel.position.z = 0.12
    head.add(bezel)
    const crystal = new Mesh(new CylinderGeometry(R * 0.94, R * 0.94, 0.012, 40), M.glass)
    crystal.rotation.x = Math.PI / 2
    crystal.position.z = 0.11
    crystal.renderOrder = 6
    head.add(crystal)

    // internal dial illumination, dark until the clock's own lamp is switched on
    // Placed well clear of the face: the dial is lit from *within* (emissive), and
    // this light exists only to spill onto the column, the rail and the ground.
    this.dialLight = new PointLight(new Color('#ffdca8'), 0, 9, 2)
    this.dialLight.position.set(0, -0.6, 1.5)
    head.add(this.dialLight)

    this.dialGlow = new Mesh(
      new PlaneGeometry(3.6, 3.6),
      new MeshBasicMaterial({
        map: makeGlowTexture(128, 2.6),
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        opacity: 0,
        color: new Color('#ffd9a0'),
      }),
    )
    this.dialGlow.position.z = 0.24
    this.dialGlow.renderOrder = 8
    head.add(this.dialGlow)

  }

  /** World position of the dial centre, for framing and for the dial's own lamp. */
  dialWorldPosition(out = new Vector3()): Vector3 {
    this.group.updateWorldMatrix(true, false)
    return this.head.getWorldPosition(out)
  }

  private buildGuardRail(M: ReturnType<typeof materials>): void {
    // a low rail keeping the standing distance from the cabinet
    const postGeo = new CylinderGeometry(0.038, 0.038, 0.78, 8)
    const baseGeo = new CylinderGeometry(0.07, 0.08, 0.06, 8)
    const steel = new Batch()
    const foot = new Batch()
    const R = 1.55
    const from = -1.15
    const to = 1.15
    const N = 5
    const pts: Vector3[] = []
    for (let i = 0; i < N; i++) {
      const a = lerp(from, to, i / (N - 1))
      const p = new Vector3(Math.sin(a) * R, 0, Math.cos(a) * R)
      pts.push(p)
      steel.add(postGeo, { x: p.x, y: 0.39, z: p.z })
      foot.add(baseGeo, { x: p.x, y: 0.03, z: p.z })
    }
    for (let i = 0; i < N - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      for (const y of [0.72, 0.42]) {
        const len = a.distanceTo(b)
        const mid = a.clone().add(b).multiplyScalar(0.5).setY(y)
        steel.add(new CylinderGeometry(0.022, 0.022, len, 6), mid, {
          x: 0,
          y: -Math.atan2(b.z - a.z, b.x - a.x),
          z: Math.PI / 2,
        })
      }
    }
    this.group.add(steel.build(M.steelPaint, { cast: true }))
    this.group.add(foot.build(M.concrete))
  }

  private buildSensorPost(
    M: ReturnType<typeof materials>,
    local: Vector3,
    aim: Vector3,
  ): void {
    const post = new Group()
    post.position.copy(local)
    this.group.add(post)

    const mast = new Mesh(new CylinderGeometry(0.045, 0.055, 1.16, 10), M.steelGalv)
    mast.position.y = 0.58
    mast.castShadow = true
    post.add(mast)
    const foot = new Mesh(new CylinderGeometry(0.13, 0.15, 0.1, 10), M.concrete)
    foot.position.y = 0.05
    post.add(foot)

    const headG = new Group()
    headG.position.set(0, 1.12, 0)
    // The head is turned to face the swing: the lens looks at the seat, and only
    // at the seat. Nothing about the link is mechanical contact.
    headG.rotation.y = Math.atan2(aim.x - local.x, aim.z - local.z)
    headG.rotation.x = 0.16
    post.add(headG)
    const housing = new Mesh(new BoxGeometry(0.18, 0.13, 0.12), M.steelPaint)
    housing.castShadow = true
    headG.add(housing)
    // downward-tilted hood over the lens so rain and low sun stay out of it
    const hood = new Mesh(new BoxGeometry(0.2, 0.02, 0.1), M.steelPaint)
    hood.position.set(0, 0.075, 0.03)
    hood.rotation.x = 0.22
    headG.add(hood)

    this.sensorLensMat = new MeshStandardMaterial({
      color: new Color('#101418'),
      metalness: 0.2,
      roughness: 0.15,
      emissive: new Color('#7fd8ff'),
      emissiveIntensity: 0,
    })
    this.sensorLens = new Mesh(new SphereGeometry(0.042, 12, 10), this.sensorLensMat)
    this.sensorLens.position.set(0, 0, 0.065)
    this.sensorLens.scale.z = 0.55
    headG.add(this.sensorLens)

    this.sensorFlash = new Mesh(
      new PlaneGeometry(0.5, 0.5),
      new MeshBasicMaterial({
        map: makeGlowTexture(64, 2.8),
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        opacity: 0,
        color: new Color('#8fe0ff'),
      }),
    )
    this.sensorFlash.position.set(0, 0, 0.1)
    headG.add(this.sensorFlash)

    post.getWorldPosition(this.sensorWorld)
    this.sensorWorld.y += 1.12
  }

  private buildConduit(M: ReturnType<typeof materials>, path: Vector3[]): void {
    // Covered cable/rod channel from the sensor mast to the cabinet. It doglegs
    // around the swing's arc rather than crossing it, the way real trunking would.
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i]
      const to = path[i + 1]
      const dir = new Vector3().subVectors(to, from).setY(0)
      const len = dir.length()
      if (len < 0.05) continue
      const cover = new Mesh(
        new CylinderGeometry(0.075, 0.075, len, 8, 1, false, 0, Math.PI),
        M.steelGalv,
      )
      cover.rotation.z = Math.PI / 2
      cover.rotation.y = -Math.atan2(dir.z, dir.x) + Math.PI / 2
      cover.position.copy(from).add(to).multiplyScalar(0.5).setY(0.04)
      cover.receiveShadow = true
      this.group.add(cover)

      // bolted cover plates at intervals, and a proper bend fitting at each corner
      const n = Math.max(2, Math.round(len / 1.6))
      for (let k = 1; k < n; k++) {
        const p = new Vector3().lerpVectors(from, to, k / n).setY(0.075)
        const plate = new Mesh(new BoxGeometry(0.1, 0.02, 0.19), M.steelDark)
        plate.position.copy(p)
        plate.rotation.y = -Math.atan2(dir.z, dir.x)
        this.group.add(plate)
      }
      if (i > 0) {
        const elbow = new Mesh(new SphereGeometry(0.085, 10, 8), M.steelGalv)
        elbow.position.copy(from).setY(0.04)
        this.group.add(elbow)
      }
    }
  }

  // --------------------------------------------------------------- behaviour

  /**
   * The swing has passed its low point. Runs the mechanism through its sequence.
   * Called once per completed cycle only — never twice for the same pass.
   */
  advance(teeth: number): void {
    this.schedule(0.0, () => {
      this.sensorPulse = 1
    })
    this.schedule(0.05, () => {
      this.rodPulse = 1
    })
    this.schedule(0.09, () => {
      this.leverPulse = 1
    })
    this.schedule(0.15, () => {
      this.pawlPulse = 1
      this.mechTarget += TOOTH_ANGLE * teeth
    })
  }

  /** A pass in the non-driving direction: the pawl lifts and re-cocks, nothing advances. */
  recock(): void {
    this.schedule(0.02, () => {
      this.sensorPulse = 0.45
      this.leverPulse = -0.55
    })
  }

  private schedule(delay: number, fn: () => void): void {
    this.queue.push({ at: this.elapsed + delay, fn })
  }

  update(dt: number, L: LightingState, dialLitTarget: number): void {
    this.elapsed += dt
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.queue[i].at <= this.elapsed) {
        this.queue[i].fn()
        this.queue.splice(i, 1)
      }
    }

    // Stiff spring for the ratchet: it snaps and settles like a real escapement.
    const k = 260
    const c = 22
    const a = (this.mechTarget - this.mechCurrent) * k - this.mechVel * c
    this.mechVel += a * dt
    this.mechCurrent += this.mechVel * dt

    // The display end of the train is softer, so the movement visibly travels outward.
    const k2 = 95
    const c2 = 15
    const a2 = (this.mechCurrent - this.handCurrent) * k2 - this.handVel * c2
    this.handVel += a2 * dt
    this.handCurrent += this.handVel * dt

    this.escapeWheel.rotation.z = -this.mechCurrent
    this.idlerGear.rotation.z = this.mechCurrent * 1.5
    this.centreWheel.rotation.z = -this.handCurrent
    this.indexRing.rotation.z = -this.handCurrent

    const hands = L.clockHands()
    this.minuteHand.rotation.z = -hands.minuteAngle - (this.mechCurrent - this.handCurrent) * 0.35
    this.hourHand.rotation.z = -hands.hourAngle

    // impulse channels decay
    this.sensorPulse = damp(this.sensorPulse, 0, 7.0, dt)
    this.rodPulse = damp(this.rodPulse, 0, 8.5, dt)
    this.leverPulse = damp(this.leverPulse, 0, 6.5, dt)
    this.pawlPulse = damp(this.pawlPulse, 0, 9.0, dt)

    this.linkRod.position.x = -0.71 - 0.14 + this.rodPulse * 0.055
    this.lever.rotation.z = this.leverPulse * 0.2
    this.pawl.rotation.z = -0.18 - this.pawlPulse * 0.3

    this.sensorLensMat.emissiveIntensity = 0.12 + this.sensorPulse * 2.6
    ;(this.sensorFlash.material as MeshBasicMaterial).opacity = clamp(this.sensorPulse * 0.55)

    // dial illumination
    this.dialLit = damp(this.dialLit, dialLitTarget, 2.2, dt)
    const glowAmount = this.dialLit * L.lampEmissive
    this.dialFace.emissiveIntensity = glowAmount * 0.42
    this.tmpColor.setHex(0xffd9a0)
    this.dialLight.color.copy(this.tmpColor)
    this.dialLight.intensity = glowAmount * 2.6 * L.lampLightIntensity
    ;(this.dialGlow.material as MeshBasicMaterial).opacity = glowAmount * 0.13
    this.glassSheen.opacity = 0.03 + L.starVisibility * 0.035
    this.mechLight.intensity = 0.34 + L.readFill * 0.55 + glowAmount * 0.7
  }

  /** Place the train at a given tooth count instantly — used when restoring a session. */
  setTeeth(teeth: number): void {
    this.mechTarget = TOOTH_ANGLE * teeth
    this.mechCurrent = this.mechTarget
    this.handCurrent = this.mechTarget
    this.mechVel = 0
    this.handVel = 0
  }

  /** Reset for replay: hands return to the opening time without a visible rewind spin. */
  reset(): void {
    this.mechTarget = 0
    this.mechCurrent = 0
    this.mechVel = 0
    this.handCurrent = 0
    this.handVel = 0
    this.queue.length = 0
    this.dialLit = 0
  }
}
