import './style.css';
import { Game } from './core/Game';

const params = new URLSearchParams(location.search);
const fast = params.get('fast') === '1' || params.get('e2e') === '1';

const canvas = document.getElementById('stage') as HTMLCanvasElement | null;
const ui = document.getElementById('ui');
const boot = document.getElementById('boot');

if (!canvas || !ui) {
  throw new Error('stage missing');
}

const bootStart = performance.now();
const game = new Game(canvas, ui, { fast });
const bootMs = performance.now() - bootStart;
game.start();

// Deterministic surface for the smoke test. Never used by the game itself.
declare global {
  interface Window {
    __wb?: ReturnType<Game['debugApi']> & { bootMs: () => number };
  }
}
window.__wb = { ...game.debugApi(), bootMs: () => bootMs };

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    boot?.classList.add('hidden');
    window.setTimeout(() => boot?.remove(), 900);
  });
});
