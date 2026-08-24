import { Game } from './game/Game';
import { installTestApi } from './game/testApi';

const params = new URLSearchParams(location.search);
const fast = params.get('fast') === '1' || params.get('E2E_FAST') === '1';
const manualStep = params.get('e2e') === '1';

const container = document.getElementById('app')!;
const game = new Game(container, { fast, manualStep });

installTestApi(game);

let last = performance.now();
function loop(now: number): void {
  const dt = (now - last) / 1000;
  last = now;
  game.frame(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
