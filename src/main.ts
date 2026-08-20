/**
 * Boot: build the game, bake what has to be baked, then run a clamped frame loop that
 * survives tab switches and orientation changes.
 */

import { Game, type StageName } from './game/Game';

const canvas = document.getElementById('scene') as HTMLCanvasElement | null;
const boot = document.getElementById('boot');
const bootSub = boot?.querySelector('.boot-sub') as HTMLElement | null;

function fail(message: string): void {
  if (boot) {
    boot.classList.remove('gone');
    const sub = boot.querySelector('.boot-sub');
    if (sub) sub.textContent = message;
  }
}

async function main(): Promise<void> {
  if (!canvas) {
    fail('がめんが みつかりません');
    return;
  }

  let game: Game;
  try {
    game = new Game(canvas);
  } catch (err) {
    console.error(err);
    fail('この ブラウザでは WebGL 2 が つかえません');
    return;
  }

  await game.prepare((t) => {
    if (bootSub) bootSub.textContent = `よみこみちゅう… ${Math.round(t * 100)}%`;
  });

  boot?.classList.add('gone');
  window.setTimeout(() => boot?.remove(), 900);

  const jump = new URLSearchParams(location.search).get('stage');
  if (jump) game.jumpTo(jump as StageName);

  let last = performance.now();
  const loop = (now: number): void => {
    // returning from a background tab must not deliver one enormous delta
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    game.tick(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) last = performance.now();
  });

  // exposed for the end-to-end tests only
  (window as unknown as { __nebuta: Game }).__nebuta = game;
}

void main();
