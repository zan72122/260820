import * as THREE from 'three'
import { box, merge } from './geom'
import { groundHeight } from './layout'
import type { MaterialLib } from './materials'
import { makeRng, rand, type Rng } from '../core/util'

/**
 * 遠景。堤防の向こうの町並みと、その先の丘。
 * 夜になると窓に灯りが入り、地平がぼんやり明るくなる。
 */

export type CityBuild = {
  group: THREE.Group
  /** 夜の窓明かり（0..1） */
  setNight: (k: number) => void
  /** 川面に映す代表的な灯りの位置 */
  glowAnchors: THREE.Vector3[]
}

function buildingRow(
  rng: Rng,
  zFrom: number,
  zTo: number,
  xMin: number,
  xMax: number,
  count: number,
  hMin: number,
  hMax: number,
) {
  const bodies: THREE.BufferGeometry[] = []
  const windows: THREE.BufferGeometry[] = []
  for (let i = 0; i < count; i++) {
    const x = rand(rng, xMin, xMax)
    const z = rand(rng, zFrom, zTo)
    const w = rand(rng, 8, 26)
    const d = rand(rng, 8, 20)
    const h = rand(rng, hMin, hMax)
    const y = groundHeight(x, z)
    const rot = rand(rng, -0.35, 0.35)
    bodies.push(box(w, h, d, x, y + h / 2, z, 0.12, rot))
    // 窓面（正面だけ、少し内側に）
    const face = new THREE.PlaneGeometry(w * 0.94, h * 0.9)
    face.translate(0, 0, d / 2 + 0.06)
    face.rotateY(rot)
    face.translate(x, y + h / 2, z)
    const uv = face.getAttribute('uv') as THREE.BufferAttribute
    for (let v = 0; v < uv.count; v++) {
      uv.setXY(v, uv.getX(v) * Math.max(1, Math.round(w / 5)), uv.getY(v) * Math.max(1, Math.round(h / 4)))
    }
    uv.needsUpdate = true
    windows.push(face)
    // 裏面（川に向いていない側にも少しだけ）
    const back = new THREE.PlaneGeometry(w * 0.94, h * 0.9)
    back.rotateY(Math.PI)
    back.translate(0, 0, -d / 2 - 0.06)
    back.rotateY(rot)
    back.translate(x, y + h / 2, z)
    const uv2 = back.getAttribute('uv') as THREE.BufferAttribute
    for (let v = 0; v < uv2.count; v++) {
      uv2.setXY(v, uv2.getX(v) * Math.max(1, Math.round(w / 5)), uv2.getY(v) * Math.max(1, Math.round(h / 4)))
    }
    uv2.needsUpdate = true
    windows.push(back)
  }
  return { bodies, windows }
}

/** ゆるい稜線（丘）。長岡は市街の向こうに山がある。 */
function ridge(rng: Rng, z: number, height: number, color: THREE.Color, seed: number) {
  const n = 90
  const pos: number[] = []
  const idx: number[] = []
  const span = 2600
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const x = -span / 2 + span * t
    const r = makeRng(seed + i * 37)
    const h =
      height *
      (0.45 +
        0.55 *
          (Math.sin(t * 7.1 + seed) * 0.3 + Math.sin(t * 17.3 + seed * 2) * 0.18 + r() * 0.5 + 0.5))
    pos.push(x, 0, z, x, h, z)
  }
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2
    const b = a + 1
    const c = a + 2
    const d = a + 3
    idx.push(a, c, b, b, c, d)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  const m = new THREE.MeshBasicMaterial({ color, fog: true, side: THREE.DoubleSide })
  const mesh = new THREE.Mesh(g, m)
  void rng
  return mesh
}

export function buildCity(lib: MaterialLib, quality: number): CityBuild {
  const group = new THREE.Group()
  group.name = 'city'
  const rng = makeRng(3141592)
  const n = quality > 0.6 ? 1 : 0.6

  const near = buildingRow(rng, 250, 330, -420, 460, Math.round(58 * n), 6, 22)
  const far = buildingRow(rng, 340, 430, -600, 640, Math.round(34 * n), 8, 30)
  const across = buildingRow(rng, -320, -238, -560, 600, Math.round(46 * n), 6, 20)
  const across2 = buildingRow(rng, -430, -340, -700, 720, Math.round(26 * n), 8, 26)

  const bodies = merge([...near.bodies, ...far.bodies, ...across.bodies, ...across2.bodies])
  const bodyMesh = new THREE.Mesh(bodies, lib.buildingDay)
  bodyMesh.castShadow = false
  bodyMesh.receiveShadow = false
  group.add(bodyMesh)

  const winGeo = merge([...near.windows, ...far.windows, ...across.windows, ...across2.windows])
  const winMat = new THREE.MeshBasicMaterial({
    map: lib.windowTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0,
    fog: true,
    side: THREE.FrontSide,
  })
  const winMesh = new THREE.Mesh(winGeo, winMat)
  winMesh.renderOrder = 4
  group.add(winMesh)

  // 丘（三重に重ねて空気遠近を作る）
  group.add(ridge(rng, -900, 82, new THREE.Color('#6b7a92'), 11))
  group.add(ridge(rng, -1250, 120, new THREE.Color('#7d8aa0'), 29))
  group.add(ridge(rng, 620, 70, new THREE.Color('#6f7c93'), 53))

  const glowAnchors: THREE.Vector3[] = [
    new THREE.Vector3(-260, 8, -270),
    new THREE.Vector3(120, 8, -260),
    new THREE.Vector3(380, 8, -280),
  ]

  const ridges = group.children.filter((c) => c instanceof THREE.Mesh && c.material instanceof THREE.MeshBasicMaterial && !(c as THREE.Mesh).geometry.getAttribute('uv')) as THREE.Mesh[]

  return {
    group,
    glowAnchors,
    setNight: (k: number) => {
      winMat.opacity = k
      const dim = 1 - k * 0.82
      lib.buildingDay.color.setRGB(0.365 * dim, 0.372 * dim, 0.388 * dim)
      for (const r of ridges) {
        const m = r.material as THREE.MeshBasicMaterial
        m.color.setRGB(
          0.42 * (1 - k * 0.86) + 0.02 * k,
          0.48 * (1 - k * 0.86) + 0.03 * k,
          0.57 * (1 - k * 0.8) + 0.06 * k,
        )
      }
    },
  }
}
