import * as THREE from 'three'
import { Sim, Phase } from './sim'
import { L } from './layout'
import { damp, smoothstep, clamp } from './util'

// Camera choreography: four core framings (overview / weight / align / seating)
// plus sequence shots, with separate paths for portrait and landscape.
// Transitions are always smoothly damped — cause and effect are never cut apart.

interface Shot { pos: THREE.Vector3, look: THREE.Vector3, fov: number }

const tmpShot: Shot = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 55 }

export class CameraRig {
  camera: THREE.PerspectiveCamera
  private curPos = new THREE.Vector3()
  private curLook = new THREE.Vector3()
  private curFov = 55
  private lam = 1.6
  private shakeT = 1e9

  // small decaying jolt when the mass meets its supports
  impulse() { this.shakeT = 0 }

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.3, 400)
    this.curPos.set(-13, 13, 21)
    this.curLook.set(2, 2.4, 1)
  }

  private computeShot(sim: Sim, portrait: boolean): Shot {
    const s = tmpShot
    const carY = sim.carY, carZ = sim.carZ, carX = sim.carX
    const dockY = L.dockUndersideY

    // stage detection
    const weightStage = (sim.phase === Phase.LIFT) && (sim.tension > 0.04 || sim.airborne) && carY < L.clearHeight * 0.72
    const seatingStage = (sim.phase === Phase.DESCEND && sim.airborne && (carY - dockY) < 1.15)
      || sim.phase === Phase.SEATED || sim.phase === Phase.UNHOOK

    if (sim.phase === Phase.LIGHTS) {
      // front 3/4 of the waking cab (inside the crane carrier's sightline)
      if (portrait) { s.pos.set(carX - 10.5, 3.0, 6.2); s.look.set(carX - 4.5, 4.9, 0); s.fov = 58 }
      else { s.pos.set(carX - 11.5, 3.2, 6.8); s.look.set(carX - 4, 4.8, 0); s.fov = 50 }
      this.lam = 1.0
      return s
    }
    if (sim.phase === Phase.MOVER_IN || sim.phase === Phase.TOW) {
      // wide: car + bogies roll away as one vehicle
      if (portrait) { s.pos.set(carX + 9, 4.2, 15.5); s.look.set(carX - 4, 4.6, 0); s.fov = 66 }
      else { s.pos.set(carX + 12, 5.2, 15); s.look.set(carX - 5, 4.2, 0); s.fov = 52 }
      this.lam = 1.1
      return s
    }
    if (seatingStage) {
      // side closeup on the near bogie interface; car-over-bogie stays readable
      const bx = 4.6
      const t = smoothstep(1.15, 0.1, carY - dockY)
      if (portrait) {
        s.pos.set(bx - 4.6, dockY + 2.9 - t * 1.0, 10.8 - t * 2.2)
        s.look.set(bx + 0.4, dockY + 0.2 + (carY - dockY) * 0.4, 0)
        s.fov = 56
      } else {
        s.pos.set(bx - 5.6, dockY + 2.6 - t * 0.9, 10.2 - t * 1.9)
        s.look.set(bx + 1.0, dockY + 0.25 + (carY - dockY) * 0.4, 0)
        s.fov = 48
      }
      this.lam = 1.5
      return s
    }
    if (weightStage) {
      // low to the ground: gap under the body, taut wires against the sky
      if (portrait) {
        s.pos.set(-12.5, 1.2, carZ + 10.6)
        s.look.set(1, carY + 1.4, carZ - 0.6)
        s.fov = 62
      } else {
        s.pos.set(-13.5, 1.3, carZ + 10.8)
        s.look.set(1.5, carY + 1.0, carZ)
        s.fov = 52
      }
      this.lam = 1.2
      return s
    }
    if (sim.phase === Phase.TRANSPORT || sim.phase === Phase.DESCEND) {
      // elevated 3/4: lateral offset to the bogies is readable
      const mid = (carZ + 0) / 2
      if (portrait) {
        s.pos.set(-10.5, carY + 6.5, mid + 11)
        s.look.set(0, carY - 1.2, mid - 1)
        s.fov = 62
      } else {
        s.pos.set(-12.5, carY + 6.0, mid + 10.5)
        s.look.set(0, carY - 1.5, mid - 0.5)
        s.fov = 52
      }
      this.lam = 1.4
      return s
    }
    // OVERVIEW: down the beam — both waiting bogies in a row, body on its
    // trailer beside them, cranes framing above. "The train and its wheels
    // are separate" reads in one glance.
    if (portrait) {
      s.pos.set(-11, 13.5, 21.5)
      s.look.set(1.6, 2.4, 0.8)
      s.fov = 60
    } else {
      s.pos.set(-12, 12.0, 19)
      s.look.set(1.5, 2.0, 1.5)
      s.fov = 54
    }
    this.lam = 1.0
    return s
  }

  update(sim: Sim, dt: number, aspect: number) {
    const portrait = aspect < 1
    const shot = this.computeShot(sim, portrait)
    const k = this.lam
    this.curPos.x = damp(this.curPos.x, shot.pos.x, k, dt)
    this.curPos.y = damp(this.curPos.y, shot.pos.y, k, dt)
    this.curPos.z = damp(this.curPos.z, shot.pos.z, k, dt)
    this.curLook.x = damp(this.curLook.x, shot.look.x, k * 1.2, dt)
    this.curLook.y = damp(this.curLook.y, shot.look.y, k * 1.2, dt)
    this.curLook.z = damp(this.curLook.z, shot.look.z, k * 1.2, dt)
    this.curFov = damp(this.curFov, shot.fov, 1.5, dt)

    this.camera.aspect = aspect
    this.camera.fov = clamp(this.curFov, 30, 80)
    this.camera.position.copy(this.curPos)
    this.shakeT += dt
    if (this.shakeT < 0.5) {
      const a = Math.exp(-7 * this.shakeT) * 0.035
      this.camera.position.y += Math.sin(this.shakeT * 62) * a
      this.camera.position.x += Math.sin(this.shakeT * 47 + 1.3) * a * 0.6
    }
    this.camera.lookAt(this.curLook)
    this.camera.updateProjectionMatrix()
  }
}
