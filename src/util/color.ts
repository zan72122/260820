import { Color } from 'three'
import { clamp } from './math'

export type Stop = { at: number; color: string }

/**
 * A multi-stop colour ramp evaluated in linear-ish sRGB space.
 * Used for every continuous lighting parameter so dusk -> night never
 * collapses into a single "blue filter" cross-fade.
 */
export class Ramp {
  private stops: { at: number; c: Color }[]
  constructor(stops: Stop[]) {
    this.stops = stops
      .map((s) => ({ at: s.at, c: new Color(s.color) }))
      .sort((a, b) => a.at - b.at)
  }
  sample(t: number, out = new Color()): Color {
    const v = clamp(t)
    const s = this.stops
    if (v <= s[0].at) return out.copy(s[0].c)
    if (v >= s[s.length - 1].at) return out.copy(s[s.length - 1].c)
    for (let i = 0; i < s.length - 1; i++) {
      const a = s[i]
      const b = s[i + 1]
      if (v >= a.at && v <= b.at) {
        const k = (v - a.at) / (b.at - a.at)
        return out.copy(a.c).lerp(b.c, k)
      }
    }
    return out.copy(s[s.length - 1].c)
  }
}

/** Scalar keyframe curve — same idea as Ramp but for numbers. */
export class Curve {
  private keys: [number, number][]
  constructor(keys: [number, number][]) {
    this.keys = [...keys].sort((a, b) => a[0] - b[0])
  }
  at(t: number): number {
    const v = clamp(t)
    const k = this.keys
    if (v <= k[0][0]) return k[0][1]
    if (v >= k[k.length - 1][0]) return k[k.length - 1][1]
    for (let i = 0; i < k.length - 1; i++) {
      if (v >= k[i][0] && v <= k[i + 1][0]) {
        const f = (v - k[i][0]) / (k[i + 1][0] - k[i][0])
        const s = f * f * (3 - 2 * f)
        return k[i][1] + (k[i + 1][1] - k[i][1]) * s
      }
    }
    return k[k.length - 1][1]
  }
}
