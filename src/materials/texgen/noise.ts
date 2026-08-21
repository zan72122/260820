/**
 * Tileable procedural noise on Float32 fields — pure math, no DOM, so the
 * whole synthesis pipeline is unit-testable in Node. All functions are
 * deterministic in (seed, params).
 */
import { mulberry32 } from '../../core/rng'

export interface Field {
  w: number
  h: number
  data: Float32Array
}

export function createField(w: number, h: number, fill = 0): Field {
  const data = new Float32Array(w * h)
  if (fill !== 0) data.fill(fill)
  return { w, h, data }
}

export function cloneField(f: Field): Field {
  return { w: f.w, h: f.h, data: new Float32Array(f.data) }
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

/**
 * Tileable lattice value noise added into `out`:
 * out += amp * noise(cells×cells lattice).
 * `stretchX` > 1 elongates features along x (wood grain streaks).
 */
export function addValueNoise(
  out: Field,
  seed: number,
  cells: number,
  amp: number,
  stretchX = 1,
): void {
  const rng = mulberry32(seed)
  const cellsX = Math.max(1, Math.round(cells / stretchX))
  const cellsY = cells
  const lattice = new Float32Array(cellsX * cellsY)
  for (let i = 0; i < lattice.length; i++) lattice[i] = rng()

  const { w, h, data } = out
  for (let y = 0; y < h; y++) {
    const v = (y / h) * cellsY
    const y0 = Math.floor(v)
    const fy = smooth(v - y0)
    const iy0 = y0 % cellsY
    const iy1 = (y0 + 1) % cellsY
    for (let x = 0; x < w; x++) {
      const u = (x / w) * cellsX
      const x0 = Math.floor(u)
      const fx = smooth(u - x0)
      const ix0 = x0 % cellsX
      const ix1 = (x0 + 1) % cellsX
      const a = lattice[iy0 * cellsX + ix0] as number
      const b = lattice[iy0 * cellsX + ix1] as number
      const c = lattice[iy1 * cellsX + ix0] as number
      const d = lattice[iy1 * cellsX + ix1] as number
      const val = a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
      data[y * w + x] = (data[y * w + x] as number) + amp * val
    }
  }
}

/** Fractal sum of value noise octaves (tileable). */
export function addFbm(
  out: Field,
  seed: number,
  baseCells: number,
  octaves: number,
  amp: number,
  gain = 0.5,
  stretchX = 1,
): void {
  let a = amp
  let cells = baseCells
  for (let o = 0; o < octaves; o++) {
    addValueNoise(out, seed + o * 101, cells, a, stretchX)
    a *= gain
    cells *= 2
  }
}

/**
 * Tileable Worley (cellular) noise written into `out` (overwrites):
 * mode 'f1' = distance to nearest point (0 at points, growing outward),
 * mode 'edge' = f2-f1 (0 at cell borders — pebble/crack look inverted).
 * Distances are normalized by the mean spacing so output is ~0..1.
 */
export function worley(
  out: Field,
  seed: number,
  points: number,
  mode: 'f1' | 'edge',
): void {
  const rng = mulberry32(seed)
  const px = new Float32Array(points)
  const py = new Float32Array(points)
  for (let i = 0; i < points; i++) {
    px[i] = rng()
    py[i] = rng()
  }
  const norm = 1 / Math.sqrt(points)
  const { w, h, data } = out
  for (let y = 0; y < h; y++) {
    const v = y / h
    for (let x = 0; x < w; x++) {
      const u = x / w
      let f1 = Infinity
      let f2 = Infinity
      for (let i = 0; i < points; i++) {
        let dx = Math.abs(u - (px[i] as number))
        let dy = Math.abs(v - (py[i] as number))
        if (dx > 0.5) dx = 1 - dx
        if (dy > 0.5) dy = 1 - dy
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < f1) {
          f2 = f1
          f1 = d
        } else if (d < f2) {
          f2 = d
        }
      }
      const val = mode === 'f1' ? f1 / norm : (f2 - f1) / norm
      data[y * w + x] = Math.min(1.5, val)
    }
  }
}

/** Transpose in place-ish (returns a new field, w/h swapped) — lets the
 * x-stretched generators produce vertically elongated features. */
export function transposeField(f: Field): Field {
  const out = createField(f.h, f.w)
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      out.data[x * f.h + y] = f.data[y * f.w + x] as number
    }
  }
  return out
}

/** Per-pixel transform. */
export function mapField(f: Field, fn: (v: number, i: number) => number): void {
  const { data } = f
  for (let i = 0; i < data.length; i++) data[i] = fn(data[i] as number, i)
}

/** Rescale to [0,1] (no-op on constant fields). */
export function normalizeField(f: Field): void {
  let min = Infinity
  let max = -Infinity
  for (const v of f.data) {
    if (v < min) min = v
    if (v > max) max = v
  }
  const span = max - min
  if (span < 1e-9) return
  mapField(f, (v) => (v - min) / span)
}

/** out = out*(1-t) + other*t, t may be a field or scalar. */
export function mixField(out: Field, other: Field, t: number | Field): void {
  const { data } = out
  for (let i = 0; i < data.length; i++) {
    const k = typeof t === 'number' ? t : (t.data[i] as number)
    data[i] = (data[i] as number) * (1 - k) + (other.data[i] as number) * k
  }
}

/**
 * Height field → tangent-space normal map bytes (RGBA, y-up green),
 * tileable Sobel. `strength` scales the slope.
 */
export function heightToNormalBytes(f: Field, strength: number): Uint8ClampedArray {
  const { w, h, data } = f
  const out = new Uint8ClampedArray(w * h * 4)
  const at = (x: number, y: number) =>
    data[((y + h) % h) * w + ((x + w) % w)] as number
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = at(x - 1, y - 1)
      const l = at(x - 1, y)
      const bl = at(x - 1, y + 1)
      const tr = at(x + 1, y - 1)
      const r = at(x + 1, y)
      const br = at(x + 1, y + 1)
      const t = at(x, y - 1)
      const b = at(x, y + 1)
      const dx = (tr + 2 * r + br - tl - 2 * l - bl) * strength
      const dy = (bl + 2 * b + br - tl - 2 * t - tr) * strength
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1)
      const i = (y * w + x) * 4
      out[i] = (-dx * inv * 0.5 + 0.5) * 255
      out[i + 1] = (dy * inv * 0.5 + 0.5) * 255
      out[i + 2] = (inv * 0.5 + 0.5) * 255
      out[i + 3] = 255
    }
  }
  return out
}

export interface ColorStop {
  t: number
  rgb: readonly [number, number, number]
}

/** Map a scalar field through a colour ramp → RGBA bytes (sRGB). */
export function rampToBytes(f: Field, stops: readonly ColorStop[]): Uint8ClampedArray {
  const { w, h, data } = f
  const out = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < data.length; i++) {
    const v = Math.max(0, Math.min(1, data[i] as number))
    let lo = stops[0] as ColorStop
    let hi = stops[stops.length - 1] as ColorStop
    for (let s = 0; s < stops.length - 1; s++) {
      const a = stops[s] as ColorStop
      const b = stops[s + 1] as ColorStop
      if (v >= a.t && v <= b.t) {
        lo = a
        hi = b
        break
      }
    }
    const span = hi.t - lo.t
    const k = span > 1e-9 ? (v - lo.t) / span : 0
    const j = i * 4
    out[j] = lo.rgb[0] + (hi.rgb[0] - lo.rgb[0]) * k
    out[j + 1] = lo.rgb[1] + (hi.rgb[1] - lo.rgb[1]) * k
    out[j + 2] = lo.rgb[2] + (hi.rgb[2] - lo.rgb[2]) * k
    out[j + 3] = 255
  }
  return out
}

/** Scalar field → greyscale RGBA bytes (linear, for roughness maps). */
export function greyToBytes(f: Field): Uint8ClampedArray {
  const { data } = f
  const out = new Uint8ClampedArray(data.length * 4)
  for (let i = 0; i < data.length; i++) {
    const v = Math.max(0, Math.min(1, data[i] as number)) * 255
    const j = i * 4
    out[j] = v
    out[j + 1] = v
    out[j + 2] = v
    out[j + 3] = 255
  }
  return out
}
