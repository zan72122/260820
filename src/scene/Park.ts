import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
} from 'three'
import { Rng, TAU } from '../util/math'
import { Batch } from './geom'
import { CREST_Z } from './Town'
import { makeBarkTexture, makeBeamTexture, makeGroundTexture } from '../util/textures'
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
  /** The visible cone of light under each tall lamp, brightened as night falls. */
  private beams: { mat: MeshBasicMaterial; fixture: () => number }[] = []

  constructor(rig: LightRig) {
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
    const pathBatch = new Batch()
    for (let i = 0; i < pathPts.length - 1; i++) {
      const a = pathPts[i]
      const b = pathPts[i + 1]
      const len = a.distanceTo(b)
      const mid = a.clone().add(b).multiplyScalar(0.5).setY(0.014)
      pathBatch.add(
        new PlaneGeometry(len * 1.08, 1.9),
        mid,
        { x: -Math.PI / 2, y: 0, z: -Math.atan2(b.z - a.z, b.x - a.x) },
      )
    }
    this.group.add(pathBatch.build(pathMat, { receive: true }))

    // --- edge fence: this is a hilltop, and the drop is real ----------------
    // One mesh for the whole fence: 27 posts and 52 rails would otherwise be 79
    // draw calls for something that never moves.
    const fence = new Batch()
    const postGeo = new CylinderGeometry(0.055, 0.06, 0.95, 7)
    const railGeo = new BoxGeometry(1.58, 0.07, 0.045)
    for (let i = -13; i <= 13; i++) {
      const x = i * 1.55
      const z = CREST_Z + 1.6 - Math.cos(i * 0.14) * 1.1
      fence.add(postGeo, { x, y: 0.47, z })
      if (i < 13) {
        for (const y of [0.86, 0.55]) {
          fence.add(railGeo, { x: x + 0.775, y, z: z - 0.02 }, { x: 0, y: 0.02, z: 0 })
        }
      }
    }
    this.group.add(fence.build(materials().wood, { cast: true }))

    // --- benches -----------------------------------------------------------
    const benchSpots: [number, number, number][] = [
      [4.2, 3.6, -0.55],
      [-6.6, -2.6, 0.9],
    ]
    const woodBatch = new Batch()
    const steelBatch = new Batch()
    for (const [bx, bz, ry] of benchSpots) this.addBench(woodBatch, steelBatch, bx, bz, ry)
    this.group.add(woodBatch.build(materials().wood, { cast: true, receive: true }))
    this.group.add(steelBatch.build(materials().steelDark, { cast: true }))

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
    const trunks = new Batch()
    const foliage = new Batch()
    for (const [tx, tz, s] of treeSpots) this.addTree(trunks, foliage, tx, tz, s, rng)
    this.group.add(trunks.build(barkMat, { cast: true }))
    this.group.add(foliage.build(this.leafMaterial, { cast: true }))

    // --- tier 0: path bollards, right at the child's feet -------------------
    const bollardSpots: [number, number][] = [
      [-0.6, 2.9],
      [1.6, 0.4],
      [-5.9, 1.7],
      [3.9, -1.8],
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
        emissiveGain: 0.9,
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
      const { glass, y, beam } = this.makeLampPost(x, z)
      const f = rig.add({
        group: 'benchLamps',
        index: i,
        position: new Vector3(x, y, z),
        color: WARM_LAMP,
        glass,
        dynamic: true,
        lightRange: 13,
        lightPower: 9,
        emissiveGain: 0.75,
        haloSize: 0.95,
        poolRadius: 4.6,
      })
      this.beams.push({ mat: beam, fixture: () => f.level })
    })
  }

  private addBench(wood: Batch, steel: Batch, x: number, z: number, ry: number): void {
    const rot = { x: 0, y: ry, z: 0 }
    const place = (lx: number, ly: number, lz: number) => ({
      x: x + lx * Math.cos(ry) + lz * Math.sin(ry),
      y: ly,
      z: z - lx * Math.sin(ry) + lz * Math.cos(ry),
    })
    for (const sx of [-1, 1]) {
      steel.add(new BoxGeometry(0.07, 0.42, 0.5), place(sx * 0.68, 0.21, 0.02), rot)
      steel.add(new BoxGeometry(0.06, 0.55, 0.06), place(sx * 0.68, 0.62, -0.2), {
        x: -0.16,
        y: ry,
        z: 0,
      })
    }
    for (let i = 0; i < 4; i++) {
      wood.add(new BoxGeometry(1.6, 0.045, 0.11), place(0, 0.44, -0.18 + i * 0.14), rot)
    }
    for (let i = 0; i < 3; i++) {
      wood.add(new BoxGeometry(1.6, 0.09, 0.04), place(0, 0.66 + i * 0.14, -0.24 - i * 0.022), {
        x: -0.16,
        y: ry,
        z: 0,
      })
    }
  }

  private addTree(
    trunks: Batch,
    foliage: Batch,
    x: number,
    z: number,
    scale: number,
    rng: Rng,
  ): void {
    const yaw = rng.range(0, TAU)
    const h = rng.range(3.0, 4.4) * scale
    trunks.add(
      new CylinderGeometry(0.12 * scale, 0.24 * scale, h, 8),
      { x, y: h / 2, z },
      { x: 0, y: yaw, z: 0 },
    )
    for (let i = 0; i < 4; i++) {
      const r = rng.range(0.95, 1.5) * scale
      foliage.add(
        new IcosahedronGeometry(r, 1),
        {
          x: x + rng.range(-0.9, 0.9) * scale,
          y: h * 0.86 + rng.range(-0.25, 0.85) * scale,
          z: z + rng.range(-0.9, 0.9) * scale,
        },
        { x: 0, y: yaw + i, z: 0 },
        { x: 1, y: rng.range(0.68, 0.9), z: 1 },
      )
    }
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

  private makeLampPost(
    x: number,
    z: number,
  ): { glass: MeshStandardMaterial; y: number; beam: MeshBasicMaterial } {
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

    // Flared downward over the globe, the way a park lamp shade actually is —
    // the other way round the globe pokes through its neck and glares.
    const shade = new Mesh(new CylinderGeometry(0.1, 0.32, 0.24, 14, 1, true), M.steelPaint)
    shade.position.set(0.4, H + 0.16, 0)
    shade.castShadow = true
    g.add(shade)
    const shadeCap = new Mesh(new CylinderGeometry(0.1, 0.1, 0.03, 14), M.steelPaint)
    shadeCap.position.set(0.4, H + 0.28, 0)
    g.add(shadeCap)

    const glass = new MeshStandardMaterial({
      color: new Color('#3d3626'),
      emissive: WARM_LAMP.clone(),
      emissiveIntensity: 0,
      roughness: 0.22,
      metalness: 0,
      transparent: true,
      opacity: 0.92,
    })
    const globe = new Mesh(new SphereGeometry(0.125, 14, 10), glass)
    globe.position.set(0.4, H - 0.02, 0)
    g.add(globe)

    // The beam itself: a shaft of light in the evening air, reaching the ground.
    // This is what makes the lamp read as a light source rather than a bright dot.
    const beam = new MeshBasicMaterial({
      map: makeBeamTexture(),
      color: WARM_LAMP.clone(),
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      opacity: 0,
    })
    const cone = new Mesh(new ConeGeometry(2.3, H - 0.2, 18, 1, true), beam)
    cone.position.set(0.4, (H - 0.03) - (H - 0.2) / 2, 0)
    cone.renderOrder = 5
    g.add(cone)

    return { glass, y: H - 0.03, beam }
  }

  /** Leaves pick up a cold rim as the moon rises; lamp beams thicken as it darkens. */
  update(moonAmount: number, airGlow: number): void {
    // Enough sheen for the moon to find the leaves, not enough to look like frost.
    this.leafMaterial.metalness = 0.04 + moonAmount * 0.035
    this.leafMaterial.roughness = 0.66 - moonAmount * 0.05
    for (const b of this.beams) b.mat.opacity = b.fixture() * airGlow * 0.075
  }
}

export { WARM_LAMP, COOL_LAMP }
