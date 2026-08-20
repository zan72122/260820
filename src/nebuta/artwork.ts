/**
 * The line-work of the design, expressed in patch-local (a, b) coordinates.
 *
 * `GUIDES` are the thick faint "planned lines" the child traces with the ink brush — nothing
 * is drawn for them, they only attract the brush. `WAX` is the fine resist pattern the
 * teacher lays down with hot wax, which repels dye and later lets the lamp light burst
 * through as bright white threads.
 */

export type Pt = [number, number];

export interface Stroke {
  patch: string;
  pts: Pt[];
  width: number;
  closed?: boolean;
}

function ellipse(cx: number, cy: number, rx: number, ry: number, n = 26, phase = 0): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2 + phase;
    out.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  return out;
}

function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 14): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + (a1 - a0) * (i / n);
    out.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  return out;
}

function wavy(a0: number, a1: number, b0: number, b1: number, amp: number, freq: number, n = 18): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = Math.sin(t * Math.PI * freq) * amp * Math.sin(Math.PI * t);
    out.push([a0 + (a1 - a0) * t + w * 0.4, b0 + (b1 - b0) * t + w]);
  }
  return out;
}

/** A row of overlapping scale arcs, the signature goldfish texture. */
function scaleRow(aCentre: number, count: number, size: number, bias = 0): Stroke['pts'][] {
  const rows: Pt[][] = [];
  for (let i = 0; i < count; i++) {
    const b = (i + 0.5) / count;
    rows.push(arc(aCentre, b + bias, size * 0.85, 0.5 / count + size * 0.1, Math.PI * 0.15, Math.PI * 0.85, 9));
  }
  return rows;
}

function headGuides(patch: string): Stroke[] {
  const s: Stroke[] = [];
  // big round eye on the cheek bulge, plus the pupil
  s.push({ patch, pts: ellipse(0.333, 0.45, 0.135, 0.105), width: 1.0, closed: true });
  s.push({ patch, pts: ellipse(0.333, 0.45, 0.062, 0.05), width: 0.85, closed: true });
  // brow flick
  s.push({ patch, pts: arc(0.333, 0.45, 0.185, 0.15, Math.PI * 1.1, Math.PI * 1.55, 10), width: 0.8 });
  // mouth
  s.push({ patch, pts: arc(0.1, 0.93, 0.09, 0.09, Math.PI * 1.75, Math.PI * 2.45, 10), width: 0.95 });
  // gill plate
  s.push({ patch, pts: arc(0.86, 0.5, 0.2, 0.52, Math.PI * 0.62, Math.PI * 1.38, 14), width: 1.0 });
  // cheek scales
  for (const r of scaleRow(0.66, 3, 0.075)) s.push({ patch, pts: r, width: 0.6 });
  return s;
}

function bodyGuides(patch: string, rows: number): Stroke[] {
  const s: Stroke[] = [];
  for (let r = 0; r < rows; r++) {
    const a = 0.12 + (r / Math.max(1, rows - 1)) * 0.76;
    const count = 4;
    for (const pts of scaleRow(a, count, 0.085, r % 2 === 0 ? 0 : 0.5 / count)) {
      s.push({ patch, pts, width: 0.62 });
    }
  }
  // lateral line running the length of the flank
  s.push({ patch, pts: wavy(0.02, 0.98, 0.34, 0.36, 0.03, 2.4, 20), width: 0.7 });
  return s;
}

function tailGuides(patch: string): Stroke[] {
  const s: Stroke[] = [];
  for (let i = 0; i < 7; i++) {
    const b = 0.08 + (i / 6) * 0.84;
    s.push({ patch, pts: wavy(0.02, 0.99, b, b + (b - 0.5) * 0.12, 0.026, 2.0, 16), width: 0.85 });
  }
  s.push({ patch, pts: wavy(0.42, 0.42, 0.03, 0.97, 0.05, 1.6, 16), width: 0.6 });
  return s;
}

function waveGuides(patch: string): Stroke[] {
  const s: Stroke[] = [];
  for (let i = 0; i < 5; i++) {
    const b = 0.1 + (i / 4) * 0.8;
    s.push({ patch, pts: wavy(0.02, 0.98, b, b, 0.035, 2.6, 18), width: 0.9 });
  }
  // foam curls at the breaking crest
  for (let i = 0; i < 3; i++) {
    const b = 0.25 + i * 0.25;
    const spiral: Pt[] = [];
    for (let k = 0; k <= 18; k++) {
      const t = k / 18;
      const th = t * Math.PI * 2.2;
      const rr = 0.085 * (1 - 0.6 * t);
      spiral.push([0.84 + Math.cos(th) * rr, b + Math.sin(th) * rr * 1.6]);
    }
    s.push({ patch, pts: spiral, width: 0.7 });
  }
  return s;
}

function finGuides(patch: string, n: number): Stroke[] {
  const s: Stroke[] = [];
  for (let i = 0; i < n; i++) {
    const b = 0.12 + (i / (n - 1)) * 0.76;
    s.push({ patch, pts: wavy(0.05, 0.97, b, b, 0.02, 1.6, 10), width: 0.7 });
  }
  return s;
}

export const GUIDES: Stroke[] = [
  ...headGuides('head-r'),
  ...headGuides('head-l'),
  ...bodyGuides('belly-r', 4),
  ...bodyGuides('belly-l', 4),
  ...bodyGuides('back-r', 3),
  ...bodyGuides('back-l', 3),
  ...tailGuides('tail-r'),
  ...tailGuides('tail-l'),
  ...waveGuides('wave-f'),
  ...waveGuides('wave-b'),
  ...finGuides('fin-r', 4),
  ...finGuides('fin-l', 4),
  ...finGuides('dorsal', 4),
];

/* --------------------------------------------------------------- wax resist */

function flower(cx: number, cy: number, r: number, petals = 5): Pt[][] {
  const out: Pt[][] = [];
  for (let p = 0; p < petals; p++) {
    const base = (p / petals) * Math.PI * 2;
    const pts: Pt[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const th = base + (t - 0.5) * 1.15;
      const rr = r * Math.sin(Math.PI * t) * 1.0;
      pts.push([cx + Math.cos(th) * rr, cy + Math.sin(th) * rr * 1.25]);
    }
    out.push(pts);
  }
  return out;
}

function star(cx: number, cy: number, r: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= 10; i++) {
    const th = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.42;
    pts.push([cx + Math.cos(th) * rr, cy + Math.sin(th) * rr * 1.3]);
  }
  return pts;
}

function waxHead(patch: string): Stroke[] {
  const s: Stroke[] = [];
  // catch-light in the eye and a ring of fine lashes
  s.push({ patch, pts: ellipse(0.3, 0.41, 0.028, 0.024), width: 0.5, closed: true });
  for (let i = 0; i < 10; i++) {
    const th = (i / 10) * Math.PI * 2;
    s.push({
      patch,
      pts: [
        [0.333 + Math.cos(th) * 0.15, 0.45 + Math.sin(th) * 0.12],
        [0.333 + Math.cos(th) * 0.185, 0.45 + Math.sin(th) * 0.15],
      ],
      width: 0.4,
    });
  }
  for (const p of flower(0.8, 0.22, 0.085)) s.push({ patch, pts: p, width: 0.4 });
  return s;
}

function waxBody(patch: string): Stroke[] {
  const s: Stroke[] = [];
  for (let r = 0; r < 5; r++) {
    const a = 0.1 + (r / 4) * 0.8;
    for (let i = 0; i < 5; i++) {
      const b = (i + 0.5) / 5 + (r % 2 ? 0.1 : 0);
      s.push({ patch, pts: arc(a, b, 0.055, 0.075, Math.PI * 0.2, Math.PI * 0.8, 8), width: 0.42 });
    }
  }
  s.push({ patch, pts: star(0.5, 0.14, 0.07), width: 0.45 });
  for (const p of flower(0.26, 0.82, 0.075)) s.push({ patch, pts: p, width: 0.4 });
  return s;
}

function waxTail(patch: string): Stroke[] {
  const s: Stroke[] = [];
  for (let i = 0; i < 12; i++) {
    const b = 0.05 + (i / 11) * 0.9;
    s.push({ patch, pts: wavy(0.15, 0.98, b, b, 0.014, 2.2, 12), width: 0.4 });
  }
  return s;
}

function waxWave(patch: string): Stroke[] {
  const s: Stroke[] = [];
  for (let i = 0; i < 9; i++) {
    const b = 0.06 + (i / 8) * 0.88;
    s.push({ patch, pts: wavy(0.06, 0.97, b, b, 0.02, 3.0, 14), width: 0.42 });
  }
  for (let i = 0; i < 4; i++) {
    s.push({ patch, pts: star(0.2 + i * 0.2, 0.5 + (i % 2 ? 0.28 : -0.28), 0.045), width: 0.38 });
  }
  return s;
}

export const WAX: Stroke[] = [
  ...waxHead('head-r'),
  ...waxHead('head-l'),
  ...waxBody('belly-r'),
  ...waxBody('belly-l'),
  ...waxBody('back-r'),
  ...waxBody('back-l'),
  ...waxTail('tail-r'),
  ...waxTail('tail-l'),
  ...waxWave('wave-f'),
  ...waxWave('wave-b'),
  ...waxTail('fin-r'),
  ...waxTail('fin-l'),
  ...waxTail('dorsal'),
];

/* --------------------------------------------------------------- dyes */

export interface DyeSpec {
  id: string;
  label: string;
  /** Surface colour in daylight. */
  hex: string;
  density: number;
}

/** Five dyes: enough choice to make it yours, few enough to take in at a glance. */
export const DYES: DyeSpec[] = [
  { id: 'beni', label: 'あか', hex: '#d0203a', density: 1.0 },
  { id: 'daidai', label: 'だいだい', hex: '#e8701d', density: 0.92 },
  { id: 'momo', label: 'もも', hex: '#ef8ba6', density: 0.68 },
  { id: 'ao', label: 'あお', hex: '#2f6fb5', density: 0.95 },
  { id: 'ai', label: 'あい', hex: '#264a7a', density: 1.05 },
];
