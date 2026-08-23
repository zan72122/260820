import { LetterSpec } from '../const';

// Capital A.
// Three separated bars at different depths; each endpoint is back-projected
// from the desired screen stroke, so the solved shadow is exact by
// construction. The letter floats above the screen's bottom edge — only the
// thin foot-pin shadows continue below it. Ray-aligned tie struts at the
// stroke crossings are derived automatically at build time.

export const letterA: LetterSpec = {
  letter: 'A',
  parts: [
    { kind: 'rod', a: [-0.44, 1.02], za: 2.06, b: [0.005, 1.87], zb: 2.42, strokeW: 0.085 },
    { kind: 'rod', a: [0.44, 1.02], za: 3.1, b: [-0.005, 1.87], zb: 2.78, strokeW: 0.085 },
    { kind: 'rod', a: [-0.285, 1.33], za: 2.26, b: [0.285, 1.33], zb: 2.34, strokeW: 0.08 },
  ],
  feet: [
    { part: 0, u: 0 },
    { part: 1, u: 0 },
  ],
  autoStruts: true,
  braces: [],
  lightY: 1.5,
  tableAngle0: -1.08,
  tableRange: [-1.22, 0.21],
  tableRadius: 0.78,
  detent: 0.075,
  hasLever: false,
  hintDelay: 7,
};
