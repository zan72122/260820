import { Game } from './game/game';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const overlay = document.getElementById('overlay') as HTMLCanvasElement;
const replay = document.getElementById('replay') as HTMLButtonElement;
const boot = document.getElementById('boot') as HTMLDivElement;

function viewport(): { w: number; h: number } {
  const vv = window.visualViewport;
  return {
    w: Math.max(1, Math.round(vv?.width ?? window.innerWidth)),
    h: Math.max(1, Math.round(vv?.height ?? window.innerHeight)),
  };
}

let game: Game;
try {
  game = new Game(canvas, overlay, replay);
} catch (err) {
  boot.textContent = 'WebGL unavailable';
  throw err;
}

function applySize(): void {
  const { w, h } = viewport();
  game.resize(w, h);
}
applySize();

// An orientation change is a reframe, never a restart: the weaving is world-space
// geometry, so it is still exactly where it was when the phone turns.
let resizeTimer = 0;
const onResize = (): void => {
  window.clearTimeout(resizeTimer);
  applySize();
  resizeTimer = window.setTimeout(applySize, 220);
};
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);
window.visualViewport?.addEventListener('resize', onResize);

document.addEventListener('visibilitychange', () => game.setHidden(document.hidden));

let last = performance.now();
let booted = false;

function frame(now: number): void {
  requestAnimationFrame(frame);
  const raw = now - last;
  const dt = Math.min(0.1, raw / 1000);
  last = now;
  if (document.hidden) return;

  game.step(dt);
  game.render();
  // The frame interval, not the JS work time: GPU cost lands after render()
  // returns, so only the gap between callbacks reflects what the phone is doing.
  game.watchPerformance(raw);

  if (!booted) {
    booted = true;
    boot.classList.add('gone');
    window.setTimeout(() => boot.remove(), 1000);
  }
}
requestAnimationFrame(frame);
