import { describe, expect, it } from 'vitest';
import { classifyStroke, directionalMatch, StrokeRecorder } from '../src/core/gestures';

const line = (n: number, dx: number, dy: number, ms = 400) =>
  Array.from({ length: n }, (_, i) => ({
    x: (dx * i) / (n - 1), y: (dy * i) / (n - 1), t: (ms * i) / (n - 1),
  }));

describe('gesture reading, tuned for small hands', () => {
  it('treats a wobbly stationary touch as a tap', () => {
    expect(classifyStroke(line(6, 8, 5, 120)).kind).toBe('tap');
  });

  it('treats a long stationary touch as a long press', () => {
    expect(classifyStroke(line(6, 6, 4, 900)).kind).toBe('longpress');
  });

  it('separates a slow drag from a quick swipe', () => {
    expect(classifyStroke(line(12, 220, 0, 1400)).kind).toBe('drag');
    expect(classifyStroke(line(12, 220, 0, 160)).kind).toBe('swipe');
  });

  it('reads direction from net travel, so a curved stroke still counts', () => {
    const curved = [
      { x: 0, y: 0, t: 0 }, { x: 40, y: -30, t: 80 },
      { x: 90, y: 10, t: 160 }, { x: 140, y: 2, t: 240 },
    ];
    const g = classifyStroke(curved);
    expect(g.kind).not.toBe('tap');
    expect(Math.abs(g.angle)).toBeLessThan(0.2);
  });

  it('survives an empty or single-sample stroke', () => {
    expect(classifyStroke([]).kind).toBe('tap');
    expect(classifyStroke([{ x: 1, y: 1, t: 0 }]).distance).toBe(0);
  });

  it('scores direction generously but not blindly', () => {
    expect(directionalMatch(10, 0, 0)).toBeCloseTo(1);
    expect(directionalMatch(0, 10, 0)).toBeCloseTo(0);
    expect(directionalMatch(-10, 0, 0)).toBe(0);
    expect(directionalMatch(10, 10, 0)).toBeCloseTo(0.707, 2);
    expect(directionalMatch(0, 0, 0)).toBe(0);
  });

  it('keeps the recorder bounded and reports the last step', () => {
    const r = new StrokeRecorder(8);
    for (let i = 0; i < 40; i++) r.push(i * 5, 0, i * 16);
    expect(r.samples.length).toBe(8);
    expect(r.lastDelta.dx).toBe(5);
    r.reset();
    expect(r.samples.length).toBe(0);
    expect(r.lastDelta).toEqual({ dx: 0, dy: 0, dt: 0 });
  });
});
