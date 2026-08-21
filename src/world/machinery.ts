import * as THREE from 'three'
import { buildMaterials } from '../core/materials'
import { MeshMerger } from './merge'
import type { ContactShadows } from './decals'
import {
  CIRCUIT_IDS,
  DIST_BOX,
  GENERATOR,
  ROLLERS,
  SHAFT,
  STORAGE_BOX,
  type CircuitId,
} from './layout'
import { approach, clamp01, lerp } from '../core/math'

const _v = new THREE.Vector3()

function shaftPointAt(z: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(SHAFT.x, SHAFT.heightAt(z), z)
}

/* ------------------------------------------------------------------ *
 * Pictogram reliefs for the selector plates
 * ------------------------------------------------------------------ */

function pathRelief(): THREE.BufferGeometry {
  // A footpath receding: wide at the bottom, narrow at the top.
  const shape = new THREE.Shape()
  shape.moveTo(-0.03, -0.034)
  shape.lineTo(0.03, -0.034)
  shape.lineTo(0.012, 0.034)
  shape.lineTo(-0.012, 0.034)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: false })
  geo.translate(0, 0, 0)
  return geo
}

function roofRelief(): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(-0.038, 0.002)
  shape.lineTo(0, 0.036)
  shape.lineTo(0.038, 0.002)
  shape.lineTo(0.026, 0.002)
  shape.lineTo(0, 0.024)
  shape.lineTo(-0.026, 0.002)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.007, bevelEnabled: false })
  return geo
}

/* ------------------------------------------------------------------ *
 * Selector lever
 * ------------------------------------------------------------------ */

export interface SelectorLever {
  id: CircuitId
  /** Pivots about its local X axis. */
  pivot: THREE.Group
  /** The picture plate the player actually grabs. */
  handle: THREE.Mesh
  /** Oversized invisible hit volume around the plate, for small fingers. */
  grab: THREE.Mesh
  pilot: THREE.MeshStandardMaterial
  /** -1 when parked up, +1 when thrown over. */
  thrown: number
  angle: number
}

/* ------------------------------------------------------------------ */

export class Machinery {
  readonly root = new THREE.Group()

  readonly levers: SelectorLever[] = []

  private readonly shaftSections: THREE.Group[] = []
  private readonly needle = new THREE.Group()
  private dialMaterial!: THREE.MeshStandardMaterial
  private readonly storageSegments: THREE.MeshStandardMaterial[] = []
  private shaftAngle = 0
  private needleAngle = 0

  constructor(contacts: ContactShadows) {
    this.root.name = 'machinery'
    this.buildShaft()
    this.buildGenerator(contacts)
    this.buildCableRun()
    this.buildDistributionBox(contacts)
  }

  /* ---------------- line shaft ---------------- */

  private buildShaft(): void {
    const m = buildMaterials()
    const merger = new MeshMerger()
    const wheelGeo = new THREE.CylinderGeometry(SHAFT.wheelRadius, SHAFT.wheelRadius, 0.022, 16)
    const hubGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.03, 10)
    const couplingGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.07, 12)

    for (let sec = 0; sec < SHAFT.breaks.length - 1; sec++) {
      const z0 = SHAFT.breaks[sec]
      const z1 = SHAFT.breaks[sec + 1]
      const a = new THREE.Vector3(SHAFT.x, SHAFT.heightAt(z0), z0)
      const b = new THREE.Vector3(SHAFT.x, SHAFT.heightAt(z1), z1)
      const mid = a.clone().lerp(b, 0.5)
      const len = a.distanceTo(b)
      const pitch = Math.atan2(a.y - b.y, b.z - a.z)

      const group = new THREE.Group()
      group.position.copy(mid)
      group.rotation.x = Math.PI / 2 - pitch
      this.root.add(group)

      const spinner = new THREE.Group()
      group.add(spinner)
      this.shaftSections.push(spinner)

      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(SHAFT.radius, SHAFT.radius, len, 10),
        m.galvanised,
      )
      bar.castShadow = true
      spinner.add(bar)

      // A rubber friction wheel on every second drive roller: enough contact to
      // read as a line shaft without crowding the bed.
      let n = 0
      for (const r of ROLLERS) {
        if (!r.drive || r.z < z0 || r.z > z1) continue
        if (n++ % 2 !== 0) continue
        const local = (r.z - mid.z) / Math.max(0.001, Math.cos(pitch))
        const wheel = new THREE.Mesh(wheelGeo, m.rubber)
        wheel.position.y = local
        wheel.castShadow = true
        spinner.add(wheel)
        const hub = new THREE.Mesh(hubGeo, m.darkSteel)
        hub.position.y = local
        spinner.add(hub)
      }

      // Muff coupling at the joint between sections.
      if (sec < SHAFT.breaks.length - 2) {
        const coupling = new THREE.Mesh(couplingGeo, m.darkSteel)
        coupling.position.y = len / 2 - 0.02
        spinner.add(coupling)
      }

      // Pillow-block bearings are fixed to the frame and do not turn.
      const blockGeo = new THREE.BoxGeometry(0.07, 0.09, 0.06)
      const strapGeo = new THREE.BoxGeometry(0.028, 0.15, 0.028)
      for (const t of [0.06, 0.94]) {
        const p = a.clone().lerp(b, t)
        merger.addAt(blockGeo, m.darkSteel, p.x, p.y, p.z, 0, 0, 0, { cast: true })
        merger.addAt(strapGeo, m.galvanised, p.x, p.y + 0.1, p.z)
      }
    }
    merger.build(this.root, 'shaft-bearings')
  }

  /* ---------------- generator ---------------- */

  private buildGenerator(contacts: ContactShadows): void {
    const m = buildMaterials()

    // Right-angle drive box on the end of the line shaft, and the cross shaft
    // that carries the drive outboard into the generator.
    const bevelY = shaftPointAt(SHAFT.zTo, _v).y
    const bevel = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.15), m.darkSteel)
    bevel.position.set(SHAFT.x, bevelY, GENERATOR.bevelPos.z)
    bevel.castShadow = true
    this.root.add(bevel)
    const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.44, 8), m.galvanised)
    cross.rotation.z = Math.PI / 2
    cross.position.set(SHAFT.x - 0.28, bevelY, GENERATOR.bevelPos.z)
    this.root.add(cross)

    const g = new THREE.Group()
    g.position.copy(GENERATOR.pos)
    this.root.add(g)

    const s = GENERATOR.size

    // Concrete pad and galvanised plinth.
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.56), m.concrete)
    pad.position.y = -GENERATOR.pos.y + 0.03
    pad.receiveShadow = true
    g.add(pad)
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.16, GENERATOR.pos.y - 0.09, 0.2), m.galvanised)
    plinth.position.y = -(GENERATOR.pos.y - 0.06) / 2 - 0.03
    plinth.castShadow = true
    g.add(plinth)
    contacts.add(GENERATOR.pos.x, 0, GENERATOR.pos.z, 0.42, 0.55)

    // Weatherproof body: a shallow-domed lid so rain runs off, drip lip below.
    const body = new THREE.Mesh(new THREE.BoxGeometry(s.x, s.y, s.z), m.housing)
    body.castShadow = true
    body.receiveShadow = true
    g.add(body)

    const lid = new THREE.Mesh(new THREE.BoxGeometry(s.x + 0.03, 0.035, s.z + 0.03), m.housing)
    lid.position.y = s.y / 2 + 0.017
    lid.castShadow = true
    g.add(lid)

    const drip = new THREE.Mesh(new THREE.BoxGeometry(s.x + 0.02, 0.018, s.z + 0.02), m.housing)
    drip.position.y = -s.y / 2 - 0.009
    g.add(drip)

    // Heat-dissipation fins along the +Z flank.
    for (let i = 0; i < 5; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, s.y * 0.72, 0.03), m.housing)
      fin.position.set(-s.x / 2 + 0.06 + i * 0.055, 0, s.z / 2 + 0.014)
      g.add(fin)
    }

    // Four service screws around the inspection face.
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 6), m.darkSteel)
        screw.rotation.x = Math.PI / 2
        screw.position.set(sx * (s.x / 2 - 0.035), sy * (s.y / 2 - 0.035), -s.z / 2 - 0.004)
        g.add(screw)
      }
    }

    // Shaft seal where the cross shaft enters the +X face.
    const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, 0.05, 12), m.darkSteel)
    seal.rotation.z = Math.PI / 2
    seal.position.set(s.x / 2 + 0.02, 0.04, 0)
    g.add(seal)

    // Inspection window with a mechanical needle behind glass. It faces the
    // way the child arrives from, so the movement is legible from the run-out.
    const face = new THREE.Group()
    face.rotation.y = Math.PI
    face.position.set(0.01, 0.012, -s.z / 2 - 0.002)
    g.add(face)

    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.098, 0.014, 22), m.darkSteel)
    bezel.rotation.x = Math.PI / 2
    face.add(bezel)

    // The dial is lit from inside by the machine it reports on, so the needle
    // is only readable once the shaft is actually turning.
    this.dialMaterial = new THREE.MeshStandardMaterial({
      color: 0x9d978a,
      emissive: new THREE.Color(0xffd2a0),
      emissiveIntensity: 0,
      roughness: 0.72,
      metalness: 0,
    })
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.086, 26), this.dialMaterial)
    dial.position.z = 0.0085
    face.add(dial)

    // Scale ticks pressed into the dial plate.
    for (let i = 0; i <= 8; i++) {
      const a = lerp(-1.05, 1.05, i / 8)
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(0.005, i % 4 === 0 ? 0.02 : 0.011, 0.002),
        m.darkSteel,
      )
      const r = 0.07
      tick.position.set(Math.sin(a) * r, Math.cos(a) * r, 0.011)
      tick.rotation.z = -a
      face.add(tick)
    }

    this.needle.position.z = 0.0135
    face.add(this.needle)
    const needleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.074, 0.003), m.needle)
    needleMesh.position.y = 0.03
    this.needle.add(needleMesh)
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 10), m.darkSteel)
    hub.rotation.x = Math.PI / 2
    hub.position.z = 0.003
    this.needle.add(hub)

    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.09, 22), m.glassDark)
    glass.position.z = 0.017
    glass.material = new THREE.MeshStandardMaterial({
      color: 0x1c1f22,
      roughness: 0.12,
      metalness: 0.05,
      transparent: true,
      opacity: 0.24,
    })
    face.add(glass)

    // A hoop guard so the housing is not a trip hazard beside the run-out.
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.018, 8, 20, Math.PI), m.galvanised)
    hoop.rotation.y = Math.PI / 2
    hoop.rotation.z = -Math.PI / 2
    hoop.position.set(-0.06, -0.06, 0)
    hoop.castShadow = true
    g.add(hoop)
  }

  /* ---------------- cable, storage box and conduit ---------------- */

  private buildCableRun(): void {
    const m = buildMaterials()
    const merger = new MeshMerger()

    // Short flexible cable from the generator gland to the storage box.
    const from = new THREE.Vector3(
      GENERATOR.pos.x - 0.06,
      GENERATOR.pos.y - 0.11,
      GENERATOR.pos.z + GENERATOR.size.z / 2 + 0.02,
    )
    const to = STORAGE_BOX.pos.clone().add(new THREE.Vector3(0.05, -0.14, 0.06))
    const sag = from.clone().lerp(to, 0.5)
    sag.y -= 0.14
    const curve = new THREE.CatmullRomCurve3([from, sag, to])
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.012, 6, false), m.rubber)
    cable.castShadow = true
    this.root.add(cable)

    const gland = new THREE.CylinderGeometry(0.018, 0.022, 0.04, 8)
    merger.addAt(gland, m.conduit, from.x, from.y, from.z - 0.02, Math.PI / 2, 0, 0)

    // Storage box: a small enclosure with a column of charge segments.
    const box = new THREE.Group()
    box.position.copy(STORAGE_BOX.pos)
    box.rotation.y = STORAGE_BOX.yaw
    this.root.add(box)

    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.24, 0.12), m.housing)
    shell.castShadow = true
    box.add(shell)
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.02, 0.14), m.housing)
    cap.position.y = 0.13
    box.add(cap)
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.028, STORAGE_BOX.pos.y, 8),
      m.galvanised,
    )
    post.position.y = -STORAGE_BOX.pos.y / 2 - 0.06
    post.castShadow = true
    box.add(post)

    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.17, 0.008), m.darkSteel)
    bezel.position.set(0, 0.005, -0.062)
    box.add(bezel)

    for (let i = 0; i < STORAGE_BOX.segments; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x6d6a60,
        emissive: new THREE.Color(0xffc079),
        emissiveIntensity: 0,
        roughness: 0.55,
        metalness: 0,
      })
      this.storageSegments.push(mat)
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.019, 0.004), mat)
      seg.position.set(0, -0.062 + i * 0.031, -0.068)
      box.add(seg)
    }

    // Conduit: down the post, into the ground, along to the distribution box.
    const conduitR = 0.017
    const down = new THREE.Mesh(
      new THREE.CylinderGeometry(conduitR, conduitR, STORAGE_BOX.pos.y - 0.14, 8),
      m.conduit,
    )
    down.position.set(
      STORAGE_BOX.pos.x - 0.05,
      (STORAGE_BOX.pos.y - 0.14) / 2,
      STORAGE_BOX.pos.z + 0.06,
    )
    this.root.add(down)

    const a = new THREE.Vector3(STORAGE_BOX.pos.x - 0.05, 0.06, STORAGE_BOX.pos.z + 0.06)
    const b = new THREE.Vector3(DIST_BOX.pos.x + 0.1, 0.06, DIST_BOX.pos.z + 0.22)
    const run = new THREE.CatmullRomCurve3([
      a,
      a.clone().lerp(b, 0.4).setY(0.055),
      b,
    ])
    const conduit = new THREE.Mesh(new THREE.TubeGeometry(run, 20, conduitR, 6, false), m.conduit)
    conduit.castShadow = true
    this.root.add(conduit)

    // Saddle clips along the buried run where it surfaces.
    const clip = new THREE.CylinderGeometry(0.026, 0.026, 0.012, 8)
    for (let i = 1; i < 5; i++) {
      run.getPoint(i / 5, _v)
      merger.addAt(clip, m.darkSteel, _v.x, 0.03, _v.z)
    }
    merger.build(this.root, 'cable-fittings')
  }

  /* ---------------- distribution box and selectors ---------------- */

  private buildDistributionBox(contacts: ContactShadows): void {
    const m = buildMaterials()
    const g = new THREE.Group()
    g.position.copy(DIST_BOX.pos)
    g.rotation.y = DIST_BOX.yaw
    this.root.add(g)

    const w = DIST_BOX.bodyWidth
    const h = DIST_BOX.bodyHeight
    const d = DIST_BOX.bodyDepth
    const baseY = DIST_BOX.leverY - h / 2 - 0.06

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, 0.09, d + 0.16), m.concrete)
    plinth.position.y = 0.045
    plinth.receiveShadow = true
    g.add(plinth)
    contacts.add(DIST_BOX.pos.x, 0, DIST_BOX.pos.z, 0.62, 0.6)

    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, baseY - h / 2, 0.06), m.galvanised)
      leg.position.set(s * (w / 2 - 0.08), (baseY - h / 2) / 2 + 0.05, 0)
      leg.castShadow = true
      g.add(leg)
    }

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m.housing)
    body.position.y = baseY
    body.castShadow = true
    body.receiveShadow = true
    g.add(body)

    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.03, d + 0.08), m.housing)
    roof.position.y = baseY + h / 2 + 0.015
    roof.castShadow = true
    g.add(roof)

    // Door hinges and a latch, so the box reads as serviceable equipment.
    for (const y of [-0.18, 0.18]) {
      const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 8), m.darkSteel)
      hinge.position.set(-w / 2 - 0.008, baseY + y, -d / 2 + 0.02)
      g.add(hinge)
    }
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.02), m.darkSteel)
    latch.position.set(w / 2 - 0.03, baseY - 0.02, -d / 2 - 0.012)
    g.add(latch)

    const front = -d / 2 - 0.004
    const spacing = 0.216

    CIRCUIT_IDS.forEach((id, i) => {
      const x = (i - 1) * spacing

      // Escutcheon plate the lever swings in.
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.2, 0.008), m.darkSteel)
      plate.position.set(x, DIST_BOX.leverY - 0.06, front)
      g.add(plate)

      const pivot = new THREE.Group()
      pivot.position.set(x, DIST_BOX.leverY - 0.06, front - 0.02)
      g.add(pivot)

      const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.05, 12), m.galvanised)
      boss.rotation.z = Math.PI / 2
      pivot.add(boss)

      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), m.galvanised)
      arm.position.y = 0.1
      arm.castShadow = true
      pivot.add(arm)

      // The picture plate: relief only, never a word.
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.115, 0.016), m.paintedSteel)
      handle.position.set(0, 0.215, -0.012)
      handle.castShadow = true
      pivot.add(handle)

      // Generous invisible hit volume: a four-year-old aims at the picture, not
      // at the 11 cm plate.
      const grab = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.34, 0.2),
        new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, opacity: 0 }),
      )
      grab.position.set(0, 0.17, -0.03)
      grab.renderOrder = -10
      pivot.add(grab)

      const relief = new THREE.Group()
      relief.position.set(0, 0.215, -0.021)
      pivot.add(relief)

      if (id === 'path') {
        const geo = pathRelief()
        const mesh = new THREE.Mesh(geo, m.relief)
        mesh.rotation.y = Math.PI
        relief.add(mesh)
        for (let k = 0; k < 2; k++) {
          const dash = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.004), m.paintedSteel)
          dash.position.set(0, -0.012 + k * 0.026, -0.008)
          relief.add(dash)
        }
      } else if (id === 'pavilion') {
        const roofMesh = new THREE.Mesh(roofRelief(), m.relief)
        roofMesh.rotation.y = Math.PI
        relief.add(roofMesh)
        for (const s of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.03, 0.006), m.relief)
          post.position.set(s * 0.026, -0.014, -0.003)
          relief.add(post)
        }
      } else {
        const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.03, 0.007), m.relief)
        trunk.position.set(0, -0.022, -0.0035)
        relief.add(trunk)
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.027, 12, 8), m.relief)
        crown.position.set(0, 0.008, -0.008)
        crown.scale.set(1, 0.85, 0.5)
        relief.add(crown)
      }

      // Pilot lamp: pale amber, tells you which way the box is switched.
      const pilotMat = new THREE.MeshStandardMaterial({
        color: 0x5f5c54,
        emissive: new THREE.Color(0xffd7a0),
        emissiveIntensity: 0,
        roughness: 0.45,
        metalness: 0,
      })
      const pilot = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.008, 10), pilotMat)
      pilot.rotation.x = Math.PI / 2
      pilot.position.set(x, DIST_BOX.leverY + 0.115, front - 0.002)
      g.add(pilot)
      const pilotRing = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.006, 10), m.darkSteel)
      pilotRing.rotation.x = Math.PI / 2
      pilotRing.position.set(x, DIST_BOX.leverY + 0.115, front + 0.001)
      g.add(pilotRing)

      // Each circuit leaves the box in its own conduit stub.
      const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 6), m.conduit)
      stub.position.set(x * 0.6, baseY - h / 2 - 0.09, d / 2 - 0.03)
      stub.rotation.x = 0.35
      g.add(stub)

      this.levers.push({
        id,
        pivot,
        handle,
        grab,
        pilot: pilotMat,
        thrown: -1,
        angle: -0.42,
      })
      pivot.rotation.x = -0.42
    })
  }

  /* ---------------- runtime ---------------- */

  /** Which lever is currently over-centre, if any. */
  setArmed(id: CircuitId | null, immediate = false): void {
    for (const lever of this.levers) {
      lever.thrown = lever.id === id ? 1 : -1
      if (immediate) {
        lever.angle = lever.thrown > 0 ? 0.5 : -0.42
        lever.pivot.rotation.x = lever.angle
      }
    }
  }

  /** Manual override used while a finger is dragging a lever. */
  setLeverAngle(lever: SelectorLever, angle: number): void {
    lever.angle = angle
    lever.pivot.rotation.x = angle
  }

  update(dt: number, shaftOmega: number, output: number, storage: number): void {
    this.shaftAngle += shaftOmega * dt
    if (this.shaftAngle > Math.PI * 2) this.shaftAngle -= Math.PI * 2
    for (const sec of this.shaftSections) sec.rotation.y = this.shaftAngle

    // The needle is a real moving-iron movement: it lags and it never snaps.
    this.needleAngle = approach(this.needleAngle, clamp01(output), 0.16, dt)
    this.needle.rotation.z = -lerp(-1.05, 1.05, this.needleAngle)
    this.dialMaterial.emissiveIntensity = Math.min(0.68, 0.06 + this.needleAngle * 0.9)

    const n = this.storageSegments.length
    for (let i = 0; i < n; i++) {
      const lo = i / n
      const level = clamp01((storage - lo) * n * 1.6)
      this.storageSegments[i].emissiveIntensity = level * 1.5
    }

    for (const lever of this.levers) {
      const target = lever.thrown > 0 ? 0.5 : -0.42
      lever.angle = approach(lever.angle, target, 0.07, dt)
      lever.pivot.rotation.x = lever.angle
      // A pilot lamp needs the circuit it watches to be carrying something.
      lever.pilot.emissiveIntensity = lever.thrown > 0 ? clamp01(storage * 6) * 1.4 : 0
    }
  }
}
