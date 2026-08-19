import * as THREE from 'three'
import { PAN, panInnerR, tubeOuterR } from '../core/dims'
import { buildRevolve, addRelativeMorph, type ProfileFn } from '../core/geometry'
import { crustTexture, crumbTexture } from '../core/textures'
import type { Flavor } from '../core/flavors'
import { clamp } from '../core/math'

const Y0 = 0.0018
const GAP = 0.0004

/** Profile-segment boundaries — also the UV bands the shader tints. */
const T_INNER = 0.16
const T_TOP = 0.6
const T_OUTER = 0.76

interface Shape {
  hIn: number
  hOut: number
  dome: number
  crack: number
  squash: number
  stria: number
}

const EMPTY: Shape = { hIn: 0.0032, hOut: 0.0034, dome: 0, crack: 0, squash: 0, stria: 0 }
const POURED: Shape = { hIn: 0.032, hOut: 0.0322, dome: -0.0018, crack: 0, squash: 0, stria: 0 }
const RISEN: Shape = { hIn: 0.103, hOut: 0.105, dome: 0.0115, crack: 1, squash: 0, stria: 1 }
const SQUASHED: Shape = { ...RISEN, squash: 1 }

/** Cake wall radii. Above the rim the chiffon mushrooms very slightly outward. */
const outerR = (y: number) => (y <= PAN.height ? panInnerR(y) - GAP : PAN.rTop - GAP + (y - PAN.height) * 0.35)
const innerR = (y: number) => tubeOuterR(y) + GAP

function topHeight(s: Shape, u: number, theta: number, seed: number): number {
  const arch = Math.pow(Math.sin(Math.PI * clamp(u)), 0.75)
  let y = s.hIn + (s.hOut - s.hIn) * u + s.dome * arch
  if (s.crack > 0) {
    const ridge =
      Math.sin(theta * 5 + seed) * 0.6 + Math.sin(theta * 9 + seed * 1.7) * 0.28 + Math.sin(theta * 14 + seed * 0.4) * 0.16
    y += s.crack * 0.0026 * arch * ridge
    const fissure = Math.pow(Math.max(0, Math.sin(theta * 3 + seed * 0.9)), 10)
    y -= s.crack * 0.0038 * Math.pow(arch, 0.4) * fissure
  }
  if (s.squash > 0) y -= s.squash * 0.0062 * Math.pow(arch, 0.5)
  return y
}

function wallR(s: Shape, base: number, y: number, hi: number, theta: number): number {
  let r = base
  if (s.stria > 0) r += s.stria * 0.00032 * Math.sin(theta * 44)
  if (s.squash > 0) {
    const f = Math.sin(Math.PI * clamp((y - Y0) / Math.max(1e-4, hi - Y0)))
    r += s.squash * 0.0017 * f * Math.sign(base - 0.05)
  }
  return r
}

function makeProfile(s: Shape, seed: number): ProfileFn {
  return (t, theta) => {
    if (t <= T_INNER) {
      const k = t / T_INNER
      const y = Y0 + (s.hIn - Y0) * k
      return { r: wallR(s, innerR(y), y, s.hIn, theta), y }
    }
    if (t <= T_TOP) {
      const u = (t - T_INNER) / (T_TOP - T_INNER)
      const y = topHeight(s, u, theta, seed)
      const rI = innerR(s.hIn)
      const rO = outerR(s.hOut)
      let r = rI + (rO - rI) * u
      if (s.stria > 0) r += 0
      return { r, y }
    }
    if (t <= T_OUTER) {
      const k = (t - T_TOP) / (T_OUTER - T_TOP)
      const y = s.hOut + (Y0 - s.hOut) * k
      return { r: wallR(s, outerR(y), y, s.hOut, theta), y }
    }
    const k = (t - T_OUTER) / (1 - T_OUTER)
    const rO = outerR(Y0)
    const rI = innerR(Y0)
    return { r: rO + (rI - rO) * k, y: Y0 }
  }
}

/** Flat cross-section face for the short cut-away moments. */
function buildCrossFace(s: Shape, seed: number, nU: number, nV: number, sign: number): Float32Array {
  const pos = new Float32Array((nU + 1) * (nV + 1) * 3)
  let k = 0
  const theta = sign > 0 ? 0 : Math.PI
  for (let i = 0; i <= nU; i++) {
    const u = i / nU
    const top = topHeight(s, u, theta, seed)
    for (let j = 0; j <= nV; j++) {
      const v = j / nV
      const y = Y0 + (top - Y0) * v
      const rI = innerR(y)
      const rO = outerR(y)
      const r = rI + (rO - rI) * u
      pos[k++] = sign * r
      pos[k++] = y
      pos[k++] = -0.00022
    }
  }
  return pos
}

function crossGeometry(shapes: Shape[], seed: number, nU = 40, nV = 20): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  const both = (s: Shape) => {
    const a = buildCrossFace(s, seed, nU, nV, 1)
    const b = buildCrossFace(s, seed, nU, nV, -1)
    const out = new Float32Array(a.length + b.length)
    out.set(a, 0)
    out.set(b, a.length)
    return out
  }
  const base = both(shapes[0])
  g.setAttribute('position', new THREE.Float32BufferAttribute(base, 3))
  const uv: number[] = []
  const idx: number[] = []
  const per = (nU + 1) * (nV + 1)
  for (let half = 0; half < 2; half++) {
    for (let i = 0; i <= nU; i++)
      for (let j = 0; j <= nV; j++) uv.push(i / nU, j / nV)
    for (let i = 0; i < nU; i++)
      for (let j = 0; j < nV; j++) {
        const a = half * per + i * (nV + 1) + j
        const b = a + 1
        const c = a + (nV + 1)
        const d = c + 1
        if (half === 0) idx.push(a, b, c, b, d, c)
        else idx.push(a, c, b, b, c, d)
      }
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  const nrm = g.getAttribute('normal') as THREE.BufferAttribute
  g.morphAttributes.position = []
  g.morphAttributes.normal = []
  for (let m = 1; m < shapes.length; m++) {
    const ref = both(shapes[m - 1])
    const tgt = both(shapes[m])
    const dp = new Float32Array(tgt.length)
    for (let i = 0; i < tgt.length; i++) dp[i] = tgt[i] - ref[i]
    g.morphAttributes.position.push(new THREE.Float32BufferAttribute(dp, 3))
    g.morphAttributes.normal.push(new THREE.Float32BufferAttribute(new Float32Array(nrm.count * 3), 3))
  }
  g.morphTargetsRelative = true
  return g
}

/**
 * The batter, the rising cake and the finished chiffon are one continuous body.
 * Three stacked relative morphs: pour → rise → press.
 */
export class Chiffon {
  readonly group = new THREE.Group()
  readonly mesh: THREE.Mesh
  readonly cut: THREE.Mesh
  readonly material: THREE.MeshStandardMaterial
  private cutMaterial: THREE.MeshStandardMaterial
  private uniforms = {
    uBake: { value: 0 },
    uRaw: { value: new THREE.Color(0xf3d98d) },
    uCrust: { value: new THREE.Color(0xcf9a55) },
    uSide: { value: new THREE.Color(0xf0dcae) },
    uBottom: { value: new THREE.Color(0xd9b273) },
  }
  private cutUniforms = { uBubble: { value: 0 }, uBake: { value: 0 } }

  constructor(flavor: Flavor, quality: 'high' | 'low') {
    const nT = quality === 'high' ? 96 : 72
    const nTheta = quality === 'high' ? 112 : 80
    const seed = flavor.seed % 6.283
    const geo = buildRevolve(makeProfile(EMPTY, seed), nT, nTheta)
    addRelativeMorph(geo, makeProfile(POURED, seed), nT, nTheta, makeProfile(EMPTY, seed))
    addRelativeMorph(geo, makeProfile(RISEN, seed), nT, nTheta, makeProfile(POURED, seed))
    addRelativeMorph(geo, makeProfile(SQUASHED, seed), nT, nTheta, makeProfile(RISEN, seed))

    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: crustTexture(flavor.crustA, flavor.crustB, flavor.seed),
      roughness: 0.72,
      metalness: 0,
    })
    this.applyShader(this.material)
    this.setFlavor(flavor)

    this.mesh = new THREE.Mesh(geo, this.material)
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    this.mesh.morphTargetInfluences = [0, 0, 0]
    this.mesh.name = 'chiffon'

    this.cutMaterial = new THREE.MeshStandardMaterial({
      map: crumbTexture(flavor.crumb, flavor.crumbShadow, flavor.seed),
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
    })
    const cu = this.cutUniforms
    this.cutMaterial.onBeforeCompile = (sh) => {
      sh.uniforms.uBubble = cu.uBubble
      sh.uniforms.uBake = cu.uBake
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uBubble;\nuniform float uBake;')
        .replace(
          '#include <map_fragment>',
          `vec2 cUv = (vMapUv - 0.5) / mix(2.6, 1.0, uBubble) + 0.5;
           vec4 sampledDiffuseColor = texture2D( map, cUv );
           diffuseColor *= sampledDiffuseColor;
           diffuseColor.rgb = mix(diffuseColor.rgb * vec3(1.02, 0.98, 0.86), diffuseColor.rgb, uBake);`,
        )
    }
    this.cut = new THREE.Mesh(crossGeometry([EMPTY, POURED, RISEN, SQUASHED], seed), this.cutMaterial)
    this.cut.morphTargetInfluences = [0, 0, 0]
    this.cut.visible = false
    this.cut.name = 'chiffon-cut'

    this.group.add(this.mesh, this.cut)
  }

  private applyShader(m: THREE.MeshStandardMaterial) {
    const u = this.uniforms
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u)
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uBake; uniform vec3 uRaw; uniform vec3 uCrust; uniform vec3 uSide; uniform vec3 uBottom;`,
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
           float band = vMapUv.y;
           float topMask = smoothstep(${T_INNER.toFixed(3)} - 0.02, ${T_INNER.toFixed(3)} + 0.04, band)
                         * (1.0 - smoothstep(${T_TOP.toFixed(3)} - 0.045, ${T_TOP.toFixed(3)} + 0.01, band));
           float botMask = smoothstep(${T_OUTER.toFixed(3)} + 0.02, ${T_OUTER.toFixed(3)} + 0.07, band);
           vec3 baked = mix(uSide, uCrust, topMask);
           baked = mix(baked, uBottom, botMask);
           float mottle = dot(diffuseColor.rgb, vec3(0.3333));
           vec3 tint = mix(uRaw, baked, uBake);
           diffuseColor.rgb = tint * (0.86 + 0.34 * (mottle - 0.55));`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `float roughnessFactor = mix(0.34, 0.88, uBake);`,
        )
    }
  }

  setFlavor(f: Flavor) {
    this.uniforms.uRaw.value.setHex(f.batter)
    this.uniforms.uCrust.value.set(f.crustA)
    this.uniforms.uSide.value.setHex(f.side)
    this.uniforms.uBottom.value.set(f.crustB)
  }

  /** 0 = empty pan, 1 = poured to depth. */
  setFill(v: number) {
    this.mesh.morphTargetInfluences![0] = clamp(v)
    this.cut.morphTargetInfluences![0] = clamp(v)
  }
  /** 0 = flat batter, 1 = fully risen above the rim. */
  setRise(v: number) {
    this.mesh.morphTargetInfluences![1] = clamp(v)
    this.cut.morphTargetInfluences![1] = clamp(v)
  }
  /** Positive presses the top down; small negatives let it spring back past rest. */
  setPress(v: number) {
    const c = Math.max(-0.45, Math.min(1, v))
    this.mesh.morphTargetInfluences![2] = c
    this.cut.morphTargetInfluences![2] = c
  }
  /** 0 = raw pale batter, 1 = baked colour. */
  setBake(v: number) {
    this.uniforms.uBake.value = clamp(v)
    this.cutUniforms.uBake.value = clamp(v)
    this.cutUniforms.uBubble.value = clamp(v)
  }
  setCutaway(on: boolean) {
    this.cut.visible = on
  }
  setClipping(planes: THREE.Plane[]) {
    this.material.clippingPlanes = planes
    this.material.clipShadows = planes.length > 0
    this.material.needsUpdate = true
  }
  /** Height of the crown above the pan base — used to park the camera. */
  get crownHeight() {
    const rise = this.mesh.morphTargetInfluences![1]
    return Y0 + (RISEN.hIn + RISEN.dome - Y0) * rise
  }
}
