// The whole point of a senko-hanabi is that it is not one effect. It is a
// sequence of four temperaments in one small object. Traditionally they are
// called tsubomi (bud), botan (peony), matsuba (pine needle), yanagi (willow)
// and chirigiku (scattering chrysanthemum) -- names a four-year-old will never
// be shown, but which describe exactly what has to be built.
//
// Keyframes are in normalised burn time (0..1) so the same curve can be
// stretched over a generous first sparkler or a shorter later one.

const K = (t, p) => ({ t, ...p });

export const PHASE_NAMES = ['tsubomi', 'botan', 'matsuba', 'yanagi', 'chirigiku', 'sizumari'];

// Which temperament dominates at a given normalised time -- used for audio
// voicing and for the camera, never shown to the player.
export function phaseNameAt(t) {
  if (t < 0.1) return 'tsubomi';
  if (t < 0.3) return 'botan';
  if (t < 0.66) return 'matsuba';
  if (t < 0.86) return 'yanagi';
  if (t < 0.97) return 'chirigiku';
  return 'sizumari';
}

const KEYS = [
  // --- tsubomi: the bud. A bead of molten slag gathers. Almost nothing else.
  K(0.0, {
    emberRadius: 0.00115,
    emberTemp: 0.50,
    emberPower: 0.014,
    emberWobble: 0.22,
    rate: 0.0,
    speed: 0.16,
    speedVar: 0.4,
    life: 0.3,
    lifeVar: 0.3,
    drag: 4.2,
    gravity: 0.16,
    size: 0.00042,
    branchDelay: 0.3,
    branchCount: 0,
    branchSpread: 0.3,
    branchKeep: 0.6,
    maxDepth: 0,
    upBias: 0.1,
    hiss: 0.16,
    crackle: 0.0,
    sizzle: 0.0,
  }),
  K(0.06, {
    emberRadius: 0.0019,
    emberTemp: 0.56,
    emberPower: 0.026,
    emberWobble: 0.3,
    rate: 0.5,
    speed: 0.23,
    speedVar: 0.45,
    life: 0.33,
    lifeVar: 0.3,
    drag: 4.0,
    gravity: 0.18,
    size: 0.00055,
    branchDelay: 0.26,
    branchCount: 0,
    branchSpread: 0.3,
    branchKeep: 0.6,
    maxDepth: 0,
    upBias: 0.12,
    hiss: 0.3,
    crackle: 0.5,
    sizzle: 0.0,
  }),
  // --- botan: the peony. Single, deliberate sparks, thrown hard.
  K(0.15, {
    emberRadius: 0.0026,
    emberTemp: 0.6,
    emberPower: 0.045,
    emberWobble: 0.36,
    rate: 4.0,
    speed: 0.27,
    speedVar: 0.5,
    life: 0.38,
    lifeVar: 0.32,
    drag: 3.8,
    gravity: 0.2,
    size: 0.00062,
    branchDelay: 0.2,
    branchCount: 2,
    branchSpread: 0.34,
    branchKeep: 0.66,
    maxDepth: 1,
    upBias: 0.16,
    hiss: 0.42,
    crackle: 4.0,
    sizzle: 0.05,
  }),
  K(0.28, {
    emberRadius: 0.0034,
    emberTemp: 0.7,
    emberPower: 0.08,
    emberWobble: 0.4,
    rate: 26.0,
    speed: 0.28,
    speedVar: 0.48,
    life: 0.4,
    lifeVar: 0.3,
    drag: 3.6,
    gravity: 0.21,
    size: 0.00058,
    branchDelay: 0.17,
    branchCount: 2,
    branchSpread: 0.42,
    branchKeep: 0.7,
    maxDepth: 2,
    upBias: 0.14,
    hiss: 0.55,
    crackle: 16.0,
    sizzle: 0.18,
  }),
  // --- matsuba: pine needles. The one moment that is genuinely spectacular.
  K(0.42, {
    emberRadius: 0.0041,
    emberTemp: 0.82,
    emberPower: 0.14,
    emberWobble: 0.44,
    rate: 145.0,
    speed: 0.28,
    speedVar: 0.42,
    life: 0.44,
    lifeVar: 0.28,
    drag: 3.5,
    gravity: 0.2,
    size: 0.00052,
    branchDelay: 0.14,
    branchCount: 3,
    branchSpread: 0.52,
    branchKeep: 0.74,
    maxDepth: 3,
    upBias: 0.1,
    hiss: 0.7,
    crackle: 70.0,
    sizzle: 0.5,
  }),
  K(0.55, {
    emberRadius: 0.0044,
    emberTemp: 0.88,
    emberPower: 0.175,
    emberWobble: 0.46,
    rate: 255.0,
    speed: 0.29,
    speedVar: 0.4,
    life: 0.46,
    lifeVar: 0.27,
    drag: 3.4,
    gravity: 0.2,
    size: 0.0005,
    branchDelay: 0.13,
    branchCount: 3,
    branchSpread: 0.56,
    branchKeep: 0.76,
    maxDepth: 3,
    upBias: 0.08,
    hiss: 0.78,
    crackle: 110.0,
    sizzle: 0.72,
  }),
  K(0.66, {
    emberRadius: 0.0042,
    emberTemp: 0.84,
    emberPower: 0.155,
    emberWobble: 0.44,
    rate: 170.0,
    speed: 0.26,
    speedVar: 0.4,
    life: 0.48,
    lifeVar: 0.28,
    drag: 3.5,
    gravity: 0.34,
    size: 0.00046,
    branchDelay: 0.16,
    branchCount: 2,
    branchSpread: 0.44,
    branchKeep: 0.68,
    maxDepth: 2,
    upBias: -0.02,
    hiss: 0.7,
    crackle: 72.0,
    sizzle: 0.66,
  }),
  // --- yanagi: the willow. Thin, soft, hanging downward. The retreat begins.
  K(0.78, {
    emberRadius: 0.0037,
    emberTemp: 0.72,
    emberPower: 0.105,
    emberWobble: 0.38,
    rate: 96.0,
    speed: 0.2,
    speedVar: 0.38,
    life: 0.6,
    lifeVar: 0.3,
    drag: 3.8,
    gravity: 0.72,
    size: 0.00036,
    branchDelay: 0.22,
    branchCount: 2,
    branchSpread: 0.26,
    branchKeep: 0.52,
    maxDepth: 1,
    upBias: -0.16,
    hiss: 0.5,
    crackle: 22.0,
    sizzle: 0.55,
  }),
  K(0.88, {
    emberRadius: 0.0032,
    emberTemp: 0.62,
    emberPower: 0.07,
    emberWobble: 0.34,
    rate: 34.0,
    speed: 0.16,
    speedVar: 0.36,
    life: 0.64,
    lifeVar: 0.3,
    drag: 4.0,
    gravity: 0.92,
    size: 0.00031,
    branchDelay: 0.26,
    branchCount: 1,
    branchSpread: 0.2,
    branchKeep: 0.5,
    maxDepth: 1,
    upBias: -0.30,
    hiss: 0.34,
    crackle: 7.0,
    sizzle: 0.34,
  }),
  // --- chirigiku: a few last flakes, and the bead is the subject again.
  K(0.95, {
    emberRadius: 0.0028,
    emberTemp: 0.5,
    emberPower: 0.042,
    emberWobble: 0.28,
    rate: 7.0,
    speed: 0.13,
    speedVar: 0.4,
    life: 0.58,
    lifeVar: 0.3,
    drag: 4.3,
    gravity: 1.02,
    size: 0.00028,
    branchDelay: 0.4,
    branchCount: 0,
    branchSpread: 0.18,
    branchKeep: 0.5,
    maxDepth: 0,
    upBias: -0.42,
    hiss: 0.2,
    crackle: 1.6,
    sizzle: 0.12,
  }),
  // --- sizumari: the quiet. Nothing but a dimming bead, breathing.
  K(1.0, {
    emberRadius: 0.0025,
    emberTemp: 0.4,
    emberPower: 0.026,
    emberWobble: 0.2,
    rate: 0.35,
    speed: 0.1,
    speedVar: 0.4,
    life: 0.5,
    lifeVar: 0.3,
    drag: 4.5,
    gravity: 1.05,
    size: 0.00026,
    branchDelay: 0.5,
    branchCount: 0,
    branchSpread: 0.15,
    branchKeep: 0.5,
    maxDepth: 0,
    upBias: -0.46,
    hiss: 0.1,
    crackle: 0.3,
    sizzle: 0.0,
  }),
];

const FIELDS = Object.keys(KEYS[0]).filter((k) => k !== 't');

// Reused output object: this is sampled every frame.
const OUT = {};
for (const f of FIELDS) OUT[f] = 0;

export function sampleTimeline(t, out = OUT) {
  const x = Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].t < x) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const span = b.t - a.t;
  let k = span > 1e-6 ? (x - a.t) / span : 0;
  k = Math.min(1, Math.max(0, k));
  // Smoothstep between keys: the character must change without ever popping.
  const s = k * k * (3 - 2 * k);
  for (const f of FIELDS) out[f] = a[f] + (b[f] - a[f]) * s;
  return out;
}

export { FIELDS as TIMELINE_FIELDS, KEYS as TIMELINE_KEYS };
