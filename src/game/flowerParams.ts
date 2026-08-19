/** Everything is in metres: the flower nail head is 50 mm across. */
export const NAIL_RADIUS = 0.025;
export const NAIL_PLATE_THICKNESS = 0.0012;

export const CONE = {
  /** Buttercream cone the petals are wrapped around. */
  baseRadius: 0.0092,
  targetHeight: 0.023,
  /** Piping past the sweet spot is allowed but quietly runs out of travel. */
  maxHeight: 0.028,
  growthPerSecond: 0.016,
};

/** Radius of the cone at a given height above the parchment. */
export function coneRadiusAt(h: number, height: number): number {
  if (height <= 1e-6) return 0;
  const t = Math.min(1, Math.max(0, h / height));
  return CONE.baseRadius * Math.pow(1 - t, 0.85);
}

export interface LayerDef {
  name: 'core' | 'mid' | 'outer';
  /** Petals that feel complete; play always allows finishing early. */
  target: number;
  /** Where the petal root sits, as a fraction of the cone height. */
  baseFrac: number;
  /** Extra radius outside the cone wall. */
  radiusOffset: number;
  rise: number;
  thick: number;
  /** Outward tilt at the root, then the extra opening at the top edge. */
  lean: number;
  curl: number;
  /** How strongly a wild finger path is pulled back onto the layer ring. */
  correction: number;
  minSpan: number;
  maxSpan: number;
}

export const LAYERS: LayerDef[] = [
  {
    name: 'core',
    target: 3,
    baseFrac: 0.6,
    radiusOffset: 0.0016,
    rise: 0.0105,
    thick: 0.0019,
    lean: -0.0006,
    curl: 0.0012,
    correction: 0.72,
    minSpan: 0.7,
    maxSpan: 2.0,
  },
  {
    name: 'mid',
    target: 5,
    baseFrac: 0.33,
    radiusOffset: 0.0046,
    rise: 0.0118,
    thick: 0.0022,
    lean: 0.0014,
    curl: 0.0034,
    correction: 0.66,
    minSpan: 0.8,
    maxSpan: 2.2,
  },
  {
    name: 'outer',
    target: 7,
    baseFrac: 0.12,
    radiusOffset: 0.0092,
    rise: 0.0112,
    thick: 0.0024,
    lean: 0.0032,
    curl: 0.0062,
    correction: 0.6,
    minSpan: 0.9,
    maxSpan: 2.4,
  },
];

/** Petal counts that already count as a finished flower. */
export const MIN_PETALS_FOR_FLOWER = 6;

export const CREAM_COLORS = [
  { name: 'strawberry', hex: 0xf6c3cb },
  { name: 'vanilla', hex: 0xfaeecd },
  { name: 'pistachio', hex: 0xd4e2b6 },
  { name: 'blueberry', hex: 0xcfd0ec },
  { name: 'apricot', hex: 0xf8d5ad },
] as const;
