import { LetterSpec } from '../const';

// Capital H — two controls, used in order.
// The two uprights sit near the table axis; the crossbar sits much deeper
// (close to the lamp), so moving the lamp height sweeps the crossbar's
// shadow far more than the uprights'. Stage 1: turn the table until the
// uprights stand parallel. Stage 2: the tall lever frees and the lamp
// height walks the crossbar into the middle.
// The crossbar hangs from two vertical columns whose shadows are vertical
// lines hidden exactly behind the uprights' strokes at every lamp height.

export const letterH: LetterSpec = {
  letter: 'H',
  parts: [
    { kind: 'rod', a: [-0.36, 0.94], za: 2.08, b: [-0.36, 1.86], zb: 2.2, strokeW: 0.085 },
    { kind: 'rod', a: [0.36, 0.94], za: 2.42, b: [0.36, 1.86], zb: 2.3, strokeW: 0.085 },
    { kind: 'rod', a: [-0.4, 1.4], za: 3.48, b: [0.4, 1.4], zb: 3.52, strokeW: 0.08 },
  ],
  feet: [
    { part: 0, u: 0 },
    { part: 1, u: 0 },
  ],
  struts: [],
  braces: [
    // crossbar support columns; shadows stay inside the upright strokes
    { a: [-0.36, 1.4], za: 3.485, b: [-0.36, -0.538], zb: 3.485, r: 0.0065 },
    { a: [0.36, 1.4], za: 3.515, b: [0.36, -0.538], zb: 3.515, r: 0.0065 },
  ],
  lightY: 1.42,
  lightY0: 1.66,
  leverRange: [1.3, 1.72],
  tableAngle0: -0.92,
  tableRange: [-1.08, 0.17],
  tableRadius: 0.95,
  detent: 0.075,
  hasLever: true,
};
