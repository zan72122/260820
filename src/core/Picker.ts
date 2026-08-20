import * as THREE from 'three'

/**
 * タップ判定。3D の厳密なレイキャストではなく、
 * 画面上の距離で拾う。小さな対象でも 4歳児が押せるようにするため。
 */

type Target = {
  id: string
  anchor: THREE.Vector3
  enabled: boolean
  radius: number
}

export class Picker {
  private targets = new Map<string, Target>()
  private v = new THREE.Vector3()

  register(id: string, anchor: THREE.Vector3, radius = 1) {
    this.targets.set(id, { id, anchor, enabled: false, radius })
  }
  setAnchor(id: string, p: THREE.Vector3) {
    const t = this.targets.get(id)
    if (t) t.anchor.copy(p)
  }
  enable(id: string, on: boolean) {
    const t = this.targets.get(id)
    if (t) t.enabled = on
  }
  disableAll() {
    this.targets.forEach((t) => (t.enabled = false))
  }

  pick(clientX: number, clientY: number, camera: THREE.PerspectiveCamera, rect: DOMRect) {
    const w = rect.width
    const h = rect.height
    const base = Math.min(w, h)
    let best: string | null = null
    let bestD = Infinity
    this.targets.forEach((t) => {
      if (!t.enabled) return
      this.v.copy(t.anchor).project(camera)
      if (this.v.z > 1) return // 背面
      const sx = rect.left + ((this.v.x + 1) / 2) * w
      const sy = rect.top + ((1 - this.v.y) / 2) * h
      const d = Math.hypot(sx - clientX, sy - clientY)
      const r = Math.max(base * 0.13, 62) * t.radius
      if (d < r && d < bestD) {
        bestD = d
        best = t.id
      }
    })
    return best as string | null
  }
}
