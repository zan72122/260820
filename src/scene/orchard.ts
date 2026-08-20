/**
 * The orchard around the hero objects. Everything here is deliberately cheaper
 * than the fruit: instanced grass, instanced litter, instanced background
 * canopies. What it must get right is contact - branch weight, leaf shadows
 * falling on the fruit and on the sheet, and nothing hovering above the soil.
 */
import * as THREE from 'three'
import { groundHeight } from './terrain'
import {
  makeBarkTextures,
  makeCanopyTexture,
  makeGrassTexture,
  makeGroundTextures,
  makeLeafTextures,
  type LeafTextures,
  type SurfaceTextures,
} from './textures'
import { makeRng } from '../sim/noise'
import { withBounce } from './bounceMaterial'
import type { LightRig } from './lightRig'
import type { QualitySettings } from '../core/quality'
import type { Occluder } from '../sim/blush'

export interface RoundLayout {
  peachSeed: number
  bagSeed: number
  sheetSeed: number
  leafSeed: number
  peachPos: THREE.Vector3
  branchYaw: number
  branchLift: number
  sheetOrigin: THREE.Vector3
  sheetDir: THREE.Vector3
  sheetLength: number
  sheetWidth: number
}

export function layoutForRound(round: number): RoundLayout {
  const rng = makeRng(9001 + round * 7919)
  const yaw = round === 0 ? 0 : (rng() - 0.5) * 0.85
  const px = round === 0 ? 0 : (rng() - 0.5) * 0.36
  const pz = round === 0 ? 0 : (rng() - 0.5) * 0.22
  const py = 0.84 + (round === 0 ? 0.02 : rng() * 0.09)
  // The sheet runs across the frame rather than straight away from the
  // camera, so its spread and its position stay readable.
  const dir = new THREE.Vector3(-1, 0, 0.06 + (round === 0 ? 0 : (rng() - 0.5) * 0.36)).normalize()
  return {
    peachSeed: 1000 + round * 137,
    bagSeed: 2000 + round * 311,
    sheetSeed: 3000 + round * 523,
    leafSeed: 4000 + round * 701,
    peachPos: new THREE.Vector3(px, py, pz),
    branchYaw: yaw,
    branchLift: round === 0 ? 0 : (rng() - 0.5) * 0.08,
    sheetOrigin: new THREE.Vector3(px + 0.72, 0, pz - 0.02),
    sheetDir: dir,
    sheetLength: 1.4 + (round === 0 ? 0.04 : rng() * 0.3),
    sheetWidth: 0.46 + (round === 0 ? 0.05 : rng() * 0.18),
  }
}

interface Disposable {
  dispose(): void
}

export class Orchard {
  readonly group = new THREE.Group()
  readonly branchGroup = new THREE.Group()
  /** Where the fruit's stalk meets the branch. */
  readonly hangPoint = new THREE.Vector3()
  readonly sunSprite: THREE.Sprite

  private disposables: Disposable[] = []
  private leafTex: LeafTextures
  private leafMesh: THREE.InstancedMesh | null = null
  private leafMaterial: THREE.MeshPhysicalMaterial
  private branchMesh: THREE.Mesh | null = null
  private barkTex: SurfaceTextures
  private pedicel: THREE.Mesh | null = null
  private occluderList: Occluder[] = []
  private q: QualitySettings
  private layout: RoundLayout

  constructor(
    private scene: THREE.Scene,
    private rig: LightRig,
    q: QualitySettings,
    layout: RoundLayout,
  ) {
    this.q = q
    this.layout = layout
    this.scene.add(this.group)
    this.group.add(this.branchGroup)

    this.barkTex = makeBarkTextures(77)
    this.leafTex = makeLeafTextures(layout.leafSeed)
    this.disposables.push(this.barkTex, this.leafTex)

    this.leafMaterial = withBounce(
      new THREE.MeshPhysicalMaterial({
        map: this.leafTex.map,
        alphaMap: this.leafTex.alphaMap,
        normalMap: this.leafTex.normalMap,
        alphaTest: 0.5,
        transparent: false,
        side: THREE.DoubleSide,
        roughness: 0.68,
        metalness: 0,
        sheen: 0.4,
        sheenColor: new THREE.Color(0xd8e8b0),
        sheenRoughness: 0.7,
        envMapIntensity: 0.7,
      }),
      rig,
      {
        fragmentCommon: /* glsl */ `
          float momoLeafBounce() {
            return momoBounce(vMomoWPos, normalize(vMomoWNrm), uQ0, uQ1, uQ2, uQ3,
                              uSheetNormal, uSunDir, uSheetAlbedo, uSunStrength, uSheetDeployed);
          }
        `,
        afterLights: /* glsl */ `
          {
            // Leaves are thin: light comes through from behind, and the sheet
            // puts a faint green-white on their undersides.
            vec3 wn = normalize(vMomoWNrm);
            float back = max(0.0, dot(-wn, uSunDir));
            reflectedLight.indirectDiffuse += diffuseColor.rgb * pow(back, 1.6) * uSunStrength * 0.38;
            float bnc = momoLeafBounce() * uBounceGain;
            reflectedLight.indirectDiffuse += uSheetTint * bnc * 0.7 * diffuseColor.rgb;
          }
        `,
      },
    )

    this.buildGround()
    this.buildScatter()
    this.buildBackground()
    this.buildBranch(layout)

    this.sunSprite = this.buildSun()
    this.group.add(this.sunSprite)
  }

  private buildGround(): void {
    const tex = makeGroundTextures(51)
    this.disposables.push(tex)
    for (const t of [tex.map, tex.normalMap, tex.roughnessMap]) {
      t.repeat.set(42, 42)
      t.anisotropy = this.q.anisotropy
    }
    const size = 64
    const seg = this.q.tier === 'low' ? 140 : 220
    const geo = new THREE.PlaneGeometry(size, size, seg, seg)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      pos.setY(i, groundHeight(x, z))
    }
    geo.computeVertexNormals()
    const mat = withBounce(
      new THREE.MeshPhysicalMaterial({
        map: tex.map,
        normalMap: tex.normalMap,
        roughnessMap: tex.roughnessMap,
        roughness: 1,
        metalness: 0,
        envMapIntensity: 0.55,
      }),
      this.rig,
      {
        afterMap: /* glsl */ `
          {
            // Macro breakup: the same soil sampled far larger kills the tiling
            // that a repeated texture would otherwise print across the orchard.
            vec3 macro = texture2D(map, vMapUv * 0.077).rgb;
            diffuseColor.rgb *= mix(vec3(1.0), macro * 1.9, 0.4);
          }
        `,
        afterLights: /* glsl */ `
          {
            float bnc = momoBounce(vMomoWPos, normalize(vMomoWNrm), uQ0, uQ1, uQ2, uQ3,
                                   uSheetNormal, uSunDir, uSheetAlbedo, uSunStrength, uSheetDeployed);
            reflectedLight.indirectDiffuse += uSheetTint * bnc * 0.5 * diffuseColor.rgb;
          }
        `,
      },
    )
    const mesh = new THREE.Mesh(geo, mat)
    mesh.receiveShadow = true
    this.group.add(mesh)
    this.disposables.push(geo, mat)
  }

  private buildScatter(): void {
    const rng = makeRng(4242)
    const grass = makeGrassTexture(88)
    this.disposables.push(grass.map, grass.alphaMap)
    grass.map.anisotropy = this.q.anisotropy
    const bladeGeo = new THREE.PlaneGeometry(0.17, 0.17, 1, 1)
    bladeGeo.translate(0, 0.085, 0)
    const grassMat = new THREE.MeshPhysicalMaterial({
      map: grass.map,
      alphaMap: grass.alphaMap,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.85,
      metalness: 0,
      envMapIntensity: 0.6,
    })
    const tufts = this.q.grassTufts
    const grassMesh = new THREE.InstancedMesh(bladeGeo, grassMat, tufts * 2)
    const m = new THREE.Matrix4()
    const qt = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    let n = 0
    for (let i = 0; i < tufts; i++) {
      // Keep the working area clear so grass never hides the causal objects.
      let x = 0
      let z = 0
      for (let tries = 0; tries < 8; tries++) {
        const a = rng() * Math.PI * 2
        const r = 0.9 + Math.pow(rng(), 0.7) * 5.4
        x = Math.cos(a) * r + 0.2
        z = Math.sin(a) * r - 0.1
        if (Math.hypot(x - 0.1, z + 0.05) > 1.35) break
      }
      const y = groundHeight(x, z)
      const s = 0.6 + rng() * 0.9
      const rot = rng() * Math.PI
      for (let k = 0; k < 2; k++) {
        qt.setFromAxisAngle(up, rot + k * Math.PI * 0.5)
        m.compose(new THREE.Vector3(x, y - 0.01, z), qt, new THREE.Vector3(s, s, s))
        grassMesh.setMatrixAt(n++, m)
      }
    }
    grassMesh.count = n
    grassMesh.instanceMatrix.needsUpdate = true
    grassMesh.castShadow = false
    grassMesh.receiveShadow = false
    this.group.add(grassMesh)
    this.disposables.push(bladeGeo, grassMat)

    const pebbleGeo = new THREE.IcosahedronGeometry(0.013, 0)
    const pebbleMat = new THREE.MeshPhysicalMaterial({
      color: 0x8d8478,
      roughness: 0.96,
      metalness: 0,
      envMapIntensity: 0.18,
      flatShading: true,
    })
    const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, this.q.groundPebbles)
    for (let i = 0; i < this.q.groundPebbles; i++) {
      const a = rng() * Math.PI * 2
      const r = 0.35 + rng() * 1.9
      const x = Math.cos(a) * r + 0.2
      const z = Math.sin(a) * r * 0.7
      const y = groundHeight(x, z)
      const s = 0.5 + rng() * 1.3
      qt.setFromEuler(new THREE.Euler(rng() * 3, rng() * 3, rng() * 3))
      m.compose(new THREE.Vector3(x, y + 0.008 * s, z), qt, new THREE.Vector3(s, s * 0.6, s))
      pebbles.setMatrixAt(i, m)
    }
    pebbles.instanceMatrix.needsUpdate = true
    pebbles.castShadow = this.q.tier !== 'low'
    pebbles.receiveShadow = false
    this.group.add(pebbles)
    this.disposables.push(pebbleGeo, pebbleMat)

    // Dry fallen leaves.
    const litterGeo = new THREE.PlaneGeometry(0.06, 0.11)
    litterGeo.rotateX(-Math.PI / 2)
    const litterMat = new THREE.MeshPhysicalMaterial({
      map: this.leafTex.map,
      alphaMap: this.leafTex.alphaMap,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      color: new THREE.Color(0xa88a58),
      roughness: 0.9,
      metalness: 0,
    })
    const litterCount = Math.round(this.q.grassTufts * 0.14)
    const litter = new THREE.InstancedMesh(litterGeo, litterMat, litterCount)
    for (let i = 0; i < litterCount; i++) {
      const a = rng() * Math.PI * 2
      const r = 0.5 + rng() * 3.2
      const x = Math.cos(a) * r + 0.2
      const z = Math.sin(a) * r * 0.8
      const y = groundHeight(x, z)
      qt.setFromEuler(new THREE.Euler((rng() - 0.5) * 0.4, rng() * 6.3, (rng() - 0.5) * 0.4))
      const s = 0.7 + rng() * 0.7
      m.compose(new THREE.Vector3(x, y + 0.004, z), qt, new THREE.Vector3(s, s, s))
      litter.setMatrixAt(i, m)
    }
    litter.instanceMatrix.needsUpdate = true
    this.group.add(litter)
    this.disposables.push(litterGeo, litterMat)
  }

  private buildBackground(): void {
    const rng = makeRng(1717)
    const canopy = makeCanopyTexture(303)
    this.disposables.push(canopy.map, canopy.alphaMap)
    const canopyGeo = new THREE.PlaneGeometry(1.7, 1.5)
    const canopyMat = new THREE.MeshBasicMaterial({
      map: canopy.map,
      alphaMap: canopy.alphaMap,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      fog: true,
    })
    const trunkGeo = new THREE.CylinderGeometry(0.11, 0.19, 1.7, 6, 1)
    const trunkMat = new THREE.MeshPhysicalMaterial({
      map: this.barkTex.map,
      normalMap: this.barkTex.normalMap,
      roughness: 0.95,
      metalness: 0,
    })
    const count = this.q.backgroundTrees * 4
    const clumps = 9
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, count * clumps)
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count)
    const m = new THREE.Matrix4()
    const qt = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const pos = new THREE.Vector3()
    // The camera always looks roughly this way; keep that wedge of the horizon
    // clear so nothing grows out of the fruit's head.
    const viewAz = Math.atan2(-0.72, -0.69)
    let ci = 0
    let ti = 0
    for (let i = 0; i < count; i++) {
      // Half the trees form a far row that may stand anywhere; the near ones
      // must keep out of the wedge the camera shoots through.
      const far = i % 3 !== 0
      let a = 0
      let r = 0
      for (let tries = 0; tries < 12; tries++) {
        a = rng() * Math.PI * 2
        r = far ? 17 + rng() * 11 : 10 + rng() * 6
        const d = Math.abs((((a - viewAz) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI)
        if (far || d > 0.3) break
      }
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const y = groundHeight(x, z)
      const s = 0.9 + rng() * 0.7
      qt.setFromAxisAngle(up, rng() * 6.28)
      m.compose(pos.set(x, y + 0.85 * s, z), qt, new THREE.Vector3(s, s, s))
      trunks.setMatrixAt(ti++, m)
      for (let k = 0; k < clumps; k++) {
        // Several small clumps, never one big blob: a canopy has to have edges.
        qt.setFromEuler(new THREE.Euler((rng() - 0.5) * 0.5, rng() * 6.28, (rng() - 0.5) * 0.4))
        const cs = s * (0.55 + rng() * 0.6)
        m.compose(
          pos.set(
            x + (rng() - 0.5) * 3.0 * s,
            y + (1.15 + rng() * 1.7) * s,
            z + (rng() - 0.5) * 3.0 * s,
          ),
          qt,
          new THREE.Vector3(cs, cs, cs),
        )
        canopies.setMatrixAt(ci++, m)
      }
    }
    canopies.count = ci
    trunks.count = ti
    canopies.instanceMatrix.needsUpdate = true
    trunks.instanceMatrix.needsUpdate = true
    this.group.add(canopies)
    this.group.add(trunks)
    this.disposables.push(canopyGeo, canopyMat, trunkGeo, trunkMat)
  }

  private buildSun(): THREE.Sprite {
    const canvasTex = new THREE.DataTexture(
      (() => {
        const s = 64
        const d = new Uint8Array(s * s * 4)
        for (let y = 0; y < s; y++) {
          for (let x = 0; x < s; x++) {
            const dx = (x + 0.5) / s - 0.5
            const dy = (y + 0.5) / s - 0.5
            const r = Math.hypot(dx, dy) * 2
            const core = Math.max(0, 1 - Math.pow(r / 0.13, 4))
            const halo = Math.pow(Math.max(0, 1 - r), 1.9) * 0.4
            const a = Math.min(1, core + halo)
            const warm = 1 - Math.min(1, r * 1.6)
            const i = (y * s + x) * 4
            d[i] = 255
            d[i + 1] = 236 + warm * 19
            d[i + 2] = 186 + warm * 60
            d[i + 3] = a * 255
          }
        }
        return d
      })(),
      64,
      64,
      THREE.RGBAFormat,
    )
    canvasTex.colorSpace = THREE.SRGBColorSpace
    canvasTex.needsUpdate = true
    const mat = new THREE.SpriteMaterial({
      map: canvasTex,
      fog: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    })
    const sprite = new THREE.Sprite(mat)
    sprite.scale.setScalar(3.2)
    sprite.renderOrder = -1
    this.disposables.push(canvasTex, mat)
    return sprite
  }

  private buildBranch(layout: RoundLayout): void {
    if (this.branchMesh) {
      this.branchGroup.remove(this.branchMesh)
      this.branchMesh.geometry.dispose()
      this.branchMesh = null
    }
    if (this.leafMesh) {
      this.branchGroup.remove(this.leafMesh)
      this.leafMesh.geometry.dispose()
      this.leafMesh = null
    }
    this.branchGroup.rotation.y = layout.branchYaw
    this.branchGroup.position.set(0, layout.branchLift, 0)

    const anchor = layout.peachPos
    const y0 = anchor.y + 0.185
    const pts = [
      new THREE.Vector3(anchor.x - 1.55, y0 + 0.5, anchor.z - 0.57),
      new THREE.Vector3(anchor.x - 0.85, y0 + 0.28, anchor.z - 0.32),
      new THREE.Vector3(anchor.x - 0.3, y0 + 0.09, anchor.z - 0.08),
      new THREE.Vector3(anchor.x, y0, anchor.z + 0.02),
      new THREE.Vector3(anchor.x + 0.5, y0 + 0.03, anchor.z + 0.12),
      new THREE.Vector3(anchor.x + 1.15, y0 + 0.16, anchor.z + 0.02),
    ]
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4)
    const seg = this.q.tier === 'low' ? 44 : 80
    const geo = new THREE.TubeGeometry(curve, seg, 0.026, this.q.tier === 'low' ? 6 : 10, false)
    // Taper: thick at the trunk end, slender at the tip.
    const pos = geo.attributes.position as THREE.BufferAttribute
    const nrm = geo.attributes.normal as THREE.BufferAttribute
    const uv = geo.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const t = uv.getX(i)
      const scale = 1.35 - t * 0.72
      const c = curve.getPointAt(Math.min(1, Math.max(0, t)))
      const px = pos.getX(i)
      const py = pos.getY(i)
      const pz = pos.getZ(i)
      pos.setXYZ(i, c.x + (px - c.x) * scale, c.y + (py - c.y) * scale, c.z + (pz - c.z) * scale)
      void nrm
    }
    geo.computeVertexNormals()
    const barkMat = withBounce(
      new THREE.MeshPhysicalMaterial({
        map: this.barkTex.map,
        normalMap: this.barkTex.normalMap,
        roughnessMap: this.barkTex.roughnessMap,
        roughness: 1,
        metalness: 0,
        envMapIntensity: 0.5,
      }),
      this.rig,
      {
        afterLights: /* glsl */ `
          {
            float bnc = momoBounce(vMomoWPos, normalize(vMomoWNrm), uQ0, uQ1, uQ2, uQ3,
                                   uSheetNormal, uSunDir, uSheetAlbedo, uSunStrength, uSheetDeployed);
            reflectedLight.indirectDiffuse += uSheetTint * bnc * 0.8 * diffuseColor.rgb;
          }
        `,
      },
    )
    this.branchMesh = new THREE.Mesh(geo, barkMat)
    this.branchMesh.castShadow = true
    this.branchMesh.receiveShadow = true
    this.branchGroup.add(this.branchMesh)
    this.disposables.push(barkMat)

    this.hangPoint.copy(pts[3])
    this.branchGroup.updateMatrixWorld(true)
    this.hangPoint.applyMatrix4(this.branchGroup.matrixWorld)

    this.buildLeaves(curve, layout)
    this.buildPedicel(layout)
  }

  private buildLeaves(curve: THREE.CatmullRomCurve3, layout: RoundLayout): void {
    const rng = makeRng(layout.leafSeed)
    const per = this.q.leavesPerBranch
    const geo = new THREE.PlaneGeometry(0.085, 0.21)
    geo.translate(0, 0.098, 0)
    const total = per * 4
    const mesh = new THREE.InstancedMesh(geo, this.leafMaterial, total)
    const m = new THREE.Matrix4()
    const qt = new THREE.Quaternion()
    const scl = new THREE.Vector3()
    const p = new THREE.Vector3()
    this.occluderList = []
    let n = 0
    for (let i = 0; i < total; i++) {
      const t = 0.08 + rng() * 0.88
      curve.getPointAt(t, p)
      const around = rng() * Math.PI * 2
      const off = 0.03 + rng() * 0.16
      p.x += Math.cos(around) * off
      p.z += Math.sin(around) * off * 0.7
      p.y += (rng() - 0.5) * 0.13 - 0.02
      const s = 0.75 + rng() * 0.6
      qt.setFromEuler(new THREE.Euler((rng() - 0.5) * 1.5 - 0.5, rng() * 6.28, (rng() - 0.5) * 1.4))
      scl.set(s, s, s)
      m.compose(p, qt, scl)
      mesh.setMatrixAt(n++, m)

      // Leaves close above the fruit become sun occluders for the blush sim.
      const d = Math.hypot(p.x - layout.peachPos.x, p.z - layout.peachPos.z)
      if (d < 0.42 && p.y > layout.peachPos.y - 0.02) {
        this.occluderList.push({
          c: { x: p.x, y: p.y + this.branchGroup.position.y, z: p.z },
          r: 0.055 * s,
        })
      }
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
    // No two leaves the same tone: a repeated plane reads instantly as fake.
    const tint = new THREE.Color()
    for (let i = 0; i < n; i++) {
      const k = makeRng(layout.leafSeed + i * 31)
      tint.setHSL(0.22 + k() * 0.05, 0.34 + k() * 0.18, 0.42 + k() * 0.24)
      mesh.setColorAt(i, tint)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.branchGroup.add(mesh)
    this.leafMesh = mesh
    this.disposables.push(geo)

    // Occluders live in world space; apply the branch yaw.
    const mat = this.branchGroup.matrixWorld
    const v = new THREE.Vector3()
    for (const o of this.occluderList) {
      v.set(o.c.x, o.c.y, o.c.z).applyMatrix4(mat)
      o.c.x = v.x
      o.c.y = v.y
      o.c.z = v.z
    }
  }

  private buildPedicel(layout: RoundLayout): void {
    if (this.pedicel) {
      this.branchGroup.remove(this.pedicel)
      this.pedicel.geometry.dispose()
    }
    const from = new THREE.Vector3(layout.peachPos.x, layout.peachPos.y + 0.185, layout.peachPos.z + 0.02)
    const to = new THREE.Vector3(layout.peachPos.x, layout.peachPos.y + 0.052, layout.peachPos.z)
    const curve = new THREE.CatmullRomCurve3([
      from,
      from.clone().lerp(to, 0.4).add(new THREE.Vector3(0.012, 0.004, 0.008)),
      to,
    ])
    const geo = new THREE.TubeGeometry(curve, 12, 0.0042, 6, false)
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x7d7440, roughness: 0.82, metalness: 0 })
    this.pedicel = new THREE.Mesh(geo, mat)
    this.pedicel.castShadow = true
    this.branchGroup.add(this.pedicel)
    this.disposables.push(mat)
  }

  relayout(layout: RoundLayout): void {
    this.layout = layout
    this.leafTex.dispose()
    this.leafTex = makeLeafTextures(layout.leafSeed)
    this.leafMaterial.map = this.leafTex.map
    this.leafMaterial.alphaMap = this.leafTex.alphaMap
    this.leafMaterial.normalMap = this.leafTex.normalMap
    this.leafMaterial.needsUpdate = true
    this.buildBranch(layout)
  }

  get occluders(): Occluder[] {
    return this.occluderList
  }

  get currentLayout(): RoundLayout {
    return this.layout
  }

  updateSun(rig: LightRig): void {
    this.sunSprite.position.copy(rig.sunDir).multiplyScalar(14).add(new THREE.Vector3(0, 0.5, 0))
    const noon = Math.max(0.2, rig.sunDir.y)
    this.sunSprite.scale.setScalar(3.0 + (1 - noon) * 1.6)
    const mat = this.sunSprite.material as THREE.SpriteMaterial
    mat.opacity = 0.42 + noon * 0.3
  }

  setQuality(q: QualitySettings): void {
    this.q = q
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose()
    this.disposables = []
    this.leafMaterial.dispose()
    this.scene.remove(this.group)
  }
}
