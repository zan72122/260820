import test from 'node:test';
import assert from 'node:assert/strict';
import { Quality, TIERS, ORDER } from '../src/core/quality.js';

function feed(q, fps, seconds) {
  const dt = 1 / fps;
  for (let t = 0; t < seconds; t += dt) q.sample(dt);
}

test('tiers only ever shed detail as they go down', () => {
  for (let i = 1; i < ORDER.length; i++) {
    const hi = TIERS[ORDER[i - 1]];
    const lo = TIERS[ORDER[i]];
    assert.ok(lo.maxSparks < hi.maxSparks, `${ORDER[i]} caps sparks below ${ORDER[i - 1]}`);
    assert.ok(lo.sparkRate <= hi.sparkRate);
    assert.ok(lo.bloomScale <= hi.bloomScale);
    assert.ok(lo.renderScale <= hi.renderScale);
    assert.ok(lo.pixelRatioCap <= hi.pixelRatioCap);
  }
});

test('even the lowest tier keeps enough sparks for the stages to read', () => {
  assert.ok(TIERS.floor.maxSparks >= 250);
  assert.ok(TIERS.floor.sparkRate >= 0.4);
  // The one thing that is never allowed to be cut is the story itself, so the
  // tiers carry no knob that could disable a phase.
  for (const name of ORDER) {
    assert.ok(!('phases' in TIERS[name]));
    assert.ok(!('emberPhases' in TIERS[name]));
  }
});

test('a slow device is stepped down, once, not thrashed', () => {
  const q = new Quality('high');
  const changes = [];
  q.onChange = (s) => changes.push(s.name);
  feed(q, 25, 4);
  assert.deepEqual(changes, ['medium'], 'one step down, then it waits to see');
  feed(q, 25, 6);
  assert.deepEqual(changes, ['medium', 'low']);
});

test('a fast device is promoted only after a long clean run', () => {
  const q = new Quality('low');
  const changes = [];
  q.onChange = (s) => changes.push(s.name);
  feed(q, 60, 5);
  assert.deepEqual(changes, [], 'a few good seconds prove nothing');
  feed(q, 60, 12);
  assert.deepEqual(changes, ['medium']);
});

test('an explicitly chosen tier is never overridden', () => {
  const q = new Quality('high');
  q.forceTier('floor');
  feed(q, 120, 40);
  assert.equal(q.tier, 'floor');
});
