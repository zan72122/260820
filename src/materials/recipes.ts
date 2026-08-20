import { clamp01, lerp, smoothstep } from '../util/math';
import { cellular, fbm, ridged, valueNoise } from '../util/rng';
import type { Recipe, Sample } from './texgen';

/**
 * Surface recipes.
 *
 * Colour is deliberately *not* the identifying channel: several floors sit in
 * the same muted earth/grey family, and the child tells them apart by how the
 * light behaves on them — the width of the highlight, the grain of the normal,
 * the depth of the cavity occlusion. Roughness is never constant across a
 * surface; every material carries hand grease, scuffs, damp patches or dust
 * where the pavilion is actually used.
 */

/** Distance from the tile centre, 0 at the middle and 1 at the panel rim. */
const radial = (u: number, v: number) => Math.hypot(u - 0.5, v - 0.5) * 2;

function setRgb(s: Sample, r: number, g: number, b: number) {
  s.r = clamp01(r);
  s.g = clamp01(g);
  s.b = clamp01(b);
}

/** Tint a sample towards a colour, used for stains and damp patches. */
function tint(s: Sample, r: number, g: number, b: number, t: number) {
  s.r = lerp(s.r, r, t);
  s.g = lerp(s.g, g, t);
  s.b = lerp(s.b, b, t);
}

// ---------------------------------------------------------------------------
// Floor materials
// ---------------------------------------------------------------------------

/** Thick industrial rubber mat: soft broad highlight, fine granular skin. */
export const rubberFloor: Recipe = {
  id: 'floor.rubber',
  size: 512,
  bump: 0.55,
  sample(u, v, s) {
    const grain = fbm(u * 96, v * 96, 96, 4, 11);
    const speckle = cellular(u * 70, v * 70, 70, 23);
    const fleck = smoothstep(0.42, 0.06, speckle.f1) * (speckle.id > 0.72 ? 1 : 0.12);
    const patch = fbm(u * 5, v * 5, 5, 3, 71);

    const base = 0.135 + grain * 0.035 + patch * 0.026;
    setRgb(s, base * 1.04, base * 1.0, base * 0.94);
    // Recycled rubber crumb shows as slightly lighter flecks.
    tint(s, 0.2, 0.19, 0.175, fleck * 0.55);

    // The centre of the mat has been struck thousands of times: the skin there
    // is burnished smoother and a little darker than the untouched rim.
    const wear = smoothstep(0.55, 0.06, radial(u, v));
    s.rough = 0.74 - wear * 0.2 + patch * 0.06 - fleck * 0.05;
    s.metal = 0;
    s.height = 0.5 + (grain - 0.5) * 0.7 + fleck * 0.25 - wear * 0.1;
    s.ao = 1 - fleck * 0.22 - (1 - grain) * 0.1;
  },
};

/** Dry sand: maximal roughness, cellular grain, deep cavity occlusion. */
export const sandFloor: Recipe = {
  id: 'floor.sand',
  size: 512,
  bump: 1.35,
  sample(u, v, s) {
    const grain = cellular(u * 150, v * 150, 150, 5);
    const coarse = fbm(u * 26, v * 26, 26, 4, 17);
    const ripple = fbm(u * 7 + coarse * 1.4, v * 7, 7, 3, 41);
    const g = clamp01(grain.f2 - grain.f1);

    const light = 0.62 + coarse * 0.12 + grain.id * 0.1 + ripple * 0.06;
    setRgb(s, light * 1.0, light * 0.93, light * 0.79);
    // A few darker mineral grains keep it from reading as flat beige.
    if (grain.id > 0.9) tint(s, 0.3, 0.26, 0.21, 0.6);

    s.rough = 0.95 + coarse * 0.04;
    s.metal = 0;
    s.height = 0.42 + g * 0.42 + ripple * 0.2;
    // Light gets trapped between grains — this is what makes sand read as sand.
    s.ao = clamp01(0.52 + g * 0.48) * (0.86 + ripple * 0.14);
  },
};

/** Wet clay: darker than sand, with a specular water film pooling in the low spots. */
export const clayFloor: Recipe = {
  id: 'floor.clay',
  size: 512,
  bump: 0.9,
  sample(u, v, s) {
    // A worked clay bed is smooth at the small scale and undulating at the
    // large one — the opposite of sand, and that difference is most of what
    // separates the two on screen.
    const body = fbm(u * 7, v * 7, 7, 4, 29);
    const fine = fbm(u * 26, v * 26, 26, 3, 31);
    const broad = fbm(u * 3, v * 3, 3, 3, 83);
    // Traces of the tool that last smoothed the bed.
    const tool = ridged(u * 6, v * 22, 22, 2, 61);
    const damp = clamp01(smoothstep(0.4, 0.7, broad * 0.7 + body * 0.3));

    const light = 0.24 + body * 0.09 + broad * 0.05 + fine * 0.02 - damp * 0.07;
    setRgb(s, light * 1.0, light * 0.86, light * 0.72);
    tint(s, 0.13, 0.11, 0.1, damp * 0.45);

    // The water film is the whole point: roughness collapses where it is wet.
    s.rough = lerp(0.72, 0.19, damp) - tool * 0.04 + fine * 0.06;
    s.metal = 0;
    s.height = 0.5 + (body - 0.5) * 0.62 + tool * 0.1 + (fine - 0.5) * 0.08 - damp * 0.06;
    s.ao = 0.86 + body * 0.14 - damp * 0.05;
  },
};

/** Planed wood board: ring grain, end-grain darkening, scuffed traffic line. */
export const woodFloor: Recipe = {
  id: 'floor.wood',
  size: 512,
  bump: 0.5,
  sample(u, v, s) {
    // Stretch the noise along the board so growth rings run lengthwise.
    const warp = fbm(u * 3, v * 12, 12, 3, 97) * 0.9;
    const rings = Math.abs(((v * 13 + warp) % 1) * 2 - 1);
    const ring = Math.pow(rings, 0.55);
    const fibre = fbm(u * 10, v * 190, 190, 3, 131);
    const knotD = Math.hypot(u - 0.74, v - 0.28);
    const knot = smoothstep(0.13, 0.02, knotD);

    const light = 0.34 + ring * 0.2 + fibre * 0.07;
    setRgb(s, light * 1.0, light * 0.79, light * 0.55);
    tint(s, 0.16, 0.1, 0.06, knot * 0.8);

    // A dry board plus a slightly damp end: same wood, two roughnesses.
    const dampEnd = smoothstep(0.72, 1.0, v) * 0.35;
    const scuff = smoothstep(0.45, 0.1, radial(u, v)) * 0.3;
    s.rough = 0.62 - ring * 0.1 - dampEnd + scuff * 0.12 + knot * 0.1;
    s.metal = 0;
    s.height = 0.5 + (0.5 - ring) * 0.35 + fibre * 0.16 - knot * 0.35;
    s.ao = 1 - knot * 0.45 - (1 - ring) * 0.12;
  },
};

/** Polished steel plate: true metalness, fine directional scratches, worn edges. */
export const metalFloor: Recipe = {
  id: 'floor.metal',
  size: 512,
  bump: 0.32,
  sample(u, v, s) {
    // Fine lapping marks running in one direction give a spun/polished look.
    const lap = ridged(u * 260, v * 6, 260, 2, 149);
    const scratch = ridged(u * 40 + v * 3, v * 420, 420, 2, 151);
    const haze = fbm(u * 12, v * 12, 12, 4, 157);
    const r = radial(u, v);
    const rimWear = smoothstep(0.78, 1.0, r);

    const light = 0.66 + haze * 0.05 + lap * 0.03;
    setRgb(s, light, light * 0.995, light * 0.985);

    s.metal = 1 - rimWear * 0.06;
    // Polished in the middle where it is wiped, duller at the handled rim.
    s.rough = clamp01(0.17 + haze * 0.1 + scratch * 0.22 + rimWear * 0.24 + lap * 0.05);
    s.height = 0.5 + (lap - 0.5) * 0.1 + scratch * 0.22 - rimWear * 0.1;
    s.ao = 1 - scratch * 0.12 - rimWear * 0.1;
  },
};

/** Dense felt pad: fibre normal, strong diffuse, sheen instead of a specular dot. */
export const feltFloor: Recipe = {
  id: 'floor.felt',
  size: 512,
  bump: 1.0,
  sample(u, v, s) {
    // Two crossed fibre directions, matted rather than woven.
    const f1 = ridged(u * 200 + v * 24, v * 26, 200, 2, 181);
    const f2 = ridged(u * 24, v * 200 - u * 30, 200, 2, 191);
    const mat = fbm(u * 30, v * 30, 30, 4, 199);
    const fibre = Math.max(f1, f2 * 0.85);
    const press = smoothstep(0.6, 0.05, radial(u, v));

    const light = 0.32 + mat * 0.1 + fibre * 0.08;
    setRgb(s, light * 0.94, light * 0.95, light * 0.9);

    s.rough = 0.97 - fibre * 0.05;
    s.metal = 0;
    // Compressed in the middle from repeated tests: flatter fibres there.
    s.height = 0.45 + fibre * 0.5 * (1 - press * 0.5) + mat * 0.16;
    s.ao = clamp01(0.6 + fibre * 0.4) - press * 0.06;
  },
};

/** The silted pan under the shallow water tray — seen *through* the water. */
export const waterBedFloor: Recipe = {
  id: 'floor.waterbed',
  size: 512,
  bump: 0.7,
  sample(u, v, s) {
    const silt = fbm(u * 34, v * 34, 34, 5, 211);
    const grit = cellular(u * 90, v * 90, 90, 223);
    const drift = fbm(u * 6, v * 6, 6, 3, 227);
    const g = clamp01(grit.f2 - grit.f1);

    const light = 0.2 + silt * 0.1 + drift * 0.06;
    setRgb(s, light * 0.92, light * 0.95, light * 0.9);

    // Permanently submerged, so uniformly low roughness under the surface.
    s.rough = 0.42 + silt * 0.16;
    s.metal = 0;
    s.height = 0.45 + g * 0.3 + silt * 0.3;
    s.ao = clamp01(0.62 + g * 0.38);
  },
};

// ---------------------------------------------------------------------------
// Ball materials
// ---------------------------------------------------------------------------

export const rubberBall: Recipe = {
  id: 'ball.rubber',
  size: 256,
  bump: 0.5,
  sample(u, v, s) {
    const pebble = cellular(u * 46, v * 46, 46, 307);
    const dust = fbm(u * 18, v * 18, 18, 4, 311);
    const p = clamp01(pebble.f2 - pebble.f1);
    // The mould parting line runs round the equator.
    const seam = smoothstep(0.012, 0.0, Math.abs(v - 0.5));

    const light = 0.26 + dust * 0.07 + pebble.id * 0.04;
    setRgb(s, light * 1.05, light * 0.99, light * 0.93);

    s.rough = 0.66 + dust * 0.1 - p * 0.06 + seam * 0.06;
    s.metal = 0;
    s.height = 0.5 + p * 0.3 + dust * 0.14 + seam * 0.18;
    s.ao = clamp01(0.72 + p * 0.28) - seam * 0.1;
  },
};

export const woodBall: Recipe = {
  id: 'ball.wood',
  size: 256,
  bump: 0.4,
  sample(u, v, s) {
    // Turned on a lathe: rings run around the sphere's latitude.
    const warp = fbm(u * 4, v * 6, 6, 3, 331) * 0.5;
    const rings = Math.abs((((u * 9 + warp) % 1) * 2 - 1));
    const ring = Math.pow(rings, 0.6);
    const fibre = fbm(u * 160, v * 12, 160, 3, 337);
    const ding = cellular(u * 12, v * 12, 12, 347);
    const dent = smoothstep(0.1, 0.0, ding.f1) * (ding.id > 0.86 ? 1 : 0);

    const light = 0.4 + ring * 0.2 + fibre * 0.05;
    setRgb(s, light * 1.0, light * 0.78, light * 0.52);

    // Waxed, so a moderate even sheen with the grain showing through.
    s.rough = 0.44 - ring * 0.07 + dent * 0.25;
    s.metal = 0;
    s.height = 0.5 + (0.5 - ring) * 0.28 + fibre * 0.12 - dent * 0.5;
    s.ao = 1 - dent * 0.5 - (1 - ring) * 0.1;
  },
};

export const hollowMetalBall: Recipe = {
  id: 'ball.hollowmetal',
  size: 256,
  bump: 0.45,
  sample(u, v, s) {
    // Spun from thin sheet: concentric tool marks plus a brazed equator seam.
    const spin = ridged(u * 6, v * 150, 150, 2, 353);
    const brush = ridged(u * 300, v * 8, 300, 2, 359);
    const dent = fbm(u * 9, v * 9, 9, 3, 367);
    const seam = smoothstep(0.016, 0.0, Math.abs(v - 0.5));
    const tarnish = fbm(u * 5, v * 5, 5, 3, 373);

    const light = 0.6 + dent * 0.06 + brush * 0.04;
    setRgb(s, light * 0.98, light * 0.99, light * 1.0);
    tint(s, 0.42, 0.4, 0.36, tarnish * 0.35);

    s.metal = 1 - tarnish * 0.1;
    s.rough = 0.3 + spin * 0.18 + tarnish * 0.22 + seam * 0.2;
    s.height = 0.5 + (dent - 0.5) * 0.5 + spin * 0.14 - seam * 0.4;
    s.ao = 1 - seam * 0.35 - (1 - dent) * 0.12;
  },
};

export const solidMetalBall: Recipe = {
  id: 'ball.solidmetal',
  size: 256,
  bump: 0.22,
  sample(u, v, s) {
    const micro = ridged(u * 400, v * 400, 400, 2, 379);
    const haze = fbm(u * 20, v * 20, 20, 4, 383);
    const nick = cellular(u * 16, v * 16, 16, 389);
    const chip = smoothstep(0.07, 0.0, nick.f1) * (nick.id > 0.9 ? 1 : 0);

    const light = 0.74 + haze * 0.03;
    setRgb(s, light, light * 0.995, light * 0.98);

    s.metal = 1;
    // A near-mirror ball: the environment does the describing, not the texture.
    s.rough = clamp01(0.1 + micro * 0.1 + haze * 0.06 + chip * 0.5);
    s.height = 0.5 + micro * 0.1 - chip * 0.5;
    s.ao = 1 - chip * 0.45;
  },
};

export const foamBall: Recipe = {
  id: 'ball.foam',
  size: 256,
  bump: 1.15,
  sample(u, v, s) {
    // Open-cell foam: the pores are the identifying feature.
    const pores = cellular(u * 52, v * 52, 52, 401);
    const fine = cellular(u * 120, v * 120, 120, 409);
    const skin = fbm(u * 22, v * 22, 22, 4, 419);
    const p = clamp01(pores.f2 - pores.f1);
    const f = clamp01(fine.f2 - fine.f1);
    const open = smoothstep(0.3, 0.02, pores.f1) * (pores.id > 0.55 ? 1 : 0.25);

    const light = 0.52 + skin * 0.12 + p * 0.08;
    setRgb(s, light * 1.0, light * 0.96, light * 0.89);

    s.rough = 0.94 + skin * 0.05;
    s.metal = 0;
    s.height = 0.4 + p * 0.35 + f * 0.2 - open * 0.35;
    s.ao = clamp01(0.45 + p * 0.4 + f * 0.15) * (1 - open * 0.35);
  },
};

export const waterBall: Recipe = {
  id: 'ball.water',
  size: 256,
  bump: 0.3,
  sample(u, v, s) {
    // A soft skin holding water: slack folds plus a clinging surface film.
    const fold = fbm(u * 8, v * 8, 8, 4, 431);
    const film = fbm(u * 40, v * 40, 40, 3, 433);
    const bead = cellular(u * 34, v * 34, 34, 439);
    const drop = smoothstep(0.22, 0.05, bead.f1) * (bead.id > 0.6 ? 1 : 0.2);

    const light = 0.66 + fold * 0.1;
    setRgb(s, light * 0.9, light * 0.95, light * 0.96);

    s.metal = 0;
    // Wet everywhere, wettest where the droplets bead up.
    s.rough = clamp01(0.24 - drop * 0.16 + film * 0.1);
    s.height = 0.5 + (fold - 0.5) * 0.4 + drop * 0.4 + film * 0.08;
    s.ao = 1 - (1 - fold) * 0.16;
  },
};

// ---------------------------------------------------------------------------
// Pavilion structure
// ---------------------------------------------------------------------------

/** Poured concrete apron: trowel swirl, dust, damp shadow at the edges. */
export const concrete: Recipe = {
  id: 'struct.concrete',
  size: 512,
  bump: 0.55,
  sample(u, v, s) {
    const body = fbm(u * 22, v * 22, 22, 5, 503);
    const agg = cellular(u * 64, v * 64, 64, 509);
    const swirl = ridged(u * 8 + body * 2, v * 8, 8, 2, 521);
    const stain = fbm(u * 3.5, v * 3.5, 3.5, 3, 523);
    const pit = smoothstep(0.1, 0.02, agg.f1) * (agg.id > 0.88 ? 1 : 0);

    const light = 0.42 + body * 0.12 + agg.id * 0.05 - stain * 0.1;
    setRgb(s, light * 1.0, light * 0.985, light * 0.95);
    // Dust and dragged-out sand collect in patches.
    tint(s, 0.58, 0.53, 0.43, clamp01(stain - 0.45) * 0.7);

    s.rough = 0.85 + body * 0.1 - stain * 0.12 + pit * 0.1;
    s.metal = 0;
    s.height = 0.5 + (body - 0.5) * 0.4 + swirl * 0.1 - pit * 0.6;
    s.ao = 1 - pit * 0.6 - (1 - body) * 0.15;
  },
};

/** Machine-grey enamel over steel, chipped down to primer on the corners. */
export const paintedSteel: Recipe = {
  id: 'struct.paint',
  size: 256,
  bump: 0.35,
  sample(u, v, s) {
    const orange = fbm(u * 55, v * 55, 55, 3, 541);
    const chipN = cellular(u * 20, v * 20, 20, 547);
    const chip = smoothstep(0.12, 0.03, chipN.f1) * (chipN.id > 0.84 ? 1 : 0);
    const grime = fbm(u * 6, v * 6, 6, 4, 557);

    const light = 0.36 + orange * 0.03 - grime * 0.05;
    setRgb(s, light * 0.95, light * 0.98, light * 0.96);
    // Chipped through to red-brown primer.
    tint(s, 0.24, 0.13, 0.09, chip * 0.85);

    s.metal = chip * 0.35;
    // Enamel "orange peel" plus greasy handling marks.
    s.rough = 0.42 + orange * 0.12 + grime * 0.18 + chip * 0.3;
    s.height = 0.5 + orange * 0.1 - chip * 0.5;
    s.ao = 1 - chip * 0.4;
  },
};

/** Bare hot-dip galvanised steel: spangle pattern, dull metal, oxide bloom. */
export const galvanised: Recipe = {
  id: 'struct.galv',
  size: 256,
  bump: 0.4,
  sample(u, v, s) {
    const spangle = cellular(u * 15, v * 15, 15, 563);
    const grain = fbm(u * 80, v * 80, 80, 3, 569);
    const oxide = fbm(u * 5, v * 5, 5, 4, 571);
    const facet = spangle.id;

    const light = 0.52 + facet * 0.12 + grain * 0.05 - oxide * 0.08;
    setRgb(s, light * 0.98, light * 0.99, light * 1.0);

    s.metal = 0.92 - oxide * 0.25;
    // Each spangle facet catches the light at its own roughness.
    s.rough = clamp01(0.34 + facet * 0.24 + oxide * 0.25 + grain * 0.08);
    s.height = 0.5 + (spangle.f2 - spangle.f1) * 0.18 + grain * 0.1;
    s.ao = 1 - (1 - clamp01(spangle.f2 - spangle.f1)) * 0.18;
  },
};

/** Extruded rubber cable jacket with moulded ribs and handling shine. */
export const cableRubber: Recipe = {
  id: 'struct.cable',
  size: 128,
  bump: 0.6,
  sample(u, v, s) {
    const rib = Math.abs(((v * 26) % 1) * 2 - 1);
    const skin = fbm(u * 40, v * 40, 40, 3, 577);
    const shine = fbm(u * 4, v * 4, 4, 3, 587);

    const light = 0.075 + skin * 0.03;
    setRgb(s, light, light * 0.99, light * 1.0);

    s.metal = 0;
    s.rough = 0.6 + rib * 0.14 - shine * 0.18;
    s.height = 0.4 + rib * 0.5 + skin * 0.1;
    s.ao = clamp01(0.68 + rib * 0.32);
  },
};

/** Scuffed anodised aluminium for handles and trim. */
export const anodised: Recipe = {
  id: 'struct.anodised',
  size: 256,
  bump: 0.3,
  sample(u, v, s) {
    const brush = ridged(u * 340, v * 5, 340, 2, 593);
    const wear = fbm(u * 7, v * 7, 7, 4, 599);
    const grease = fbm(u * 3, v * 3, 3, 3, 601);

    const light = 0.5 + brush * 0.06 + wear * 0.04;
    setRgb(s, light * 0.99, light, light * 1.01);

    s.metal = 0.95;
    // Where hands land, the anodising is polished and greasy.
    s.rough = clamp01(0.34 + brush * 0.18 + wear * 0.12 - grease * 0.22);
    s.height = 0.5 + brush * 0.12 + wear * 0.08;
    s.ao = 1 - (1 - wear) * 0.1;
  },
};

/** Grip rubber for the release ring, dark and heavily hand-polished. */
export const gripRubber: Recipe = {
  id: 'struct.grip',
  size: 256,
  bump: 0.8,
  sample(u, v, s) {
    // Moulded diamond knurl.
    const kx = Math.abs((((u * 34 + v * 34) % 1) * 2 - 1));
    const ky = Math.abs((((u * 34 - v * 34) % 1) * 2 - 1));
    const knurl = Math.min(kx, ky);
    const skin = fbm(u * 60, v * 60, 60, 3, 607);
    // Decades of small hands have polished the top of the ring.
    const palm = smoothstep(0.55, 0.98, fbm(u * 3, v * 3, 3, 3, 613));

    const light = 0.09 + skin * 0.03 + palm * 0.02;
    setRgb(s, light * 1.05, light * 1.0, light * 0.95);

    s.metal = 0;
    s.rough = 0.72 - palm * 0.34 - knurl * 0.06 + skin * 0.06;
    s.height = 0.35 + knurl * 0.55 + skin * 0.1 - palm * 0.08;
    s.ao = clamp01(0.6 + knurl * 0.4);
  },
};

/** Weathered timber for the pavilion posts and the ball shelf. */
export const timber: Recipe = {
  id: 'struct.timber',
  size: 256,
  bump: 0.7,
  sample(u, v, s) {
    const warp = fbm(u * 3, v * 8, 8, 3, 617) * 0.8;
    const rings = Math.abs((((v * 7 + warp) % 1) * 2 - 1));
    const ring = Math.pow(rings, 0.5);
    const check = ridged(u * 6, v * 90, 90, 2, 619);
    const grey = fbm(u * 4, v * 4, 4, 3, 631);

    const light = 0.28 + ring * 0.14 + grey * 0.06;
    // Sun-greyed on the outside, warmer in the splits.
    setRgb(s, light * 0.98, light * 0.92, light * 0.8);
    tint(s, 0.3, 0.28, 0.26, grey * 0.5);

    s.metal = 0;
    s.rough = 0.8 - ring * 0.08 + check * 0.12;
    s.height = 0.5 + (0.5 - ring) * 0.3 - check * 0.4;
    s.ao = 1 - check * 0.45 - (1 - ring) * 0.12;
  },
};

/** Compacted dirt and fine gravel outside the pavilion slab. */
export const ground: Recipe = {
  id: 'struct.ground',
  size: 512,
  bump: 1.1,
  sample(u, v, s) {
    const stones = cellular(u * 80, v * 80, 80, 641);
    const dirt = fbm(u * 30, v * 30, 30, 5, 643);
    const broad = fbm(u * 5, v * 5, 5, 3, 647);
    const st = clamp01(stones.f2 - stones.f1);

    const light = 0.26 + dirt * 0.12 + broad * 0.08 + stones.id * 0.08;
    setRgb(s, light * 1.0, light * 0.9, light * 0.75);

    s.metal = 0;
    s.rough = 0.93 + dirt * 0.06;
    s.height = 0.4 + st * 0.4 + dirt * 0.25;
    s.ao = clamp01(0.5 + st * 0.5) * (0.9 + broad * 0.1);
  },
};

/** Ribbed translucent roof sheeting, seen from below. */
export const roofSheet: Recipe = {
  id: 'struct.roof',
  size: 256,
  bump: 0.5,
  sample(u, v, s) {
    const rib = Math.abs(((u * 14) % 1) * 2 - 1);
    const dirtN = fbm(u * 9, v * 9, 9, 4, 653);
    const streak = ridged(u * 30, v * 4, 30, 2, 659);

    const light = 0.62 - dirtN * 0.16 - streak * 0.06;
    setRgb(s, light * 0.97, light * 0.98, light * 0.94);

    s.metal = 0;
    s.rough = 0.55 + dirtN * 0.3;
    s.height = 0.4 + Math.pow(rib, 0.7) * 0.55;
    s.ao = clamp01(0.7 + rib * 0.3) - dirtN * 0.1;
  },
};

/** Perforated mesh look for the safety screen, faked with AO and roughness. */
export const meshPanel: Recipe = {
  id: 'struct.mesh',
  size: 256,
  bump: 0.9,
  sample(u, v, s) {
    const gx = Math.abs(((u * 16) % 1) * 2 - 1);
    const gy = Math.abs(((v * 16) % 1) * 2 - 1);
    const wire = Math.max(smoothstep(0.55, 0.95, gx), smoothstep(0.55, 0.95, gy));
    const grime = valueNoise(u * 12, v * 12, 12, 661);

    const light = 0.3 + wire * 0.18 - grime * 0.05;
    setRgb(s, light * 0.97, light * 0.98, light);

    s.metal = 0.85 * wire;
    s.rough = 0.48 + grime * 0.2 + (1 - wire) * 0.3;
    s.height = 0.3 + wire * 0.6;
    s.ao = clamp01(0.35 + wire * 0.65);
  },
};
