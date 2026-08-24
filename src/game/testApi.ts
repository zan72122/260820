import { Game } from './Game';
import { Vec2 } from '../sim/types';
import { Prediction } from '../render/PredictionMarker';

/**
 * ブラウザ試験・E2E 用の決定的フック。
 * ?e2e=1 のとき RAF はシミュレーションを進めず、step() でのみ進む。
 * 判定ロジック自体はゲームと同一コードを通る。
 */
export interface TestApi {
  step(seconds: number): void;
  phase(): string;
  doorState(): string;
  doorPosition(): number;
  openedOnce(): boolean;
  depth(): number;
  farWidth(): number;
  setDepth(d: number): void;
  setFarWidth(w: number): void;
  lensOpen(): boolean;
  openLens(): void;
  closeLens(): void;
  startGame(): void;
  submitPath(index: number, pts: Vec2[]): boolean;
  placeMarker(k: Prediction): void;
  pullLever(): void;
  clickNext(): void;
  clickRetry(): void;
  actorPositions(): { id: string; x: number; z: number; finished: boolean }[];
  trialIndex(): number;
  lastResult(): unknown;
  activationCellCount(): number;
  hotCellCount(): number;
  curtainOccupied(): boolean;
  trailCount(): number;
  pathVisible(index: number): boolean;
  diagnosticsShown(): boolean;
  screenOfFloor(x: number, z: number): { x: number; y: number };
  screenOfRing(): { x: number; y: number };
  lensScreen(): { x: number; y: number };
}

declare global {
  interface Window {
    __game?: TestApi;
  }
}

export function installTestApi(game: Game): void {
  const api: TestApi = {
    step(seconds: number): void {
      const dt = 1 / 60;
      const n = Math.max(1, Math.round(seconds / dt));
      for (let i = 0; i < n; i++) game.stepSim(dt);
      // 1回だけ描画して見た目も追従させる
      game.frame(0);
    },
    phase: () => game.phase,
    doorState: () => game.doorSys.door.state,
    doorPosition: () => game.doorSys.door.position,
    openedOnce: () => game.doorSys.door.openedOnce,
    depth: () => game.doorSys.activation.params.depth,
    farWidth: () => game.doorSys.activation.params.farWidth,
    setDepth: (d) => game.setDepth(d),
    setFarWidth: (w) => game.setFarWidth(w),
    lensOpen: () => game.lensOpen,
    openLens: () => game.openLens(),
    closeLens: () => game.closeLens(),
    startGame: () => game.start(),
    submitPath: (i, pts) => game.submitPath(i, pts),
    placeMarker: (k) => game.placeMarker(k),
    pullLever: () => game.pullLever(),
    clickNext: () => {
      (game as unknown as { flags: { next: boolean } }).flags.next = true;
    },
    clickRetry: () => {
      (game as unknown as { flags: { retry: boolean } }).flags.retry = true;
    },
    actorPositions: () =>
      (game as unknown as { entries: { actor: { id: string; pos: Vec2; finished: boolean } }[] }).entries.map(
        (e) => ({
          id: e.actor.id,
          x: e.actor.pos.x,
          z: e.actor.pos.z,
          finished: e.actor.finished,
        }),
      ),
    trialIndex: () => game.trialIndex,
    lastResult: () => game.lastResult,
    activationCellCount: () => game.doorSys.activation.cells.length,
    hotCellCount: () => game.doorSys.activation.cells.filter((c) => c.hot > 0.3).length,
    curtainOccupied: () => game.doorSys.curtain.occupied,
    trailCount: () =>
      (game.overlay as unknown as { trails: Map<string, unknown> }).trails.size,
    pathVisible: (i) =>
      (game as unknown as { entries: { ribbon: { mesh: { visible: boolean } } }[] }).entries[i]
        ?.ribbon.mesh.visible ?? false,
    diagnosticsShown: () => game.overlay.shown,
    screenOfFloor: (x, z) => game.screenOfFloor(x, z),
    screenOfRing: () => game.screenOfRing(),
    lensScreen: () =>
      (game as unknown as { lensScreenPos(): { x: number; y: number } }).lensScreenPos(),
  };
  window.__game = api;
}
