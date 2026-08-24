import * as THREE from 'three'
import { MaterialKit } from './materials'
import { L } from './layout'

// Rigging per crane: hook block -> short wire legs -> spreader beam across the
// car width -> two woven web slings down to the sill lifting brackets.
// Slings visibly go slack (bow outward) when they carry no load.

export interface Rig {
  group: THREE.Group
  update(hookWorld: THREE.Vector3, bracketA: THREE.Vector3, bracketB: THREE.Vector3, tension: number, visible: boolean): void
}

const UP = new THREE.Vector3(0, 1, 0)

function orientBetween(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
  const mid = a.clone().add(b).multiplyScalar(0.5)
  const d = a.clone().sub(b)
  mesh.position.copy(mid)
  mesh.scale.y = d.length()
  mesh.quaternion.setFromUnitVectors(UP, d.normalize())
}

export function buildRig(mats: MaterialKit): Rig {
  const g = new THREE.Group()

  // spreader beam (painted yellow, rated-load stencil plate)
  const spreader = new THREE.Group()
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, L.spreaderLen), mats.craneYellow)
  beam.castShadow = true
  spreader.add(beam)
  for (const s of [-1, 1]) {
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.16), mats.hookSteel)
    lug.position.set(0, 0.2, s * (L.spreaderLen / 2 - 0.12))
    spreader.add(lug)
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.024, 8, 14, Math.PI), mats.machinedSteel)
    shackle.position.set(0, -0.16, s * (L.spreaderLen / 2 - 0.12))
    shackle.rotation.z = Math.PI
    shackle.rotation.y = Math.PI / 2
    spreader.add(shackle)
  }
  g.add(spreader)

  // wire legs hook -> spreader ends (stay taut: spreader weight keeps them straight)
  const legGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 6)
  const legs = [new THREE.Mesh(legGeo, mats.wireRope), new THREE.Mesh(legGeo, mats.wireRope)]
  legs.forEach(l => g.add(l))

  // web slings: tubes along quadratic curves, flattened to read as belts
  const slings: THREE.Mesh[] = []
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), mats.sling)
    m.castShadow = true
    slings.push(m)
    g.add(m)
  }

  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3()

  function updateSling(mesh: THREE.Mesh, top: THREE.Vector3, bottom: THREE.Vector3, tension: number) {
    const dist = top.distanceTo(bottom)
    const slack = Math.max(0, L.slingLen - dist)
    // slack belts bow outward (away from car center) and down
    const outDir = Math.sign(bottom.z - top.z) || 1
    const mid = top.clone().add(bottom).multiplyScalar(0.5)
    mid.z += outDir * slack * 1.1 + (1 - tension) * 0.02
    mid.y -= slack * 0.45
    const curve = new THREE.QuadraticBezierCurve3(top, mid, bottom)
    const geo = new THREE.TubeGeometry(curve, 10, 0.042, 6)
    // flatten tube into a belt profile
    const pos = geo.attributes.position as THREE.BufferAttribute
    mesh.geometry.dispose()
    mesh.geometry = geo
    mesh.scale.set(1, 1, 1)
    void pos
  }

  function update(hookWorld: THREE.Vector3, bracketA: THREE.Vector3, bracketB: THREE.Vector3, tension: number, visible: boolean) {
    g.visible = visible
    if (!visible) return
    const spreaderY = hookWorld.y - L.spreaderDrop
    // spreader centers between brackets horizontally when carrying, else below hook
    const cx = tension > 0.5 ? (bracketA.x + bracketB.x) / 2 : hookWorld.x
    const cz = (bracketA.z + bracketB.z) / 2
    const mixX = cx * tension + hookWorld.x * (1 - tension)
    const mixZ = cz * Math.min(1, tension + 0.55) + hookWorld.z * Math.max(0, 0.45 - tension)
    spreader.position.set(mixX, spreaderY, mixZ)

    for (const [i, s] of [-1, 1].entries()) {
      tmpA.set(spreader.position.x, spreaderY + 0.14, spreader.position.z + s * (L.spreaderLen / 2 - 0.12))
      orientBetween(legs[i], hookWorld.clone().setY(hookWorld.y - 0.92), tmpA)
      tmpB.set(spreader.position.x, spreaderY - 0.18, spreader.position.z + s * (L.spreaderLen / 2 - 0.12))
      const bracket = s > 0 ? (bracketA.z > bracketB.z ? bracketA : bracketB) : (bracketA.z > bracketB.z ? bracketB : bracketA)
      updateSling(slings[i], tmpB.clone(), bracket, tension)
    }
  }

  return { group: g, update }
}
