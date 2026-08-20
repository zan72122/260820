import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Sparks } from '../src/scene/sparks.js';
import { sampleTimeline } from '../src/sim/phases.js';
import { mulberry32 } from '../src/sim/session.js';

const ORIGIN = new THREE.Vector3(0, -0.12, 0);
const ZERO = new THREE.Vector3();

function drive(sparks, burn, seconds, { rateScale = 1, dt = 1 / 60 } = {}) {
  const rand = mulberry32(99);
  const p = sampleTimeline(burn, {});
  for (let t = 0; t < seconds; t += dt) {
    sparks.update(dt, p, ORIGIN, p.emberRadius, ZERO, ZERO, rateScale, rand);
  }
  return p;
}

function poolIsConsistent(s) {
  let alive = 0;
  for (let i = 0; i < s.capacity; i++) if (s.alive[i]) alive++;
  assert.equal(alive, s.liveCount, 'liveCount matches the alive flags');
  assert.equal(alive + s.freeCount, s.capacity, 'every slot is either live or free');
  const free = new Set();
  for (let i = 0; i < s.freeCount; i++) {
    assert.ok(!free.has(s.free[i]), `slot ${s.free[i]} is on the free list twice`);
    assert.ok(!s.alive[s.free[i]], `slot ${s.free[i]} is both free and alive`);
    free.add(s.free[i]);
  }
}

test('the pool stays consistent through a whole burn', () => {
  const s = new Sparks();
  for (let i = 0; i <= 20; i++) {
    drive(s, i / 20, 1.2);
    poolIsConsistent(s);
  }
  s.dispose();
});

test('the instance buffer is packed: every drawn instance is a live spark', () => {
  const s = new Sparks();
  drive(s, 0.55, 2);
  const n = s.geometry.instanceCount;
  assert.equal(n, s.liveCount);
  assert.ok(n > 0);
  for (let i = 0; i < n; i++) {
    assert.ok(s.aP[i * 4 + 3] > 0, `instance ${i} has a real width`);
    const age = s.aV[i * 4 + 3];
    assert.ok(age >= 0 && age <= 1, `instance ${i} has a sane normalised age`);
  }
  // Nothing past the draw range should be read by the GPU, but it must at least
  // not be NaN, or a driver may fault on the upload.
  for (let i = 0; i < s.aP.length; i++) assert.ok(Number.isFinite(s.aP[i]));
  s.dispose();
});

test('matsuba branches: children outnumber the sparks that were emitted', () => {
  const s = new Sparks();
  const rand = mulberry32(5);
  const p = sampleTimeline(0.55, {});
  let emitted = 0;
  const realSpawn = s.spawn.bind(s);
  s.spawn = (...args) => {
    const i = realSpawn(...args);
    if (i >= 0) emitted++;
    return i;
  };
  for (let t = 0; t < 1.5; t += 1 / 60) {
    s.update(1 / 60, p, ORIGIN, p.emberRadius, ZERO, ZERO, 0.3, rand);
  }
  const deepest = Math.max(...Array.from(s.depth).filter((_, i) => s.alive[i]));
  assert.ok(deepest >= 2, `sparks should fork more than once, saw depth ${deepest}`);
  assert.ok(s.liveCount > emitted * 0.5, 'branching multiplies the population');
  s.dispose();
});

test('the tsubomi stage emits nothing at all', () => {
  const s = new Sparks();
  drive(s, 0, 4);
  assert.equal(s.liveCount, 0);
  assert.equal(s.geometry.instanceCount, 0);
  s.dispose();
});

test('the very first spark is a single, countable event', () => {
  const s = new Sparks();
  const births = [];
  s.onBirth = (n) => births.push(n);
  drive(s, 0.05, 6);
  assert.ok(births.length > 0, 'something eventually flew off');
  assert.equal(births[0], 1, 'and the first one was on its own');
  s.dispose();
});

test('the quality cap is respected and never leaks slots', () => {
  const s = new Sparks();
  s.applyQuality({ maxSparks: 120 });
  drive(s, 0.55, 3);
  assert.ok(s.liveCount <= 120, `live ${s.liveCount} exceeded the cap`);
  poolIsConsistent(s);
  // Raising the cap must let it fill again rather than stay stuck.
  s.applyQuality({ maxSparks: 900 });
  drive(s, 0.55, 2);
  assert.ok(s.liveCount > 120);
  poolIsConsistent(s);
  s.dispose();
});

test('reset returns the pool to a clean slate', () => {
  const s = new Sparks();
  drive(s, 0.55, 2);
  assert.ok(s.liveCount > 0);
  s.reset();
  assert.equal(s.liveCount, 0);
  assert.equal(s.geometry.instanceCount, 0);
  poolIsConsistent(s);
  drive(s, 0.55, 1);
  assert.ok(s.liveCount > 0, 'and it still works afterwards');
  s.dispose();
});

test('hand movement is carried into the spark trajectories', () => {
  const still = new Sparks();
  const moved = new Sparks();
  const p = sampleTimeline(0.5, {});
  const carry = new THREE.Vector3(0.25, 0, 0);
  const wind = new THREE.Vector3(-0.6, 0, 0);
  for (let t = 0; t < 0.4; t += 1 / 60) {
    still.update(1 / 60, p, ORIGIN, p.emberRadius, ZERO, ZERO, 0.4, mulberry32(3));
    moved.update(1 / 60, p, ORIGIN, p.emberRadius, carry, wind, 0.4, mulberry32(3));
  }
  const meanX = (s) => {
    let sum = 0;
    for (let i = 0; i < s.geometry.instanceCount; i++) sum += s.aP[i * 4];
    return sum / Math.max(1, s.geometry.instanceCount);
  };
  assert.ok(meanX(moved) > meanX(still), 'a hand moving right drags its sparks with it');
  still.dispose();
  moved.dispose();
});

test('shedding load never delays the first spark', () => {
  const firstSparkAt = (rateScale) => {
    const s = new Sparks();
    s.applyQuality({ maxSparks: 2000 });
    const rand = mulberry32(17);
    let t = 0;
    while (t < 30) {
      // Walk the opening of the timeline the way the real burn does.
      const p = sampleTimeline(Math.min(0.09, t / 60), {});
      s.update(1 / 60, p, ORIGIN, p.emberRadius, ZERO, ZERO, rateScale, rand);
      t += 1 / 60;
      if (s.liveCount > 0) break;
    }
    s.dispose();
    return t;
  };
  const full = firstSparkAt(1);
  const shed = firstSparkAt(0.46);
  assert.ok(full < 30, 'a first spark does arrive');
  assert.ok(
    Math.abs(shed - full) < 0.2,
    `the opening beat must not depend on the device: ${full.toFixed(2)}s vs ${shed.toFixed(2)}s`
  );
});
