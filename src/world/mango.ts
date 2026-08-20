import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  MeshPhysicalMaterial,
  type IUniform,
} from 'three'
import { Noise3 } from '../gfx/noise'
import { clamp01, smoothstep } from '../core/math'
import { ORDER_SCALE, type TextureBundle } from '../gfx/textureLab'
import type { RoundProfile } from '../game/state'

/**
 * The fruit. Its surface is a star-shaped radial function, which matters for
 * more than looks: the net solver evaluates the *same* function, so a knot in
 * the contact patch sits exactly on the skin it is holding - never buried in
 * it, never hovering a millimetre off it.
 *
 * The lower cap is analytic only (asymmetric, but noise free), so contact is
 * exact; the organic irregularity lives on the shoulders, where it reads.
 */

export interface MangoShape {
  /** Base radius in metres before the profile modifiers. */
  radius: number
  elongate: number
  flatten: number
  shoulder: number
  taper: number
  neck: number
  asym: number
  beak: number
  beakDir: [number, number, number]
  groove: number
  grooveAngle: number
  cavity: number
  tilt: number
  bumps: number
  seed: number
}

export function makeMangoShape(profile: RoundProfile, baseRadius: number): MangoShape {
  const r = (n: number): number => {
    // Cheap deterministic hash of the round seed for each parameter slot.
    const x = Math.sin((profile.seed % 100000) * 0.0001 + n * 12.9898) * 43758.5453
    return x - Math.floor(x)
  }
  return {
    radius: baseRadius * profile.sizeScale,
    elongate: 1.44 + r(1) * 0.12,
    flatten: 0.80 + r(2) * 0.055,
    shoulder: 0.145 + r(3) * 0.05,
    taper: 0.085 + r(4) * 0.045,
    neck: 0.075 + r(12) * 0.045,
    asym: 0.055 + r(5) * 0.04,
    beak: 0.032 + r(6) * 0.026,
    beakDir: [0.9, -0.42, 0.34],
    groove: 0.024 + r(7) * 0.016,
    grooveAngle: r(8) * Math.PI * 2,
    cavity: 0.052 + r(9) * 0.026,
    tilt: (r(10) - 0.5) * 0.5,
    bumps: 0.013 + r(11) * 0.01,
    seed: profile.seed,
  }
}

/**
 * Radius of the skin in a unit direction, in metres. Pure and cheap: the
 * physics can call it thousands of times per second.
 */
export function mangoRadiusAt(
  s: MangoShape,
  dx: number,
  dy: number,
  dz: number,
): number {
  const a = 1
  const b = s.elongate
  const c = s.flatten
  let r = 1 / Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b) + (dz * dz) / (c * c))

  // Full, square shoulders below the stem, a slight neck under the peduncle,
  // and a softer, narrower distal end: the widest point sits low.
  r *= 1 + s.shoulder * smoothstep(-0.62, 0.18, dy)
  r *= 1 - s.neck * smoothstep(0.34, 0.92, dy)
  r *= 1 - s.taper * smoothstep(-0.15, -0.98, dy)

  // One cheek carries more flesh than the other.
  r *= 1 + s.asym * dx * (0.4 + 0.6 * smoothstep(-0.7, 0.8, dy))
  r *= 1 + s.asym * 0.55 * dz * smoothstep(0.1, 0.9, dy)

  // The beak: a small blunt point low on one side.
  const bd = s.beakDir
  const bl = Math.hypot(bd[0], bd[1], bd[2])
  const dot = (dx * bd[0] + dy * bd[1] + dz * bd[2]) / bl
  r += s.beak * Math.exp(-9.5 * (1 - dot))

  // A shallow groove running from the stem down one flank.
  const hl = Math.hypot(dx, dz)
  if (hl > 1e-5) {
    const gx = Math.cos(s.grooveAngle)
    const gz = Math.sin(s.grooveAngle)
    const cosang = (dx * gx + dz * gz) / hl
    r -= s.groove * Math.exp(-7 * (1 - cosang)) * smoothstep(-0.85, 0.45, dy)
  }

  // The dished cavity the peduncle sits in.
  r -= s.cavity * smoothstep(0.86, 1.0, dy)

  return r * s.radius
}

/** Direction convention shared with the fruit's texture map. */
export function mangoDirFromUV(u: number, v: number, out: Float32Array): void {
  const theta = u * Math.PI * 2
  const phi = v * Math.PI
  const sp = Math.sin(phi)
  out[0] = -sp * Math.cos(theta)
  out[1] = Math.cos(phi)
  out[2] = sp * Math.sin(theta)
}

/**
 * Largest and downward extents of the skin. The physics needs both: the first
 * for broad phase, the second because the fruit rests on the net at the point
 * furthest from its centre, not at some nominal radius.
 */
export function mangoExtents(s: MangoShape): { max: number; bottom: number } {
  let max = 0
  for (let j = 0; j <= 24; j++) {
    const v = j / 24
    for (let i = 0; i < 32; i++) {
      const dir = new Float32Array(3)
      mangoDirFromUV(i / 32, v, dir)
      const r = mangoRadiusAt(s, dir[0], dir[1], dir[2])
      if (r > max) max = r
    }
  }
  return { max, bottom: mangoRadiusAt(s, 0, -1, 0) }
}

export function buildMangoGeometry(
  s: MangoShape,
  lon: number,
  lat: number,
): BufferGeometry {
  const noise = new Noise3(s.seed ^ 0x5c11)
  const vcount = (lon + 1) * (lat + 1)
  const pos = new Float32Array(vcount * 3)
  const uv = new Float32Array(vcount * 2)
  const dir = new Float32Array(3)

  for (let j = 0; j <= lat; j++) {
    const v = j / lat
    for (let i = 0; i <= lon; i++) {
      const u = i / lon
      mangoDirFromUV(u, v, dir)
      const dx = dir[0], dy = dir[1], dz = dir[2]
      let r = mangoRadiusAt(s, dx, dy, dz)
      // Organic undulation, kept strictly above the contact cap.
      const upper = smoothstep(-0.2, 0.15, dy)
      if (upper > 0) {
        r += s.radius * s.bumps * upper * noise.fbm(dx * 3.1, dy * 3.1, dz * 3.1, 3)
      }
      const k = (j * (lon + 1) + i) * 3
      pos[k] = dx * r
      pos[k + 1] = dy * r
      pos[k + 2] = dz * r
      const o = (j * (lon + 1) + i) * 2
      uv[o] = u
      uv[o + 1] = 1 - v
    }
  }

  const index: number[] = []
  for (let j = 0; j < lat; j++) {
    for (let i = 0; i < lon; i++) {
      const a = j * (lon + 1) + i
      const b = a + lon + 1
      if (j !== 0) index.push(a, b, a + 1)
      if (j !== lat - 1) index.push(b, b + 1, a + 1)
    }
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('uv', new BufferAttribute(uv, 2))
  geo.setIndex(index)
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

export interface MangoMaterialHandle {
  material: MeshPhysicalMaterial
  setRipeness(v: number): void
  setProfile(p: RoundProfile): void
  dispose(): void
}

const RAMP = {
  greenDeep: new Color(0.058, 0.112, 0.028),
  greenLight: new Color(0.185, 0.268, 0.052),
  chartreuse: new Color(0.44, 0.415, 0.062),
  yellow: new Color(0.78, 0.545, 0.072),
  orange: new Color(0.80, 0.315, 0.038),
  red: new Color(0.63, 0.115, 0.042),
}

export function makeMangoMaterial(tex: TextureBundle): MangoMaterialHandle {
  const uniforms: Record<string, IUniform> = {
    uRipeness: { value: 0 },
    uBlush: { value: 0.75 },
    uSpeckle: { value: 0.5 },
    uGreenDeep: { value: RAMP.greenDeep.clone() },
    uGreenLight: { value: RAMP.greenLight.clone() },
    uChartreuse: { value: RAMP.chartreuse.clone() },
    uYellow: { value: RAMP.yellow.clone() },
    uOrange: { value: RAMP.orange.clone() },
    uRed: { value: RAMP.red.clone() },
  }

  const material = new MeshPhysicalMaterial({
    color: 0xffffff,
    map: tex.mangoData,
    normalMap: tex.mangoNormal,
    roughness: 0.44,
    metalness: 0,
    clearcoat: 0.26,
    clearcoatRoughness: 0.34,
    sheen: 0.22,
    sheenRoughness: 0.7,
    envMapIntensity: 0.55,
  })
  material.normalScale.set(0.42, 0.42)

  material.onBeforeCompile = (shader) => {
    for (const key of Object.keys(uniforms)) shader.uniforms[key] = uniforms[key]
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uRipeness;
        uniform float uBlush;
        uniform float uSpeckle;
        const float ORDER_SCALE = ${ORDER_SCALE.toFixed(3)};
        uniform vec3 uGreenDeep;
        uniform vec3 uGreenLight;
        uniform vec3 uChartreuse;
        uniform vec3 uYellow;
        uniform vec3 uOrange;
        uniform vec3 uRed;
        float mangoRipeLocal;
        float mangoPore;
        `,
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        vec4 mangoTexel = texture2D( map, vMapUv );
        float mOrder = mangoTexel.g * ORDER_SCALE;
        float mMottle = mangoTexel.r;
        float mPore = mangoTexel.b;
        float mSpeck = mangoTexel.a;

        // Ripening spreads: each patch of skin has its own turn, so green,
        // yellow, orange and red all live on the fruit at the same time, and
        // the shaded shoulder is still turning when the sun cheek is done.
        float drive = uRipeness * 1.65 - 0.30;
        float lr = smoothstep(mOrder - 0.30, mOrder + 0.30, drive);

        vec3 col = mix(uGreenDeep, uGreenLight, smoothstep(0.0, 0.30, lr));
        col = mix(col, uChartreuse, smoothstep(0.22, 0.52, lr));
        col = mix(col, uYellow, smoothstep(0.44, 0.74, lr));
        col = mix(col, uOrange, smoothstep(0.66, 0.92, lr));
        // Red is a blush, not a coat: it only reaches what the sun reached.
        col = mix(col, uRed, smoothstep(0.68, 1.02, lr) * uBlush * (1.0 - 0.5 * mOrder));
        col *= 0.78 + 0.44 * mMottle;

        // Pale lenticels, then the dark speckle of a skin gone properly ripe.
        col += vec3(0.075, 0.068, 0.048) * mPore * (0.45 + 0.55 * lr);
        col = mix(col, col * vec3(0.34, 0.26, 0.21),
                  mSpeck * uSpeckle * smoothstep(0.6, 1.0, uRipeness));

        // Waxy bloom sits on unripe skin and burns off as it colours.
        float bloom = (1.0 - lr) * 0.42;
        col = mix(col, mix(col, vec3(dot(col, vec3(0.3333))), 0.32) + vec3(0.010), bloom);

        // Dry stem scar.
        float scar = smoothstep(0.055, 0.012, 1.0 - vMapUv.y);
        col = mix(col, vec3(0.145, 0.118, 0.072), scar * 0.92);

        diffuseColor.rgb *= col;
        mangoRipeLocal = lr;
        mangoPore = mPore;
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor *= mix(1.12, 0.72, mangoRipeLocal);
        roughnessFactor += mangoPore * 0.16 + (mangoTexel.r - 0.5) * 0.16;
        roughnessFactor = clamp(roughnessFactor, 0.08, 1.0);
        `,
      )
  }

  return {
    material,
    setRipeness(v: number): void {
      uniforms.uRipeness.value = clamp01(v)
    },
    setProfile(p: RoundProfile): void {
      uniforms.uBlush.value = p.blush
      uniforms.uSpeckle.value = p.speckle
    },
    dispose(): void {
      material.dispose()
    },
  }
}

export function makeMangoMesh(geometry: BufferGeometry, material: MeshPhysicalMaterial): Mesh {
  const mesh = new Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.matrixAutoUpdate = true
  return mesh
}
