import { getGlyph, scanline } from './glyphs';
import { EM } from './constants';

export type PairId = 'AV' | 'OO' | 'LT';
export type GapState = 'wide' | 'ok' | 'narrow';

export interface PairConfig {
  id: PairId;
  left: string;
  right: string;
  /** world x of the left glyph origin (fixed letter). */
  leftX: number;
  /** initial bbox gap between the letters (m) — deliberately far too wide. */
  spacing0: number;
  spacingMin: number;
  spacingMax: number;
  /**
   * classification bands on the characteristic clearance of the negative
   * space (m). clearance < narrowBelow -> narrow, <= okUpTo -> ok, else wide.
   * Bands are generous — the point is a wide "flows nicely" range, not one
   * exact position.
   */
  narrowBelow: number;
  okUpTo: number;
  /** recovery tray mouth center, relative to the right letter origin x. */
  trayOffset: number;
  /** tray mouth half width (m). */
  trayHalf: number;
  /** 'channel': capsule descends between the letters. 'bridge': LT style. */
  mode: 'channel' | 'bridge';
}

export const PAIRS: PairConfig[] = [
  {
    id: 'AV',
    left: 'A',
    right: 'V',
    leftX: -1.26,
    spacing0: 1.05,
    spacingMin: -0.3,
    spacingMax: 1.3,
    narrowBelow: 0.27,
    okUpTo: 0.56,
    trayOffset: 0.29,
    trayHalf: 0.3,
    mode: 'channel',
  },
  {
    id: 'OO',
    left: 'O',
    right: 'O',
    leftX: -1.61,
    spacing0: 1.2,
    spacingMin: 0.07,
    spacingMax: 1.5,
    narrowBelow: 0.27,
    okUpTo: 0.55,
    trayOffset: -0.205,
    trayHalf: 0.27,
    mode: 'channel',
  },
  {
    id: 'LT',
    left: 'L',
    right: 'T',
    leftX: -1.14,
    spacing0: 0.6,
    spacingMin: -0.42,
    spacingMax: 0.9,
    narrowBelow: 0.27,
    okUpTo: 0.52,
    trayOffset: 0.3,
    trayHalf: 0.3,
    mode: 'bridge',
  },
];

export function glyphWidthM(name: string): number {
  return getGlyph(name).width * EM;
}

/** world x of the right glyph origin for a given spacing. */
export function rightGlyphX(pair: PairConfig, spacing: number): number {
  return pair.leftX + glyphWidthM(pair.left) + spacing;
}

/**
 * Characteristic clearance of the negative space (m).
 * channel: minimum horizontal free width between facing edges over the
 * letter height. bridge (LT): the slot between L's foot end and T's stem.
 */
export function clearanceOf(pair: PairConfig, spacing: number): number {
  const gl = getGlyph(pair.left);
  const gr = getGlyph(pair.right);
  const lx = pair.leftX;
  const rx = rightGlyphX(pair, spacing);
  if (pair.mode === 'bridge') {
    // T stem left face relative to its glyph origin
    const t = getGlyph('T');
    const stemLeft = t.contours[0][5].x; // stem-left vertex
    return rx + stemLeft * EM - (lx + gl.width * EM);
  }
  let min = Infinity;
  for (let i = 0; i <= 20; i++) {
    const y = 0.06 + (0.88 * i) / 20;
    const sl = scanline(gl, y);
    const sr = scanline(gr, y);
    if (!sl || !sr) continue;
    const gap = rx + sr[0] * EM - (lx + sl[1] * EM);
    if (gap < min) min = gap;
  }
  return min;
}

export function classify(pair: PairConfig, spacing: number): GapState {
  const c = clearanceOf(pair, spacing);
  if (c < pair.narrowBelow) return 'narrow';
  if (c <= pair.okUpTo) return 'ok';
  return 'wide';
}

/** Capsule/water release x in world coordinates for the current spacing. */
export function dropX(pair: PairConfig, spacing: number): number {
  if (pair.mode === 'bridge') {
    // above L's foot, next to the stem
    return pair.leftX + getGlyph('L').contours[0][3].x * EM + 0.16;
  }
  const gl = getGlyph(pair.left);
  const gr = getGlyph(pair.right);
  const y = 0.96;
  const sl = scanline(gl, y);
  const sr = scanline(gr, y);
  const rx = rightGlyphX(pair, spacing);
  const l = sl ? pair.leftX + sl[1] * EM : pair.leftX + gl.width * EM;
  const r = sr ? rx + sr[0] * EM : rx;
  return (l + r) / 2;
}

/**
 * Center path of the negative space, sampled top to bottom, world meters.
 * Used for the gentle success assist and the water ribbon.
 */
export function channelCenters(pair: PairConfig, spacing: number): { y: number; x: number; halfW: number }[] {
  const out: { y: number; x: number; halfW: number }[] = [];
  const gl = getGlyph(pair.left);
  const gr = getGlyph(pair.right);
  const rx = rightGlyphX(pair, spacing);
  for (let i = 0; i <= 30; i++) {
    const ey = 0.97 - (0.94 * i) / 30;
    const sl = scanline(gl, ey);
    const sr = scanline(gr, ey);
    if (!sl || !sr) continue;
    const l = pair.leftX + sl[1] * EM;
    const r = rx + sr[0] * EM;
    if (r <= l) continue;
    out.push({ y: ey * EM, x: (l + r) / 2, halfW: (r - l) / 2 });
  }
  return out;
}
