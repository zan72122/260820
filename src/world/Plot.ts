import * as THREE from 'three'
import { noiseTexture } from './noise'
import { NOISE_GLSL, MURK_GLSL } from './shaders'
import { applyMurk } from './murk'
import type { LotusSpec } from './Lotus'

export const MASK_RES = 192

export type PlotSpec = {
  center: THREE.Vector3 // on the bed plane
  size: number
  /** clay resistance; higher needs more water */
  hardness: number
  maxDepth: number
  petioles: number
  seed: number
  lotus: LotusSpec
}

function rng(seed: number) {
  let s = (seed || 1) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export type Petiole = {
  mesh: THREE.Mesh
  base: THREE.Vector3
  phase: number
  tilt: number
  marked: boolean
  height: number
}

export class Plot {
  group = new THREE.Group()
  bed: THREE.Mesh
  petioles: Petiole[] = []
  spec: PlotSpec
  data: Uint8Array
  texture: THREE.DataTexture
  private dirty = true
  private clods: { mesh: THREE.Mesh; hp: number; radius: number }[] = []
  private debris: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = []
  private clodGroup = new THREE.Group()
  private uniforms: Record<string, THREE.IUniform>
  /** removal fraction, mirrored on the CPU for gameplay queries */
  private removal: Float32Array
  /** texel bounds ever touched, so the per-frame decay stays cheap */
  private touched = { i0: MASK_RES, i1: -1, j0: MASK_RES, j1: -1 }

  constructor(spec: PlotSpec, murkColor: THREE.Color, private onClodBreak: (p: THREE.Vector3) => void) {
    this.spec = spec
    this.group.position.copy(spec.center)

    this.data = new Uint8Array(MASK_RES * MASK_RES * 4)
    this.removal = new Float32Array(MASK_RES * MASK_RES)
    for (let i = 0; i < MASK_RES * MASK_RES; i++) this.data[i * 4 + 3] = 255
    this.texture = new THREE.DataTexture(this.data, MASK_RES, MASK_RES, THREE.RGBAFormat)
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter
    this.texture.wrapS = this.texture.wrapT = THREE.ClampToEdgeWrapping
    this.texture.needsUpdate = true

    this.uniforms = {
      uNoise: { value: noiseTexture() },
      uMask: { value: this.texture },
      uSize: { value: spec.size },
      uMaxDepth: { value: spec.maxDepth },
      uMurkColor: { value: murkColor.clone() },
      uWaterY: { value: 0 },
      uSeed: { value: spec.seed % 100 },
    }

    const geo = new THREE.PlaneGeometry(spec.size, spec.size, 140, 140)
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, metalness: 0.0 })
    // wins the depth test in the thin band where it overlaps the paddy floor
    mat.polygonOffset = true
    mat.polygonOffsetFactor = -2
    mat.polygonOffsetUnits = -2
    if (typeof location !== 'undefined' && location.search.includes('debugmask')) mat.defines = { DEBUG_MASK: '' }
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms)
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
          ${NOISE_GLSL}
          uniform sampler2D uMask;
          uniform float uSize;
          uniform float uMaxDepth;
          uniform float uSeed;
          varying vec2 vMaskUv;
          varying vec3 vWorldP;
          varying float vRemoval;
          varying float vClean;
          float bedH(vec2 uv, vec2 local){
            vec4 m = texture2D(uMask, uv);
            // everything fades out at the border so the patch meets the paddy
            // floor exactly, with no lip and no z-fight
            float edge = smoothstep(0.0, 0.075, min(min(uv.x,uv.y), min(1.0-uv.x,1.0-uv.y)));
            float relief = (fbm(local*7.0 + uSeed) - 0.5) * 0.032 + (fbm(local*21.0) - 0.5) * 0.009;
            return (relief - m.r * uMaxDepth) * edge;
          }
          `,
        )
        .replace(
          '#include <beginnormal_vertex>',
          /* glsl */ `
          vec2 mUv = position.xz / uSize + 0.5;
          vMaskUv = mUv;
          vec4 mSample = texture2D(uMask, mUv);
          vRemoval = mSample.r;
          vClean = mSample.g;
          float e = 1.0 / ${MASK_RES.toFixed(1)};
          float h0 = bedH(mUv, position.xz);
          float hx = bedH(mUv + vec2(e,0.0), position.xz + vec2(uSize*e, 0.0));
          float hz = bedH(mUv + vec2(0.0,e), position.xz + vec2(0.0, uSize*e));
          vec3 objectNormal = normalize(vec3(-(hx-h0)/(uSize*e), 1.0, -(hz-h0)/(uSize*e)));
          #ifdef USE_TANGENT
            vec3 objectTangent = vec3( tangent.xyz );
          #endif
          `,
        )
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `
          vec3 transformed = vec3( position );
          transformed.y += bedH(mUv, position.xz);
          vWorldP = (modelMatrix * vec4(transformed,1.0)).xyz;
          `,
        )
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
          ${NOISE_GLSL}
          ${MURK_GLSL}
          uniform float uSeed;
          uniform float uMaxDepth;
          varying vec2 vMaskUv;
          varying vec3 vWorldP;
          varying float vRemoval;
          varying float vClean;
          `,
        )
        .replace(
          '#include <color_fragment>',
          /* glsl */ `#include <color_fragment>
          vec2 lp = vWorldP.xz;
          // same palette and frequencies as the surrounding paddy floor, so the
          // edge of the worked patch is invisible until it is dug
          float g1 = fbm(lp*2.2);
          float g2 = fbm(lp*13.0);
          float near = 1.0 - smoothstep(4.0, 18.0, length(vWorldP - cameraPosition));
          float g3 = mix(0.5, fbm(lp*46.0 + uSeed), near);
          vec3 topMud = mix(vec3(0.185,0.170,0.135), vec3(0.135,0.135,0.105), g1);
          topMud *= 0.82 + 0.34*g2;
          topMud *= 0.92 + 0.16*g3;
          // clay revealed underneath: darker, cooler, wetter
          vec3 clay = mix(vec3(0.086,0.070,0.052), vec3(0.058,0.052,0.045), g3);
          float cut = smoothstep(0.03, 0.42, vRemoval);
          vec3 base = mix(topMud, clay, cut);
          // freshly cut rim catches light
          float rim = smoothstep(0.10,0.30,vRemoval) * (1.0 - smoothstep(0.30,0.62,vRemoval));
          base += vec3(0.035,0.030,0.024) * rim;
          diffuseColor.rgb *= base;
          #ifdef DEBUG_MASK
          diffuseColor.rgb = vec3(vRemoval, vClean, 0.5);
          #endif
          `,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          /* glsl */ `float roughnessFactor = mix(0.95, 0.42, smoothstep(0.05,0.5,vRemoval));`,
        )
        .replace(
          '#include <opaque_fragment>',
          /* glsl */ `outgoingLight = mix(outgoingLight, uMurkColor, murkAmount(vWorldP, vClean, 0.0));
          #include <opaque_fragment>`,
        )
    }
    mat.customProgramCacheKey = () => 'bed'
    this.bed = new THREE.Mesh(geo, mat)
    this.bed.receiveShadow = true
    this.group.add(this.bed)
    this.group.add(this.clodGroup)

    this.buildPetioles(murkColor)
    this.buildClods(murkColor)
  }

  private buildPetioles(murkColor: THREE.Color) {
    const r = rng(this.spec.seed + 21)
    const mat = new THREE.MeshStandardMaterial({ color: 0x4b4934, roughness: 0.78, metalness: 0 })
    applyMurk(mat, murkColor, 0.08)
    const cutMat = new THREE.MeshStandardMaterial({ color: 0xa89f7e, roughness: 0.85, side: THREE.DoubleSide })
    applyMurk(cutMat, murkColor, 0.08)
    const waterDepth = -this.spec.center.y
    for (let i = 0; i < this.spec.petioles; i++) {
      // the marked one sits right above the head of the rhizome
      let lx: number
      let lz: number
      if (i === 0) {
        lx = this.spec.lotus.origin.x - this.spec.center.x
        lz = this.spec.lotus.origin.z - this.spec.center.z
      } else {
        const a = r() * Math.PI * 2
        const rad = 0.28 + r() * this.spec.size * 0.42
        lx = Math.cos(a) * rad
        lz = Math.sin(a) * rad
      }
      // the marked stalk stands a little taller: the only thing in the opening
      // frame that can catch a child's eye without a word of text
      const above = (i === 0 ? 0.34 : 0.09) + r() * (i === 0 ? 0.06 : 0.14)
      const h = waterDepth + above
      const thick = i === 0 ? 1.35 : 1.0
      const g = new THREE.CylinderGeometry((0.0068 + r() * 0.003) * thick, (0.0105 + r() * 0.004) * thick, h, 6, 1, false)
      g.translate(0, h / 2, 0)
      const mesh = new THREE.Mesh(g, mat)
      // a pale cut face on top, the way a harvested stalk is trimmed
      const cut = new THREE.Mesh(new THREE.CircleGeometry((0.0072 + r() * 0.003) * thick, 6), cutMat)
      cut.rotation.x = -Math.PI / 2 + 0.35
      cut.position.y = h
      mesh.add(cut)
      mesh.position.set(lx, 0, lz)
      const tilt = 0.06 + r() * 0.26
      const dir = r() * Math.PI * 2
      mesh.rotation.set(Math.cos(dir) * tilt, 0, Math.sin(dir) * tilt)
      mesh.castShadow = false
      this.group.add(mesh)
      this.petioles.push({
        mesh,
        base: new THREE.Vector3(lx, 0, lz).add(this.spec.center),
        phase: r() * 10,
        tilt,
        marked: i === 0,
        height: h,
      })
    }
  }

  private buildClods(murkColor: THREE.Color) {
    const r = rng(this.spec.seed + 55)
    const mat = new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.95, metalness: 0 })
    applyMurk(mat, murkColor, 0.05)
    const count = 5 + Math.floor(r() * 3)
    for (let i = 0; i < count; i++) {
      const rad = 0.035 + r() * 0.03
      const g = new THREE.IcosahedronGeometry(rad, 1)
      const p = g.attributes.position as THREE.BufferAttribute
      for (let v = 0; v < p.count; v++) {
        const s = 0.78 + r() * 0.42
        p.setXYZ(v, p.getX(v) * s, p.getY(v) * s * 0.7, p.getZ(v) * s)
      }
      g.computeVertexNormals()
      const mesh = new THREE.Mesh(g, mat)
      const a = r() * Math.PI * 2
      const dist = 0.15 + r() * 0.55
      const lx = this.spec.lotus.origin.x - this.spec.center.x + Math.cos(a) * dist
      const lz = this.spec.lotus.origin.z - this.spec.center.z + Math.sin(a) * dist
      mesh.position.set(lx, rad * 0.45, lz)
      mesh.rotation.set(r() * 3, r() * 3, r() * 3)
      mesh.castShadow = true
      this.clodGroup.add(mesh)
      this.clods.push({ mesh, hp: 1, radius: rad })
    }
  }

  worldToMask(x: number, z: number) {
    const u = (x - this.spec.center.x) / this.spec.size + 0.5
    const v = (z - this.spec.center.z) / this.spec.size + 0.5
    return { u, v }
  }

  /** Wash mud away at a world position. amount is already scaled by dt. */
  paint(x: number, z: number, radius: number, amount: number, cleanAmount = 1) {
    const { u, v } = this.worldToMask(x, z)
    if (u < -0.2 || u > 1.2 || v < -0.2 || v > 1.2) return 0
    const px = u * MASK_RES
    const py = v * MASK_RES
    const pr = (radius / this.spec.size) * MASK_RES
    const i0 = Math.max(0, Math.floor(px - pr))
    const i1 = Math.min(MASK_RES - 1, Math.ceil(px + pr))
    const j0 = Math.max(0, Math.floor(py - pr))
    const j1 = Math.min(MASK_RES - 1, Math.ceil(py + pr))
    let work = 0
    const inv = 1 / this.spec.hardness
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = (i + 0.5 - px) / pr
        const dy = (j + 0.5 - py) / pr
        const d2 = dx * dx + dy * dy
        if (d2 > 1) continue
        const f = Math.exp(-d2 * 2.1) * (1 - d2 * 0.25)
        const idx = j * MASK_RES + i
        const prev = this.removal[idx]
        const next = Math.min(1, prev + amount * f * inv)
        work += next - prev
        this.removal[idx] = next
        const o = idx * 4
        this.data[o] = (next * 255) | 0
        const clean = Math.max(this.data[o + 1] / 255, f * cleanAmount)
        this.data[o + 1] = (clean * 255) | 0
        this.data[o + 2] = Math.max(this.data[o + 2], (f * 255) | 0)
      }
    }
    this.dirty = true
    this.touched.i0 = Math.min(this.touched.i0, i0)
    this.touched.i1 = Math.max(this.touched.i1, i1)
    this.touched.j0 = Math.min(this.touched.j0, j0)
    this.touched.j1 = Math.max(this.touched.j1, j1)
    return work
  }

  removalAt(x: number, z: number) {
    const { u, v } = this.worldToMask(x, z)
    if (u < 0 || u > 1 || v < 0 || v > 1) return 0
    const i = Math.min(MASK_RES - 1, Math.max(0, Math.floor(u * MASK_RES)))
    const j = Math.min(MASK_RES - 1, Math.max(0, Math.floor(v * MASK_RES)))
    return this.removal[j * MASK_RES + i]
  }

  cleanAt(x: number, z: number) {
    const { u, v } = this.worldToMask(x, z)
    if (u < 0 || u > 1 || v < 0 || v > 1) return 0
    const i = Math.min(MASK_RES - 1, Math.max(0, Math.floor(u * MASK_RES)))
    const j = Math.min(MASK_RES - 1, Math.max(0, Math.floor(v * MASK_RES)))
    return this.data[(j * MASK_RES + i) * 4 + 1] / 255
  }

  /** world Y of the mud surface after digging */
  bedSurfaceY(x: number, z: number) {
    return this.spec.center.y - this.removalAt(x, z) * this.spec.maxDepth
  }

  /** Returns true if a clod was destroyed by this hit. */
  hitClods(x: number, z: number, power: number, dt: number) {
    let broke = false
    for (let i = this.clods.length - 1; i >= 0; i--) {
      const c = this.clods[i]
      const wp = c.mesh.position.clone().add(this.spec.center)
      const d = Math.hypot(wp.x - x, wp.z - z)
      if (d < c.radius + 0.09) {
        c.hp -= dt * power * 1.9
        if (c.hp <= 0) {
          this.breakClod(i)
          broke = true
        }
      }
    }
    return broke
  }

  private breakClod(index: number) {
    const c = this.clods[index]
    this.clods.splice(index, 1)
    const origin = c.mesh.position.clone()
    this.clodGroup.remove(c.mesh)
    this.onClodBreak(origin.clone().add(this.spec.center))
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(c.mesh.geometry, c.mesh.material)
      m.scale.setScalar(0.36 + Math.random() * 0.24)
      m.position.copy(origin)
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
      this.clodGroup.add(m)
      this.debris.push({
        mesh: m,
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.15 + Math.random() * 0.2, (Math.random() - 0.5) * 0.5),
        life: 1.6,
      })
    }
  }

  update(dt: number) {
    // cleanliness settles back as silt drifts in; removal is permanent
    let changed = false
    const t = this.touched
    for (let j = Math.max(0, t.j0); j <= t.j1; j++) {
      for (let i = Math.max(0, t.i0); i <= t.i1; i++) {
        const idx = j * MASK_RES + i
        const o = idx * 4
        if (this.data[o + 1] > 0) {
          const c = this.data[o + 1] / 255
          const nc = Math.max(0.85 * (this.removal[idx] > 0.08 ? 1 : 0), c - dt * 0.2)
          this.data[o + 1] = (nc * 255) | 0
          changed = true
        }
        if (this.data[o + 2] > 0) {
          this.data[o + 2] = Math.max(0, this.data[o + 2] - dt * 420) | 0
          changed = true
        }
      }
    }
    if (this.dirty || changed) {
      this.texture.needsUpdate = true
      this.dirty = false
    }

    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i]
      d.life -= dt
      d.vel.y -= dt * 1.1
      d.vel.multiplyScalar(1 - dt * 2.2)
      d.mesh.position.addScaledVector(d.vel, dt)
      d.mesh.rotation.x += dt * 1.4
      const floor = -this.removalAt(d.mesh.position.x + this.spec.center.x, d.mesh.position.z + this.spec.center.z) * this.spec.maxDepth
      if (d.mesh.position.y < floor + 0.01) {
        d.mesh.position.y = floor + 0.01
        d.vel.set(0, 0, 0)
      }
      const s = Math.max(0.001, Math.min(1, d.life / 0.8))
      d.mesh.scale.setScalar(d.mesh.scale.x * (1 - dt * 0.3) * (s < 0.4 ? 1 - dt * 2.2 : 1))
      if (d.life <= 0) {
        this.clodGroup.remove(d.mesh)
        this.debris.splice(i, 1)
      }
    }
  }

  animatePetioles(t: number, calm: number, hint: number, gaze: THREE.Vector3 | null, boat?: THREE.Vector3) {
    for (const p of this.petioles) {
      if (boat) {
        // the hull has pushed these ones flat; do not spear them through the deck
        p.mesh.visible = Math.abs(p.base.x - boat.x) > 0.95 || Math.abs(p.base.z - boat.z) > 0.5
        if (!p.mesh.visible) continue
      }
      const sway = (0.012 + 0.02 * (1 - calm)) * Math.sin(t * 0.8 + p.phase)
      let extra = 0
      if (p.marked && hint > 0) {
        // pulled from below: a slow, uneven tug, never a glow or an arrow
        extra = hint * (0.115 * Math.sin(t * 1.5) + 0.05 * Math.sin(t * 3.3 + 1.0))
        p.mesh.position.y = -0.012 * hint * (0.5 + 0.5 * Math.sin(t * 1.5))
      }
      const dir = p.phase
      p.mesh.rotation.x = Math.cos(dir) * p.tilt + sway + extra
      p.mesh.rotation.z = Math.sin(dir) * p.tilt + sway * 0.6 + extra * 0.7
      if (p.marked && gaze) gaze.set(p.base.x, 0.06, p.base.z)
    }
  }

  dispose() {
    this.texture.dispose()
    this.bed.geometry.dispose()
    ;(this.bed.material as THREE.Material).dispose()
  }
}
