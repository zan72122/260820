/** Every dimension in metres. One place, so the port, plate and light agree. */
export const DIM = {
  innerR: 0.95,
  wall: 0.02,
  /** kept shell arc: leaves an open wedge facing the camera side (+X) */
  thetaStart: -0.30,
  thetaLength: 4.95,
  /** test port sits on the far-top quadrant so the light falls across the bed */
  portTheta: 0.42,
  portS: 6.0,
  windowHalf: 0.38,
  neckWall: 0.05,
  neckTop: 0.15,
  flangeHalf: 0.56,
  flangeThick: 0.03,
  flangeBore: 0.545,
  collarOuter: 0.76,
  collarThick: 0.055,
  pocketHalf: 0.505,
  plateHalf: 0.49,
  plateThick: 0.018,
  plateCorner: 0.06,
  plateHoleR: 0.024,
  plateHoleAt: 0.4,
  /** water film sits on the bed, a few millimetres proud of the gelcoat */
  filmDepth: 0.012,
  bedHalfAngle: 1.0,
  raftRadius: 0.62,
} as const;

export const FLUME_POINTS: Array<[number, number, number]> = [
  [-1.35, 3.62, -10.5],
  [-0.95, 3.34, -7.2],
  [-0.45, 3.02, -3.6],
  [0.12, 2.68, 0.2],
  [0.55, 2.34, 4.0],
  [0.66, 2.02, 7.6],
  [0.42, 1.78, 10.6],
  [0.02, 1.66, 13.0],
];
