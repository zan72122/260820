/**
 * Headless behaviour table. Runs the real simulation for every object across
 * every surface state and start band, so the tuning can be checked without a
 * browser. `npm run simcheck`.
 */
import { PROFILES, OBJECT_ORDER } from '../src/objects/profiles';
import { SlideSurface, SURFACE_CELLS } from '../src/world/surface';
import { createBody, predict, type SimWorld } from '../src/sim/simulate';
import { START_ZONES, SLIDE_LENGTH } from '../src/world/slideCurve';

const mat = { x: 5.6, z: 0, halfX: 0.62, halfZ: 0.5, thickness: 0.05, present: false, depression: 0 };

function makeSurface(kind: string): SlideSurface {
  const s = new SlideSurface();
  if (kind === 'morning') return s;
  s.wet.fill(0);
  s.sand.fill(0);
  s.rubber.fill(0);
  if (kind === 'wet') s.wet.fill(1);
  if (kind === 'sand') s.sand.fill(1);
  if (kind === 'rubber') for (let i = 0; i < SURFACE_CELLS; i++) if (i / SURFACE_CELLS > 0.3 && i / SURFACE_CELLS < 0.62) s.rubber[i] = 1;
  return s;
}

const surfaces = ['morning', 'dry', 'wet', 'sand', 'rubber'];
const rows: string[] = [];
rows.push(['object'.padEnd(11), ...surfaces.map((s) => s.padEnd(20))].join(' '));
for (const id of OBJECT_ORDER) {
  const p = PROFILES[id];
  const cells: string[] = [];
  for (const sk of surfaces) {
    const world: SimWorld = { surface: makeSurface(sk), mat: { ...mat } };
    const b = createBody(START_ZONES[0].center, 0, 7);
    const pr = predict(b, p, world);
    const where = pr.onSlide ? `slide@${pr.arc!.toFixed(2)}/${SLIDE_LENGTH}` : `x=${pr.x.toFixed(2)}`;
    cells.push(`${where} t=${pr.time.toFixed(1)}`.padEnd(20));
  }
  rows.push([id.padEnd(11), ...cells].join(' '));
}
console.log(rows.join('\n'));

console.log('\n--- start band comparison (morning surface) ---');
for (const id of OBJECT_ORDER) {
  const p = PROFILES[id];
  const out: string[] = [];
  for (const z of START_ZONES) {
    const world: SimWorld = { surface: makeSurface('morning'), mat: { ...mat } };
    const pr = predict(createBody(z.center, 0, 3), p, world);
    out.push(`${z.id}:${pr.onSlide ? `slide@${pr.arc!.toFixed(2)}` : `x=${pr.x.toFixed(2)}`}`.padEnd(20));
  }
  console.log(id.padEnd(11), out.join(' '));
}

console.log('\n--- repeatability (same object, same conditions, 5 different attempt seeds) ---');
for (const id of OBJECT_ORDER) {
  const p = PROFILES[id];
  const xs: number[] = [];
  for (let k = 0; k < 5; k++) {
    const world: SimWorld = { surface: makeSurface('morning'), mat: { ...mat } };
    const pr = predict(createBody(START_ZONES[0].center + (k % 2 ? 0.004 : -0.004), (k - 2) * 0.006, 100 + k * 37, 1 + (k - 2) * 0.014), p, world);
    xs.push(pr.onSlide ? pr.arc! : pr.x);
  }
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  console.log(id.padEnd(11), xs.map((v) => v.toFixed(3)).join('  '), ` spread=${(max - min).toFixed(3)}m`);
}
