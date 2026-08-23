import { LetterSpec } from '../const';

// Capital Q.
// A thick ring facing the lamp plus a separated short rod; at the solved
// angle the rod's shadow docks onto the ring's shadow and becomes the tail.
// The ring stands on a single thin pin; the tail is tied to the ring by a
// ray-aligned strut at the rim crossing (derived at build time) and leans on
// an inclined brace inside the tail's own plane of light rays — its shadow
// prolongs the tail straight off the screen.

export const letterQ: LetterSpec = {
  letter: 'Q',
  parts: [
    { kind: 'ring', center: [0, 1.44], z: 2.45, radius: 0.41, strokeW: 0.095 },
    { kind: 'rod', a: [0.22, 1.18], za: 3.05, b: [0.5, 0.93], zb: 3.22, strokeW: 0.085 },
  ],
  feet: [
    { part: 0, u: 0, r: 0.007 },
  ],
  autoStruts: true,
  braces: [
    // tail end -> table, hidden in the tail's ray plane
    { a: [0.5, 0.93], za: 3.22, b: [1.859, -0.283], zb: 3.1, r: 0.009 },
  ],
  lightY: 1.5,
  tableAngle0: 0.75,
  tableRange: [-0.17, 0.87],
  tableRadius: 0.92,
  detent: 0.075,
  hasLever: false,
  hintDelay: 14,
};
