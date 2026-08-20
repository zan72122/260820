import { describe, expect, it } from 'vitest';
import { HintDirector } from '../src/core/HintDirector';

const run = (h: HintDirector, ms: number, stepMs = 100) => {
  let last = h.update(0);
  for (let t = 0; t < ms; t += stepMs) last = h.update(stepMs);
  return last;
};

describe('wordless hinting', () => {
  it('stays completely silent for the first seconds of observation', () => {
    const h = new HintDirector({ observeMs: 3000 });
    h.focus('spreadNet', 0);
    expect(run(h, 2500).level).toBe(0);
  });

  it('then stirs exactly one object', () => {
    const h = new HintDirector({ observeMs: 3000 });
    h.focus('spreadNet', 0);
    const s = run(h, 3500);
    expect(s.level).toBe(1);
    expect(s.target).toBe('spreadNet');
  });

  it('offers a short partial motion only after a longer wait', () => {
    const h = new HintDirector({ observeMs: 3000, nudgeMs: 5000, cueMs: 900 });
    h.focus('spreadNet', 0);
    expect(run(h, 6000).level).toBe(1);

    let sawCue = false;
    let peak = 0;
    let cueSamples = 0;
    for (let t = 0; t < 3000; t += 100) {
      const s = h.update(100);
      if (s.level === 2) {
        sawCue = true;
        cueSamples++;
        peak = Math.max(peak, s.cue);
      }
    }
    expect(sawCue).toBe(true);
    // The motion rises and settles back within about a second: it is a hint,
    // not a demonstration of the whole gesture.
    expect(peak).toBeGreaterThan(0.5);
    expect(peak).toBeLessThanOrEqual(1);
    expect(cueSamples).toBeLessThanOrEqual(10);
  });

  it('falls silent the instant the child touches anything', () => {
    const h = new HintDirector({ observeMs: 3000 });
    h.focus('spreadNet', 0);
    expect(run(h, 4000).level).toBe(1);
    h.notifyInteraction();
    expect(h.update(0).level).toBe(0);
    expect(run(h, 1000).level).toBe(0);
  });

  it('is quieter the second time and silent the third', () => {
    const once = new HintDirector({ observeMs: 3000 });
    once.focus('spreadNet', 1);
    const second = run(once, 12000);
    expect(second.strength).toBeCloseTo(0.4);

    const twice = new HintDirector({ observeMs: 3000 });
    twice.focus('spreadNet', 2);
    const third = run(twice, 12000);
    expect(third.level).toBe(0);
    expect(third.strength).toBe(0);
  });

  it('hints for nothing at all when there is no current step', () => {
    const h = new HintDirector();
    h.focus(null);
    expect(run(h, 20000)).toEqual({ level: 0, strength: 0, target: null, cue: 0 });
  });

  it('restarts the ladder when the step changes', () => {
    const h = new HintDirector({ observeMs: 3000 });
    h.focus('spreadNet', 0);
    expect(run(h, 4000).level).toBe(1);
    h.focus('callSun', 0);
    expect(h.update(0).level).toBe(0);
    expect(run(h, 2000).level).toBe(0);
    expect(run(h, 2000).target).toBe('callSun');
  });
});
