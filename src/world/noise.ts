import * as THREE from 'three'

/**
 * One tileable multi-octave noise texture shared by every material. Sampling a
 * texture is far cheaper than evaluating fbm per pixel, which matters on phone
 * GPUs and makes the fill-heavy water and mud shaders affordable.
 * R,G,B,A hold progressively finer octaves.
 */
let cached: THREE.Texture | null = null

function periodicValueNoise(size: number, freq: number, seed: number) {
  const grid = new Float32Array(freq * freq)
  let s = (seed * 2654435761) >>> 0
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
  for (let i = 0; i < freq * freq; i++) grid[i] = rand()
  const out = new Float32Array(size * size)
  const smooth = (t: number) => t * t * (3 - 2 * t)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * freq
      const fy = (y / size) * freq
      const x0 = Math.floor(fx) % freq
      const y0 = Math.floor(fy) % freq
      const x1 = (x0 + 1) % freq
      const y1 = (y0 + 1) % freq
      const tx = smooth(fx - Math.floor(fx))
      const ty = smooth(fy - Math.floor(fy))
      const a = grid[y0 * freq + x0]
      const b = grid[y0 * freq + x1]
      const c = grid[y1 * freq + x0]
      const d = grid[y1 * freq + x1]
      out[y * size + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty
    }
  }
  return out
}

export function noiseTexture() {
  if (cached) return cached
  const S = 256
  const oct = [
    periodicValueNoise(S, 4, 1),
    periodicValueNoise(S, 8, 2),
    periodicValueNoise(S, 16, 3),
    periodicValueNoise(S, 32, 4),
  ]
  const data = new Uint8Array(S * S * 4)
  for (let i = 0; i < S * S; i++) {
    for (let c = 0; c < 4; c++) data[i * 4 + c] = Math.max(0, Math.min(255, (oct[c][i] * 255) | 0))
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.generateMipmaps = true
  t.needsUpdate = true
  cached = t
  return t
}
