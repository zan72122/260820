import { App } from './core/App.js';

const canvas = document.getElementById('stage');
const veil = document.getElementById('veil');
const fallback = document.getElementById('fallback');

const app = new App(canvas);

if (app.failed) {
  veil.classList.add('gone');
  fallback.classList.add('show');
} else {
  app.start();
  // Hold the veil for two frames so the first thing the child sees is a
  // finished picture of a festival, not a half-built one.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      veil.classList.add('gone');
      setTimeout(() => veil.remove(), 1100);
    })
  );
}

/**
 * Test surface. Kept small and stable: automated runs need to drive one
 * finger, advance the clock deterministically, and read the state of the
 * paper and the fish.
 */
window.__KINGYO__ = {
  app,
  get ready() {
    return !app.failed && !!app.game;
  },
  snapshot: () => (app.game ? app.game.snapshot() : null),
  /** @param {{x:number,y:number,down:boolean}|null} cmd CSS pixels */
  drive: (cmd) => app.input && app.input.script(cmd),
  /** @param {number} seconds */
  advance: (seconds, render = false) => app.advance(seconds, render),
  aim: (x, z) => (app.game ? app.game.aimScreen(x, z) : null),
  pause: () => app.stop(),
  resume: () => app.start(),
  tier: () => app.tier,
  renderInfo: () => (app.renderer ? { ...app.renderer.info.render } : null),
};
