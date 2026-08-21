import {
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
} from 'three'
import type { Rng } from '../../core/rng'
import { rngRange } from '../../core/rng'
import type { MatKit } from '../../materials/matkit'
import { ROOF_PITCH } from '../../scene/layout'
import { chamferBox, mergeParts, moveGeo, offsetUvs, setVertexColor, tintJitter } from '../util/geo'

/**
 * 中景（12〜80m）: 塀越しに覗く隣家の屋根、杉木立、田、電柱、農道。
 * 形は簡略でも比例と勾配は近景と同じ実寸則（隣家も4寸勾配）。
 * ここが近景と遠景を繋ぐ「奥行きの第二層」になる。
 */
export function buildMidLayer(kit: MatKit, rng: Rng): Group {
  const group = new Group()
  group.name = 'midLayer'

  // --- 中景の地面: 近景の外へ広がる草地 -----------------------------------
  const terrain = new PlaneGeometry(700, 700, 1, 1)
  terrain.rotateX(-Math.PI / 2)
  {
    const uv = terrain.getAttribute('uv')
    const pos = terrain.getAttribute('position')
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i))
  }
  terrain.translate(0, -0.06, 0)
  const terrainMesh = new Mesh(terrain, kit.grassShort)
  terrainMesh.receiveShadow = false
  group.add(terrainMesh)

  // --- 田: 刈田（秋の夕方=稲刈り後の株の列）＋畦 --------------------------
  const paddyMat = kit.grassShort.clone()
  paddyMat.color = new Color('#c2a86e') // 刈田の藁色
  const azeMat = new MeshStandardMaterial({ color: '#6b6f42', roughness: 1 })
  const paddies: Array<{ x: number; z: number; w: number; d: number; rot: number }> = [
    { x: -26, z: 6, w: 22, d: 14, rot: 0.06 },
    { x: -30, z: -12, w: 18, d: 12, rot: -0.04 },
    { x: -18, z: 22, w: 16, d: 12, rot: 0.1 },
    { x: 24, z: 18, w: 20, d: 13, rot: -0.08 },
  ]
  const paddyParts: BufferGeometry[] = []
  const azeParts: BufferGeometry[] = []
  for (const p of paddies) {
    const plane = new PlaneGeometry(p.w, p.d)
    plane.rotateX(-Math.PI / 2)
    plane.rotateY(p.rot)
    plane.translate(p.x, -0.04, p.z)
    paddyParts.push(plane)
    // 畦: 周囲の細い盛り土
    for (const [w, d, ox, oz] of [
      [p.w + 0.6, 0.5, 0, -p.d / 2],
      [p.w + 0.6, 0.5, 0, p.d / 2],
      [0.5, p.d + 0.6, -p.w / 2, 0],
      [0.5, p.d + 0.6, p.w / 2, 0],
    ] as const) {
      const aze = chamferBox(w, 0.25, d, 0.05)
      aze.rotateY(p.rot)
      const c = Math.cos(p.rot)
      const s = Math.sin(p.rot)
      aze.translate(p.x + ox * c + oz * s, 0.05, p.z - ox * s + oz * c)
      azeParts.push(aze)
    }
  }
  const paddyMesh = new Mesh(mergeParts(paddyParts), paddyMat)
  const azeMesh = new Mesh(mergeParts(azeParts), azeMat)
  group.add(paddyMesh, azeMesh)

  // --- 隣家（2軒）: 同じ4寸勾配の瓦屋根を持つ簡略の量塊 -------------------
  const houseAt = (hx: number, hz: number, w: number, d: number, rotY: number) => {
    const h = new Group()
    const wallH = 2.7
    const walls = chamferBox(w, wallH, d, 0.02)
    // 遠目の漆喰は夕方の環境光で沈む（真っ白に飛ばさない）
    setVertexColor(walls, tintJitter(rng, '#aca493', 0.05))
    offsetUvs(walls, rng(), rng())
    moveGeo(walls, 0, wallH / 2, 0)
    const wallMesh = new Mesh(walls, kit.plaster)
    h.add(wallMesh)
    // 腰の暗い帯（遠目の板張り）
    const skirt = chamferBox(w + 0.04, 0.9, d + 0.04, 0.02)
    setVertexColor(skirt, tintJitter(rng, '#4a3e30', 0.05))
    moveGeo(skirt, 0, 0.45, 0)
    const skirtMesh = new Mesh(skirt, kit.woodDark)
    h.add(skirtMesh)
    // 切妻屋根
    const roofParts: BufferGeometry[] = []
    const rise = (d / 2) * Math.tan(ROOF_PITCH)
    for (const side of [1, -1]) {
      const slopeLen = d / 2 / Math.cos(ROOF_PITCH) + 0.5
      const slope = new PlaneGeometry(w + 1.0, slopeLen)
      slope.rotateX(side > 0 ? ROOF_PITCH - Math.PI / 2 : Math.PI / 2 - ROOF_PITCH)
      slope.translate(0, wallH + rise / 2 + 0.1, (side * d) / 4)
      setVertexColor(slope, tintJitter(rng, '#4d525a', 0.04))
      roofParts.push(slope)
    }
    const ridge = chamferBox(w + 1.0, 0.22, 0.3, 0.02)
    setVertexColor(ridge, tintJitter(rng, '#454a52', 0.04))
    moveGeo(ridge, 0, wallH + rise + 0.15, 0)
    roofParts.push(ridge)
    for (const p of roofParts) offsetUvs(p, rng(), rng())
    const roofMesh = new Mesh(mergeParts(roofParts), kit.kawara)
    h.add(roofMesh)
    h.position.set(hx, -0.05, hz)
    h.rotation.y = rotY
    return h
  }
  group.add(houseAt(13.5, -2, 9, 7, 0.15))
  group.add(houseAt(-20, -18, 10, 8, -0.5))
  group.add(houseAt(26, 10, 9, 7, 0.35))

  // --- 杉木立と広葉樹の塊 -------------------------------------------------
  const cedarParts: BufferGeometry[] = []
  const blobParts: BufferGeometry[] = []
  const clusters = [
    { x: 18, z: -12, n: 5 },
    { x: -14, z: -24, n: 7 },
    { x: 34, z: 2, n: 4 },
    { x: -34, z: 14, n: 5 },
  ]
  for (const c of clusters) {
    for (let i = 0; i < c.n; i++) {
      const tx = c.x + (rng() - 0.5) * 8
      const tz = c.z + (rng() - 0.5) * 8
      if (rng() < 0.65) {
        // 杉: 段のある不規則な円錐の重なり（整った円錐は人工物に見える）
        const h = rngRange(rng, 7, 12)
        const tiers = 3
        for (let k = 0; k < tiers; k++) {
          const tierH = h * (0.42 - k * 0.07)
          const tierR = h * (0.17 - k * 0.045) * rngRange(rng, 0.85, 1.15)
          const cone = new ConeGeometry(tierR, tierH, 7)
          setVertexColor(cone, tintJitter(rng, '#2e4230', 0.09))
          cone.translate(
            tx + (rng() - 0.5) * h * 0.03,
            h * (0.3 + k * 0.22) + tierH / 2 - h * 0.12,
            tz + (rng() - 0.5) * h * 0.03,
          )
          cedarParts.push(cone)
        }
        const trunk = new CylinderGeometry(h * 0.015, h * 0.02, h * 0.35, 5)
        setVertexColor(trunk, tintJitter(rng, '#4a3f34', 0.05))
        trunk.translate(tx, h * 0.17, tz)
        cedarParts.push(trunk)
      } else {
        // 広葉樹: 潰れた球の房
        const h = rngRange(rng, 5, 8)
        const blob = new SphereGeometry(h * 0.32, 8, 6)
        blob.scale(1, 0.75, 1)
        setVertexColor(blob, tintJitter(rng, '#57603a', 0.09))
        blob.translate(tx, h * 0.7, tz)
        blobParts.push(blob)
        const trunk = new CylinderGeometry(h * 0.02, h * 0.028, h * 0.5, 5)
        setVertexColor(trunk, tintJitter(rng, '#4a3f34', 0.05))
        trunk.translate(tx, h * 0.25, tz)
        blobParts.push(trunk)
      }
    }
  }
  const treeMat = new MeshStandardMaterial({ roughness: 0.95, vertexColors: true })
  for (const p of [...cedarParts, ...blobParts]) offsetUvs(p, rng(), rng())
  const cedarMesh = new Mesh(mergeParts([...cedarParts, ...blobParts]), treeMat)
  group.add(cedarMesh)

  // --- 農道: 木戸の先を東西へ ---------------------------------------------
  const road = new PlaneGeometry(120, 2.6, 24, 1)
  road.rotateX(-Math.PI / 2)
  {
    const pos = road.getAttribute('position')
    const uv = road.getAttribute('uv')
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      // 緩やかに蛇行する轍道
      pos.setZ(i, pos.getZ(i) + 7.6 + Math.sin(x * 0.05) * 1.5)
      pos.setY(i, -0.03)
      uv.setXY(i, x, pos.getZ(i))
    }
  }
  road.computeVertexNormals()
  const roadMesh = new Mesh(road, kit.gravel)
  group.add(roadMesh)

  // --- 電柱1本（現代の里の風景の必然、1本だけ） ---------------------------
  {
    const parts: BufferGeometry[] = []
    const pole = new CylinderGeometry(0.09, 0.14, 9, 8)
    setVertexColor(pole, new Color('#605e59'))
    pole.translate(0, 4.5, 0)
    parts.push(pole)
    const arm = chamferBox(1.6, 0.08, 0.08, 0.01)
    setVertexColor(arm, new Color('#4d4b46'))
    moveGeo(arm, 0, 8.1, 0)
    parts.push(arm)
    for (const ox of [-0.6, 0, 0.6]) {
      const ins = new CylinderGeometry(0.045, 0.055, 0.12, 6)
      setVertexColor(ins, new Color('#a8a496'))
      ins.translate(ox, 8.22, 0)
      parts.push(ins)
    }
    // 電線: 弛んだ2条（東西へ抜ける）
    for (const [oy, sag] of [
      [8.24, 0.5],
      [8.22, 0.62],
    ] as const) {
      for (const dir of [1, -1]) {
        const segs = 10
        for (let s = 0; s < segs; s++) {
          const t0 = s / segs
          const t1 = (s + 1) / segs
          const x0 = dir * t0 * 28
          const x1 = dir * t1 * 28
          const y0 = oy - Math.sin(t0 * Math.PI) * -sag - t0 * t0 * sag * 2
          const y1 = oy - Math.sin(t1 * Math.PI) * -sag - t1 * t1 * sag * 2
          const len = Math.hypot(x1 - x0, y1 - y0)
          const wire = new CylinderGeometry(0.012, 0.012, len, 4)
          wire.rotateZ(Math.PI / 2 + Math.atan2(y1 - y0, x1 - x0))
          wire.translate((x0 + x1) / 2, (y0 + y1) / 2, 0)
          setVertexColor(wire, new Color('#2f2d2a'))
          parts.push(wire)
        }
      }
    }
    for (const p of parts) offsetUvs(p, rng(), rng())
    const poleMesh = new Mesh(
      mergeParts(parts),
      new MeshStandardMaterial({ roughness: 0.85, vertexColors: true }),
    )
    poleMesh.position.set(9.5, -0.05, 9.5)
    poleMesh.rotation.y = 0.1
    group.add(poleMesh)
  }

  return group
}
