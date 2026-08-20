import { Game, STATES } from './game/Game.js';
import { SHOTS } from './game/CameraRig.js';

const host = document.getElementById('app');
const veil = document.getElementById('veil');
const boot = document.getElementById('boot');
const startBtn = document.getElementById('startbtn');
const again = document.getElementById('again');
const errBox = document.getElementById('err');

function fail(e) {
  console.error(e);
  errBox.style.display = 'block';
  errBox.textContent = 'うまく はじめられませんでした\n\n' + (e && (e.stack || e.message) || e);
  boot.classList.add('gone');
}
window.addEventListener('error', (e) => fail(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => fail(e.reason));

let game = null;

function build() {
  game = new Game(host);
  window.__game = game;
  window.__SHOTS = SHOTS;
  // one silent frame so every shader is compiled before the shop is captured
  game.renderer.compile(game.scene, game.camera);
  game.captureEnvironment();
  game.update(1 / 60);
  game.render();

  game.onState = (s) => {
    document.body.dataset.state = s;
    if (s === STATES.FINISH) setTimeout(() => again.classList.add('show'), 1700);
    else again.classList.remove('show');
  };

  // A phone that loses its GL context (backgrounded, memory pressure) otherwise
  // just goes black; asking for a restore and starting over is far better.
  const canvas = game.renderer.domElement;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); }, false);
  canvas.addEventListener('webglcontextrestored', () => location.reload(), false);

  let last = performance.now();
  const loop = (now) => {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000;
    last = now;
    if (document.hidden) return;                 // no work while backgrounded
    const t0 = performance.now();
    if (!(dt > 0)) dt = 1 / 60;
    dt = Math.min(dt, 1 / 20);
    game.update(dt);
    game.render();
    game.measure(performance.now() - t0);
  };
  requestAnimationFrame(loop);
  window.__ready = true;
}

// Textures are baked on the main thread, so give the veil a frame to paint first.
requestAnimationFrame(() => requestAnimationFrame(() => {
  try {
    build();
    boot.classList.add('gone');
  } catch (e) { fail(e); }
}));

const start = async () => {
  veil.classList.add('gone');
  try { await game.audio.unlock(); } catch (e) { /* audio is optional */ }
};
startBtn.addEventListener('click', start);
startBtn.addEventListener('touchend', (e) => { e.preventDefault(); start(); }, { passive: false });

again.addEventListener('click', () => {
  again.classList.remove('show');
  game.serveAnother();
});

document.addEventListener('visibilitychange', () => {
  if (game) game.audio.setMuted(document.hidden);
});
