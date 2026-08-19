/** All world dimensions are metres; the scene is built at real scale. */
export const CFG = {
  /** distance between the centres of two ridges */
  rowSpacing: 1.5,
  bedWidth: 0.8,
  bedHeight: 0.19,
  rowCount: 9,

  daikonSpacing: 0.34,
  daikonPerRow: 20,
  /** z of the first daikon in a row */
  rowStartZ: 0.5,

  /** how far before/after the crop the machine travels */
  approachZ: -2.6,
  runoutZ: 1.9,

  driveSpeed: 0.52,
  steerSpeed: 2.5,
  /** the row grabs the machine once it is closer than this */
  magnetRange: 0.62,
  /** the grip works within this lateral error */
  grabTolerance: 0.34,

  /** local Y of the belt pinch line above the ridge top when the head is down */
  headDownY: -0.03,
  headUpY: 0.30,

  /** daikon proportions */
  daikonLength: 0.42,
  daikonRadius: 0.039,
  /** the shoulder pokes this far above the ridge */
  shoulderRise: 0.035,

  beltSpeed: 0.72,
} as const;

export const bedTopY = CFG.bedHeight;
/**
 * Y of a plant's crown while it is still in the ground. Set so the white
 * shoulder sits flush with the ridge: from above the field is nothing but
 * leaves, which is the whole premise — the root is a surprise.
 */
export const plantY = CFG.bedHeight - 0.062;
export const rowX = (i: number) => (i - (CFG.rowCount - 1) / 2) * CFG.rowSpacing;
export const daikonZ = (i: number) => CFG.rowStartZ + i * CFG.daikonSpacing;
export const rowEndZ = daikonZ(CFG.daikonPerRow - 1);
