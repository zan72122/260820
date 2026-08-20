import {
  Color,
  CylinderGeometry,
  Euler,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  Quaternion,
  RepeatWrapping,
  TorusGeometry,
  Vector3,
} from 'three'
import { DynamicTube } from './tube'
import { buildLeafGeometry, makeLeafMaterial, makeLeafParams, makeLeafMesh, type LeafMaterialHandle } from './leaf'
import { BRANCH, HOOK_DROP, branchY, branchZ, buildHooks, type HookSpec } from '../game/layout'
import { Rng } from '../core/rng'
import { clamp01, oscillatorStep, smoothstep, type SpringState } from '../core/math'
import type { TextureBundle } from '../gfx/textureLab'
import type { QualitySettings } from '../core/quality'

const LEAF_SWAY = new Quaternion()
const LEAF_EULER = new Euler()
const WORLD_UP = new Vector3(0, 1, 0)

/** Unit tangent of the branch centreline at a given x. */
function branchTangent(x: number, out: Vector3): Vector3 {
  const dy = (-2 * BRANCH.drop * x) / (BRANCH.halfSpan * BRANCH.halfSpan)
  const dz = BRANCH.zSweep / BRANCH.halfSpan
  return out.set(1, dy, dz).normalize()
}

const _q1 = new Quaternion()
const _q2 = new Quaternion()
const _va = new Vector3()
const _vb = new Vector3()

/**
 * Point a blade along `dir` and roll it so its curve droops towards the floor,
 * which is what stops a row of leaves reading as a comb.
 */
function orientBlade(dir: Vector3, out: Quaternion): void {
  _q1.setFromUnitVectors(WORLD_UP, dir)
  _va.set(0, 0, -1).applyQuaternion(_q1)
  _vb.set(0, -1, 0).addScaledVector(dir, dir.y)
  if (_vb.lengthSq() < 1e-6) {
    out.copy(_q1)
    return
  }
  _vb.normalize()
  const cos = Math.max(-1, Math.min(1, _va.dot(_vb)))
  const sign = Math.sign(_va.clone().cross(_vb).dot(dir)) || 1
  _q2.setFromAxisAngle(dir, Math.acos(cos) * sign)
  out.copy(_q2).multiply(_q1)
}

/**
 * The branch arches over the whole scene: the fruit hangs from its crown and
 * the hooks are screwed into the two descending limbs, which is why the net
 * can hang below the fruit at all. It bends by a few millimetres under load,
 * and the leaves answer that movement a beat late.
 */
export class BranchRig {
  readonly group = new Group()
  readonly hooks: HookSpec[]

  private readonly tube: DynamicTube
  private readonly twigs: DynamicTube[] = []
  private readonly hookMeshes: Group[] = []
  private readonly hookMaterials: MeshPhysicalMaterial[] = []
  private readonly leaves: {
    mesh: Mesh
    x: number
    base: Vector3
    baseQuat: Quaternion
    phase: number
    lag: number
    sway: SpringState
  }[] = []
  private readonly leafMat: LeafMaterialHandle
  private readonly barkMaterial: MeshPhysicalMaterial
  private readonly centre: Vector3[] = []
  private readonly glints: number[]

  private bendSpring: SpringState = { value: 0, velocity: 0 }
  private loadTarget = 0
  private time = 0

  constructor(tex: TextureBundle, q: QualitySettings, seed: number) {
    const bark = tex.barkColor.clone()
    bark.wrapS = RepeatWrapping
    bark.wrapT = RepeatWrapping
    bark.repeat.set(1, 5)
    bark.needsUpdate = true
    const barkN = tex.barkNormal.clone()
    barkN.wrapS = RepeatWrapping
    barkN.wrapT = RepeatWrapping
    barkN.repeat.set(1, 5)
    barkN.needsUpdate = true

    this.barkMaterial = new MeshPhysicalMaterial({
      map: bark,
      normalMap: barkN,
      roughness: 0.86,
      metalness: 0,
      envMapIntensity: 0.5,
    })
    this.barkMaterial.normalScale.set(1.1, 1.1)

    const rings = 52
    this.tube = new DynamicTube(rings, 10, this.barkMaterial)
    this.tube.mesh.receiveShadow = true
    for (let i = 0; i < rings; i++) this.centre.push(new Vector3())
    this.group.add(this.tube.mesh)

    // Two short side twigs so the limb is not a bare arc.
    const rng = new Rng(seed ^ 0x4488)
    for (const side of [-1, 1] as const) {
      const twig = new DynamicTube(10, 6, this.barkMaterial)
      this.twigs.push(twig)
      this.group.add(twig.mesh)
      void side
    }

    // Hooks: a shaft into the wood and an open eye that a cord end drops into.
    this.hooks = buildHooks()
    const hookGeoEye = new TorusGeometry(0.0098, 0.0021, 6, 16, Math.PI * 1.6)
    const hookGeoShaft = new CylinderGeometry(0.0022, 0.0022, 0.026, 6)
    for (const h of this.hooks) {
      const mat = new MeshPhysicalMaterial({
        color: new Color(0.42, 0.38, 0.31),
        roughness: 0.32,
        metalness: 0.92,
        envMapIntensity: 1.2,
        emissive: new Color(1, 0.93, 0.72),
        emissiveIntensity: 0,
      })
      this.hookMaterials.push(mat)
      const g = new Group()
      const eye = new Mesh(hookGeoEye, mat)
      eye.rotation.z = Math.PI * 0.72
      eye.position.y = -0.011
      eye.castShadow = true
      const shaft = new Mesh(hookGeoShaft, mat)
      shaft.position.y = 0.009
      shaft.castShadow = true
      g.add(eye, shaft)
      g.position.set(h.x, h.y, h.z)
      this.hookMeshes.push(g)
      this.group.add(g)
      void HOOK_DROP
    }
    this.glints = this.hooks.map(() => 0)

    // Leaves along both limbs, radiating around the wood and hanging down.
    this.leafMat = makeLeafMaterial(tex)
    const tangent = new Vector3()
    const n1 = new Vector3()
    const n2 = new Vector3()
    const around = new Vector3()
    const dir = new Vector3()
    for (let i = 0; i < q.leafCount; i++) {
      const params = makeLeafParams(rng)
      const geo = buildLeafGeometry(params, q.tier === 'low' ? 10 : 16, q.tier === 'low' ? 3 : 5)
      const mesh = makeLeafMesh(geo, this.leafMat.material)
      // Away from the crown, where the fruit needs a clear line of sight.
      const side = rng.bool() ? -1 : 1
      const x = side * BRANCH.halfSpan * rng.range(0.32, 1.03)
      branchTangent(x, tangent)
      n1.set(-tangent.z, 0, tangent.x).normalize()
      n2.crossVectors(tangent, n1).normalize()
      const phi = rng.range(0, Math.PI * 2)
      around.copy(n1).multiplyScalar(Math.cos(phi)).addScaledVector(n2, Math.sin(phi))
      dir
        .copy(around)
        .multiplyScalar(0.85)
        .addScaledVector(new Vector3(0, -1, 0), rng.range(0.5, 1.05))
        .addScaledVector(tangent, rng.jitter(0.45))
        .normalize()
      const base = new Vector3(x, branchY(x), branchZ(x)).addScaledVector(
        around,
        BRANCH.radius * 0.75,
      )
      mesh.position.copy(base)
      const baseQuat = new Quaternion()
      orientBlade(dir, baseQuat)
      mesh.quaternion.copy(baseQuat)
      this.group.add(mesh)
      this.leaves.push({
        mesh,
        x,
        base,
        baseQuat,
        phase: rng.range(0, Math.PI * 2),
        lag: rng.range(0.05, 0.2),
        sway: { value: 0, velocity: 0 },
      })
    }

    this.rebuild()
  }

  get bend(): number {
    return this.bendSpring.value
  }

  /** Downward deflection of the branch centreline at a given x. */
  bendAt(x: number): number {
    const t = Math.min(1, Math.abs(x) / BRANCH.halfSpan)
    return -this.bendSpring.value * (1 - t * t)
  }

  hookPosition(id: number, out: Vector3): Vector3 {
    const h = this.hooks[id]
    return out.set(h.x, h.y + this.bendAt(h.x), h.z)
  }

  stemAnchor(x: number, out: Vector3): Vector3 {
    return out.set(x, branchY(x) - 0.012 + this.bendAt(x), branchZ(x) + 0.006)
  }

  /** Static load in 0..1: fruit alone, or fruit plus a loaded net. */
  setLoad(load: number): void {
    this.loadTarget = clamp01(load)
  }

  /** A shove, e.g. the moment the net takes the fruit's weight. */
  impulse(amount: number): void {
    this.bendSpring.velocity += amount
    for (const leaf of this.leaves) {
      leaf.sway.velocity += amount * (0.55 + leaf.lag * 2.2)
    }
  }

  glint(hookId: number, strength = 1): void {
    if (hookId >= 0 && hookId < this.glints.length) this.glints[hookId] = strength
  }

  setSun(dir: Vector3, color: Color, intensity: number): void {
    this.leafMat.setSun(dir, color, intensity)
  }

  update(dt: number, wind: number): void {
    this.time += dt
    // A few millimetres of give, with a soft, woody return.
    oscillatorStep(this.bendSpring, this.loadTarget * 0.0052, 165, 11, dt)
    this.rebuild()

    for (let i = 0; i < this.hookMaterials.length; i++) {
      this.glints[i] = Math.max(0, this.glints[i] - dt * 1.35)
      const g = this.glints[i]
      this.hookMaterials[i].emissiveIntensity = g * g * 1.7
    }

    for (const leaf of this.leaves) {
      oscillatorStep(leaf.sway, 0, 52 + leaf.lag * 60, 4.5, dt)
      const breeze = Math.sin(this.time * (0.75 + leaf.lag) + leaf.phase) * wind * 0.075
      // The branch moves first; each blade answers a beat later.
      const delayed = leaf.sway.value * 1.7
      LEAF_SWAY.setFromEuler(
        LEAF_EULER.set(breeze * 0.7 + delayed, breeze * 0.55, breeze + delayed * 0.8),
      )
      leaf.mesh.quaternion.copy(leaf.baseQuat).multiply(LEAF_SWAY)
      leaf.mesh.position.set(leaf.base.x, leaf.base.y + this.bendAt(leaf.x), leaf.base.z)
    }
  }

  private rebuild(): void {
    const rings = this.centre.length
    for (let i = 0; i < rings; i++) {
      const t = i / (rings - 1)
      const x = (t * 2 - 1) * BRANCH.halfSpan
      this.centre[i].set(x, branchY(x) + this.bendAt(x), branchZ(x))
    }
    this.tube.update(this.centre, (t) => {
      // Thick through the crown, tapering into both limbs.
      const k = Math.abs(t * 2 - 1)
      return BRANCH.radius * (1.0 - 0.42 * smoothstep(0.25, 1.0, k))
    })

    for (let s = 0; s < this.twigs.length; s++) {
      const side = s === 0 ? -1 : 1
      const pts: Vector3[] = []
      const rootX = side * BRANCH.halfSpan * 0.46
      for (let i = 0; i < 10; i++) {
        const t = i / 9
        const x = rootX + side * t * 0.16
        pts.push(
          new Vector3(
            x,
            branchY(rootX) + this.bendAt(rootX) - t * 0.085 - t * t * 0.05,
            branchZ(rootX) + t * 0.075 * side + t * t * 0.03,
          ),
        )
      }
      this.twigs[s].update(pts, (t) => BRANCH.radius * 0.4 * (1 - t * 0.65))
    }

    for (let i = 0; i < this.hooks.length; i++) {
      const h = this.hooks[i]
      this.hookMeshes[i].position.set(h.x, h.y + this.bendAt(h.x), h.z)
    }
  }

  dispose(): void {
    this.tube.dispose()
    for (const t of this.twigs) t.dispose()
    this.barkMaterial.dispose()
    this.leafMat.dispose()
    for (const l of this.leaves) l.mesh.geometry.dispose()
    for (const m of this.hookMaterials) m.dispose()
  }
}
