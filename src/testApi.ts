/**
 * Deterministic test hooks (window.__lab). E2E drives the whole loop with
 * these instead of guessing at pixels; logical time can be stepped
 * directly, which also satisfies the E2E_FAST policy.
 */
import type { Game } from './game';

export interface LabApi {
  version: string;
  currentStation(): string;
  completed(): Record<string, boolean>;
  freeMode(): boolean;
  setAxis(v: number): void;
  getAxis(): number;
  pullLever(): boolean;
  loadBall(kind: 'rubber' | 'wood' | 'steel'): void;
  gotoStation(i: number): void;
  ballStatus(): string;
  ballPosition(): { x: number; y: number; z: number } | null;
  measure(): Record<string, number>;
  /** css-pixel screen position of a physical control */
  screenPos(kind: 'handle' | 'lever'): { x: number; y: number };
  step(seconds: number): void;
  errors: string[];
}

export function installTestApi(game: Game): LabApi {
  const errors: string[] = [];
  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
    origError(...args);
  };
  window.addEventListener('error', (e) => errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));

  const api: LabApi = {
    version: '1.0.0',
    currentStation: () => game.station.id,
    completed: () => ({ ...game.completed }),
    freeMode: () => game.freeMode,
    setAxis: (v) => game.station.setAxis(v),
    getAxis: () => game.station.getAxis(),
    pullLever: () => game.station.pullLever(),
    loadBall: (kind) => game.station.loadBall(kind),
    gotoStation: (i) => game.goToStation(i),
    ballStatus: () => game.station.ballStatus,
    ballPosition: () => {
      const b = game.station.ball;
      if (!b) return null;
      return { x: b.position.x, y: b.position.y, z: b.position.z };
    },
    measure: () => game.station.measure(),
    screenPos: (kind) => {
      const world = game.station.controlWorldPos(kind);
      const v = world.project(game.rig.camera);
      return {
        x: ((v.x + 1) / 2) * window.innerWidth,
        y: ((1 - v.y) / 2) * window.innerHeight,
      };
    },
    step: (seconds) => {
      const dt = 1 / 60;
      let t = 0;
      while (t < seconds) {
        game.update(dt);
        t += dt;
      }
    },
    errors,
  };
  (window as unknown as { __lab: LabApi }).__lab = api;
  return api;
}
