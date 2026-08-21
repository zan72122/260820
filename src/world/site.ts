/** 現場そのもの：地盤、基礎、仮囲い、カラーコーン、既存公園、空。 */
import * as THREE from 'three'
import type { Palette } from './materials'
import type { QualitySettings } from '../core/env'
import { FOUNDATIONS, SITE } from '../build/layout'
import { buildFoundation } from '../build/parts'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { chamferBox, mergeInto } from '../build/geometry'
import { Rng } from '../core/rng'

export interface SiteRefs {
  root: THREE.Group
  gate: THREE.Group
  sun: THREE.DirectionalLight
  anchorGroups: Map<string, THREE.Group>
}

function skyMaterial(): THREE.ShaderMaterial {
  const uniforms = {
    top: { value: new THREE.Color(0x4e7fae) },
    horizon: { value: new THREE.Color(0xc4d3dc) },
    ground: { value: new THREE.Color(0x8f8778) },
  }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 ground;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 c = mix(horizon, top, clamp(pow(max(h, 0.0), 0.55), 0.0, 1.0));
        c = mix(c, ground, clamp(-h * 3.0, 0.0, 1.0));
        // 朝の薄い雲
        float band = smoothstep(0.05, 0.4, h) * (1.0 - smoothstep(0.4, 0.85, h));
        c += vec3(0.05, 0.05, 0.045) * band;
        gl_FragColor = vec4(c, 1.0);
      }`,
  })
  return mat
}

function skyDome(): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(220, 24, 16), skyMaterial())
  mesh.renderOrder = -1
  return mesh
}

/**
 * 金属（溶融亜鉛めっき、ボルト、クレーン）は環境反射がないと真っ黒になる。
 * 空と地面だけの簡易シーンから PMREM を作り、朝の空を映り込ませる。
 */
export function buildEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const envScene = new THREE.Scene()
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(60, 24, 16), skyMaterial()))
  const groundDisc = new THREE.Mesh(
    new THREE.CircleGeometry(58, 24),
    new THREE.MeshBasicMaterial({ color: 0x6d6152, side: THREE.DoubleSide }),
  )
  groundDisc.rotation.x = -Math.PI / 2
  groundDisc.position.y = -1.4
  envScene.add(groundDisc)
  // 朝日の明るい部分
  const sunCard = new THREE.Mesh(
    new THREE.SphereGeometry(9, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff3dc }),
  )
  sunCard.position.set(-30, 26, 30)
  envScene.add(sunCard)
  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()
  const target = pmrem.fromScene(envScene, 0.02)
  pmrem.dispose()
  envScene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose()
      ;(o.material as THREE.Material).dispose()
    }
  })
  return target.texture
}

/** 既存樹木。周囲一周に instancing で並べ、どの画角でも背景が抜けないようにする。 */
function plantTrees(root: THREE.Group, pal: Palette, rng: Rng, count: number, tier: QualitySettings['tier']) {
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.9, 1, tier === 'low' ? 5 : 7)
  trunkGeo.translate(0, 0.5, 0)
  const leafGeo = new THREE.IcosahedronGeometry(1, tier === 'high' ? 1 : 0)
  const blobs = tier === 'low' ? 2 : 3
  const trunks = new THREE.InstancedMesh(trunkGeo, pal.bark, count)
  const leaves = new THREE.InstancedMesh(leafGeo, pal.foliage, count * blobs)
  trunks.castShadow = tier !== 'low'
  leaves.castShadow = tier !== 'low'
  trunks.receiveShadow = true
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  let li = 0
  for (let i = 0; i < count; i++) {
    const h = rng.range(3.6, 7.4)
    // 一周を等分してから揺らす。少ない本数でもどの方向にも樹が来る。
    const ang = ((i + rng.range(0.15, 0.85)) / count) * Math.PI * 2
    const dist = rng.range(13, 38)
    const x = Math.cos(ang) * dist
    const z = Math.sin(ang) * dist
    q.setFromEuler(new THREE.Euler(0, rng.range(0, 6.28), 0))
    m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(h * 0.045, h * 0.5, h * 0.045))
    trunks.setMatrixAt(i, m)
    for (let b = 0; b < blobs; b++) {
      const r = h * rng.range(0.19, 0.28)
      q.setFromEuler(new THREE.Euler(rng.range(0, 1), rng.range(0, 6.28), rng.range(0, 1)))
      m.compose(
        new THREE.Vector3(x + rng.range(-0.5, 0.5) * r, h * rng.range(0.5, 0.8), z + rng.range(-0.5, 0.5) * r),
        q,
        new THREE.Vector3(r, r * 0.85, r),
      )
      leaves.setMatrixAt(li++, m)
    }
  }
  trunks.instanceMatrix.needsUpdate = true
  leaves.instanceMatrix.needsUpdate = true
  root.add(trunks, leaves)
}

/** 仮囲い：メッシュパネル＋支柱＋転倒防止ウェイト。1 枚を merge して instancing する。 */
function fencePanelGeometry(): THREE.BufferGeometry {
  const f = SITE.fence
  const h = f.height
  const w = 1.78
  const parts: THREE.BufferGeometry[] = []
  const bar = (bw: number, bh: number, bd: number, x: number, y: number) => {
    const g = chamferBox(bw, bh, bd, 0.004)
    g.translate(x, y, 0)
    parts.push(g)
  }
  bar(w, 0.05, 0.05, 0, h - 0.025)
  bar(w, 0.05, 0.05, 0, 0.16)
  bar(0.05, h - 0.16, 0.05, -w / 2 + 0.025, (h + 0.16) / 2)
  bar(0.05, h - 0.16, 0.05, w / 2 - 0.025, (h + 0.16) / 2)
  const wires = 13
  for (let i = 1; i < wires; i++) {
    bar(0.016, h - 0.2, 0.016, -w / 2 + (w * i) / wires, (h + 0.16) / 2)
  }
  for (const y of [h * 0.45, h * 0.72]) bar(w - 0.06, 0.014, 0.014, 0, y)
  const merged = mergeGeometries(parts, false)
  parts.forEach((g) => g.dispose())
  return merged ?? new THREE.BufferGeometry()
}

interface FenceRun {
  x: number
  z: number
  angle: number
}

function fenceLayout(): FenceRun[] {
  const f = SITE.fence
  const runs: FenceRun[] = []
  const addRun = (x0: number, z0: number, x1: number, z1: number, gate: boolean) => {
    const len = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.max(1, Math.round(len / 1.8))
    const dx = (x1 - x0) / n
    const dz = (z1 - z0) / n
    const angle = Math.atan2(-dz, dx)
    for (let i = 0; i < n; i++) {
      const cx = x0 + dx * (i + 0.5)
      const cz = z0 + dz * (i + 0.5)
      if (gate && Math.abs(cx) < f.gateHalf) continue
      runs.push({ x: cx, z: cz, angle })
    }
  }
  addRun(f.minX, f.minZ, f.maxX, f.minZ, true)
  addRun(f.maxX, f.minZ, f.maxX, f.maxZ, false)
  addRun(f.maxX, f.maxZ, f.minX, f.maxZ, false)
  addRun(f.minX, f.maxZ, f.minX, f.minZ, false)
  return runs
}

function fencePanels(pal: Palette): THREE.Group {
  const g = new THREE.Group()
  const runs = fenceLayout()
  const geo = fencePanelGeometry()
  const panels = new THREE.InstancedMesh(geo, pal.fencePost, runs.length)
  panels.castShadow = false
  panels.receiveShadow = true
  const weightGeo = chamferBox(0.62, 0.1, 0.24, 0.012)
  const weights = new THREE.InstancedMesh(weightGeo, pal.coneBase, runs.length)
  weights.receiveShadow = true
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const one = new THREE.Vector3(1, 1, 1)
  runs.forEach((r, i) => {
    q.setFromEuler(new THREE.Euler(0, r.angle, 0))
    m.compose(new THREE.Vector3(r.x, 0, r.z), q, one)
    panels.setMatrixAt(i, m)
    m.compose(new THREE.Vector3(r.x, 0.05, r.z), q, one)
    weights.setMatrixAt(i, m)
  })
  panels.instanceMatrix.needsUpdate = true
  weights.instanceMatrix.needsUpdate = true
  g.add(panels, weights)
  return g
}

function cone(pal: Palette): THREE.Group {
  const g = new THREE.Group()
  const c = mergeInto(g, new THREE.ConeGeometry(0.15, 0.6, 12, 1, true), pal.cone)
  c.position.y = 0.3
  const band = mergeInto(g, new THREE.CylinderGeometry(0.096, 0.113, 0.09, 12, 1, true), pal.fence)
  band.position.y = 0.35
  const base = mergeInto(g, chamferBox(0.32, 0.03, 0.32, 0.006), pal.coneBase)
  base.position.y = 0.015
  return g
}

export function buildSite(scene: THREE.Scene, pal: Palette, q: QualitySettings): SiteRefs {
  const root = new THREE.Group()
  scene.add(root)
  const rng = new Rng(8123)

  scene.add(skyDome())
  scene.fog = new THREE.Fog(0xb9c8d2, 26, 130)

  // 地盤
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300, 1, 1), pal.ground)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  root.add(ground)

  // 滑走出口の安全舗装（ウッドチップ）
  const surf = mergeInto(root, chamferBox(3.0, 0.035, 3.9, 0.01), pal.safetySurface, false)
  surf.position.set(0, 0.018, -3.2)
  surf.receiveShadow = true

  // 砕石・掘削残土
  const gravelGeo = new THREE.IcosahedronGeometry(1, 0)
  const gravel = new THREE.InstancedMesh(gravelGeo, pal.gravel, q.groundDetail)
  const m4 = new THREE.Matrix4()
  const quat = new THREE.Quaternion()
  const scl = new THREE.Vector3()
  for (let i = 0; i < q.groundDetail; i++) {
    const r = rng.range(0.02, 0.075)
    scl.set(r, r * 0.7, r * rng.range(0.8, 1.2))
    quat.setFromEuler(new THREE.Euler(rng.range(0, 3), rng.range(0, 3), rng.range(0, 3)))
    m4.compose(new THREE.Vector3(rng.range(-4.0, 2.4), r * 0.4, rng.range(-5.0, 5.4)), quat, scl)
    gravel.setMatrixAt(i, m4)
  }
  gravel.instanceMatrix.needsUpdate = true
  gravel.castShadow = q.tier !== 'low'
  gravel.receiveShadow = true
  root.add(gravel)

  // 大きな湿りむら（タイル境界を隠す非反復の汚し）
  const damp = new THREE.Mesh(
    new THREE.CircleGeometry(1, 16),
    new THREE.MeshStandardMaterial({ color: 0x6d5c46, roughness: 0.55, transparent: true, opacity: 0.5, depthWrite: false }),
  )
  damp.rotation.x = -Math.PI / 2
  for (const [dx, dz, r] of [
    [-2.6, -1.9, 1.5],
    [1.4, 1.9, 1.1],
    [-0.4, 4.4, 1.7],
    [2.0, -3.4, 1.2],
    [-3.4, 2.6, 1.0],
  ] as Array<[number, number, number]>) {
    const d = damp.clone()
    d.position.set(dx, 0.006, dz)
    d.scale.setScalar(r)
    d.renderOrder = 1
    root.add(d)
  }

  // 砕石の山と土のう
  const pile = mergeInto(root, new THREE.ConeGeometry(0.85, 0.55, 12), pal.gravel)
  pile.position.set(-3.3, 0.27, -1.4)
  pile.scale.set(1, 1, 0.8)

  // 枕木（部材の下敷き）
  for (const [x, z, rot] of [
    [-0.9, 4.1, 0],
    [-0.9, 4.78, 0],
    [1.35, 4.3, 0],
    [0.1, 2.75, Math.PI / 2],
    [0.1, 3.35, Math.PI / 2],
    [-2.6, 1.5, Math.PI / 2],
  ] as Array<[number, number, number]>) {
    const dun = mergeInto(root, chamferBox(1.5, 0.09, 0.14, 0.006), pal.timber)
    dun.position.set(x, 0.045, z)
    dun.rotation.y = rot
  }

  // 基礎
  const anchorGroups = new Map<string, THREE.Group>()
  for (const f of FOUNDATIONS) {
    const g = buildFoundation(pal, f)
    root.add(g)
    anchorGroups.set(f.id, g)
  }

  // 仮囲い＋ゲート
  root.add(fencePanels(pal))
  const gate = new THREE.Group()
  const f = SITE.fence
  const leafGeo = fencePanelGeometry()
  leafGeo.scale((f.gateHalf - 0.04) / 1.78, 1, 1)
  for (const sx of [-1, 1]) {
    const leaf = new THREE.Group()
    const panel = mergeInto(leaf, leafGeo, pal.fencePost, false)
    panel.position.set((sx * (f.gateHalf - 0.04)) / 2, 0, 0)
    leaf.userData.sx = sx
    leaf.position.set(sx * 0.02, 0, 0)
    gate.add(leaf)
  }
  gate.position.set(0, 0, f.minZ)
  root.add(gate)

  // カラーコーン＋バー（作業区域の地面表示）
  const conePositions: Array<[number, number]> = [
    [-1.7, -1.0], [-1.7, -2.4], [-1.7, -3.8], [1.7, -1.0], [1.7, -2.4], [1.7, -3.8],
    [-1.9, 0.6], [1.9, 0.6], [-2.6, 2.6], [2.2, 1.2], [-3.4, -0.4], [2.3, -4.6], [-2.2, -4.6],
  ]
  for (const [x, z] of conePositions) {
    const c = cone(pal)
    c.position.set(x, 0, z)
    c.rotation.y = rng.range(0, Math.PI)
    root.add(c)
  }

  // 背景：既存樹木
  plantTrees(root, pal, rng, Math.max(16, q.vegetation), q.tier)

  // 背景：完成済みの別遊具（クライミング）
  const play = new THREE.Group()
  for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]] as Array<[number, number]>) {
    const p = mergeInto(play, new THREE.CylinderGeometry(0.05, 0.05, 2.0, 8), pal.rail, false)
    p.position.set(x, 1.0, z)
  }
  const roof = mergeInto(play, chamferBox(1.6, 0.08, 1.6, 0.01), pal.deck, false)
  roof.position.y = 2.0
  for (let i = 0; i < 5; i++) {
    const rung = mergeInto(play, new THREE.CylinderGeometry(0.025, 0.025, 1.2, 6), pal.galvanized, false)
    rung.rotation.z = Math.PI / 2
    rung.position.set(0, 0.35 + i * 0.33, 0.6)
  }
  play.position.set(-11.5, 0, -3.5)
  play.rotation.y = 0.4
  root.add(play)

  // 背景：住宅と丘
  for (let i = 0; i < 11; i++) {
    const h = new THREE.Group()
    const bw = rng.range(5, 9)
    const bh = rng.range(3.4, 5.2)
    const body = mergeInto(h, chamferBox(bw, bh, rng.range(5, 8), 0.05), pal.house, false)
    body.position.y = bh / 2
    const rf = mergeInto(h, new THREE.ConeGeometry(bw * 0.82, 1.5, 4), pal.roof, false)
    rf.position.y = bh + 0.75
    rf.rotation.y = Math.PI / 4
    const ha = rng.range(0, Math.PI * 2)
    const hd = rng.range(38, 62)
    h.position.set(Math.cos(ha) * hd, 0, Math.sin(ha) * hd)
    h.rotation.y = ha + rng.range(-0.4, 0.4)
    root.add(h)
  }
  for (const [hx, hz, hr, hs] of [
    [-46, -118, 46, 1.6],
    [58, -132, 52, 1.4],
    [-96, 60, 54, 1.5],
    [70, 96, 44, 1.3],
  ] as Array<[number, number, number, number]>) {
    const hill = mergeInto(root, new THREE.SphereGeometry(hr, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), pal.foliage, false)
    hill.position.set(hx, -hr * 0.66, hz)
    hill.scale.set(hs, 0.42, 1)
  }

  // 光：午前の自然光。作業灯は使わない。
  const hemi = new THREE.HemisphereLight(0xbdd4e6, 0x7d7466, 0.62)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xfff0d8, 3.1)
  sun.position.set(-10.5, 7.6, 7.2)
  sun.target.position.set(0, 0.8, -0.6)
  scene.add(sun.target)
  if (q.shadowMapSize > 0) {
    sun.castShadow = true
    sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize)
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 40
    sun.shadow.camera.left = -9
    sun.shadow.camera.right = 9
    sun.shadow.camera.top = 9
    sun.shadow.camera.bottom = -9
    sun.shadow.bias = -0.0012
    sun.shadow.normalBias = 0.012
  }
  scene.add(sun)
  const fill = new THREE.DirectionalLight(0xcfe0ef, 0.28)
  fill.position.set(7, 5, -8)
  scene.add(fill)

  return { root, gate, sun, anchorGroups }
}

/** 端末が弱いときの接地影（影マップを使わない代替） */
export function makeContactShadow(size: number): THREE.Mesh {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62)
  grad.addColorStop(0, 'rgba(0,0,0,0.55)')
  grad.addColorStop(0.55, 'rgba(0,0,0,0.26)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.9 }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.renderOrder = 2
  return mesh
}
