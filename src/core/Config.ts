/**
 * Every tuning number for the test section lives here so the causal rule
 * ("strong water pushes the raft up the hill") stays deterministic and legible.
 * Nothing in this file is ever shown to the player as a number.
 */

/** Side profile of the water-coaster test section, metres. z is always 0:
 *  the whole point of this course is that it reads in one side view. */
export const COURSE_POINTS: ReadonlyArray<readonly [number, number]> = [
  [-7.5, 6.42],
  [-3.0, 6.19],
  [0.0, 6.0],
  [3.0, 5.52],
  [6.4, 3.9],
  [9.6, 2.3],
  [12.6, 1.32],
  [15.4, 0.92],
  [17.2, 0.72],
  [18.6, 0.6],
  [19.8, 0.54],
  [21.0, 0.66],
  [22.2, 1.0],
  [23.8, 1.58],
  [26.8, 2.62],
  [30.2, 3.86],
  [33.6, 5.1],
  [36.8, 6.16],
  [39.8, 7.0],
  [42.4, 7.42],
  [45.2, 7.28],
  [48.2, 6.34],
  [51.6, 4.6],
  [55.0, 2.85],
  [58.4, 1.62],
  [61.6, 1.06],
  [66.0, 0.95],
  [72.0, 0.93],
  [78.0, 0.92],
];

/** Landmarks expressed in course x (metres). */
export const LANDMARK_X = {
  launch: -3.0,
  dropStart: 1.5,
  valleyIn: 13.0,
  /** Moulded waiting dimple at the bottom of the valley. */
  restPool: 19.8,
  hillToe: 21.8,
  hillTop: 42.4,
  landing: 60.0,
  runoutEnd: 74.0,
} as const;

/** Physical nozzle bank cast into the uphill floor. */
export const NOZZLE = {
  /** The bank starts just behind the waiting dimple: that is what lets a
   *  stopped raft be pushed out of it, and it is the whole discovery. */
  firstX: 16.4,
  lastX: 40.4,
  spacing: 1.45,
  /** Angle above the local floor plane, radians - jets lean up-slope. */
  rake: 0.44,
  boreRadius: 0.075,
} as const;

/** Water supply valves. Which nozzles actually get pressure this run. */
export const BLAST_ZONES = {
  single: [[16.0, 40.8]] as ReadonlyArray<readonly [number, number]>,
  split: [
    [16.0, 28.5],
    [31.5, 40.8],
  ] as ReadonlyArray<readonly [number, number]>,
};

export const PHYSICS = {
  G: 9.81,
  /** Fixed integration step. Physics never sees a variable dt. */
  FIXED_DT: 1 / 240,
  MAX_FRAME_DT: 1 / 15,
  RAFT_MASS: 62,
  BAG_MASS: 30,
  RAFT_LENGTH: 2.7,
  /** Wet FRP is slippery; this is the last bit of coulomb friction. */
  FRICTION: 0.016,
  /** Water film + air, N per (m/s)^2. */
  DRAG: 0.85,
  /** Standing water in the valley dimple, extra quadratic + linear drag. */
  POOL_DRAG: 2.0,
  POOL_LINEAR: 12.0,
  POOL_FROM_X: 16.0,
  POOL_TO_X: 21.6,
  /** The moulded waiting dimple at the very bottom: it only grips a raft that
   *  has already lost its speed, so a fast raft still shoots through. */
  DOCK_SPAN: 4.0,
  DOCK_DAMPING: 115.0,
  /** The dimple's uphill lip catches a raft drifting back down much harder
   *  than it holds one still running forward, so the first fast pass through
   *  the valley is untouched and the return is caught in a metre or two. */
  DOCK_FORWARD_BIAS: 0.12,
  /** Shallow runout pool at the end. */
  RUNOUT_DRAG: 9.0,
  RUNOUT_LINEAR: 42.0,
  /** Peak push from a fully charged bank, newtons. */
  BLAST_FORCE: 860,
  /** How many nozzles' worth of coverage counts as "full push". */
  BLAST_COVERAGE_NORM: 1.9,
  /** How far up-slope a jet can still reach the raft's tail. */
  JET_REACH_BEHIND: 2.7,
  JET_REACH_AHEAD: 0.45,
  REST_SPEED: 0.06,
  /** A parked raft only stays parked while nothing is pushing it. */
  STATIC_HOLD: 95,
} as const;

export const PUMP = {
  /** Lever press -> hydraulic pressure, seconds. */
  RISE_TAU: 0.38,
  FALL_TAU: 0.55,
  /** Sequential fill of the bank, near nozzle first. */
  SEQUENCE_SPREAD: 0.42,
  SEQUENCE_WIDTH: 0.2,
  FILL_TAU: 0.1,
} as const;

export interface RunPreset {
  readonly index: number;
  /** Number of ballast bags the rig puts on the deck before this run. */
  readonly bags: number;
  readonly zones: ReadonlyArray<readonly [number, number]>;
  /** What single thing changed compared with the previous run. */
  readonly changed: 'first' | 'lighter' | 'heavier' | 'course';
}

export const RUNS: ReadonlyArray<RunPreset> = [
  { index: 0, bags: 1, zones: BLAST_ZONES.single, changed: 'first' },
  { index: 1, bags: 0, zones: BLAST_ZONES.single, changed: 'lighter' },
  { index: 2, bags: 2, zones: BLAST_ZONES.single, changed: 'heavier' },
  { index: 3, bags: 2, zones: BLAST_ZONES.split, changed: 'course' },
];

export const CAMERA = {
  NEAR: 0.15,
  FAR: 3000,
  FOV_LANDSCAPE: 46,
  FOV_PORTRAIT: 58,
} as const;
