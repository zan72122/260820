import './style.css';
import { Game } from './game';

interface TestApi {
  ready: boolean;
  errors: string[];
  state: () => ReturnType<Game['snapshot']>;
  advance: (ms: number, step?: number, render?: boolean) => void;
  autoPipe: () => void;
  autoBake: (amount?: number) => void;
  autoCut: () => void;
  forcePhase: (p: Parameters<Game['forcePhase']>[0]) => void;
  game: Game | null;
}

const errors: string[] = [];
const api: TestApi = {
  ready: false,
  errors,
  state: () => ({}) as ReturnType<Game['snapshot']>,
  advance: () => {},
  autoPipe: () => {},
  autoBake: () => {},
  autoCut: () => {},
  forcePhase: () => {},
  game: null,
};
(window as unknown as { __ba: TestApi }).__ba = api;

window.addEventListener('error', (e) => {
  errors.push(String(e.message ?? e));
});
window.addEventListener('unhandledrejection', (e) => {
  errors.push(String((e as PromiseRejectionEvent).reason));
});

function fail(message: string): void {
  errors.push(message);
  const boot = document.getElementById('boot-hint');
  if (boot) boot.textContent = message;
}

function boot(): void {
  const canvas = document.getElementById('stage') as HTMLCanvasElement | null;
  const hudRoot = document.getElementById('hud');
  if (!canvas || !hudRoot) {
    fail('画面を準備できませんでした。');
    return;
  }

  let game: Game;
  try {
    game = new Game(canvas, hudRoot);
  } catch (err) {
    console.error(err);
    fail('このブラウザでは WebGL を利用できません。');
    return;
  }

  api.game = game;
  api.state = () => game.snapshot();
  api.advance = (ms, step, render) => game.advance(ms, step, render);
  api.autoPipe = () => game.autoPipe();
  api.autoBake = (amount) => game.autoBake(amount);
  api.autoCut = () => game.autoCut();
  api.forcePhase = (p) => game.forcePhase(p);

  game.start();
  api.ready = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') game.start();
    else game.stop();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
