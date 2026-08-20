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
 * flume stands on, the veranda behind it, the trees that close off the
 * distance, and — most importantly — the leaves overhead, whose shadows fall
 * across the whole scene and make it read as a real afternoon.
 */
export class Garden {
  readonly group = new Group()
  readonly shadowLeaves: { mesh: Mesh; phase: number; amp: number; y0: number }[] = []

  constructor() {
    const rng = makeRng(4242)

    // ---- ground -----------------------------------------------------------
    const g = bakeGround()
    for (const t of [g.map, g.roughnessMap, g.normalMap]) {
      t.wrapS = t.wrapT = RepeatWrapping
      t.repeat.set(96, 96)
    }
    const groundMat = new MeshStandardMaterial({
      map: g.map,
      roughnessMap: g.roughnessMap,
      normalMap: g.normalMap,
      normalScale: new Vector2(1.2, 1.2),
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.75,
    })
    const ground = new Mesh(new PlaneGeometry(64, 64, 1, 1), groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.set(-3, 0, -4)
    ground.receiveShadow = true
    this.group.add(ground)

    // A plain skirt far beyond the detailed ground, so the tiled plane never
    // ends in a visible edge — the haze swallows it instead.
    const far = new Mesh(
      new PlaneGeometry(400, 400, 1, 1),
      new MeshStandardMaterial({ color: 0x4a5c34, roughness: 1, metalness: 0, envMapIntensity: 0.7 }),
    )
    far.rotation.x = -Math.PI / 2
    far.position.set(-3, -0.02, -4)
    this.group.add(far)

    // ---- stepping stones beside the flume ---------------------------------
    const stoneMat = new MeshStandardMaterial({ color: 0x6a6a5c, roughness: 0.96, metalness: 0 })
    const stoneGeo = new CylinderGeometry(0.155, 0.175, 0.07, 9)
    for (let i = 0; i < 8; i++) {
      const s = new Mesh(stoneGeo, stoneMat)
      s.position.set(1.02 + rng() * 0.5 + i * 0.09, 0.012, 0.7 - i * 0.66 + rng() * 0.14)
      s.rotation.y = rng() * 3
      s.scale.set(1 + rng() * 0.2, 1, 0.8 + rng() * 0.25)
      s.receiveShadow = true
      s.castShadow = i < 5
      this.group.add(s)
    }

    this.group.add(this.buildLantern())
    this.group.add(this.buildShrubs(rng))
    this.group.add(this.buildEngawa())
    this.group.add(this.buildTrees(rng))
    this.group.add(this.buildCanopy(rng))
  }

  /** A small stone lantern — a silhouette that says "Japanese garden". */
  private buildLantern(): Group {
    const g = new Group()
    const stone = new MeshStandardMaterial({ color: 0x8b897c, roughness: 0.95, metalness: 0 })
    const dark = new MeshStandardMaterial({ color: 0x3a3833, roughness: 0.95, metalness: 0 })
    const parts: [number, number, number, number, number][] = [
      // [radiusTop, radiusBottom, height, y, sides]
      [0.15, 0.19, 0.10, 0.05, 6],
      [0.075, 0.085, 0.46, 0.33, 6],
      [0.20, 0.15, 0.07, 0.595, 6],
      [0.17, 0.20, 0.20, 0.73, 6],
      [0.30, 0.24, 0.10, 0.88, 6],
      [0.05, 0.09, 0.10, 0.97, 6],
    ]
    for (let i = 0; i < parts.length; i++) {
      const [rt, rb, h, y, sides] = parts[i]
      const m = new Mesh(new CylinderGeometry(rt, rb, h, sides), i === 3 ? dark : stone)
      m.position.set(0, y, 0)
      m.castShadow = true
      m.receiveShadow = true
      g.add(m)
    }
    g.position.set(2.35, 0, -2.55)
    g.rotation.y = 0.4
    return g
  }

  /** Low planting so the lawn is not an empty field. */
  private buildShrubs(rng: () => number): Group {
    const g = new Group()
    const tex = bakeLeafCard(5150, [70, 116, 46])
    const mat = new MeshStandardMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.42,
      side: DoubleSide,
      roughness: 0.86,
      metalness: 0,
      envMapIntensity: 0.95,
    })
    const clumps: [number, number, number][] = [
      [1.75, -1.35, 0.42],
      [2.9, -0.55, 0.34],
      [1.5, -3.4, 0.5],
      [3.3, -3.9, 0.46],
      [-1.6, -2.3, 0.44],
      [-2.2, -4.6, 0.5],
      [1.1, -5.6, 0.4],
      [2.7, -6.6, 0.52],
    ]
    for (const [x, z, r] of clumps) {
      for (let i = 0; i < 3; i++) {
        const card = new Mesh(new PlaneGeometry(r * 2.1, r * 1.5), mat)
        card.position.set(x + (rng() - 0.5) * r, r * 0.72 + rng() * r * 0.2, z + (rng() - 0.5) * r)
        card.rotation.y = rng() * Math.PI
        card.castShadow = true
        g.add(card)
      }
    }
    return g
  }

  private buildEngawa(): Group {
    const g = new Group()
    const w = bakeWood()
    for (const t of [w.map, w.roughnessMap, w.normalMap]) {
      t.wrapS = t.wrapT = RepeatWrapping
      t.repeat.set(3, 14)
    }
    const wood = new MeshStandardMaterial({
      map: w.map,
      roughnessMap: w.roughnessMap,
      normalMap: w.normalMap,
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.55,
    })
    const dark = new MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.85, metalness: 0 })
    const frameMat = new MeshStandardMaterial({ color: 0x3d2b1c, roughness: 0.7, metalness: 0 })

    const X = -5.5
    const Z = -1.2
    const LEN = 8.4

    // The dark void under the deck: without it the veranda floats.
    const base = new Mesh(new BoxGeometry(1.55, 0.36, LEN - 0.2), dark)
    base.position.set(X, 0.18, Z)
    g.add(base)

    const deck = new Mesh(new BoxGeometry(1.78, 0.075, LEN), wood)
    deck.position.set(X, 0.40, Z)
    deck.receiveShadow = true
    deck.castShadow = true
    g.add(deck)

    // shoji: bright paper with a dark interior showing through
    const paper = new MeshStandardMaterial({ color: 0xded6bf, roughness: 0.9, metalness: 0 })
    const wall = new Mesh(new BoxGeometry(0.08, 1.86, LEN), paper)
    wall.position.set(X - 0.86, 1.37, Z)
    wall.receiveShadow = true
    g.add(wall)
    for (let i = 0; i < 9; i++) {
      const m = new Mesh(new BoxGeometry(0.045, 1.86, 0.045), frameMat)
      m.position.set(X - 0.81, 1.37, Z - LEN / 2 + 0.4 + i * 0.95)
      g.add(m)
    }
    for (let i = 0; i < 4; i++) {
      const m = new Mesh(new BoxGeometry(0.045, 0.04, LEN), frameMat)
      m.position.set(X - 0.81, 0.62 + i * 0.5, Z)
      g.add(m)
    }

    // deep eave: the dark band that says "there is a house here"
    const eave = new Mesh(new BoxGeometry(2.5, 0.11, LEN + 0.7), frameMat)
    eave.position.set(X - 0.15, 2.36, Z)
    eave.castShadow = true
    g.add(eave)
    const soffit = new Mesh(new BoxGeometry(2.4, 0.30, LEN + 0.5), dark)
    soffit.position.set(X - 0.15, 2.18, Z)
    g.add(soffit)
    for (const dz of [-3.4, -1.1, 1.2, 3.4]) {
      const post = new Mesh(new BoxGeometry(0.085, 1.85, 0.085), frameMat)
      post.position.set(X + 0.78, 1.35, Z + dz)
      post.castShadow = true
      g.add(post)
    }
    return g
  }

  private buildTrees(rng: () => number): Group {
    const g = new Group()
    const barkMat = new MeshStandardMaterial({ color: 0x453c31, roughness: 0.95, metalness: 0 })
    const tints: [number, number, number][] = [
      [86, 130, 52],
      [58, 104, 44],
      [112, 148, 64],
    ]
    const leafTex = tints.map((t, i) => bakeLeafCard(700 + i * 31, t))
    const leafMats = leafTex.map(
      (t) =>
        new MeshStandardMaterial({
          map: t,
          transparent: true,
          alphaTest: 0.40,
          depthWrite: true,
          side: DoubleSide,
          roughness: 0.85,
          metalness: 0,
          envMapIntensity: 1.0,
        }),
    )

    const trees = [
      { x: 4.6, z: -6.4, h: 5.4, r: 2.6 },
      { x: -9.2, z: -6.4, h: 6.2, r: 3.0 },
      { x: -11.0, z: 3.6, h: 5.4, r: 2.7 },
      { x: 8.2, z: 1.2, h: 6.0, r: 2.9 },
      { x: -6.4, z: -13.5, h: 6.4, r: 3.2 },
      { x: 6.0, z: -12.5, h: 5.2, r: 2.8 },
    ]
    for (const t of trees) {
      const trunk = new Mesh(new CylinderGeometry(0.1, 0.19, t.h, 7), barkMat)
      trunk.position.set(t.x, t.h / 2, t.z)
      g.add(trunk)
      for (let i = 0; i < 6; i++) {
        const mat = leafMats[Math.floor(rng() * leafMats.length)]
        const card = new Mesh(
          new PlaneGeometry(t.r * (0.9 + rng() * 0.5), t.r * (0.7 + rng() * 0.4)),
          mat,
        )
        card.position.set(
          t.x + (rng() - 0.5) * t.r * 1.0,
          t.h * (0.66 + rng() * 0.32),
          t.z + (rng() - 0.5) * t.r * 1.0,
        )
        card.rotation.y = rng() * Math.PI
        card.rotation.z = (rng() - 0.5) * 0.5
        g.add(card)
      }
    }

    // A bamboo grove closing the far end, so the flume runs *into* something.
    const hedgeMat = leafMats[1]
    for (let i = 0; i < 16; i++) {
      const h = 1.5 + rng() * 0.8
      const card = new Mesh(new PlaneGeometry(1.5 + rng() * 0.8, h), hedgeMat)
      card.position.set(
        -4.6 + i * 0.62 + (rng() - 0.5) * 0.5,
        h * 0.48 + rng() * 0.25,
        -10.4 - rng() * 2.2,
      )
      card.rotation.y = (rng() - 0.5) * 0.6
      g.add(card)
    }
    for (let i = 0; i < 9; i++) {
      const h2 = 1.7 + rng() * 0.8
      const card = new Mesh(new PlaneGeometry(1.9 + rng() * 0.9, h2), hedgeMat)
      card.position.set(7.6 + rng() * 1.4, h2 * 0.48 + rng() * 0.2, -7.5 + i * 1.5)
      card.rotation.y = Math.PI / 2 + (rng() - 0.5) * 0.5
      g.add(card)
    }
    return g
  }

  /**
   * Leaves high above the flume. They are almost never in frame; what the
   * player sees is their shadow moving over the bamboo and the water.
   */
  private buildCanopy(rng: () => number): Group {
    const g = new Group()
    const tex = bakeLeafCard(1234, [82, 126, 50])
    const mat = new MeshStandardMaterial({
      map: tex,
      transparent: false,
      alphaTest: 0.5,
      side: DoubleSide,
      roughness: 0.8,
      metalness: 0,
      envMapIntensity: 1.0,
    })
    const spots: [number, number, number][] = [
      [0.4, 3.5, -2.6],
      [-0.5, 3.7, -1.3],
      [1.0, 3.4, -0.3],
      [-0.2, 3.8, 0.8],
      [0.7, 3.55, 1.9],
      [-1.0, 3.65, -3.4],
      [1.5, 3.45, 0.9],
      [-1.3, 3.75, 2.4],
    ]
    for (const [x, y, z] of spots) {
      const card = new Mesh(new PlaneGeometry(1.4 + rng() * 0.8, 1.15 + rng() * 0.7), mat)
      card.position.set(x, y, z)
      card.rotation.set(-Math.PI / 2 + (rng() - 0.5) * 0.4, rng() * Math.PI, 0)
      card.castShadow = true
      card.receiveShadow = false
      g.add(card)
      this.shadowLeaves.push({ mesh: card, phase: rng() * 6.28, amp: 0.02 + rng() * 0.03, y0: y })
    }
    return g
  }

  /** Gentle sway, so the dapple on the bamboo is never static. */
  update(time: number): void {
    for (const l of this.shadowLeaves) {
      l.mesh.rotation.z = Math.sin(time * 0.42 + l.phase) * l.amp * 6
      l.mesh.position.y = l.y0 + Math.sin(time * 0.63 + l.phase) * 0.02
    }
  }
}
