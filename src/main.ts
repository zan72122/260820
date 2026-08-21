import { Game } from './game/Game';

const params = new URLSearchParams(location.search);
const fast = params.get('fast') === '1' || (window as unknown as { __E2E_FAST?: boolean }).__E2E_FAST === true;

const app = document.getElementById('app')!;
const boot = document.getElementById('boot');

function fail(err: unknown) {
  // eslint-disable-next-line no-console
  console.error('[under-the-ridge]', err);
  if (boot) boot.classList.remove('gone');
}

if (params.get('inspect') === '1') {
  const { inspect } = await import('./inspect');
  inspect(app);
  boot?.classList.add('gone');
} else {
try {
  const game = new Game(app, fast);
  game.start();
  (window as unknown as { __ur: unknown }).__ur = {
    state: () => game.debugState(),
    mute: (m: boolean) => game.audio.setMuted(m),
  };
  requestAnimationFrame(() => boot?.classList.add('gone'));
} catch (err) {
  fail(err);
}
}
