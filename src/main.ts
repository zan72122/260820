import { Game } from './game/Game';
import { SHEAR_Y } from './core/config';

const params = new URLSearchParams(location.search);
const e2e = params.get('e2e') === '1';
const keepIntro = params.get('intro') === '1';

const container = document.getElementById('app');
if (!container) throw new Error('missing #app');

const game = new Game(container, e2e, e2e && !keepIntro);

/**
 * Deterministic test surface (also handy from a desktop console).
 * Everything here reads or drives the same deterministic model the game
 * itself runs on — no test-only physics.
 */
export interface PinForestHooks {
  state(): string;
  depth(): number;
  setDepth(d: number): void;
  boundaries(): number[];
  aligned(): boolean;
  plugAngle(): number;
  boltProgress(): number;
  doorAngle(): number;
  keyIndex(): number;
  playCount(): number;
  selectKey(i: number): void;
  rotateTo(rad: number): void;
  pullDoor(): void;
  advance(seconds: number): void;
  skipCinematic(): void;
  freePlay(): void;
  returnKey(): void;
  reset(): void;
  shearY: number;
  ready: boolean;
}

const hooks: PinForestHooks = {
  state: () => game.gs.state,
  depth: () => game.rail.depth,
  setDepth: (d) => game.hookSetDepth(d),
  boundaries: () => game.rig.boundaryOffsets(),
  aligned: () => game.rig.isAligned(),
  plugAngle: () => game.mech.plugAngle,
  boltProgress: () => game.mech.boltProgress,
  doorAngle: () => game.gs.doorAngle,
  keyIndex: () => game.gs.keyIndex,
  playCount: () => game.gs.playCount,
  selectKey: (i) => game.selectKey(i),
  rotateTo: (rad) => game.hookRotate(rad),
  pullDoor: () => game.hookPullDoor(),
  advance: (s) => game.hookAdvance(s),
  skipCinematic: () => game.hookSkipCinematic(),
  freePlay: () => game.enterFreePlay(),
  returnKey: () => game.returnKeyToTray(),
  reset: () => game.hookReset(),
  shearY: SHEAR_Y,
  ready: true,
};

declare global {
  interface Window {
    __pinForest?: PinForestHooks;
  }
}
window.__pinForest = hooks;
