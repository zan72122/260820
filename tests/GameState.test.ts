import { describe, expect, it } from 'vitest';
import {
  GameState, STAGE_ORDER, STAGE_STEPS, loadSnapshot, saveSnapshot,
} from '../src/core/GameState';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number { return this.map.size; }
  clear(): void { this.map.clear(); }
  getItem(k: string): string | null { return this.map.get(k) ?? null; }
  key(i: number): string | null { return [...this.map.keys()][i] ?? null; }
  removeItem(k: string): void { this.map.delete(k); }
  setItem(k: string, v: string): void { this.map.set(k, v); }
}

describe('stage progression', () => {
  it('offers exactly one unknown causality at a time', () => {
    const s = new GameState();
    expect(s.step).toBe('spreadNet');
    expect(s.isStepUnlocked('spreadNet')).toBe(true);
    expect(s.isStepUnlocked('callSun')).toBe(false);
    expect(s.isStepUnlocked('gather')).toBe(false);

    s.setProgress('spreadNet', 1);
    expect(s.step).toBe('callSun');
    expect(s.isStepUnlocked('callSun')).toBe(true);
    expect(s.isStepUnlocked('gather')).toBe(false);
  });

  it('keeps every learned action available afterwards', () => {
    const s = new GameState();
    s.setProgress('spreadNet', 1);
    s.setProgress('callSun', 1);
    // The net can still be played with once the sun step has moved on.
    expect(s.isStepUnlocked('spreadNet')).toBe(true);
    expect(s.isStepUnlocked('callSun')).toBe(true);
  });

  it('never rewinds: progress is monotonic under any input order', () => {
    const s = new GameState();
    s.advance('spreadNet', 0.6);
    s.advance('spreadNet', -0.4);
    expect(s.stepProgress('spreadNet')).toBeCloseTo(0.6);
    s.setProgress('spreadNet', 0.2);
    expect(s.stepProgress('spreadNet')).toBeCloseTo(0.6);
  });

  it('ignores input on steps that are still locked', () => {
    const s = new GameState();
    s.advance('gather', 1);
    expect(s.stepProgress('gather')).toBe(0);
  });

  it('enters free play only once every step of the stage is done', () => {
    const s = new GameState();
    const phases: string[] = [];
    s.on((e) => {
      if (e.type === 'phase') phases.push(e.phase);
    });
    for (const step of STAGE_STEPS.orchard) {
      expect(s.phase).toBe('task');
      s.setProgress(step, 1);
    }
    expect(s.phase).toBe('freeplay');
    expect(phases).toEqual(['freeplay']);
  });

  it('walks all three stages and loops back to a fresh orchard', () => {
    const s = new GameState();
    for (const stage of STAGE_ORDER) {
      expect(s.stage).toBe(stage);
      for (const step of STAGE_STEPS[stage]) s.setProgress(step, 1);
      expect(s.canAdvanceStage).toBe(true);
      s.nextStage();
    }
    expect(s.stage).toBe('orchard');
    expect(s.loops).toBe(1);
    expect(s.step).toBe('spreadNet');
    expect(s.stepProgress('spreadNet')).toBe(0);
  });

  it('remembers mastery across a loop so hints stay quiet the second time', () => {
    const s = new GameState();
    for (const stage of STAGE_ORDER) {
      for (const step of STAGE_STEPS[stage]) s.setProgress(step, 1);
      s.nextStage();
    }
    expect(s.masteryOf('spreadNet')).toBe(1);
    s.setProgress('spreadNet', 1);
    expect(s.masteryOf('spreadNet')).toBe(2);
  });

  it('round-trips through a snapshot, which is what survives a reload', () => {
    const store = new MemoryStorage();
    const a = new GameState();
    a.setProgress('spreadNet', 1);
    a.setProgress('callSun', 0.4);
    saveSnapshot(a.snapshot(), store);

    const b = new GameState(loadSnapshot(store));
    expect(b.stage).toBe('orchard');
    expect(b.step).toBe('callSun');
    expect(b.stepProgress('callSun')).toBeCloseTo(0.4);
    expect(b.masteryOf('spreadNet')).toBe(1);
  });

  it('discards a snapshot from an incompatible version', () => {
    const store = new MemoryStorage();
    store.setItem('ume.progress.v3', JSON.stringify({ version: 1, stage: 'drying' }));
    const s = new GameState(loadSnapshot(store));
    expect(s.stage).toBe('orchard');
  });

  it('reports stage progress for the ambient read-out', () => {
    const s = new GameState();
    expect(s.stageProgress).toBe(0);
    s.setProgress('spreadNet', 1);
    expect(s.stageProgress).toBeCloseTo(1 / 3);
  });
});
