import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import type { Pendulum } from '../sim/Pendulum'
import { clamp, damp, lerp } from '../util/math'
import { makeSwingApronTexture } from '../util/textures'
import { materials } from './materials'

const LINKS_PER_CHAIN = 22

/**
 * The swing bay: a galvanised A-frame with a painted steel top beam, two chains,
 * a rubber belt seat, and a child riding it.
 *
 * The rider is driven entirely by the pendulum state — lean, knees, hair and the
 * load on the seat all follow phase and amplitude, so the child on screen looks
 * like the reason the swing is moving rather than a decal riding on top of it.
 */
export class Swing {
  /** Positioned and rotated by the caller: the bay stands at an angle to the view. */
  readonly group = new Group()
  /** Pivot of the swing, in the bay's own frame. */
  readonly pivot = new Vector3(0, 3.42, 0)
  /** Live world position of the seat, used for camera framing. */
  readonly seatWorld = new Vector3()

  private armGroup = new Group()
  private seatGroup = new Group()
  private rider!: {
    hips: Group
    torso: Group
    head: Group
    hair: Group
    upperLegL: Group
    upperLegR: Group
    lowerLegL: Group
    lowerLegR: Group
    armL: Group
    armR: Group
    coat: Mesh
  }
  private chains!: InstancedMesh
  private chainDummy = new Object3D()
  private mat = new Matrix4()
  private quat = new Quaternion()

  private lean = 0
  private knee = 0
  private hairSway = 0
  private hairVel = 0
  private seatLoad = 0

  constructor(private pendulum: Pendulum) {
    const M = materials()
    this.buildFrame(M)
    this.buildApron()
    this.group.add(this.armGroup)
    this.armGroup.position.copy(this.pivot)
    this.buildChainsAndSeat(M)
    this.buildRider(M)
  }

  private buildApron(): void {
    // The compacted, swept earth a swing wears into the ground under its arc.
    const apron = new Mesh(
      new PlaneGeometry(3.4, 5.6),
      new MeshStandardMaterial({
        map: makeSwingApronTexture(256),
        transparent: true,
        roughness: 0.95,
        metalness: 0,
      }),
    )
    apron.rotation.x = -Math.PI / 2
    apron.rotation.z = Math.PI / 2
    apron.position.set(0, 0.012, -0.35)
    apron.receiveShadow = true
    this.group.add(apron)
  }

  private buildFrame(M: ReturnType<typeof materials>): void {
    const P = this.pivot
    const beamLen = 3.6
    const beam = new Mesh(new CylinderGeometry(0.075, 0.075, beamLen, 12), M.steelPaint)
    beam.rotation.z = Math.PI / 2
    beam.position.set(P.x, P.y + 0.09, P.z)
    beam.castShadow = true
    this.group.add(beam)

    // end caps
    for (const sx of [-1, 1]) {
      const cap = new Mesh(new CylinderGeometry(0.085, 0.085, 0.06, 12), M.steelDark)
      cap.rotation.z = Math.PI / 2
      cap.position.set(P.x + sx * beamLen * 0.5, P.y + 0.09, P.z)
      this.group.add(cap)
    }

    // A-frame legs at both ends, splayed fore and aft
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const top = new Vector3(P.x + sx * (beamLen * 0.5 - 0.06), P.y + 0.09, P.z)
        const bottom = new Vector3(P.x + sx * (beamLen * 0.5 + 0.5), 0, P.z + sz * 1.28)
        const dir = new Vector3().subVectors(bottom, top)
        const len = dir.length()
        const leg = new Mesh(new CylinderGeometry(0.058, 0.07, len, 10), M.steelGalv)
        leg.position.copy(top).addScaledVector(dir, 0.5)
        this.quat.setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().normalize())
        leg.quaternion.copy(this.quat)
        leg.castShadow = true
        this.group.add(leg)

        const footing = new Mesh(new CylinderGeometry(0.19, 0.22, 0.16, 10), M.concrete)
        footing.position.set(bottom.x, 0.05, bottom.z)
        footing.receiveShadow = true
        this.group.add(footing)
      }
      // cross tie between the two splayed legs
      const tie = new Mesh(new CylinderGeometry(0.03, 0.03, 2.2, 6), M.steelGalv)
      tie.rotation.x = Math.PI / 2
      tie.position.set(P.x + sx * (beamLen * 0.5 + 0.32), 1.05, P.z)
      this.group.add(tie)
    }

    // hanger shackles
    for (const sx of [-1, 1]) {
      const sh = new Mesh(new TorusGeometry(0.05, 0.014, 6, 12), M.chain)
      sh.position.set(P.x + sx * 0.24, P.y + 0.02, P.z)
      sh.rotation.y = Math.PI / 2
      this.group.add(sh)
      const bracket = new Mesh(new BoxGeometry(0.09, 0.11, 0.05), M.steelDark)
      bracket.position.set(P.x + sx * 0.24, P.y + 0.075, P.z)
      this.group.add(bracket)
    }
  }

  private buildChainsAndSeat(M: ReturnType<typeof materials>): void {
    const linkGeo = new TorusGeometry(0.028, 0.008, 5, 9)
    this.chains = new InstancedMesh(linkGeo, M.chain, LINKS_PER_CHAIN * 2)
    this.chains.castShadow = true
    this.chains.frustumCulled = false
    this.armGroup.add(this.chains)

    this.seatGroup.position.set(0, -this.pendulum.length, 0)
    this.armGroup.add(this.seatGroup)

    // rubber belt seat with steel end plates and swaged sleeves
    const seat = new Mesh(new BoxGeometry(0.52, 0.045, 0.2), M.rubber)
    seat.castShadow = true
    seat.receiveShadow = true
    this.seatGroup.add(seat)
    for (const sx of [-1, 1]) {
      const plate = new Mesh(new BoxGeometry(0.055, 0.07, 0.2), M.steelGalv)
      plate.position.set(sx * 0.245, 0.005, 0)
      this.seatGroup.add(plate)
      const sleeve = new Mesh(new CylinderGeometry(0.022, 0.022, 0.12, 8), M.chain)
      sleeve.position.set(sx * 0.245, 0.07, 0)
      this.seatGroup.add(sleeve)
    }
  }

  private buildRider(M: ReturnType<typeof materials>): void {
    // A small child: soft shapes, warm clothes for a cool evening.
    const skin = new MeshStandardMaterial({ color: new Color('#e6bda0'), roughness: 0.78, metalness: 0 })
    // Warm, high-value clothes: the rider has to stay findable once the sky goes.
    const coatMat = new MeshStandardMaterial({ color: new Color('#e0705a'), roughness: 0.82, metalness: 0 })
    const trouser = new MeshStandardMaterial({ color: new Color('#586b96'), roughness: 0.85, metalness: 0 })
    const shoe = new MeshStandardMaterial({ color: new Color('#e8e2d4'), roughness: 0.7, metalness: 0 })
    const hairMat = new MeshStandardMaterial({ color: new Color('#33261f'), roughness: 0.65, metalness: 0 })

    const hips = new Group()
    hips.position.set(0, 0.06, 0)
    this.seatGroup.add(hips)

    const torso = new Group()
    hips.add(torso)
    const coat = new Mesh(new CylinderGeometry(0.115, 0.135, 0.34, 12), coatMat)
    coat.position.y = 0.17
    coat.castShadow = true
    torso.add(coat)
    const collar = new Mesh(new TorusGeometry(0.075, 0.022, 6, 12), coatMat)
    collar.position.y = 0.335
    collar.rotation.x = Math.PI / 2
    torso.add(collar)

    const head = new Group()
    head.position.y = 0.4
    torso.add(head)
    const skull = new Mesh(new SphereGeometry(0.105, 16, 14), skin)
    skull.castShadow = true
    head.add(skull)
    const neck = new Mesh(new CylinderGeometry(0.038, 0.045, 0.06, 8), skin)
    neck.position.y = -0.08
    head.add(neck)

    const hair = new Group()
    head.add(hair)
    const cap = new Mesh(new SphereGeometry(0.112, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat)
    cap.position.y = 0.012
    hair.add(cap)
    const tail = new Mesh(new SphereGeometry(0.062, 10, 10), hairMat)
    tail.scale.set(0.8, 1.5, 0.8)
    tail.position.set(0, -0.02, -0.11)
    hair.add(tail)

    const mkArm = (sx: number) => {
      const g = new Group()
      g.position.set(sx * 0.12, 0.3, 0)
      torso.add(g)
      const upper = new Mesh(new CylinderGeometry(0.032, 0.028, 0.2, 8), coatMat)
      upper.position.y = -0.1
      g.add(upper)
      const fore = new Mesh(new CylinderGeometry(0.026, 0.024, 0.18, 8), skin)
      fore.position.y = -0.28
      g.add(fore)
      const hand = new Mesh(new SphereGeometry(0.034, 8, 8), skin)
      hand.position.y = -0.37
      g.add(hand)
      return g
    }
    const armL = mkArm(-1)
    const armR = mkArm(1)

    const mkLeg = (sx: number) => {
      const upper = new Group()
      upper.position.set(sx * 0.075, -0.02, 0.06)
      hips.add(upper)
      const thigh = new Mesh(new CylinderGeometry(0.045, 0.04, 0.24, 8), trouser)
      thigh.position.y = -0.12
      thigh.castShadow = true
      upper.add(thigh)
      const lower = new Group()
      lower.position.y = -0.24
      upper.add(lower)
      const shin = new Mesh(new CylinderGeometry(0.036, 0.03, 0.23, 8), trouser)
      shin.position.y = -0.115
      lower.add(shin)
      const foot = new Mesh(new BoxGeometry(0.07, 0.05, 0.13), shoe)
      foot.position.set(0, -0.24, 0.03)
      lower.add(foot)
      return { upper, lower }
    }
    const legL = mkLeg(-1)
    const legR = mkLeg(1)

    // hands hold the chains
    armL.rotation.x = -0.15
    armR.rotation.x = -0.15

    this.rider = {
      hips,
      torso,
      head,
      hair,
      upperLegL: legL.upper,
      upperLegR: legR.upper,
      lowerLegL: legL.lower,
      lowerLegR: legR.lower,
      armL,
      armR,
      coat,
    }
    void M
  }

  update(dt: number): void {
    const p = this.pendulum
    const amp = p.amplitude01

    // The whole arm assembly is the pendulum.
    this.armGroup.rotation.x = -p.theta

    // --- chain links -------------------------------------------------------
    const L = p.length
    const spacing = (L - 0.1) / LINKS_PER_CHAIN
    let idx = 0
    for (const sx of [-1, 1]) {
      for (let i = 0; i < LINKS_PER_CHAIN; i++) {
        const y = -0.04 - i * spacing
        // chains converge very slightly towards the seat, like real swing chains
        const t = i / (LINKS_PER_CHAIN - 1)
        const x = sx * lerp(0.24, 0.245, t)
        this.chainDummy.position.set(x, y, 0)
        this.chainDummy.rotation.set(0, 0, i % 2 === 0 ? 0 : Math.PI / 2)
        this.chainDummy.rotation.x = Math.PI / 2
        if (i % 2 === 1) this.chainDummy.rotation.y = Math.PI / 2
        this.chainDummy.updateMatrix()
        this.mat.copy(this.chainDummy.matrix)
        this.chains.setMatrixAt(idx++, this.mat)
      }
    }
    this.chains.instanceMatrix.needsUpdate = true

    // --- rider -------------------------------------------------------------
    // Direction of travel, smoothed: this is what a child's pumping follows.
    const travel = clamp(p.omega * 1.15, -1, 1)
    this.lean = damp(this.lean, travel, 7, dt)
    this.knee = damp(this.knee, travel, 8, dt)

    const r = this.rider
    // lean back going forward, curl forward coming back
    r.torso.rotation.x = lerp(0.05, -0.40, (this.lean + 1) * 0.5) * (0.35 + amp * 0.9)
    r.head.rotation.x = -r.torso.rotation.x * 0.45
    r.hips.rotation.x = this.lean * 0.06 * amp

    // legs: shoot out on the forward half, tuck under on the return
    const ext = (this.knee + 1) * 0.5
    const legSwing = lerp(0.55, -0.85, ext) * (0.4 + amp * 0.85)
    const kneeBend = lerp(1.15, 0.06, ext) * (0.5 + amp * 0.6)
    r.upperLegL.rotation.x = legSwing
    r.upperLegR.rotation.x = legSwing * 0.94
    r.lowerLegL.rotation.x = kneeBend
    r.lowerLegR.rotation.x = kneeBend * 1.06

    // arms brace against the chains harder at speed
    const brace = Math.abs(p.omega) * 0.1
    r.armL.rotation.x = -0.15 - brace
    r.armR.rotation.x = -0.15 - brace

    // hair: a light spring driven by angular acceleration
    const accel = -(9.81 / L) * Math.sin(p.theta)
    this.hairVel += (-accel * 0.05 - this.hairSway * 26 - this.hairVel * 6.5) * dt
    this.hairSway += this.hairVel * dt
    r.hair.rotation.x = clamp(this.hairSway, -0.5, 0.5)

    // coat flutters, seat takes load at the bottom of the arc
    const speed01 = clamp(Math.abs(p.omega) / 2.2)
    r.coat.scale.z = 1 + speed01 * 0.06
    this.seatLoad = damp(this.seatLoad, speed01 * amp, 9, dt)
    this.seatGroup.scale.y = 1 - this.seatLoad * 0.06
    this.seatGroup.position.y = -L + this.seatLoad * 0.012

    this.seatGroup.getWorldPosition(this.seatWorld)
  }
}
