import * as THREE from 'three'
import { coatingGeometry, sectorGeometry } from './geom'
import { DIM, WEDGE_END, WEDGE_START, Y } from './dims'
import type { Mats } from './materials'
import { TAU } from '../core/rng'
import { FAST } from '../core/flags'

export type LayerKey = 'base' | 'ring1' | 'ring2' | 'lid'
export type CreamKey = 'cream1' | 'cream2' | 'cream3'

const SEGS = FAST ? 48 : 108

/** Angular span of the remaining cake body (everything except the slice). */
const MAIN_START = WEDGE_END
const MAIN_LEN = TAU - (WEDGE_END - WEDGE_START)

export interface SpongeLayer {
  key: LayerKey
  /** moved while the child drags the layer; ends at (0, y0, 0) */
  holder: THREE.Group
  uncut: THREE.Mesh
  main: THREE.Mesh
  wedge: THREE.Mesh
  y0: number
  y1: number
  rInner: number
  placed: boolean
}

export interface CreamLayer {
  key: CreamKey
  sweep: THREE.Mesh
  main: THREE.Mesh
  wedge: THREE.Mesh
  indexCount: number
  progress: number
}

export interface Coating {
  sweep: THREE.Mesh
  mainSkirt: THREE.Mesh
  mainTop: THREE.Mesh
  wedgeSkirt: THREE.Mesh
  wedgeTop: THREE.Mesh
  indexCount: number
  progress: number
}

function shadowed(m: THREE.Mesh) {
  m.castShadow = !FAST
  m.receiveShadow = !FAST
  return m
}

/**
 * The cake as real geometry. Every element exists as an intact 360 solid *and*
 * as a pre-split pair (remaining body + slice); the cut animation just swaps
 * which pair is visible, so no CSG ever runs at runtime.
 */
export class Cake {
  readonly root = new THREE.Group()
  readonly wedgeGroup = new THREE.Group()
  readonly body = new THREE.Group()
  readonly layers = new Map<LayerKey, SpongeLayer>()
  readonly creams = new Map<CreamKey, CreamLayer>()
  readonly coating: Coating
  readonly cavityGhost: THREE.Mesh
  isSplit = false

  constructor(private mats: Mats) {
    this.root.add(this.body, this.wedgeGroup)

    const spongeSpecs: Array<[LayerKey, readonly [number, number], number, number]> = [
      ['base', Y.base, 0, 11],
      ['ring1', Y.ring1, DIM.holeRadius, 23],
      ['ring2', Y.ring2, DIM.holeRadius, 37],
      ['lid', Y.lid, 0, 51],
    ]
    for (const [key, [y0, y1], rInner, seed] of spongeSpecs) {
      this.layers.set(key, this.buildSponge(key, y0, y1, rInner, seed))
    }

    const creamSpecs: Array<[CreamKey, readonly [number, number], number]> = [
      ['cream1', Y.cream1, 61],
      ['cream2', Y.cream2, 67],
      ['cream3', Y.cream3, 73],
    ]
    for (const [key, [y0, y1], seed] of creamSpecs) {
      this.creams.set(key, this.buildCream(key, y0, y1, seed))
    }

    this.coating = this.buildCoating()

    // faint hint of the buried cavity, only shown during the "secret" beat
    const gg = new THREE.CylinderGeometry(
      DIM.holeRadius,
      DIM.holeRadius,
      Y.cavityCeil - Y.cavityFloor,
      28,
      1,
      true,
    )
    this.cavityGhost = new THREE.Mesh(gg, this.mats.ghost.clone())
    ;(this.cavityGhost.material as THREE.MeshBasicMaterial).color.set(0xffd9a8)
    ;(this.cavityGhost.material as THREE.MeshBasicMaterial).opacity = 0.16
    ;(this.cavityGhost.material as THREE.MeshBasicMaterial).side = THREE.BackSide
    this.cavityGhost.position.y = (Y.cavityCeil + Y.cavityFloor) / 2
    this.cavityGhost.visible = false
    this.cavityGhost.renderOrder = 5
    this.body.add(this.cavityGhost)
  }

  /* ---------------------------------------------------------------- */

  private buildSponge(
    key: LayerKey,
    y0: number,
    y1: number,
    rInner: number,
    seed: number,
  ): SpongeLayer {
    const h = y1 - y0
    const shared = {
      rOuter: DIM.cakeRadius,
      rInner,
      height: h,
      segsPerTurn: SEGS,
      heightSegs: 3,
      radialSegs: 4,
      bulge: 0.16,
      wobble: 0.11,
      domeTop: key === 'lid' ? 0.22 : 0.05,
      seed,
    }
    const matSet = [this.mats.crust, this.mats.crumb]

    const uncut = shadowed(
      new THREE.Mesh(
        sectorGeometry({ ...shared, thetaStart: 0, thetaLength: TAU, capped: false }),
        matSet,
      ),
    )
    const main = shadowed(
      new THREE.Mesh(
        sectorGeometry({
          ...shared,
          thetaStart: MAIN_START,
          thetaLength: MAIN_LEN,
          capped: true,
        }),
        matSet,
      ),
    )
    const wedge = shadowed(
      new THREE.Mesh(
        sectorGeometry({
          ...shared,
          thetaStart: WEDGE_START,
          thetaLength: WEDGE_END - WEDGE_START,
          capped: true,
        }),
        matSet,
      ),
    )

    const holder = new THREE.Group()
    holder.add(uncut, main)
    holder.position.y = y0
    holder.visible = false
    main.visible = false
    this.body.add(holder)

    wedge.position.y = y0
    wedge.visible = false
    this.wedgeGroup.add(wedge)

    return { key, holder, uncut, main, wedge, y0, y1, rInner, placed: false }
  }

  private buildCream(key: CreamKey, y0: number, y1: number, seed: number): CreamLayer {
    const rOuter = DIM.cakeRadius + 0.16
    const rInner = DIM.holeRadius
    const coat = coatingGeometry({
      radius: rOuter,
      rInner,
      yBottom: y0,
      yTop: y1,
      thetaStart: 0,
      thetaLength: TAU,
      segsPerTurn: SEGS,
      heightSegs: 1,
      withTop: true,
      domeTop: 0,
      wobble: 0.06,
      seed,
      uvScale: 4,
    })
    const sweep = shadowed(new THREE.Mesh(coat.geometry, this.mats.cream))
    sweep.geometry.setDrawRange(0, 0)
    sweep.renderOrder = 1
    this.body.add(sweep)

    const shared = {
      rOuter,
      rInner,
      height: y1 - y0,
      segsPerTurn: SEGS,
      heightSegs: 1,
      radialSegs: 2,
      wobble: 0.06,
      seed,
      singleMaterial: true,
      uvScale: 4,
    }
    const main = shadowed(
      new THREE.Mesh(
        sectorGeometry({
          ...shared,
          thetaStart: MAIN_START,
          thetaLength: MAIN_LEN,
          capped: true,
        }),
        this.mats.cream,
      ),
    )
    const wedge = shadowed(
      new THREE.Mesh(
        sectorGeometry({
          ...shared,
          thetaStart: WEDGE_START,
          thetaLength: WEDGE_END - WEDGE_START,
          capped: true,
        }),
        this.mats.cream,
      ),
    )
    main.position.y = y0
    wedge.position.y = y0
    main.visible = false
    wedge.visible = false
    this.body.add(main)
    this.wedgeGroup.add(wedge)

    const idx = coat.geometry.getIndex()!
    return { key, sweep, main, wedge, indexCount: idx.count, progress: 0 }
  }

  private buildCoating(): Coating {
    const rOut = DIM.cakeRadius + DIM.coatThickness
    const yTop = Y.top
    const coat = coatingGeometry({
      radius: rOut,
      yBottom: DIM.boardTop + 0.02,
      yTop,
      thetaStart: WEDGE_START,
      thetaLength: TAU,
      segsPerTurn: SEGS,
      heightSegs: 6,
      withTop: true,
      domeTop: 0.24,
      wobble: 0.12,
      seed: 91,
      uvScale: 7,
    })
    const sweep = shadowed(new THREE.Mesh(coat.geometry, this.mats.cream))
    sweep.geometry.setDrawRange(0, 0)
    this.body.add(sweep)

    const skirt = (thetaStart: number, thetaLength: number) =>
      sectorGeometry({
        rOuter: rOut,
        rInner: DIM.cakeRadius - 0.2,
        height: yTop - DIM.boardTop - 0.02,
        thetaStart,
        thetaLength,
        segsPerTurn: SEGS,
        heightSegs: 4,
        radialSegs: 2,
        wobble: 0.12,
        seed: 91,
        capped: true,
        singleMaterial: true,
        uvScale: 7,
      })
    const cap = (thetaStart: number, thetaLength: number) =>
      sectorGeometry({
        rOuter: rOut,
        rInner: 0,
        height: 0.34,
        thetaStart,
        thetaLength,
        segsPerTurn: SEGS,
        heightSegs: 1,
        radialSegs: 5,
        domeTop: 0.24,
        wobble: 0.12,
        seed: 91,
        capped: true,
        singleMaterial: true,
        uvScale: 7,
      })

    const mainSkirt = shadowed(new THREE.Mesh(skirt(MAIN_START, MAIN_LEN), this.mats.cream))
    const wedgeSkirt = shadowed(
      new THREE.Mesh(skirt(WEDGE_START, WEDGE_END - WEDGE_START), this.mats.cream),
    )
    const mainTop = shadowed(new THREE.Mesh(cap(MAIN_START, MAIN_LEN), this.mats.cream))
    const wedgeTop = shadowed(
      new THREE.Mesh(cap(WEDGE_START, WEDGE_END - WEDGE_START), this.mats.cream),
    )
    mainSkirt.position.y = DIM.boardTop + 0.02
    wedgeSkirt.position.y = DIM.boardTop + 0.02
    mainTop.position.y = yTop
    wedgeTop.position.y = yTop
    for (const m of [mainSkirt, mainTop]) {
      m.visible = false
      this.body.add(m)
    }
    for (const m of [wedgeSkirt, wedgeTop]) {
      m.visible = false
      this.wedgeGroup.add(m)
    }

    return {
      sweep,
      mainSkirt,
      mainTop,
      wedgeSkirt,
      wedgeTop,
      indexCount: coat.geometry.getIndex()!.count,
      progress: 0,
    }
  }

  /* ---------------------------------------------------------------- */

  layer(key: LayerKey) {
    return this.layers.get(key)!
  }

  cream(key: CreamKey) {
    return this.creams.get(key)!
  }

  /** 0..1 sweep of a buttercream layer, driven by one broad swipe. */
  setCreamProgress(key: CreamKey, p: number) {
    const c = this.cream(key)
    c.progress = Math.max(0, Math.min(1, p))
    c.sweep.geometry.setDrawRange(0, Math.floor(c.indexCount * c.progress))
  }

  /** 0..1 sweep of the outer coat, driven by the turntable spin. */
  setCoatProgress(p: number) {
    const c = this.coating
    c.progress = Math.max(0, Math.min(1, p))
    c.sweep.geometry.setDrawRange(0, Math.floor(c.indexCount * c.progress))
  }

  /** Swap intact meshes for the pre-split pair. Called once, at cut completion. */
  split() {
    if (this.isSplit) return
    this.isSplit = true
    for (const l of this.layers.values()) {
      if (!l.placed) continue
      l.uncut.visible = false
      l.main.visible = true
      l.wedge.visible = true
    }
    for (const c of this.creams.values()) {
      if (c.progress <= 0.01) continue
      c.sweep.visible = false
      c.main.visible = true
      c.wedge.visible = true
    }
    if (this.coating.progress > 0.01) {
      this.coating.sweep.visible = false
      this.coating.mainSkirt.visible = true
      this.coating.mainTop.visible = true
      this.coating.wedgeSkirt.visible = true
      this.coating.wedgeTop.visible = true
    }
  }

  reset() {
    this.isSplit = false
    this.root.rotation.y = 0
    this.wedgeGroup.position.set(0, 0, 0)
    this.wedgeGroup.rotation.set(0, 0, 0)
    for (const l of this.layers.values()) {
      l.placed = false
      l.holder.visible = false
      l.holder.position.set(0, l.y0, 0)
      l.holder.rotation.set(0, 0, 0)
      l.holder.scale.set(1, 1, 1)
      l.uncut.visible = true
      l.main.visible = false
      l.wedge.visible = false
    }
    for (const c of this.creams.values()) {
      c.sweep.visible = true
      c.main.visible = false
      c.wedge.visible = false
      this.setCreamProgress(c.key, 0)
    }
    this.coating.sweep.visible = true
    this.coating.mainSkirt.visible = false
    this.coating.mainTop.visible = false
    this.coating.wedgeSkirt.visible = false
    this.coating.wedgeTop.visible = false
    this.setCoatProgress(0)
    this.cavityGhost.visible = false
  }

  dispose() {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
    })
  }
}
