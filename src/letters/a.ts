import { LetterSpec } from '../const';

// Capital A.
// Three separated bars at different depths; each endpoint is back-projected
// from the desired screen stroke, so the solved shadow is exact by construction.
// Supports: foot columns at the two lower stroke ends (their shadows drop off
// the bottom edge of the screen) and ray-aligned struts at the stroke
// crossings (their shadows collapse to points inside the strokes).

export const letterA: LetterSpec = {
  letter: 'A',
  parts: [
    { kind: 'rod', a: [-0.44, 0.94], za: 2.06, b: [0.015, 1.9], zb: 2.42, strokeW: 0.085 },
    { kind: 'rod', a: [0.44, 0.94], za: 3.1, b: [-0.015, 1.9], zb: 2.78, strokeW: 0.085 },
    { kind: 'rod', a: [-0.3, 1.28], za: 2.26, b: [0.3, 1.28], zb: 2.34, strokeW: 0.08 },
  ],
  feet: [
    { part: 0, u: 0 },
    { part: 1, u: 0 },
  ],
  struts: [
    { screen: [0, 1.855], z1: 2.42, z2: 2.78 },
    { screen: [-0.279, 1.28], z1: 2.187, z2: 2.263 },
    { screen: [0.279, 1.28], z1: 2.337, z2: 2.987 },
  ],
  braces: [],
  lightY: 1.5,
  tableAngle0: -1.08,
  tableRange: [-1.22, 0.21],
  tableRadius: 0.78,
  detent: 0.075,
  hasLever: false,
};
