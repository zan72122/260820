import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLightRig } from '../src/scene/lighting.js';
import { Sparkler, CORD_SEGMENTS, CORD_SEGMENT_LENGTH } from '../src/scene/sparkler.js';

const REST = CORD_SEGMENT_LENGTH * (CORD_SEGMENTS - 1);

function segmentLengths(s) {
  const out = [];
  for (let i = 0; i < CORD_SEGMENTS - 1; i++) {
    const a = i * 3;
    const b = a + 3;
    out.push(Math.hypot(s.pos[b] - s.pos[a], s.pos[b + 1] - s.pos[a + 1], s.pos[b + 2] - s.pos[a + 2]));
  }
  return out;
}

function settle(s, anchor, seconds, dt = 1 / 120) {
  for (let t = 0; t < seconds; t += dt) s.step(dt, anchor, 2.4);
}

test('the cord is inextensible: gravity must not stretch it', () => {
  const s = new Sparkler(createLightRig());
  const anchor = new THREE.Vector3(0, 0, 0);
  s.reset(anchor, 0.3);
  settle(s, anchor, 6);

  for (const len of segmentLengths(s)) {
    assert.ok(
      Math.abs(len - CORD_SEGMENT_LENGTH) / CORD_SEGMENT_LENGTH < 0.02,
      `segment is ${(len * 1000).toFixed(2)}mm, want ${(CORD_SEGMENT_LENGTH * 1000).toFixed(2)}mm`
    );
  }
  const hang = anchor.y - s.tip.y;
  assert.ok(Math.abs(hang - REST) / REST < 0.03, `hangs ${hang.toFixed(4)}m, want ${REST.toFixed(4)}m`);
  s.dispose();
});

test('it hangs down, and it stays hanging down when the hand moves', () => {
  const s = new Sparkler(createLightRig());
  const anchor = new THREE.Vector3(0, 0, 0);
  s.reset(anchor, 0.1);
  settle(s, anchor, 4);
  assert.ok(Math.abs(s.tip.x) < 0.004, 'a still hand leaves a still cord');

  // Swing the hand across and back; the tip should trail, then recover.
  for (let t = 0; t < 1.2; t += 1 / 120) {
    anchor.x = Math.sin(t * 5) * 0.02;
    s.step(1 / 120, anchor, 2.4);
  }
  assert.ok(Math.abs(s.tipVel.x) > 0.002, 'the tip is carrying the motion');
  anchor.set(0, 0, 0);
  settle(s, anchor, 6);
  assert.ok(Math.abs(s.tip.x) < 0.006, 'and it settles back under the fingers');
  for (const len of segmentLengths(s)) {
    assert.ok(Math.abs(len - CORD_SEGMENT_LENGTH) / CORD_SEGMENT_LENGTH < 0.03);
  }
  s.dispose();
});

test('the tip lags the hand, which is what makes the chain feel connected', () => {
  const s = new Sparkler(createLightRig());
  const anchor = new THREE.Vector3(0, 0, 0);
  s.reset(anchor, 0.5);
  settle(s, anchor, 4);
  anchor.x = 0.02;
  s.step(1 / 120, anchor, 2.4);
  assert.ok(s.tip.x < anchor.x * 0.5, 'the tip has not teleported with the fingers');
  s.dispose();
});

test('the mesh follows the simulation without NaNs', () => {
  const s = new Sparkler(createLightRig());
  const anchor = new THREE.Vector3(0.01, 0, -0.005);
  s.reset(anchor, 0.9);
  settle(s, anchor, 3);
  s.updateGeometry();
  const p = s.geometry.attributes.position.array;
  const n = s.geometry.attributes.normal.array;
  for (let i = 0; i < p.length; i++) assert.ok(Number.isFinite(p[i]), `position[${i}] is not finite`);
  for (let i = 0; i < n.length; i++) assert.ok(Number.isFinite(n[i]), `normal[${i}] is not finite`);
  s.dispose();
});

test('the char front advances but the cord is never consumed', () => {
  const s = new Sparkler(createLightRig());
  const front = () => s.material.uniforms.uCharFront.value;
  s.setBurn(0, 0);
  const start = front();
  s.setBurn(1, 1);
  assert.ok(front() < start, 'the burn creeps up the paper');
  assert.ok(front() > 0.8, 'but the bead does the burning, not the cord');
  s.dispose();
});
