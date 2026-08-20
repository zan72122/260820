/**
 * World constants. Everything is in metres and seconds.
 *
 * The flume runs along -Z (upstream, far away) to +Z (downstream, near the
 * player). It drops gently so the water — and the somen — always travel
 * towards the camera.
 */

export const FLUME = {
  zStart: -11.4,
  zEnd: 4.6,
  /** Height of the *inside bottom* of the trough at z. */
  yAt(z: number): number {
    return 1.005 - (z - -11.4) * 0.0192 + Math.sin(z * 0.61 + 1.9) * 0.0035
  },
  /** Lateral drift of the trough centre — split bamboo is never truly straight. */
  xAt(z: number): number {
    return Math.sin(z * 0.37 + 0.4) * 0.009 + Math.sin(z * 0.13) * 0.012
  },
  rInner: 0.0685,
  rOuter: 0.0785,
  /** Distance between culm nodes. */
  nodeSpacing: 0.368,
  nodePhase: 0.14,
  /** Depth of the running water measured from the inside bottom. */
  waterDepth: 0.0215,
} as const

/** Half-width of the free water surface. */
export const WATER_HALF_WIDTH = Math.sqrt(
  FLUME.rInner * FLUME.rInner - (FLUME.rInner - FLUME.waterDepth) ** 2,
)

/** Surface height of the water at z. */
export function waterY(z: number): number {
  return FLUME.yAt(z) + FLUME.waterDepth
}

/** Distance to the nearest culm node (used for ripples and sound). */
export function nodeDistance(z: number): number {
  const t = (z - FLUME.nodePhase) / FLUME.nodeSpacing
  return Math.abs(t - Math.round(t)) * FLUME.nodeSpacing
}

/** Reach of the chopsticks along the flume. */
export const PLAY = {
  sMin: -3.6,
  sMax: 2.0,
  hMin: -0.014,
  hMax: 0.44,
  /** Where the somen is released and where it dies. */
  spawnZ: -9.4,
  despawnZ: 3.6,
} as const

export const BOWL = {
  x: 0.30,
  z: 1.55,
  rim: 0.078,
  height: 0.052,
  /** Height of the little stand the bowl sits on. */
  standY: 0.66,
  /** Height of the tsuyu surface. */
  get liquidY(): number {
    return this.standY + 0.034
  },
} as const

/** The trough is cut a little past the half-way line, so it holds water. */
export const THETA_MAX = (96 * Math.PI) / 180

/** Angular position of the waterline, as the V coordinate of the inner skin. */
export const WATERLINE_V = (() => {
  const theta = Math.asin(WATER_HALF_WIDTH / FLUME.rInner)
  return [(-theta + THETA_MAX) / (2 * THETA_MAX), (theta + THETA_MAX) / (2 * THETA_MAX)] as const
})()

export const SUN_DIR = { x: -0.42, y: 0.78, z: 0.47 }
