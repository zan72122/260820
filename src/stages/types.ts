import type { CameraRig } from '../core/camera'
import type { Input } from '../core/gestures'
import type { Audio } from '../core/audio'
import type { Hud } from '../ui/hud'
import type { World } from '../world'
import type { Flavor } from '../core/flavors'

export type StageId =
  | 'intro'
  | 'mix'
  | 'pour'
  | 'toOven'
  | 'bake'
  | 'takeout'
  | 'flip'
  | 'mount'
  | 'cool'
  | 'release'
  | 'lift'
  | 'press'
  | 'done'

export interface Stage {
  readonly id: StageId
  enter(): void
  update(dt: number, elapsed: number): void
  exit?(): void
}

export interface Ctx {
  world: World
  rig: CameraRig
  input: Input
  hud: Hud
  audio: Audio
  flavor: Flavor
  /** How many complete cakes the player has made — the guides fade after the first. */
  plays: number
  next(): void
  goto(id: StageId): void
}

/** Points along a circular arc in HUD unit space. */
export function arcPoints(
  cx: number,
  cy: number,
  r: number,
  fromDeg: number,
  toDeg: number,
  n = 36,
): { x: number; y: number }[] {
  const out = []
  for (let i = 0; i <= n; i++) {
    const a = ((fromDeg + (toDeg - fromDeg) * (i / n)) * Math.PI) / 180
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
  }
  return out
}

export function linePoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  bow = 0,
  n = 20,
): { x: number; y: number }[] {
  const out = []
  const mx = (x0 + x1) / 2 - (y1 - y0) * bow
  const my = (y0 + y1) / 2 + (x1 - x0) * bow
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const mt = 1 - t
    out.push({
      x: mt * mt * x0 + 2 * mt * t * mx + t * t * x1,
      y: mt * mt * y0 + 2 * mt * t * my + t * t * y1,
    })
  }
  return out
}
