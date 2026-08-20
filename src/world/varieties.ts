import { Color } from 'three';
import type { Rand } from '../core/Rand';

export interface Variety {
  id: string;
  /** Crystal colour. Also the colour that bleeds through the seam while washing,
   *  so the wash step is a genuine preview of the reward. */
  hue: Color;
  /** Outer rock tint — geodes from different beds do not look alike outside. */
  stone: Color;
  clarity: number;
  iridescent: boolean;
  crystalCount: number;
  crystalScale: number;
  weight: number;
}

export const VARIETIES: readonly Variety[] = [
  { id: 'amethyst',  hue: new Color(0.62, 0.34, 0.92), stone: new Color(1.00, 0.96, 0.90), clarity: 0.80, iridescent: false, crystalCount: 150, crystalScale: 0.115, weight: 26 },
  { id: 'celestite', hue: new Color(0.44, 0.68, 0.98), stone: new Color(0.96, 0.97, 1.00), clarity: 0.88, iridescent: false, crystalCount: 165, crystalScale: 0.105, weight: 20 },
  { id: 'citrine',   hue: new Color(0.98, 0.72, 0.32), stone: new Color(1.02, 0.94, 0.82), clarity: 0.76, iridescent: false, crystalCount: 140, crystalScale: 0.120, weight: 16 },
  { id: 'rose',      hue: new Color(0.98, 0.56, 0.68), stone: new Color(1.00, 0.93, 0.92), clarity: 0.60, iridescent: false, crystalCount: 120, crystalScale: 0.130, weight: 13 },
  { id: 'emerald',   hue: new Color(0.36, 0.86, 0.60), stone: new Color(0.92, 0.98, 0.92), clarity: 0.72, iridescent: false, crystalCount: 155, crystalScale: 0.108, weight: 11 },
  { id: 'smoky',     hue: new Color(0.52, 0.44, 0.42), stone: new Color(0.90, 0.88, 0.86), clarity: 0.66, iridescent: false, crystalCount: 130, crystalScale: 0.128, weight: 9 },
  { id: 'rainbow',   hue: new Color(0.80, 0.72, 1.00), stone: new Color(0.98, 0.95, 0.98), clarity: 0.92, iridescent: true,  crystalCount: 175, crystalScale: 0.100, weight: 5 },
];

export function pickVariety(rand: Rand): Variety {
  return rand.pick(VARIETIES, VARIETIES.map((v) => v.weight));
}

export function varietyById(id: string): Variety {
  return VARIETIES.find((v) => v.id === id) ?? VARIETIES[0];
}
