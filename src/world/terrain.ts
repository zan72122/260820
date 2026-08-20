import * as THREE from 'three'
import { clamp, fbmOpen, lerp, smoothstep } from '../core/util'
import { groundHeight, wearAmount, L } from './layout'
import type { SurfaceMaps } from './textures'
import type { MaterialLib } from './materials'

/**
 * 河川敷の地面。草地と踏み固められた土をブレンドして、
 * 「毎年ここに人が座っている」使用感を出す。
 */

const DETAIL_M = 7.5 // ディテールテクスチャが 1 周するメートル数

function buildGrid(
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  stepX: number,
  stepZ: number,
) {
  const nx = Math.max(2, Math.round((x1 - x0) / stepX) + 1)
  const nz = Math.max(2, Math.round((z1 - z0) / stepZ) + 1)
  const count = nx * nz
  const pos = new Float32Array(count * 3)
  const uv = new Float32Array(count * 2)
  const col = new Float32Array(count * 3)
  const wear = new Float32Array(count)

  let i = 0
  for (let j = 0; j < nz; j++) {
    const z = lerp(z0, z1, j / (nz - 1))
    for (let k = 0; k < nx; k++) {
      const x = lerp(x0, x1, k / (nx - 1))
      const y = groundHeight(x, z)
      pos[i * 3] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = z
      uv[i * 2] = x / DETAIL_M
      uv[i * 2 + 1] = z / DETAIL_M

      const w = wearAmount(x, z)
      wear[i] = w

      // 大きなむら（草の勢い・日照・湿り）
      const macro = fbmOpen(x * 0.008, z * 0.008, 3, 401)
      const damp = smoothstep(L.near.slopeTop + 16, L.near.shore, Math.abs(z))
      let r = 0.86 + macro * 0.30
      let g = 0.88 + macro * 0.26
      let b = 0.80 + macro * 0.22
      // 水際は湿って暗い
      r = lerp(r, r * 0.72, damp)
      g = lerp(g, g * 0.74, damp)
      b = lerp(b, b * 0.70, damp)
      // 法尻のたまり（少し暗く）
      const toe = smoothstep(L.near.terraceEnd + 4, L.near.terraceEnd - 6, z) * 0
      col[i * 3] = clamp(r - toe, 0, 2)
      col[i * 3 + 1] = clamp(g - toe, 0, 2)
      col[i * 3 + 2] = clamp(b - toe, 0, 2)
      i++
    }
  }

  const idx: number[] = []
  for (let j = 0; j < nz - 1; j++) {
    for (let k = 0; k < nx - 1; k++) {
      const a = j * nx + k
      const b = a + 1
      const c = a + nx
      const d = c + 1
      idx.push(a, c, b, b, c, d)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.setAttribute('aWear', new THREE.BufferAttribute(wear, 1))
  geo.setIndex(count > 65535 ? new THREE.BufferAttribute(new Uint32Array(idx), 1) : new THREE.BufferAttribute(new Uint16Array(idx), 1))
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

export function makeGroundMaterial(grass: SurfaceMaps, dirt: SurfaceMaps) {
  const mat = new THREE.MeshStandardMaterial({
    map: grass.map,
    normalMap: grass.normalMap,
    roughnessMap: grass.roughnessMap,
    roughness: 1.0,
    metalness: 0.0,
    vertexColors: true,
    normalScale: new THREE.Vector2(0.85, 0.85),
    dithering: true,
  })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDirtMap = { value: dirt.map }
    shader.uniforms.uDirtRough = { value: dirt.roughnessMap }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float aWear;\nvarying float vWear;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWear = aWear;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform sampler2D uDirtMap;\nuniform sampler2D uDirtRough;\nvarying float vWear;',
      )
      .replace(
        '#include <map_fragment>',
        `
        vec4 grassTex = texture2D( map, vMapUv );
        vec4 dirtTex  = texture2D( uDirtMap, vMapUv * 0.63 + vec2(0.21, 0.37) );
        float wmix = smoothstep(0.08, 0.72, vWear);
        vec4 sampledDiffuseColor = mix( grassTex, dirtTex, wmix );
        // 同じ模様の繰り返しが見えないよう、大きなスケールでむらを掛ける
        vec3 macro = texture2D( map, vMapUv * 0.113 + vec2(0.37, 0.11) ).rgb;
        vec3 macro2 = texture2D( uDirtMap, vMapUv * 0.041 + vec2(0.61, 0.29) ).rgb;
        sampledDiffuseColor.rgb *= (0.70 + 0.72 * macro.g) * (0.80 + 0.42 * macro2.r);
        diffuseColor *= sampledDiffuseColor;
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `
        float roughnessFactor = roughness;
        float rg = texture2D( roughnessMap, vRoughnessMapUv ).g;
        float rd = texture2D( uDirtRough, vRoughnessMapUv * 0.63 + vec2(0.21, 0.37) ).g;
        roughnessFactor *= mix( rg, rd, smoothstep(0.08, 0.72, vWear) );
        `,
      )
  }
  mat.customProgramCacheKey = () => 'venue-ground'
  return mat
}

export type Terrain = {
  group: THREE.Group
  material: THREE.MeshStandardMaterial
  grass: SurfaceMaps
  dirt: SurfaceMaps
}

export function buildTerrain(quality: number, lib: MaterialLib): Terrain {
  const grass = lib.grassMaps
  const dirt = lib.dirtMaps
  const material = makeGroundMaterial(grass, dirt)

  const group = new THREE.Group()
  group.name = 'terrain'

  const stepX = quality > 0.6 ? 4 : 6
  const stepZ = quality > 0.6 ? 2.2 : 3.2

  const near = new THREE.Mesh(buildGrid(-700, 700, 84, 300, stepX, stepZ), material)
  near.receiveShadow = true
  near.name = 'ground-near'
  group.add(near)

  const far = new THREE.Mesh(buildGrid(-820, 820, -250, -84, stepX * 2.4, stepZ * 1.7), material)
  far.receiveShadow = false
  far.name = 'ground-far'
  group.add(far)

  return { group, material, grass, dirt }
}
