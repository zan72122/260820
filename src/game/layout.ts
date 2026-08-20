/**
 * Every world measurement lives here, in metres. One branch, one fruit, one
 * net: the numbers are deliberately small in count so the whole staging can be
 * reasoned about (and unit tested) at a glance.
 */

export const FLOOR_Y = 0

/** The propagation bench the net is draped over before the child touches it. */
export const BENCH = {
  top: 0.335,
  x0: -0.48,
  x1: 0.48,
  z0: -0.30,
  z1: 0.04,
  legInset: 0.06,
}

/** The branch arches over the scene; both limbs sweep down and outward. */
export const BRANCH = {
  apex: { x: 0, y: 1.16, z: -0.03 },
  halfSpan: 0.62,
  /** Height drop from the apex at the outer end. */
  drop: 0.26,
  /** The limbs also swing forward, giving the arch real depth. */
  zSweep: 0.20,
  radius: 0.021,
}

/** Height of the branch centreline at a given x (before load bending). */
export function branchY(x: number): number {
  const t = Math.min(1, Math.abs(x) / BRANCH.halfSpan)
  return BRANCH.apex.y - BRANCH.drop * t * t
}

/** Depth of the branch centreline at a given x. */
export function branchZ(x: number): number {
  const t = x / BRANCH.halfSpan
  return BRANCH.apex.z + BRANCH.zSweep * t
}

/** Hooks screwed into the descending limbs, symmetric about the fruit. */
export const HOOK_XS = [0.155, 0.235, 0.315, 0.395] as const

export interface HookSpec {
  id: number
  side: -1 | 1
  x: number
  y: number
  z: number
}

/** Small drop from the branch centreline to the eye of the hook. */
export const HOOK_DROP = 0.027

export function buildHooks(): HookSpec[] {
  const hooks: HookSpec[] = []
  let id = 0
  for (const side of [-1, 1] as const) {
    for (const ax of HOOK_XS) {
      const x = side * ax
      hooks.push({ id: id++, side, x, y: branchY(x) - HOOK_DROP, z: branchZ(x) })
    }
  }
  return hooks
}

/** The pair that glints on the very first round. */
export const FIRST_HINT_HOOKS: readonly [number, number] = [1, 5]

export const STEM = {
  /** Where the peduncle leaves the branch. */
  anchor: { x: 0.012, y: BRANCH.apex.y - 0.014, z: BRANCH.apex.z + 0.006 },
  length: 0.135,
  radius: 0.0063,
}

export const FRUIT = {
  radius: 0.060,
  /** Distance from the stem scar down to the fruit centre. */
  hangOffset: 0.070,
}

/** Fruit centre while still attached to the stem. */
export const FRUIT_HANG_Y = STEM.anchor.y - STEM.length - FRUIT.hangOffset

export const NET_GEOMETRY = {
  cols: 15,
  rows: 9,
  panelLength: 0.48,
  panelWidth: 0.27,
  cordSegments: 7,
  cordLength: 0.22,
  edgeShrink: 0.10,
}

/** Radius of every structural cord in the net. */
export const CORD_RADIUS = 0.0042

/** Span limits used to normalise "how taut is this hanging?" into 0..1. */
export const SPAN_MIN = HOOK_XS[0] * 2
export const SPAN_MAX = HOOK_XS[HOOK_XS.length - 1] * 2

export function tautnessForSpan(span: number): number {
  const t = (span - SPAN_MIN) / (SPAN_MAX - SPAN_MIN)
  return t < 0 ? 0 : t > 1 ? 1 : t
}

/** Generous pick radius in CSS pixels for the two net ends. */
export const HANDLE_PICK_PX = 78
/** The grip is drawn above the finger so a fingertip never covers it. */
export const HANDLE_FINGER_OFFSET_PX = 46
/** How close a hook has to be, in metres, before it takes the cord end. */
export const HOOK_SNAP_RADIUS = 0.135
