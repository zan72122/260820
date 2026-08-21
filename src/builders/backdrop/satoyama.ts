import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
} from 'three'
import { deriveRng } from '../../core/rng'
import { FOG_COLOR } from '../../lighting/GoldenHourRig'

/**
 * 遠景: 里山の稜線3層。各層はシーンを囲む円弧のストリップ（実メッシュ）
 * なので端が見えず、層間の視差も正しく出る。西（方位 240°〜300°）だけ
 * 開けて夕陽と田の抜けを残す — 谷戸の集落の地形として妥当な形。
 *
 * 遠山はライティングに反応させず（MeshBasicMaterial）、大気の色へ
 * 事前彩色する。稜線の凹凸と高さの揺らぎはシード由来。
 */
export function buildSatoyama(seed: number): Group {
  const group = new Group()
  group.name = 'satoyama'

  const layers = [
    { dist: 170, height: 48, color: '#4f4c45', haze: 0.3, detail: 1.0 },
    { dist: 320, height: 78, color: '#6d655c', haze: 0.55, detail: 0.6 },
    { dist: 540, height: 108, color: '#9c8873', haze: 0.75, detail: 0.3 },
  ]
  const fog = new Color(FOG_COLOR)

  layers.forEach((layer, li) => {
    const rng = deriveRng(seed, `ridge${li}`)
    // 方位: 北0 → 時計回り。西の開口（240°±30°）を避けた円弧。
    const start = ((300 + li * 6) * Math.PI) / 180
    const span = ((300 - li * 10) * Math.PI) / 180
    const n = 160
    const positions: number[] = []
    const colors: number[] = []
    const indices: number[] = []

    const p1 = rng() * Math.PI * 2
    const p2 = rng() * Math.PI * 2
    const p3 = rng() * Math.PI * 2
    const profile = (t: number) => {
      const big =
        Math.sin(t * Math.PI * 2 * 2.3 + p1) * 0.42 +
        Math.sin(t * Math.PI * 2 * 4.7 + p2) * 0.28
      const trees = Math.sin(t * Math.PI * 2 * 41 + p3) * 0.05 * layer.detail
      // 弧の両端は水平線へ沈む
      const taper = Math.min(1, Math.min(t, 1 - t) * 7)
      return Math.max(0.03, (0.6 + big * 0.4 + trees) * taper)
    }

    const base = new Color(layer.color)
    const hazed = base.clone().lerp(fog, layer.haze)
    const bottom = hazed.clone().lerp(fog, 0.5)

    for (let i = 0; i <= n; i++) {
      const t = i / n
      const az = start + t * span
      const x = Math.sin(az) * layer.dist
      const z = -Math.cos(az) * layer.dist
      const top = layer.height * profile(t) + layer.height * 0.06 * (rng() - 0.5)
      positions.push(x, -3, z, x, top, z)
      colors.push(bottom.r, bottom.g, bottom.b, hazed.r, hazed.g, hazed.b)
      if (i < n) {
        const a = i * 2
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
      }
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    geo.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
    geo.setIndex(indices)
    const mesh = new Mesh(
      geo,
      new MeshBasicMaterial({ vertexColors: true, fog: false, side: 2 }),
    )
    group.add(mesh)
  })

  return group
}
