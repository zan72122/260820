import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
} from 'three'
import { Rng, TAU } from '../util/math'
import { CREST_Z } from './Town'
import { makeBarkTexture, makeGroundTexture } from '../util/textures'
import type { LightRig } from './Lights'
import { materials } from './materials'

const WARM_LAMP = new Color('#ffcf8e')
const COOL_LAMP = new Color('#f2e6c8')

/**
 * The hilltop park itself: the ground the swing stands on, the path, the benches,
 * the trees, the edge fence, and the two nearest rings of lighting.
 */
export class Park {
  readonly group = new Group()
  readonly leafMaterial: MeshStandardMaterial

  constructor(rig: LightRig) {
    const M = materials()
    const rng = new Rng(20260821)

    // --- ground ------------------------------------------------------------
    // The plateau stops dead on the crest line, where the hillside takes over.
    const groundTex = makeGroundTexture(512)
    groundTex.repeat.set(58, 29)
    const PLATEAU_D = 110
    const ground = new Mesh(
      new PlaneGeometry(220, PLATEAU_D, 1, 1),
      new MeshStandardMaterial({ map: groundTex, roughness: 0.96, metalness: 0 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.z = CREST_Z + PLATEAU_D / 2
    ground.receiveShadow = true
    this.group.add(ground)


    // gravel path sweeping past the swing and the clock
    const pathMat = new MeshStandardMaterial({ color: new Color('#5d574d'), roughness: 0.95, metalness: 0 })
    const pathPts: Vector3[] = []
    for (let i = 0; i <= 16; i++) {
      const t = i / 16
      pathPts.push(new Vector3(-11 + t * 24, 0.014, 5.6 - Math.sin(t * 2.3) * 4.6 - t * 2.4))
    }
    for (let i = 0; i < pathPts.length - 1; i++) {
      const a = pathPts[i]
      const b = pathPts[i + 1]
      const len = a.distanceTo(b)
      const seg = new Mesh(new PlaneGeometry(len * 1.08, 1.9), pathMat)
      seg.rotation.x = -Math.PI / 2
      seg.rotation.z = -Math.atan2(b.z - a.z, b.x - a.x)
      seg.position.copy(a).add(b).multiplyScalar(0.5).setY(0.014)
      seg.receiveShadow = true
      this.group.add(seg)
    }

    // --- edge fence: this is a hilltop, and the drop is real ----------------
    const fence = new Group()
    this.group.add(fence)
    for (let i = -13; i <= 13; i++) {
      const x = i * 1.55
      const z = CREST_Z + 1.6 - Math.cos(i * 0.14) * 1.1
      const post = new Mesh(new CylinderGeometry(0.055, 0.06, 0.95, 7), M.wood)
      post.position.set(x, 0.47, z)
      post.castShadow = true
      fence.add(post)
      if (i < 13) {
        for (const y of [0.86, 0.55]) {
          const rail = new Mesh(new BoxGeometry(1.58, 0.07, 0.045), M.wood)
          rail.position.set(x + 0.775, y, z - 0.02)
          rail.rotation.y = 0.02
          fence.add(rail)
        }
      }
    }

    // --- benches -----------------------------------------------------------
    const benchSpots: [number, number, number][] = [
      [4.2, 3.6, -0.55],
      [-6.6, -2.6, 0.9],
    ]
    for (const [bx, bz, ry] of benchSpots) this.group.add(this.makeBench(bx, bz, ry))

    // --- trees -------------------------------------------------------------
    const barkTex = makeBarkTexture(128)
    barkTex.repeat.set(2, 3)
    const barkMat = new MeshStandardMaterial({ map: barkTex, roughness: 0.9, metalness: 0 })
    // Leaves keep a little sheen so moonlight can catch them later in the evening.
    this.leafMaterial = new MeshStandardMaterial({
      color: new Color('#3b5039'),
      roughness: 0.62,
      metalness: 0.06,
      flatShading: true,
    })
    // Nothing within reach of the lens: the camera stands around (2..5, 4..5, 11..13).
    // Kept off two sightlines: the lens (around x 2..5, z 11..13) and the
    // swing/clock pair, which must never be occluded while the link is being learnt.
    const treeSpots: [number, number, number][] = [
      [-14.0, -6.0, 1.4],
      [13.0, -8.0, 1.2],
      [-9.5, 6.5, 1.3],
      [9.5, 6.0, 1.1],
      [-24.0, -13.0, 1.5],
      [24.0, -13.0, 1.3],
      [-20.5, 3.5, 1.25],
      [20.5, 4.5, 1.15],
    ]
    for (const [tx, tz, s] of treeSpots) {
      this.group.add(this.makeTree(tx, tz, s, barkMat, rng))
    }

    // --- tier 0: path bollards, right at the child's feet -------------------
    const bollardSpots: [number, number][] = [
      [-1.15, 2.35],
      [1.05, 0.55],
      [-5.9, 1.7],
      [3.5, -1.4],
      [-8.6, 3.6],
    ]
    bollardSpots.forEach(([x, z], i) => {
      const { glass } = this.makeBollard(x, z)
      rig.add({
        group: 'pathLights',
        index: i,
        position: new Vector3(x, 0.86, z),
        color: WARM_LAMP,
        glass,
        // No dynamic light here: a strong ground pool and a halo read the same
        // and cost nothing, which keeps the light budget for the tall lamps.
        lightRange: 5.2,
        lightPower: 2.6,
        haloSize: 0.9,
        poolRadius: 2.2,
      })
    })

    // --- tier 1: full-height park lamps around the benches ------------------
    const lampSpots: [number, number][] = [
      [2.6, 2.6],
      [-6.4, -1.6],
      [7.6, -4.2],
    ]
    lampSpots.forEach(([x, z], i) => {
      const { glass, y } = this.makeLampPost(x, z)
      rig.add({
        group: 'benchLamps',
        index: i,
        position: new Vector3(x, y, z),
        color: WARM_LAMP,
        glass,
        dynamic: true,
        lightRange: 13,
        lightPower: 9,
        haloSize: 2.4,
        poolRadius: 4.6,
      })
    })
  }

  private makeBench(x: number, z: number, ry: number): Group {
    const M = materials()
    const g = new Group()
    g.position.set(x, 0, z)
    g.rotation.y = ry
    for (const sx of [-1, 1]) {
      const leg = new Mesh(new BoxGeometry(0.07, 0.42, 0.5), M.steelDark)
      leg.position.set(sx * 0.68, 0.21, 0.02)
      leg.castShadow = true
      g.add(leg)
      const backLeg = new Mesh(new BoxGeometry(0.06, 0.55, 0.06), M.steelDark)
      backLeg.position.set(sx * 0.68, 0.62, -0.2)
      backLeg.rotation.x = -0.16
      g.add(backLeg)
    }
    for (let i = 0; i < 4; i++) {
      const slat = new Mesh(new BoxGeometry(1.6, 0.045, 0.11), M.wood)
      slat.position.set(0, 0.44, -0.18 + i * 0.14)
      slat.castShadow = true
      slat.receiveShadow = true
      g.add(slat)
    }
    for (let i = 0; i < 3; i++) {
      const slat = new Mesh(new BoxGeometry(1.6, 0.09, 0.04), M.wood)
      slat.position.set(0, 0.66 + i * 0.14, -0.24 - i * 0.022)
      slat.rotation.x = -0.16
      g.add(slat)
    }
    return g
  }

  private makeTree(
    x: number,
    z: number,
    scale: number,
    bark: MeshStandardMaterial,
    rng: Rng,
  ): Group {
    const g = new Group()
    g.position.set(x, 0, z)
    g.scale.setScalar(scale)
    g.rotation.y = rng.range(0, TAU)

    const h = rng.range(3.0, 4.4)
    const trunk = new Mesh(new CylinderGeometry(0.12, 0.24, h, 8), bark)
    trunk.position.y = h / 2
    trunk.castShadow = true
    g.add(trunk)

    const clusters = 4
    for (let i = 0; i < clusters; i++) {
      const r = rng.range(0.95, 1.5)
      const blob = new Mesh(new IcosahedronGeometry(r, 1), this.leafMaterial)
      blob.position.set(
        rng.range(-0.9, 0.9),
        h * 0.86 + rng.range(-0.25, 0.85),
        rng.range(-0.9, 0.9),
      )
      blob.scale.set(1, rng.range(0.68, 0.9), 1)
      blob.castShadow = true
      g.add(blob)
    }
    return g
  }

  private makeBollard(x: number, z: number): { glass: MeshStandardMaterial } {
    const M = materials()
    const g = new Group()
    g.position.set(x, 0, z)
    this.group.add(g)

    const base = new Mesh(new CylinderGeometry(0.11, 0.14, 0.1, 10), M.concrete)
    base.position.y = 0.05
    g.add(base)
    const post = new Mesh(new CylinderGeometry(0.075, 0.085, 0.78, 10), M.steelPaint)
    post.position.y = 0.44
    post.castShadow = true
    g.add(post)

    const glass = new MeshStandardMaterial({
      color: new Color('#3a3428'),
      emissive: WARM_LAMP.clone(),
      emissiveIntensity: 0,
      roughness: 0.32,
      metalness: 0,
      transparent: true,
      opacity: 0.94,
    })
    const lens = new Mesh(new CylinderGeometry(0.078, 0.078, 0.11, 10), glass)
    lens.position.y = 0.87
    g.add(lens)
    // downward cowl so light goes to the path, not into the sky
    const cowl = new Mesh(new CylinderGeometry(0.1, 0.075, 0.07, 10), M.steelPaint)
    cowl.position.y = 0.955
    g.add(cowl)
    return { glass }
  }

  private makeLampPost(x: number, z: number): { glass: MeshStandardMaterial; y: number } {
    const M = materials()
    const g = new Group()
    g.position.set(x, 0, z)
    this.group.add(g)

    const H = 3.55
    const base = new Mesh(new CylinderGeometry(0.16, 0.2, 0.22, 12), M.concrete)
    base.position.y = 0.11
    g.add(base)
    const pole = new Mesh(new CylinderGeometry(0.06, 0.09, H, 12), M.steelPaint)
    pole.position.y = H / 2 + 0.15
    pole.castShadow = true
    g.add(pole)
    const arm = new Mesh(new CylinderGeometry(0.045, 0.045, 0.42, 8), M.steelPaint)
    arm.rotation.z = Math.PI / 2
    arm.position.set(0.2, H + 0.12, 0)
    g.add(arm)

    const shade = new Mesh(new CylinderGeometry(0.26, 0.1, 0.2, 12, 1, true), M.steelPaint)
    shade.position.set(0.4, H + 0.06, 0)
    shade.castShadow = true
    g.add(shade)

    const glass = new MeshStandardMaterial({
      color: new Color('#3d3626'),
      emissive: WARM_LAMP.clone(),
      emissiveIntensity: 0,
      roughness: 0.22,
      metalness: 0,
      transparent: true,
      opacity: 0.92,
    })
    const globe = new Mesh(new SphereGeometry(0.13, 14, 10), glass)
    globe.position.set(0.4, H - 0.03, 0)
    g.add(globe)

    return { glass, y: H - 0.03 }
  }

  /** Leaves pick up a cold rim as the moon rises. */
  update(moonAmount: number): void {
    this.leafMaterial.metalness = 0.06 + moonAmount * 0.16
    this.leafMaterial.roughness = 0.62 - moonAmount * 0.12
  }
}

export { WARM_LAMP, COOL_LAMP }
