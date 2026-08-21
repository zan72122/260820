import * as THREE from 'three'
import { buildMaterials } from '../core/materials'
import { MeshMerger } from './merge'
import type { ContactShadows } from './decals'
import { BENCHES, PAVILION, TREES } from './layout'
import { Rng } from '../core/math'

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _e = new THREE.Euler()

/**
 * Trees are instanced: one trunk geometry, one branch geometry and one canopy
 * blob, transformed per tree. Twelve trees cost three draw calls.
 */
export function buildTrees(root: THREE.Group, contacts: ContactShadows): void {
  const m = buildMaterials()

  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.26, 1, 10, 1, false)
  trunkGeo.translate(0, 0.5, 0)
  const branchGeo = new THREE.CylinderGeometry(0.045, 0.1, 1, 6)
  branchGeo.translate(0, 0.5, 0)
  const blobGeo = new THREE.IcosahedronGeometry(1, 1)

  const BRANCHES = 4
  const BLOBS = 6
  const trunks = new THREE.InstancedMesh(trunkGeo, m.bark, TREES.length)
  const branches = new THREE.InstancedMesh(branchGeo, m.bark, TREES.length * BRANCHES)
  const blobs = new THREE.InstancedMesh(blobGeo, m.foliage, TREES.length * BLOBS)
  // Nothing out in the park casts into the key light's shadow map: it is a
  // small map aimed at the slide, and distant casters only smear it.
  trunks.castShadow = false
  branches.castShadow = false
  blobs.castShadow = false

  let bi = 0
  let ci = 0
  TREES.forEach((t, i) => {
    const rng = new Rng(t.seed * 977)
    const lean = rng.range(-0.05, 0.05)
    const spin = rng.range(0, Math.PI * 2)

    _p.set(t.x, 0, t.z)
    _q.setFromEuler(_e.set(lean, spin, rng.range(-0.05, 0.05)))
    _s.set(1, t.height * 0.46, 1)
    _m.compose(_p, _q, _s)
    trunks.setMatrixAt(i, _m)

    for (let b = 0; b < BRANCHES; b++) {
      const a = spin + (b / BRANCHES) * Math.PI * 2 + rng.range(-0.4, 0.4)
      const h = t.height * rng.range(0.3, 0.44)
      _p.set(t.x, h, t.z)
      _q.setFromEuler(_e.set(rng.range(0.6, 1.05), a, 0, 'YXZ'))
      const len = t.spread * rng.range(0.45, 0.7)
      _s.set(0.85, len, 0.85)
      _m.compose(_p, _q, _s)
      branches.setMatrixAt(bi++, _m)
    }

    for (let c = 0; c < BLOBS; c++) {
      // Crowns are built from overlapping blobs low on the trunk, so the tree
      // reads as one mass against the sky rather than a ball on a stick.
      const a = spin + (c / BLOBS) * Math.PI * 2 + rng.range(-0.45, 0.45)
      const rad = t.spread * rng.range(0.16, 0.46)
      const h = t.height * rng.range(0.5, 0.82)
      _p.set(t.x + Math.cos(a) * rad, h, t.z + Math.sin(a) * rad)
      _q.setFromEuler(_e.set(rng.range(0, 1), rng.range(0, 3), rng.range(0, 1)))
      const sc = t.spread * rng.range(0.5, 0.78)
      _s.set(sc, sc * rng.range(0.72, 0.95), sc)
      _m.compose(_p, _q, _s)
      blobs.setMatrixAt(ci++, _m)
    }

    contacts.add(t.x, 0, t.z, t.spread * 0.55, 0.55)
  })

  trunks.instanceMatrix.needsUpdate = true
  branches.instanceMatrix.needsUpdate = true
  blobs.instanceMatrix.needsUpdate = true
  root.add(trunks, branches, blobs)
}

export function buildBenches(root: THREE.Group, contacts: ContactShadows): void {
  const m = buildMaterials()
  const merger = new MeshMerger()

  const slat = new THREE.BoxGeometry(1.52, 0.035, 0.09)
  const legPlate = new THREE.BoxGeometry(0.05, 0.4, 0.46)
  const armRail = new THREE.BoxGeometry(1.56, 0.04, 0.04)

  for (const b of BENCHES) {
    const g = new THREE.Matrix4().compose(
      new THREE.Vector3(b.x, 0, b.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, b.yaw, 0)),
      new THREE.Vector3(1, 1, 1),
    )
    const put = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      rx = 0,
    ): void => {
      const local = new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)),
        new THREE.Vector3(1, 1, 1),
      )
      merger.add(geo, mat, new THREE.Matrix4().multiplyMatrices(g, local), {
        receive: true,
      })
    }

    for (let i = 0; i < 4; i++) put(slat, m.wood, 0, 0.42, -0.15 + i * 0.105)
    for (let i = 0; i < 3; i++) put(slat, m.wood, 0, 0.62 + i * 0.11, -0.24, -0.34)
    for (const s of [-1, 1]) {
      put(legPlate, m.darkSteel, s * 0.66, 0.2, -0.02)
      put(armRail, m.darkSteel, 0, 0.4, 0.16)
    }
    contacts.add(b.x, 0, b.z, 0.95, 0.55, 0.55)
  }

  merger.build(root, 'benches')
}

export function buildPavilion(root: THREE.Group, contacts: ContactShadows): void {
  const m = buildMaterials()
  const merger = new MeshMerger()
  const { x, z, width, depth, postHeight } = PAVILION

  const slab = new THREE.BoxGeometry(width + 0.9, 0.11, depth + 0.9)
  merger.addAt(slab, m.concrete, x, 0.055, z, 0, 0, 0, { receive: true })
  const step = new THREE.BoxGeometry(width + 1.5, 0.06, 0.5)
  merger.addAt(step, m.concrete, x, 0.03, z - depth / 2 - 0.68, 0, 0, 0, { receive: true })

  const postGeo = new THREE.CylinderGeometry(0.09, 0.1, postHeight, 10)
  const baseGeo = new THREE.CylinderGeometry(0.13, 0.14, 0.1, 10)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = x + (sx * width) / 2
      const pz = z + (sz * depth) / 2
      merger.addAt(postGeo, m.wood, px, postHeight / 2 + 0.11, pz)
      merger.addAt(baseGeo, m.darkSteel, px, 0.16, pz)
      contacts.add(px, 0, pz, 0.3, 0.5)
    }
  }

  // Ring beam and rafters.
  const beamX = new THREE.BoxGeometry(width + 0.24, 0.14, 0.1)
  const beamZ = new THREE.BoxGeometry(0.1, 0.14, depth + 0.24)
  for (const sz of [-1, 1]) {
    merger.addAt(beamX, m.wood, x, postHeight + 0.14, z + (sz * depth) / 2)
  }
  for (const sx of [-1, 1]) {
    merger.addAt(beamZ, m.wood, x + (sx * width) / 2, postHeight + 0.14, z)
  }
  const rafter = new THREE.BoxGeometry(width + 0.4, 0.07, 0.06)
  for (let i = 0; i < 5; i++) {
    const t = (i / 4 - 0.5) * (depth + 0.2)
    merger.addAt(rafter, m.wood, x, postHeight + 0.24, z + t)
  }

  // Pitched roof: two tilted panels and a ridge cap, corrugated steel over
  // timber. Low enough that the lanterns under it stay visible from the path.
  const roofHeight = 0.62
  const tilt = Math.atan2(roofHeight, depth / 2 + 0.45)

  const slopeLen = Math.hypot(depth / 2 + 0.5, roofHeight)
  const slope = new THREE.BoxGeometry(width + 1.1, 0.055, slopeLen)
  for (const sz of [-1, 1]) {
    merger.addAt(
      slope,
      m.paintedSteel,
      x,
      postHeight + 0.3 + roofHeight / 2,
      z + (sz * (depth / 2 + 0.5)) / 2,
      sz * tilt,
    )
  }
  const ridge = new THREE.BoxGeometry(width + 1.2, 0.08, 0.12)
  merger.addAt(ridge, m.paintedSteel, x, postHeight + 0.3 + roofHeight, z)

  merger.build(root, 'pavilion')
}

/**
 * The world beyond the park: a dark treeline and a few distant blocks of flats
 * with their windows on. Pure silhouette, no shading cost.
 */
export function buildHorizon(root: THREE.Group): void {
  const m = buildMaterials()
  const merger = new MeshMerger()
  const rng = new Rng(777)

  const blob = new THREE.IcosahedronGeometry(1, 0)
  for (let i = 0; i < 76; i++) {
    const a = (i / 76) * Math.PI * 2 + rng.range(-0.03, 0.03)
    const r = rng.range(50, 70)
    const h = rng.range(5.5, 11.5)
    const w = rng.range(3.4, 6.4)
    _p.set(Math.cos(a) * r, h * 0.55, Math.sin(a) * r)
    _q.setFromEuler(_e.set(rng.range(0, 1), rng.range(0, 3), rng.range(0, 1)))
    _s.set(w, h * 0.5, w)
    _m.compose(_p, _q, _s)
    merger.add(blob, m.silhouette, _m)
  }
  merger.build(root, 'horizon')

  // Distant housing: dark slabs with lit windows, far enough to read as depth.
  const windowMat = new THREE.MeshBasicMaterial({
    map: m.tex.windows,
    color: 0xffffff,
    fog: true,
    toneMapped: true,
  })
  const blocks: Array<[number, number, number, number, number]> = [
    [-40, 0, -48, 22, 13],
    [34, 0, -52, 26, 11],
    [58, 0, 12, 18, 15],
    [-56, 0, 26, 20, 12],
  ]
  for (const [x, , z, w, h] of blocks) {
    const yaw = Math.atan2(-x, -z)
    const shell = new THREE.Mesh(new THREE.BoxGeometry(w, h, 3), m.silhouette)
    shell.position.set(x, h / 2, z)
    shell.rotation.y = yaw
    root.add(shell)
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, h * 0.9), windowMat)
    face.position.set(x, h / 2, z)
    face.rotation.y = yaw
    face.translateZ(1.55)
    root.add(face)
  }
}
