import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshPhysicalMaterial,
  Vector3,
  type IUniform,
} from 'three'
import { Rng } from '../core/rng'
import { clamp01 } from '../core/math'
import type { TextureBundle } from '../gfx/textureLab'

/**
 * Mango leaves: long, waxy, with a raised midrib, a slight cup across the
 * blade and a droop along it. Every blade is generated with its own outline,
 * curl, twist and tint, so no two are the same object seen twice.
 */

export interface LeafParams {
  length: number
  width: number
  curl: number
  droop: number
  twist: number
  wave: number
  tint: number
  seed: number
}

export function makeLeafParams(rng: Rng): LeafParams {
  return {
    length: rng.range(0.115, 0.185),
    width: rng.range(0.021, 0.034),
    curl: rng.range(0.1, 0.4),
    droop: rng.range(0.1, 0.42),
    twist: rng.jitter(0.42),
    wave: rng.range(0, 0.35),
    tint: rng.range(0, 1),
    seed: Math.floor(rng.next() * 1e6),
  }
}

/** Blade in local space: +Y along the leaf, X across, Z the cupping axis. */
export function buildLeafGeometry(p: LeafParams, segs = 16, cross = 5): BufferGeometry {
  const vcount = (segs + 1) * (cross + 1)
  const pos = new Float32Array(vcount * 3)
  const uv = new Float32Array(vcount * 2)
  const col = new Float32Array(vcount * 3)
  const base = new Color().setHSL(0.27 + p.tint * 0.045, 0.5 + p.tint * 0.2, 0.42 + p.tint * 0.12)

  for (let j = 0; j <= segs; j++) {
    const v = j / segs
    // Blade outline: narrow at the petiole, widest just past the middle,
    // drawn out to a soft point.
    const halfW = p.width * Math.pow(Math.sin(Math.PI * Math.pow(v, 0.78)), 0.62)
    // The blade curves towards local -Z, so a leaf oriented with -Z downwards
    // droops the way a real one hangs off the twig.
    const droop = -p.droop * v * v * p.length * 0.62
    const twistAng = p.twist * v
    for (let i = 0; i <= cross; i++) {
      const u = (i / cross) * 2 - 1
      let x = u * halfW
      let z = droop + p.curl * halfW * (u * u - 0.32) + Math.sin(v * Math.PI * 2.2) * p.wave * halfW * 0.6
      const ca = Math.cos(twistAng)
      const sa = Math.sin(twistAng)
      const rx = x * ca - z * sa
      const rz = x * sa + z * ca
      x = rx
      z = rz
      const k = (j * (cross + 1) + i) * 3
      pos[k] = x
      pos[k + 1] = v * p.length
      pos[k + 2] = z
      const o = (j * (cross + 1) + i) * 2
      uv[o] = i / cross
      uv[o + 1] = v
      // A little tonal drift along the blade keeps big leaves from reading flat.
      const shade = 0.9 + 0.16 * clamp01(v * 1.2)
      col[k] = base.r * shade
      col[k + 1] = base.g * shade
      col[k + 2] = base.b * shade
    }
  }

  const index: number[] = []
  for (let j = 0; j < segs; j++) {
    for (let i = 0; i < cross; i++) {
      const a = j * (cross + 1) + i
      const b = a + cross + 1
      index.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('uv', new BufferAttribute(uv, 2))
  geo.setAttribute('color', new BufferAttribute(col, 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

export interface LeafMaterialHandle {
  material: MeshPhysicalMaterial
  setSun(dir: Vector3, color: Color, intensity: number): void
  dispose(): void
}

/**
 * Standard PBR plus a cheap translucency term: light coming from behind the
 * blade glows through it, which is most of what makes a leaf read as a leaf.
 */
export function makeLeafMaterial(tex: TextureBundle): LeafMaterialHandle {
  const uniforms: Record<string, IUniform> = {
    uSunDir: { value: new Vector3(0.4, 0.8, 0.4) },
    uSunColor: { value: new Color(1, 0.96, 0.88) },
    uSunIntensity: { value: 1 },
    uTransmit: { value: new Color(0.36, 0.62, 0.14) },
  }
  const material = new MeshPhysicalMaterial({
    map: tex.leafColor,
    normalMap: tex.leafNormal,
    vertexColors: true,
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.42,
    clearcoatRoughness: 0.36,
    side: DoubleSide,
    envMapIntensity: 0.75,
  })
  material.normalScale.set(0.8, 0.8)

  material.onBeforeCompile = (shader) => {
    for (const k of Object.keys(uniforms)) shader.uniforms[k] = uniforms[k]
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uSunIntensity;
        uniform vec3 uTransmit;
        `,
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `#include <opaque_fragment>
        {
          // Light that has passed through the blade from behind.
          vec3 n = normalize( normal );
          float back = max( 0.0, dot( -n, normalize( uSunDir ) ) );
          float view = max( 0.0, dot( normalize( vViewPosition ), n ) );
          float through = pow( back, 2.2 ) * ( 0.35 + 0.65 * view );
          gl_FragColor.rgb += uTransmit * uSunColor * ( through * 0.85 * uSunIntensity ) * diffuseColor.rgb * 2.4;
        }
        `,
      )
  }

  return {
    material,
    setSun(dir: Vector3, color: Color, intensity: number): void {
      ;(uniforms.uSunDir.value as Vector3).copy(dir)
      ;(uniforms.uSunColor.value as Color).copy(color)
      uniforms.uSunIntensity.value = intensity
    },
    dispose(): void {
      material.dispose()
    },
  }
}

export function makeLeafMesh(geo: BufferGeometry, material: MeshPhysicalMaterial): Mesh {
  const mesh = new Mesh(geo, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}
