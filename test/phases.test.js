import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleTimeline, phaseNameAt, TIMELINE_FIELDS } from '../src/sim/phases.js';

// Physics of one spark, integrated analytically: exponential drag plus a
// constant downward pull. These are the two numbers that decide whether a stage
// reads as "pine needles" or as "a willow", so they are worth asserting.
function ballistics(p) {
  const tau = 1 / p.drag;
  const settle = tau * (1 - Math.exp(-p.life / tau));
  return { reach: p.speed * settle, droop: (p.gravity / p.drag) * (p.life - settle) };
}

test('the timeline is continuous: no field jumps between adjacent samples', () => {
  // Measured against each field's own full range, so a field that legitimately
  // starts at zero is not judged by a percentage of zero.
  const N = 400;
  const samples = [];
  for (let i = 0; i <= N; i++) samples.push({ ...sampleTimeline(i / N, {}) });

  for (const f of TIMELINE_FIELDS) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of samples) {
      lo = Math.min(lo, s[f]);
      hi = Math.max(hi, s[f]);
    }
    const range = Math.max(hi - lo, 1e-9);
    for (let i = 1; i <= N; i++) {
      const step = Math.abs(samples[i][f] - samples[i - 1][f]) / range;
      assert.ok(
        step < 0.05,
        `${f} jumped at t=${(i / N).toFixed(3)}: ${samples[i - 1][f]} -> ${samples[i][f]}`
      );
    }
  }
});

test('the bead grows, peaks in the middle, and shrinks back', () => {
  const r = (t) => sampleTimeline(t, {}).emberRadius;
  assert.ok(r(0) < r(0.2), 'bud should swell');
  assert.ok(r(0.2) < r(0.5), 'it is largest around matsuba');
  assert.ok(r(0.55) > r(0.85), 'and draws back in afterwards');
  assert.ok(r(1) > 0.002, 'but it is still the subject at the end');
});

test('spark output rises to a single peak and dies away', () => {
  const rate = (t) => sampleTimeline(t, {}).rate;
  assert.equal(rate(0), 0, 'nothing at all before it gets going');
  assert.ok(rate(0.06) > 0 && rate(0.06) < 2, 'the first sparks are countable');
  assert.ok(rate(0.55) > 200, 'matsuba is the loud one');
  assert.ok(rate(0.82) < rate(0.55) * 0.6, 'yanagi is well past it');
  assert.ok(rate(0.97) < 12, 'and by the end there is almost nothing');
});

test('matsuba throws straight rays; yanagi hangs downward', () => {
  const matsuba = ballistics(sampleTimeline(0.55, {}));
  const yanagi = ballistics(sampleTimeline(0.82, {}));

  assert.ok(matsuba.reach > matsuba.droop * 3, 'matsuba must read as radial needles');
  assert.ok(matsuba.reach > 0.05 && matsuba.reach < 0.1, 'and stay roughly in frame');
  assert.ok(yanagi.droop > yanagi.reach, 'yanagi must fall more than it flies');
  assert.ok(yanagi.reach < matsuba.reach, 'and it has less energy to spend');
});

test('branching is deepest at matsuba and gone by the end', () => {
  assert.equal(sampleTimeline(0, {}).maxDepth, 0);
  assert.ok(sampleTimeline(0.55, {}).maxDepth >= 3);
  assert.ok(sampleTimeline(0.97, {}).maxDepth <= 1);
});

test('sparks are thrown outward early and downward late', () => {
  assert.ok(sampleTimeline(0.2, {}).upBias > 0);
  assert.ok(sampleTimeline(0.85, {}).upBias < -0.2);
});

test('phase names cover the whole burn in order', () => {
  const seen = [];
  for (let i = 0; i <= 100; i++) {
    const n = phaseNameAt(i / 100);
    if (seen[seen.length - 1] !== n) seen.push(n);
  }
  assert.deepEqual(seen, ['tsubomi', 'botan', 'matsuba', 'yanagi', 'chirigiku', 'sizumari']);
});

test('sampling is clamped and allocation-free', () => {
  const out = {};
  const a = sampleTimeline(-5, out);
  assert.equal(a, out);
  assert.equal(a.rate, sampleTimeline(0, {}).rate);
  assert.equal(sampleTimeline(9, {}).rate, sampleTimeline(1, {}).rate);
});
