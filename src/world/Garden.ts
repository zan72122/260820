import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  Vector2,
} from 'three'
import { bakeGround, bakeLeafCard, bakeWood } from '../gfx/textures'
import { makeRng } from '../gfx/noise'

/**
 * Everything that is not bamboo, water, somen or chopsticks: the ground the
 * flume stands on, the veranda behind it, the trees, and — most importantly —
 * the leaves overhead whose shadows fall across the whole scene.
 */
export class Garden {
  readonly group = new Group()
  readonly shadowLeaves: { mesh: Mesh; phase: number; amp: number }[] = []

  constructor() {
    const rng = makeRng(4242)

    // ---- ground -----------------------------------------------------------
    const g = bakeGround()
    for (const t of [g.map, g.roughnessMap, g.normalMap]) {
      t.wrapS = t.wrapT = RepeatWrapping
      t.repeat.set(26, 26)
    }
    const groundMat = new MeshStandardMaterial({
      map: g.map,
      roughnessMap: g.roughnessMap,
      normalMap: g.normalMap,
      normalScale: new Vector2(1.1, 1.1),
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.85,
    })
    const ground = new Mesh(new PlaneGeometry(70, 70, 1, 1), groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.set(-4, 0, -3)
    ground.receiveShadow = true
    this.group.add(ground)

    // ---- stepping stones beside the flume ---------------------------------
    const stoneMat = new MeshStandardMaterial({ color: 0x7d7a72, roughness: 0.92, metalness: 0 })
    const stoneGeo = new CylinderGeometry(0.21, 0.23, 0.075, 9)
    for (let i = 0; i < 7; i++) {
      const s = new Mesh(stoneGeo, stoneMat)
      s.position.set(0.85 + rng() * 0.25, 0.03, 2.4 - i * 0.86 + rng() * 0.2)
      s.rotation.y = rng() * 3
      s.scale.set(1 + rng() * 0.25, 1, 0.78 + rng() * 0.3)
      s.receiveShadow = true
      s.castShadow = i < 4
      this.group.add(s)
    }

    // ---- the veranda behind the flume -------------------------------------
    this.group.add(this.buildEngawa())

    // ---- trees ------------------------------------------------------------
    this.group.add(this.buildTrees(rng))

    // ---- leaves overhead: these cast the moving dapple --------------------
    this.group.add(this.buildCanopy(rng))
  }

  private buildEngawa(): Group {
    const g = new Group()
    const w = bakeWood()
    for (const t of [w.map, w.roughnessMap, w.normalMap]) {
      t.wrapS = t.wrapT = RepeatWrapping
      t.repeat.set(6, 2)
    }
    const wood = new MeshStandardMaterial({
      map: w.map,
      roughnessMap: w.roughnessMap,
      normalMap: w.normalMap,
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.7,
    })

    // deck
    const deck = new Mesh(new BoxGeometry(1.9, 0.11, 9.5), wood)
    deck.position.set(-4.6, 0.44, -1.4)
    deck.receiveShadow = true
    deck.castShadow = true
    g.add(deck)

    // shoji wall
    const paper = new MeshStandardMaterial({ color: 0xe9e2cd, roughness: 0.88, metalness: 0 })
    const wall = new Mesh(new BoxGeometry(0.09, 1.95, 9.5), paper)
    wall.position.set(-5.5, 1.42, -1.4)
    wall.receiveShadow = true
    g.add(wall)
    const frameMat = new MeshStandardMaterial({ color: 0x4a3524, roughness: 0.72, metalness: 0 })
    for (let i = 0; i < 10; i++) {
      const m = new Mesh(new BoxGeometry(0.05, 1.95, 0.05), frameMat)
      m.position.set(-5.44, 1.42, -6.1 + i * 1.05)
      g.add(m)
    }
    for (let i = 0; i < 4; i++) {
      const m = new Mesh(new BoxGeometry(0.05, 0.045, 9.5), frameMat)
      m.position.set(-5.44, 0.62 + i * 0.52, -1.4)
      g.add(m)
    }

    // deep eave — the dark band that reads as "indoors" behind the light
    const eave = new Mesh(new BoxGeometry(2.9, 0.13, 10.2), frameMat)
    eave.position.set(-4.9, 2.55, -1.4)
    eave.castShadow = true
    g.add(eave)
    for (const z of [-5.4, -2.4, 0.6, 3.1]) {
      const post = new Mesh(new BoxGeometry(0.1, 2.1, 0.1), frameMat)
      post.position.set(-3.78, 1.5, z)
      post.castShadow = true
      g.add(post)
    }
    return g
  }

  private buildTrees(rng: () => number): Group {
    const g = new Group()
    const barkMat = new MeshStandardMaterial({ color: 0x4b4237, roughness: 0.95, metalness: 0 })
    const tints: [number, number, number][] = [
      [92, 138, 58],
      [64, 112, 48],
      [120, 156, 70],
    ]
    const leafTex = tints.map((t, i) => bakeLeafCard(700 + i * 31, t))
    const leafMats = leafTex.map(
      (t) =>
        new MeshStandardMaterial({
          map: t,
          transparent: true,
          alphaTest: 0.42,
          side: DoubleSide,
          roughness: 0.82,
          metalness: 0,
          envMapIntensity: 1.1,
        }),
    )

    const trees = [
      { x: -9.5, z: -7.5, h: 5.6, r: 2.9 },
      { x: -12.5, z: 1.5, h: 6.6, r: 3.4 },
      { x: -7.5, z: 6.5, h: 4.6, r: 2.4 },
      { x: 4.5, z: -9.5, h: 5.0, r: 2.7 },
      { x: 9.0, z: -2.0, h: 6.0, r: 3.1 },
      { x: -16.0, z: -6.0, h: 7.2, r: 3.8 },
    ]
    for (const t of trees) {
      const trunk = new Mesh(new CylinderGeometry(0.11, 0.2, t.h, 7), barkMat)
      trunk.position.set(t.x, t.h / 2, t.z)
      g.add(trunk)
      const clusters = 5
      for (let i = 0; i < clusters; i++) {
        const mat = leafMats[Math.floor(rng() * leafMats.length)]
        const card = new Mesh(new PlaneGeometry(t.r * (0.9 + rng() * 0.4), t.r * (0.75 + rng() * 0.35)), mat)
        card.position.set(
          t.x + (rng() - 0.5) * t.r * 0.9,
          t.h * (0.72 + rng() * 0.3),
          t.z + (rng() - 0.5) * t.r * 0.9,
        )
        card.rotation.y = rng() * Math.PI
        card.rotation.z = (rng() - 0.5) * 0.4
        g.add(card)
      }
    }

    // a low hedge / bamboo grove line to close the mid distance
    const hedgeMat = leafMats[1]
    for (let i = 0; i < 14; i++) {
      const card = new Mesh(new PlaneGeometry(2.4, 1.7), hedgeMat)
      card.position.set(-8.5 + (rng() - 0.5) * 1.6, 0.9 + rng() * 0.35, -9 + i * 1.5)
      card.rotation.y = Math.PI / 2 + (rng() - 0.5) * 0.5
      g.add(card)
    }
    return g
  }

  /**
   * A branch reaching over the flume. Its leaves are the only shadow casters
   * that matter — they are what makes the bamboo look like it is outdoors.
   */
  private buildCanopy(rng: () => number): Group {
    const g = new Group()
    const barkMat = new MeshStandardMaterial({ color: 0x4b4237, roughness: 0.95, metalness: 0 })
    const trunk = new Mesh(new CylinderGeometry(0.15, 0.26, 5.4, 8), barkMat)
    trunk.position.set(2.9, 2.7, -3.2)
    trunk.castShadow = true
    g.add(trunk)
    const branch = new Mesh(new CylinderGeometry(0.05, 0.11, 3.2, 6), barkMat)
    branch.position.set(1.6, 3.35, -2.7)
    branch.rotation.z = Math.PI / 2.35
    branch.rotation.y = 0.4
    branch.castShadow = true
    g.add(branch)

    const tex = bakeLeafCard(1234, [88, 132, 54])
    const mat = new MeshStandardMaterial({
      map: tex,
      transparent: false,
      alphaTest: 0.5,
      side: DoubleSide,
      roughness: 0.78,
      metalness: 0,
      envMapIntensity: 1.1,
    })
    const spots = [
      [0.5, 3.1, -2.3],
      [-0.4, 3.25, -1.1],
      [0.9, 3.0, -0.2],
      [-0.1, 3.35, 0.9],
      [0.6, 3.15, 1.9],
      [-0.8, 3.3, -3.1],
      [1.4, 3.05, 0.8],
    ]
    for (const [x, y, z] of spots) {
      const card = new Mesh(new PlaneGeometry(1.5 + rng() * 0.7, 1.2 + rng() * 0.6), mat)
      card.position.set(x, y, z)
      card.rotation.set(-Math.PI / 2 + (rng() - 0.5) * 0.5, rng() * Math.PI, 0)
      card.castShadow = true
      card.receiveShadow = false
      g.add(card)
      this.shadowLeaves.push({ mesh: card, phase: rng() * 6.28, amp: 0.02 + rng() * 0.035 })
    }
    return g
  }

  /** Gentle sway, so the dapple on the bamboo is never static. */
  update(time: number): void {
    for (const l of this.shadowLeaves) {
      l.mesh.rotation.z = Math.sin(time * 0.42 + l.phase) * l.amp * 6
      l.mesh.position.y += Math.sin(time * 0.63 + l.phase) * 0.00012
    }
  }
}
