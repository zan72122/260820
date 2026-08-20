/**
 * Bootstrap: renderer loop, lifecycle, and the deterministic hooks used by the
 * automated smoke run.
 */
import { Game } from './game.js';
import { GameAudio, WORD_TEXT } from './audio.js';
import { TouchControls } from './input.js';
import { UI } from './ui.js';
import { pickQuality } from './quality.js';

const canvas = document.getElementById('view');
const ui = new UI();
const audio = new GameAudio();
const quality = pickQuality();

const game = new Game({ canvas, audio, ui, quality });

let controls = null;
let last = performance.now();
let running = false;
let manualTime = false;       // automated runs drive the clock themselves

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (!manualTime) {
    if (running) game.update(dt);
    game.render(dt);
  }
}

function tick(dt) {
  game.update(dt);
  game.render(dt);
}

async function boot() {
  await game.init();

  controls = new TouchControls(canvas, {
    onTurn: (d) => game.turn(d),
    onStep: (p) => game.step(p),
    onStrike: (p) => game.strike(p),
    onStrikeTooEarly: () => game.strikeTooEarly(),
  });
  controls.enabled = false;
  game.controls = controls;

  window.addEventListener('resize', () => game.resize());
  window.addEventListener('orientationchange', () => setTimeout(() => game.resize(), 250));
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => game.resize());
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { audio.suspend(); running = false; }
    else { audio.resume(); if (game.phase !== 'intro') running = true; last = performance.now(); }
  });

  ui.ready();
  requestAnimationFrame(frame);

  ui.startBtn.addEventListener('click', async () => {
    // iOS needs the AudioContext created inside the gesture handler
    await audio.unlock();
    ui.hideStart();
    controls.enabled = true;
    running = true;
    last = performance.now();
    game.start();
  }, { once: true });

  ui.againBtn.addEventListener('click', () => {
    ui.againEl.classList.add('hidden');
    game.replay();
  });

  // ---- hooks for the automated smoke run -------------------------------
  window.__suika = {
    game, audio, controls, quality, WORD_TEXT,
    /** Start without the audio unlock (headless runs have no gesture). */
    begin() {
      ui.startEl.classList.add('hidden');
      controls.enabled = true;
      running = true;
      last = performance.now();
      game.start();
    },
    /**
     * Advance logical simulation time directly, in fixed steps. Only the final
     * step is rendered — under a software rasteriser drawing every intermediate
     * frame costs minutes and tells us nothing.
     */
    advance(seconds, step = 1 / 60) {
      manualTime = true;
      running = false;
      let left = seconds;
      while (left > step) { game.update(step); left -= step; }
      tick(Math.max(1 / 240, left));
    },
    resume() { manualTime = false; running = true; last = performance.now(); },
    turn(d) { game.turn(d); },
    step(p = 1) { game.step(p); },
    strike() { controls.allowStrike = true; game.strike(1); },
    state() { return game.debugState(); },
  };
  document.body.dataset.ready = '1';
}

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById('loading');
  if (el) el.innerHTML = '<div style="padding:24px;text-align:center;line-height:1.9">'
    + 'ごめんなさい、このブラウザでは うごきませんでした。<br><small>' + String(err) + '</small></div>';
});
