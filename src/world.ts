import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { buildKitchen, type Kitchen } from './scene/kitchen'
import { Lighting } from './scene/lighting'
import { ChiffonPan } from './objects/pan'
import { Chiffon } from './objects/chiffon'
import { BowlBatter } from './objects/batterBowl'
import { Ribbon } from './objects/ribbon'
import { MittPair } from './objects/mitts'
import { SeparationLine } from './objects/separation'
import { Steam, HeatHaze } from './objects/steam'
import { makeBottle, makeBowl, makeCondensation, makeCoolingRack, makePaletteKnife, makeSpatula } from './objects/props'
import type { Flavor } from './core/flavors'
import { BOTTLE } from './core/dims'

export const LAYOUT = {
  bowl: new THREE.Vector3(-0.16, 0, 0.1),
  panRest: new THREE.Vector3(0.02, 0, 0.06),
  panOven: new THREE.Vector3(-0.52, 0.087, -0.68),
  panHold: new THREE.Vector3(0.0, 0.3, 0.1),
  bottle: new THREE.Vector3(0.0, 0, 0.02),
  /** Pan-root height when the pan hangs upside-down on the bottle neck. */
  mountY: 0.182,
  rack: new THREE.Vector3(0.5, 0, -0.46),
}

export type Quality = 'high' | 'low'

export class World {
  readonly scene = new THREE.Scene()
  readonly kitchen: Kitchen
  readonly lighting: Lighting
  readonly pan = new ChiffonPan()
  chiffon: Chiffon
  readonly bowl = new THREE.Group()
  readonly bowlMesh = makeBowl()
  bowlBatter: BowlBatter
  readonly spatula = makeSpatula()
  ribbon: Ribbon
  readonly bottle = makeBottle()
  readonly condensation = makeCondensation()
  readonly knife = makePaletteKnife()
  readonly mitts = new MittPair(0.112)
  readonly wallSeam = new SeparationLine(0.0776, 0.0975, 0.0505, 1.096)
  readonly tubeSeam = new SeparationLine(0.0252, 0.1, 0.0515, 0.877)
  readonly steam = new Steam(130, 0.09, 0.2)
  readonly haze = new HeatHaze(0.3)
  readonly cakeAnchor = new THREE.Object3D()
  readonly clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.0006)
  private pmrem?: THREE.PMREMGenerator

  constructor(
    renderer: THREE.WebGLRenderer,
    public quality: Quality,
    flavor: Flavor,
  ) {
    this.scene.background = new THREE.Color(0xe9e2d6)
    this.scene.fog = new THREE.Fog(0xe4ddd1, 0.95, 3.4)

    this.pmrem = new THREE.PMREMGenerator(renderer)
    const env = this.pmrem.fromScene(new RoomEnvironment(), 0.02)
    this.scene.environment = env.texture
    this.scene.environmentIntensity = 0.55

    this.kitchen = buildKitchen(quality)
    this.lighting = new Lighting(quality)
    this.scene.add(this.kitchen.root, this.lighting.root)

    // --- mixing station ---
    this.bowlBatter = new BowlBatter(flavor)
    this.bowl.add(this.bowlMesh, this.bowlBatter.mesh)
    this.bowl.position.copy(LAYOUT.bowl)
    this.bowlBatter.mesh.position.y = 0.045
    this.spatula.position.set(-0.16, 0.16, 0.16)
    this.spatula.visible = false

    // --- pan + cake ---
    this.chiffon = new Chiffon(flavor, quality)
    this.pan.contents.add(this.chiffon.group)
    this.pan.root.position.copy(LAYOUT.panRest)
    this.pan.flipPivot.add(this.mitts.root)
    this.pan.contents.add(this.wallSeam.mesh, this.tubeSeam.mesh)

    this.ribbon = new Ribbon(flavor)

    // --- cooling station ---
    this.bottle.position.copy(LAYOUT.bottle)
    this.bottle.visible = false
    this.bottle.add(this.condensation)
    this.knife.visible = false

    const rack = makeCoolingRack()
    rack.position.copy(LAYOUT.rack)

    this.scene.add(
      this.bowl,
      this.spatula,
      this.pan.root,
      this.ribbon.mesh,
      this.bottle,
      this.knife,
      this.steam.points,
      this.haze.mesh,
      this.cakeAnchor,
      rack,
    )
    this.haze.mesh.visible = false
    this.steam.amount = 0
  }

  /** Short cut-away moments: clip the half nearest the camera, show the crumb. */
  setCutaway(on: boolean) {
    const planes = on ? [this.clipPlane] : []
    this.chiffon.setClipping(planes)
    this.pan.material.clippingPlanes = planes
    this.pan.material.clipShadows = on
    this.pan.material.needsUpdate = true
    this.chiffon.setCutaway(on)
  }

  /** Orient the cut so it always faces whoever is watching. */
  aimCutaway(camera: THREE.Camera) {
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    dir.y = 0
    dir.normalize()
    this.clipPlane.normal.copy(dir)
    const p = this.pan.root.position
    this.clipPlane.constant = -dir.dot(p) + 0.0006
    const ang = Math.atan2(dir.x, dir.z)
    this.chiffon.cut.rotation.y = ang + Math.PI
  }

  /** Move the finished cake from inside the pan onto the bench. */
  detachCake() {
    this.pan.root.updateWorldMatrix(true, true)
    const pos = new THREE.Vector3()
    this.chiffon.group.getWorldPosition(pos)
    this.cakeAnchor.position.copy(pos)
    this.cakeAnchor.rotation.set(0, 0, 0)
    this.cakeAnchor.add(this.chiffon.group)
    this.chiffon.group.position.set(0, 0, 0)
    this.chiffon.group.rotation.set(0, 0, 0)
  }

  reattachCake() {
    this.pan.contents.add(this.chiffon.group)
    this.chiffon.group.position.set(0, 0, 0)
    this.chiffon.group.rotation.set(0, 0, 0)
  }

  setFlavor(f: Flavor) {
    this.bowlBatter.setFlavor(f)
    this.ribbon.setFlavor(f)
  }

  /** A new flavour means a new crumb, a new crust and a new crack pattern. */
  rebuildChiffon(f: Flavor) {
    this.chiffon.group.removeFromParent()
    this.chiffon.mesh.geometry.dispose()
    this.chiffon.cut.geometry.dispose()
    this.chiffon = new Chiffon(f, this.quality)
    this.pan.contents.add(this.chiffon.group)
  }

  /** Put the whole bench back to its opening state for another go. */
  reset(f: Flavor) {
    this.setFlavor(f)
    this.rebuildChiffon(f)
    this.chiffon.setFill(0)
    this.chiffon.setRise(0)
    this.chiffon.setPress(0)
    this.chiffon.setBake(0)
    this.setCutaway(false)
    this.pan.root.position.copy(LAYOUT.panRest)
    this.pan.root.rotation.set(0, 0, 0)
    this.pan.flipPivot.rotation.set(0, 0, 0)
    this.pan.heat = 0
    this.bowl.position.copy(LAYOUT.bowl)
    this.bowl.rotation.set(0, 0, 0)
    this.bowlBatter.update(0.016, 0, 0.045)
    this.bowlBatter.setBubbleVisibility(0)
    this.ribbon.visible = false
    this.spatula.visible = false
    this.bottle.visible = false
    this.bottle.position.copy(LAYOUT.bottle)
    ;(this.condensation.material as THREE.PointsMaterial).opacity = 0
    this.knife.visible = false
    this.mitts.root.visible = false
    this.mitts.root.position.set(0, 0, 0)
    this.mitts.grip = 0
    this.steam.amount = 0
    this.haze.mesh.visible = false
    this.wallSeam.reset()
    this.tubeSeam.reset()
    this.kitchen.oven.open = 0
    this.kitchen.oven.glassFade = 1
    this.lighting.setWarmth(0)
  }

  /** World position of the bottle's neck opening. */
  get bottleMouth() {
    return new THREE.Vector3(LAYOUT.bottle.x, BOTTLE.height, LAYOUT.bottle.z)
  }

  dispose() {
    this.pmrem?.dispose()
  }
}
