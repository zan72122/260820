import { Game } from './game/Game';
import { Phase } from './game/state';

const app = document.getElementById('app')!;
const ui = document.getElementById('ui')!;

const game = new Game(app, ui);
game.start();

/**
 * Deterministic driver for automated tests. Each call performs the same
 * state mutations as the corresponding touch gesture.
 */
interface LFDriver {
  phase(): string;
  letter(): string;
  fill(): number;
  temp(): number;
  press(): number;
  islands(): number;
  errors(): string[];
  align(): void;
  pressDown(): void;
  leverUp(): void;
  brushAll(): void;
  pourAll(): void;
  openFlask(): void;
  pick(letter: string): void;
}

const driver: LFDriver = {
  phase: () => game.phase,
  letter: () => game.letter,
  fill: () => game.fill,
  temp: () => game.temp,
  press: () => game.sand.press,
  islands: () => game.glyph.counterCount,
  errors: () => game.errors.slice(),
  align: () => game.setCarriage(0.04),
  pressDown: () => {
    // walk the lever down the way a drag would
    for (let v = 0; v <= 1.001; v += 0.05) game.setLever(v);
  },
  leverUp: () => {
    for (let v = 1; v >= -0.001; v -= 0.05) game.setLever(v);
  },
  brushAll: () => game.sweepAll(),
  pourAll: () => game.setPourHeld(true),
  openFlask: () => game.setFlaskOpen(1),
  pick: (letter: string) => {
    if (game.phase === Phase.DONE) game.startCycle(letter);
  },
};

(window as unknown as { __LF: LFDriver }).__LF = driver;
