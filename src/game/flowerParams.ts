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
    baseFrac: 0.58,
    radiusOffset: 0.0026,
    rise: 0.0086,
    thick: 0.0019,
    lean: -0.0009,
    curl: 0.0017,
    correction: 0.74,
    minSpan: 2.4,
    maxSpan: 3.3,
  },
  {
    name: 'mid',
    target: 5,
    baseFrac: 0.32,
    radiusOffset: 0.0052,
    rise: 0.0104,
    thick: 0.0022,
    lean: 0.0023,
    curl: 0.0052,
    correction: 0.68,
    minSpan: 1.75,
    maxSpan: 2.7,
  },
  {
    name: 'outer',
    target: 7,
    baseFrac: 0.11,
    radiusOffset: 0.0092,
    rise: 0.0102,
    thick: 0.0025,
    lean: 0.0038,
    curl: 0.0074,
    correction: 0.62,
    minSpan: 1.4,
    maxSpan: 2.2,
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
