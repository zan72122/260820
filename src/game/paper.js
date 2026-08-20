/**
 * The paper of the poi — the only real "system" in this game.
 *
 * Everything here is pure maths with no three.js dependency so it can be unit
 * tested and so the exact same functions can be mirrored in GLSL (see
 * `src/scene/glsl/paper.glsl.js`). If you change a formula here, change it
 * there too — the CPU decides whether a fish is caught, the GPU decides what
 * the child sees, and the two must agree.
 *
 * Local paper space is the unit disc: (x, y) in [-1, 1], r = length(x, y).
 */

import { clamp, smoothstep } from '../core/Rng.js';

export const MAX_TEARS = 6;

export const PAPER = {
  /** seconds of continuous submersion to reach fully-soaked */
  soakSeconds: 13.0,
  /** wetness lost per second while held in the air (paper never fully recovers) */
  dryPerSecond: 0.016,
  /** damage from simply being wet */
  creep: 0.0125,
  /** damage from dragging the paper sideways through water (teaches "gently") */
  shear: 0.052,
  /** damage from the weight of a fish while the paper leaves the water */
  lift: 0.62,
  /** damage from a fish thrashing on wet paper */
  struggle: 0.115,
  /** how much a hole grows per unit of damage past its spawn point */
  tearGrowth: 0.62,
  /** paper is gone at damage >= 1 */
  maxDamage: 1,
};

/**
 * Where each hole opens and at what damage. Holes start in the middle and
 * work outwards, so a child with a half-wrecked poi can still scoop a fish
 * with the surviving rim — that grace is the whole point.
 */
export const TEAR_SCHEDULE = [
  { at: 0.3, radius: 0.06, spread: 0.1 },
  { at: 0.47, radius: 0.05, spread: 0.24 },
  { at: 0.62, radius: 0.05, spread: 0.36 },
  { at: 0.74, radius: 0.04, spread: 0.46 },
  { at: 0.85, radius: 0.04, spread: 0.56 },
  { at: 0.93, radius: 0.04, spread: 0.64 },
];

export function createPaperState() {
  return {
    wetness: 0,
    damage: 0,
    /** 0..1 growth of the first wet stain, so the first touch of water reads instantly */
    wetFront: 0,
    wetOriginX: 0,
    wetOriginY: 0,
    everWet: false,
    /** {x, y, radius, wobble} in unit-disc space */
    tears: [],
    destroyed: false,
    /** rises for a moment whenever the paper takes a real hit — drives the crackle sfx */
    stressPulse: 0,
  };
}

/**
 * Ragged hole outline. A perfect circle reads as a punched hole; two cheap
 * harmonics make it read as torn fibre. Mirrored verbatim in GLSL.
 */
export function tearWobble(angle, wobbleSeed) {
  return (
    1 +
    0.3 * Math.sin(angle * 5 + wobbleSeed * 6.2831853) +
    0.17 * Math.sin(angle * 9 - wobbleSeed * 11.0) +
    0.08 * Math.sin(angle * 17 + wobbleSeed * 3.7)
  );
}

/**
 * Signed "how deep inside a hole" value at a point, in unit-disc units.
 * > 0 means the paper is gone there. Also > 0 outside the disc itself.
 */
export function holeDepth(state, x, y) {
  let best = -1e3;
  const tears = state.tears;
  for (let i = 0; i < tears.length; i++) {
    const t = tears[i];
    const dx = x - t.x;
    const dy = y - t.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const a = Math.atan2(dy, dx);
    const edge = t.radius * tearWobble(a, t.wobble);
    const v = edge - d;
    if (v > best) best = v;
  }
  return best;
}

/** True when there is no paper at this point (hole, or beyond the rim). */
export function isTorn(state, x, y) {
  if (x * x + y * y > 1) return true;
  return holeDepth(state, x, y) > 0;
}

/**
 * Fraction of the disc that still holds paper. Sampled on a fixed polar grid
 * with area weighting, so it is deterministic and cheap enough to call once
 * per second for audio/visual cues.
 */
export function integrity(state, rings = 9, spokes = 24) {
  let intact = 0;
  let total = 0;
  for (let i = 0; i < rings; i++) {
    const r = (i + 0.5) / rings;
    const w = r; // polar area weight
    for (let j = 0; j < spokes; j++) {
      const a = (j / spokes) * Math.PI * 2;
      total += w;
      if (!isTorn(state, Math.cos(a) * r, Math.sin(a) * r)) intact += w;
    }
  }
  return total > 0 ? intact / total : 0;
}

/**
 * Rebuild the hole list from the current damage. Deterministic: the same
 * damage always yields the same holes, so a replay looks identical.
 */
export function syncTears(state, seedRng) {
  const tears = state.tears;
  for (let i = 0; i < TEAR_SCHEDULE.length; i++) {
    const s = TEAR_SCHEDULE[i];
    if (state.damage < s.at) break;
    if (!tears[i]) {
      // Place a new hole. Angle/offset come from the run's seeded rng so the
      // paper looks hand-torn rather than stamped.
      const a = seedRng ? seedRng.range(0, Math.PI * 2) : (i * 2.399) % (Math.PI * 2);
      const rr = seedRng ? seedRng.range(0.15, 1) * s.spread : s.spread * 0.6;
      tears[i] = {
        x: Math.cos(a) * rr,
        y: Math.sin(a) * rr,
        radius: 0,
        wobble: seedRng ? seedRng.next() : (i * 0.37) % 1,
        bornAt: s.at,
      };
    }
    const t = tears[i];
    const grown = (state.damage - s.at) / (1 - s.at + 1e-6);
    t.radius = clamp(s.radius + PAPER.tearGrowth * Math.pow(Math.max(grown, 0), 0.8), 0, 0.75);
  }
  return tears;
}

/**
 * Advance the paper one frame.
 *
 * @param {object} state          from createPaperState()
 * @param {number} dt             seconds
 * @param {object} ctx
 * @param {number} ctx.submerged  0..1 how much of the paper is under water
 * @param {number} ctx.planarSpeed  poi speed through the water, m/s
 * @param {number} ctx.liftSpeed  upward speed of the poi, m/s (0 when sinking)
 * @param {number} ctx.fishLoad   0..1 mass of whatever is riding on the paper
 * @param {number} ctx.struggling 0..1 how hard that fish is thrashing
 * @param {object} [rng]          seeded rng used when a new hole opens
 */
export function updatePaper(state, dt, ctx, rng) {
  if (state.destroyed) return state;
  const submerged = clamp(ctx.submerged ?? 0, 0, 1);

  if (submerged > 0.02) {
    state.wetness = clamp(state.wetness + (dt * submerged) / PAPER.soakSeconds, 0, 1);
    if (!state.everWet) {
      state.everWet = true;
      state.wetFront = 0;
    }
  } else {
    state.wetness = clamp(state.wetness - dt * PAPER.dryPerSecond, 0, 1);
  }
  if (state.everWet && state.wetFront < 1) {
    // The stain races across the sheet in ~0.55s: the child must see the
    // material change on the very first contact, not a second later.
    state.wetFront = clamp(state.wetFront + dt / 0.55, 0, 1);
  }

  const w = state.wetness;
  const load = clamp(ctx.fishLoad ?? 0, 0, 1.6);
  const shearTerm =
    PAPER.shear * Math.pow(w, 1.5) * submerged * smoothstep(0.18, 1.5, ctx.planarSpeed ?? 0);
  const liftTerm =
    PAPER.lift * Math.pow(w, 1.25) * load * smoothstep(0.05, 1.1, Math.max(ctx.liftSpeed ?? 0, 0));
  const struggleTerm = PAPER.struggle * load * Math.pow(w, 1.1) * clamp(ctx.struggling ?? 0, 0, 1);
  const creepTerm = PAPER.creep * w * w * submerged;

  const stress = creepTerm + shearTerm + liftTerm + struggleTerm;
  const before = state.damage;
  state.damage = clamp(state.damage + stress * dt, 0, PAPER.maxDamage);

  // A short pulse whenever the sheet is actively giving way, used for the
  // small fibre-crackle sound and the shader's stress darkening.
  state.stressPulse = Math.max(state.stressPulse - dt * 2.2, (state.damage - before) / Math.max(dt, 1e-4) / 0.35);
  state.stressPulse = clamp(state.stressPulse, 0, 1);

  syncTears(state, rng);
  if (state.damage >= PAPER.maxDamage) state.destroyed = true;
  return state;
}

/**
 * Vertical profile of the sagging sheet, in unit-disc units (multiply by the
 * paper radius to get metres). Mirrored in GLSL.
 *
 * @param {number} r      0..1 distance from the middle of the sheet
 * @param {number} sag    overall droop (wetness driven)
 * @param {number} load   weight riding on the sheet
 * @param {number} loadR  where that weight sits
 */
export function sagProfile(r, sag, load = 0, loadR = 0) {
  const base = -sag * (1 - r * r) * (0.55 + 0.45 * (1 - r));
  const d = (r - loadR) / 0.5;
  const dimple = -load * 0.55 * Math.exp(-d * d);
  return base + dimple;
}
