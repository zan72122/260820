import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Rand } from '../core/Rand';
import {
  buildCrystalGeometry, buildGeodeHalf, defaultShape, placeCrystals, seamOffsetAt,
} from '../world/geodeGeometry';
import { VARIETIES, pickVariety, varietyById } from '../world/varieties';

const shape = () => {
  const s = defaultShape(1234, new Rand(1234));
  s.nu = 24; s.nvOut = 8; s.nvIn = 6;
  return s;
};

describe('geode halves', () => {
  it('builds finite geometry with rock and druzy groups', () => {
    const sh = shape();
    for (const sign of [1, -1] as const) {
      const g = buildGeodeHalf(sign, sh);
      const pos = g.getAttribute('position').array as ArrayLike<number>;
      for (let i = 0; i < pos.length; i++) expect(Number.isFinite(pos[i])).toBe(true);
      expect(g.groups).toHaveLength(2);
      expect(g.groups[0].materialIndex).toBe(0);
      expect(g.groups[1].materialIndex).toBe(1);
      expect(g.getAttribute('aSurf')).toBeTruthy();
      expect(g.getIndex()!.count).toBeGreaterThan(0);
    }
  });

  it('marks outer shell, rim and cavity distinctly', () => {
    const g = buildGeodeHalf(1, shape());
    const surf = new Set(Array.from(g.getAttribute('aSurf').array as ArrayLike<number>));
    expect(surf).toEqual(new Set([0, 1, 2]));
  });

  it('gives the two halves a mating break surface', () => {
    // The rim rings of the top and bottom halves must coincide in x/z and
    // mirror in y, or the closed stone shows a gap or an interpenetration.
    const sh = shape();
    const top = buildGeodeHalf(1, sh);
    const bot = buildGeodeHalf(-1, sh);
    const tp = top.getAttribute('position');
    const bp = bot.getAttribute('position');
    expect(tp.count).toBe(bp.count);

    const tSurf = top.getAttribute('aSurf').array as ArrayLike<number>;
    let checked = 0;
    for (let i = 0; i < tp.count; i++) {
      if (tSurf[i] !== 1) continue;
      expect(tp.getX(i)).toBeCloseTo(bp.getX(i), 6);
      expect(tp.getZ(i)).toBeCloseTo(bp.getZ(i), 6);
      const lon = Math.atan2(tp.getZ(i), tp.getX(i));
      const seam = seamOffsetAt(lon, sh.seamAmp, sh.seamPhase);
      // Equal and opposite deviation from the shared break line.
      // Positions are float32, so 1e-7 is the meaningful floor here.
      expect(tp.getY(i) - seam).toBeCloseTo(-(bp.getY(i) - seam), 6);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('keeps the cavity strictly inside the outer shell', () => {
    const sh = shape();
    const g = buildGeodeHalf(1, sh);
    const pos = g.getAttribute('position');
    const surf = g.getAttribute('aSurf').array as ArrayLike<number>;
    const v = new Vector3();
    let maxCavity = 0, minShell = Infinity;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (surf[i] === 2) maxCavity = Math.max(maxCavity, v.length());
      if (surf[i] === 0) minShell = Math.min(minShell, v.length());
    }
    expect(maxCavity).toBeLessThan(minShell);
  });
});

describe('seam', () => {
  it('is continuous across the wrap point', () => {
    const sh = shape();
    const a = seamOffsetAt(0, sh.seamAmp, sh.seamPhase);
    const b = seamOffsetAt(Math.PI * 2, sh.seamAmp, sh.seamPhase);
    expect(a).toBeCloseTo(b, 12);
    expect(seamOffsetAt(-Math.PI, sh.seamAmp, sh.seamPhase))
      .toBeCloseTo(seamOffsetAt(Math.PI, sh.seamAmp, sh.seamPhase), 12);
  });

  it('stays within its stated amplitude', () => {
    const sh = shape();
    for (let i = 0; i < 360; i++) {
      const y = seamOffsetAt((i / 180) * Math.PI, sh.seamAmp, sh.seamPhase);
      expect(Math.abs(y)).toBeLessThanOrEqual(sh.seamAmp * 1.0001);
    }
  });
});

describe('crystals', () => {
  it('places every crystal inside the cavity with a unit normal', () => {
    const sh = shape();
    const places = placeCrystals(-1, sh, 120, 0.12, new Rand(9));
    expect(places).toHaveLength(120);
    for (const p of places) {
      expect(p.position.length()).toBeLessThan(sh.cavityR * 1.3);
      expect(p.normal.length()).toBeCloseTo(1, 6);
      expect(p.height).toBeGreaterThan(0);
      expect(p.radius).toBeGreaterThan(0);
      // Bottom-half crystals must sit on the lower hemisphere.
      expect(p.position.y).toBeLessThan(sh.seamAmp + 1e-6);
    }
  });

  it('sizes crystals largest at the bottom of the bowl', () => {
    const places = placeCrystals(-1, shape(), 400, 0.12, new Rand(3));
    const deep = places.filter((p) => p.position.y < -0.2);
    const shallow = places.filter((p) => p.position.y > -0.08);
    const avg = (a: typeof places) => a.reduce((s, p) => s + p.height, 0) / Math.max(1, a.length);
    expect(avg(deep)).toBeGreaterThan(avg(shallow));
  });

  it('builds a closed unit crystal', () => {
    const g = buildCrystalGeometry(new Rand(5));
    const pos = g.getAttribute('position');
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      minY = Math.min(minY, pos.getY(i));
      maxY = Math.max(maxY, pos.getY(i));
    }
    expect(minY).toBeCloseTo(0, 6);
    expect(maxY).toBeCloseTo(1, 6);
    expect(g.getIndex()!.count % 3).toBe(0);
  });
});

describe('varieties', () => {
  it('has unique ids and positive weights', () => {
    expect(new Set(VARIETIES.map((v) => v.id)).size).toBe(VARIETIES.length);
    for (const v of VARIETIES) expect(v.weight).toBeGreaterThan(0);
  });

  it('picks deterministically and always returns a known variety', () => {
    for (let s = 1; s < 200; s++) {
      const v = pickVariety(new Rand(s));
      expect(VARIETIES).toContain(v);
      expect(pickVariety(new Rand(s))).toBe(v);
    }
  });

  it('falls back to a real variety for unknown ids', () => {
    expect(varietyById('does-not-exist').id).toBe(VARIETIES[0].id);
  });
});
