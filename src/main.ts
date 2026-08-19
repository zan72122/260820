import { Engine } from './core/engine';
import { UI } from './ui/ui';
import { Game } from './game/game';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

function fatal(msg: string) {
  let box = document.getElementById('fatal');
  if (!box) {
    box = document.createElement('div');
    box.id = 'fatal';
    document.getElementById('app')?.appendChild(box);
  }
  box.style.display = 'flex';
  box.innerHTML = `<div>おっと、うまく はじめられませんでした。</div><div style="opacity:.6;font-size:12px">${msg}</div>`;
}

try {
  const engine = new Engine(canvas);
  const ui = new UI(uiRoot);
  const game = new Game(engine, ui);

  // one warm frame so shaders compile before the child touches anything
  engine.render();
  ui.ready();

  let last = performance.now();
  let running = true;

  const loop = () => {
    requestAnimationFrame(loop);
    if (!running) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    engine.render();
  };
  requestAnimationFrame(loop);

  const onResize = () => {
    game.resize();
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => {
    // iOS reports the old size on the event itself
    setTimeout(onResize, 60);
    setTimeout(onResize, 320);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onResize);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
      game.pause();
    } else {
      running = true;
      last = performance.now();
      game.resumeAudio();
      onResize();
    }
  });

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    running = false;
    fatal('WebGL context lost');
  });
} catch (err) {
  console.error(err);
  fatal(err instanceof Error ? err.message : String(err));
}
