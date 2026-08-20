import test from 'node:test';
import assert from 'node:assert/strict';
import { Session, STATE, mulberry32 } from '../src/sim/session.js';

// A stand-in for a finger on the glass. `shake` is what the real Input derives
// from pointer speed; here it is set directly so the tests can be about the
// state machine rather than about spring constants.
function finger({ active = true, shake = 0, steadiness = 1 } = {}) {
  return { active, shake, steadiness, everTouched: true };
}
const idle = { active: false, shake: 0, steadiness: 1, everTouched: false };

function run(session, input, seconds, dt = 1 / 60) {
  for (let t = 0; t < seconds; t += dt) session.update(dt, input);
}

test('nothing happens until a finger arrives, however long that takes', () => {
  const s = new Session(1);
  run(s, idle, 120);
  assert.equal(s.state, STATE.WAITING);
  assert.equal(s.burn, 0, 'the clock has not started');
  assert.equal(s.params.rate, 0, 'and there are no sparks to see');
});

test('touching it starts the burn, and it then changes on its own', () => {
  const s = new Session(2);
  run(s, finger(), 1);
  assert.equal(s.state, STATE.BURNING);
  const early = s.burn;
  run(s, finger(), 10);
  assert.ok(s.burn > early, 'time moves while it is held');
  assert.ok(s.params.rate > 0, 'and sparks have started');
});

test('the first sparkler runs its whole course and then lets go', () => {
  const s = new Session(3);
  let sawMatsuba = false;
  let sawYanagi = false;
  for (let t = 0; t < 200; t += 1 / 60) {
    s.update(1 / 60, finger());
    if (s.phaseName === 'matsuba') sawMatsuba = true;
    if (s.phaseName === 'yanagi') sawYanagi = true;
    if (s.state !== STATE.BURNING) break;
  }
  assert.ok(sawMatsuba && sawYanagi, 'every stage is shown');
  assert.equal(s.state, STATE.FALLING);
});

test('the first sparkler cannot be dropped by letting go or by waving it', () => {
  const s = new Session(4);
  run(s, finger(), 2);
  run(s, { active: false, shake: 1, steadiness: 0, everTouched: true }, 25);
  assert.equal(s.state, STATE.BURNING, 'the first one is completely forgiving');
  assert.ok(s.grip >= 0.3, 'grip bottoms out well above zero on the first one');
  assert.ok(s.gripDim < 1, 'though it has visibly dimmed, which is the lesson');
});

test('letting go dims it long before it drops, and picking it up again recovers', () => {
  const s = new Session(5);
  run(s, finger(), 3);
  const held = s.gripDim;
  run(s, { ...finger(), active: false }, 4);
  assert.ok(s.gripDim < held * 0.9, 'the bead visibly weakens when it is let go');
  run(s, finger(), 3);
  assert.ok(s.gripDim > 0.99, 'and comes straight back when it is held again');
});

test('a later sparkler can be shaken loose, but only by real waving', () => {
  const s = new Session(6);
  s.forgiving = false;
  run(s, finger(), 2);
  run(s, finger({ shake: 0.5, steadiness: 0.5 }), 20);
  assert.equal(s.state, STATE.BURNING, 'a four-year-old wobble is not shaking');
  run(s, finger({ shake: 1, steadiness: 0 }), 6);
  assert.equal(s.state, STATE.FALLING, 'being waved about does end it');
});

test('holding it steady makes it last measurably longer', () => {
  const life = (steadiness) => {
    const s = new Session(7);
    let t = 0;
    while (s.state === STATE.BURNING || s.state === STATE.WAITING) {
      s.update(1 / 60, finger({ steadiness }));
      t += 1 / 60;
      if (t > 300) break;
    }
    return t;
  };
  const still = life(1);
  const restless = life(0);
  assert.ok(still > restless * 1.1, `steady ${still.toFixed(1)}s vs restless ${restless.toFixed(1)}s`);
});

test('after it falls there is a quiet, and then another one is offered', () => {
  const s = new Session(8);
  let handedOver = null;
  s.newSparkler = (c) => {
    handedOver = c;
  };
  run(s, finger(), 2);
  s._detach();
  assert.equal(s.state, STATE.FALLING);
  run(s, idle, 3);
  assert.equal(s.state, STATE.QUIET, 'a beat of nothing first');
  run(s, idle, 4);
  assert.equal(s.state, STATE.OFFERING);
  run(s, idle, 5);
  assert.ok(handedOver, 'a fresh sparkler was put in the hand');
  assert.equal(s.state, STATE.WAITING, 'and it waits to be taken');
  assert.equal(s.index, 1);
  assert.equal(s.burn, 0);
  assert.equal(s.forgiving, false, 'only the first one is on rails');
});

test('every sparkler is a slightly different one', () => {
  const s = new Session(9);
  const seen = [];
  for (let i = 0; i < 6; i++) {
    seen.push(s.character);
    s.beginSparkler(false);
  }
  const speeds = new Set(seen.map((c) => c.speedMul.toFixed(4)));
  assert.equal(speeds.size, seen.length, 'no two burn quite the same');
  for (const c of seen) {
    assert.ok(c.speedMul > 0.85 && c.speedMul < 1.15, 'but none of them is a stunt');
    assert.ok(c.twist > 5 && c.twist < 10);
  }
});

test('the first sparkler is the long one', () => {
  const s = new Session(10);
  const first = s.duration;
  const later = [];
  for (let i = 0; i < 8; i++) {
    s.beginSparkler(false);
    later.push(s.duration);
  }
  assert.ok(first > Math.max(...later), 'there is time to watch the first one properly');
  assert.ok(Math.min(...later) > 35, 'and none of the rest is over in a blink');
});

test('the first spark is announced exactly once', () => {
  const s = new Session(11);
  let calls = 0;
  s.onFirstSpark = () => calls++;
  s.noteSpark(1);
  s.noteSpark(9);
  assert.equal(calls, 1);
});

test('the seeded generator is deterministic', () => {
  const a = mulberry32(1234);
  const b = mulberry32(1234);
  for (let i = 0; i < 50; i++) assert.equal(a(), b());
});
