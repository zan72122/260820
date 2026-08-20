import { clamp01 } from './mathx';

export type StageId = 'orchard' | 'pickling' | 'drying';
export type Phase = 'task' | 'freeplay';

/**
 * Ordered steps per stage. Only one unknown causality is ever offered at a
 * time: a step is not interactive until every step before it is complete.
 */
export const STAGE_STEPS: Record<StageId, readonly string[]> = {
  orchard: ['spreadNet', 'callSun', 'gather'],
  pickling: ['pourSalt', 'passDays'],
  drying: ['placeUme', 'sunDry'],
} as const;

export const STAGE_ORDER: readonly StageId[] = ['orchard', 'pickling', 'drying'];

export interface StageSnapshot {
  stage: StageId;
  step: string | null;
  phase: Phase;
  progress: Record<string, number>;
}

export interface GameSnapshot {
  version: number;
  stage: StageId;
  phase: Phase;
  progress: Record<StageId, Record<string, number>>;
  /** How many times each step has ever been completed, across the session. */
  mastery: Record<string, number>;
  loops: number;
}

const VERSION = 3;

type Listener = (ev: GameEvent) => void;

export type GameEvent =
  | { type: 'stepProgress'; stage: StageId; step: string; progress: number }
  | { type: 'stepComplete'; stage: StageId; step: string }
  | { type: 'phase'; stage: StageId; phase: Phase }
  | { type: 'stageChange'; from: StageId | null; to: StageId; loop: number }
  | { type: 'loopComplete'; loops: number };

/**
 * Pure progression model. Holds no Three.js references, so it survives
 * orientation changes, renderer restarts and WebGL context loss untouched.
 */
export class GameState {
  stage: StageId = 'orchard';
  phase: Phase = 'task';
  loops = 0;
  readonly progress: Record<StageId, Record<string, number>>;
  readonly mastery: Record<string, number> = {};
  private listeners: Listener[] = [];

  constructor(snapshot?: GameSnapshot | null) {
    this.progress = {
      orchard: {},
      pickling: {},
      drying: {},
    };
    for (const stage of STAGE_ORDER) {
      for (const step of STAGE_STEPS[stage]) this.progress[stage][step] = 0;
    }
    if (snapshot && snapshot.version === VERSION) this.restore(snapshot);
  }

  on(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private emit(ev: GameEvent): void {
    for (const l of [...this.listeners]) l(ev);
  }

  /** Current step of the active stage, or null once the stage is in free play. */
  get step(): string | null {
    for (const s of STAGE_STEPS[this.stage]) {
      if ((this.progress[this.stage][s] ?? 0) < 1) return s;
    }
    return null;
  }

  stepProgress(step: string, stage: StageId = this.stage): number {
    return this.progress[stage][step] ?? 0;
  }

  isStepDone(step: string, stage: StageId = this.stage): boolean {
    return this.stepProgress(step, stage) >= 1;
  }

  /** True when the step is the one the player is meant to discover right now. */
  isStepActive(step: string): boolean {
    return this.step === step;
  }

  /**
   * A step accepts input while it is active *and* forever after: once a
   * causality is understood the child may keep replaying it freely.
   */
  isStepUnlocked(step: string): boolean {
    const steps = STAGE_STEPS[this.stage];
    const idx = steps.indexOf(step);
    if (idx < 0) return false;
    for (let i = 0; i < idx; i++) {
      if (!this.isStepDone(steps[i])) return false;
    }
    return true;
  }

  /** Monotonic: progress never decreases, so replaying cannot rewind a stage. */
  advance(step: string, amount: number): number {
    if (!this.isStepUnlocked(step)) return this.stepProgress(step);
    return this.setProgress(step, this.stepProgress(step) + amount);
  }

  setProgress(step: string, value: number): number {
    const stage = this.stage;
    const prev = this.progress[stage][step] ?? 0;
    const next = clamp01(Math.max(prev, value));
    if (next === prev) return prev;
    this.progress[stage][step] = next;
    this.emit({ type: 'stepProgress', stage, step, progress: next });
    if (prev < 1 && next >= 1) {
      this.mastery[step] = (this.mastery[step] ?? 0) + 1;
      this.emit({ type: 'stepComplete', stage, step });
      if (this.step === null && this.phase === 'task') this.enterFreeplay();
    }
    return next;
  }

  masteryOf(step: string): number {
    return this.mastery[step] ?? 0;
  }

  private enterFreeplay(): void {
    this.phase = 'freeplay';
    this.emit({ type: 'phase', stage: this.stage, phase: this.phase });
  }

  /** Stage progress 0..1 for the ambient progress ring. */
  get stageProgress(): number {
    const steps = STAGE_STEPS[this.stage];
    let total = 0;
    for (const s of steps) total += this.stepProgress(s);
    return total / steps.length;
  }

  get canAdvanceStage(): boolean {
    return this.phase === 'freeplay';
  }

  /** Moves to the next stage, or wraps to a fresh loop of the whole game. */
  nextStage(): StageId {
    const idx = STAGE_ORDER.indexOf(this.stage);
    const from = this.stage;
    if (idx >= STAGE_ORDER.length - 1) {
      this.loops += 1;
      this.emit({ type: 'loopComplete', loops: this.loops });
      this.resetProgress();
      this.stage = STAGE_ORDER[0];
    } else {
      this.stage = STAGE_ORDER[idx + 1];
    }
    this.phase = 'task';
    this.emit({ type: 'stageChange', from, to: this.stage, loop: this.loops });
    this.emit({ type: 'phase', stage: this.stage, phase: this.phase });
    return this.stage;
  }

  /** Clears step progress but keeps mastery, so hints stay quiet on replays. */
  resetProgress(): void {
    for (const stage of STAGE_ORDER) {
      for (const step of STAGE_STEPS[stage]) this.progress[stage][step] = 0;
    }
  }

  snapshot(): GameSnapshot {
    return {
      version: VERSION,
      stage: this.stage,
      phase: this.phase,
      loops: this.loops,
      progress: JSON.parse(JSON.stringify(this.progress)),
      mastery: { ...this.mastery },
    };
  }

  restore(snap: GameSnapshot): void {
    if (snap.version !== VERSION) return;
    this.stage = STAGE_ORDER.includes(snap.stage) ? snap.stage : 'orchard';
    this.loops = snap.loops ?? 0;
    for (const stage of STAGE_ORDER) {
      for (const step of STAGE_STEPS[stage]) {
        this.progress[stage][step] = clamp01(snap.progress?.[stage]?.[step] ?? 0);
      }
    }
    for (const k of Object.keys(snap.mastery ?? {})) this.mastery[k] = snap.mastery[k];
    this.phase = this.step === null ? 'freeplay' : 'task';
  }
}

const STORE_KEY = 'ume.progress.v3';

export function loadSnapshot(storage?: Storage): GameSnapshot | null {
  try {
    const s = storage ?? globalThis.sessionStorage;
    const raw = s?.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as GameSnapshot) : null;
  } catch {
    return null;
  }
}

export function saveSnapshot(snap: GameSnapshot, storage?: Storage): void {
  try {
    const s = storage ?? globalThis.sessionStorage;
    s?.setItem(STORE_KEY, JSON.stringify(snap));
  } catch {
    /* private mode / disabled storage: progress simply lives in memory */
  }
}
