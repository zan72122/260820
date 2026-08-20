import './style.css';
import { App } from './core/App';
import { Game } from './game/Game';
import type { QualityTier } from './core/Quality';
import { hashStringToSeed } from './core/Rand';
import type { StepName } from './game/types';

const params = new URLSearchParams(location.search);
const FAST = params.get('fast') === '1' || params.get('e2e') === '1';
const seedParam = params.get('seed');
const tierParam = params.get('q') as QualityTier | null;

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
const boot = document.getElementById('boot') as HTMLElement;
const bootFill = document.getElementById('boot-fill') as HTMLElement;

function fail(message: string): void {
  boot.classList.add('gone');
  const p = document.createElement('p');
  p.className = 'fallback';
  p.textContent = message;
  document.getElementById('app')?.appendChild(p);
}

function progress(v: number): void {
  bootFill.style.width = `${Math.round(v * 100)}%`;
}

async function main(): Promise<void> {
  progress(0.1);

  let app: App;
  try {
    app = new App(canvas, {
      fast: FAST,
      tier: tierParam && ['low', 'mid', 'high'].includes(tierParam) ? tierParam : undefined,
    });
  } catch (err) {
    console.error(err);
    fail('このブラウザでは WebGL2 が使えないため、ゲームを表示できません。'
       + '\nThis game needs WebGL2.');
    return;
  }
  progress(0.4);

  const seed = seedParam
    ? (/^\d+$/.test(seedParam) ? Number(seedParam) >>> 0 : hashStringToSeed(seedParam))
    : undefined;

  const game = new Game(app, ui, canvas, { seed, fast: FAST });
  progress(0.75);

  // Give the browser one frame to lay out before the first (expensive) compile.
  await new Promise((r) => requestAnimationFrame(r));
  app.resize();
  game.onResize(canvas.clientWidth, canvas.clientHeight, canvas.clientWidth / canvas.clientHeight);

  // Warm up every shader now, so the first crack never stalls on a compile.
  try {
    await app.renderer.compileAsync(app.scene, app.camera);
  } catch {
    /* compileAsync is best-effort */
  }
  progress(1);

  game.begin();
  app.start({
    onFrame: (dt) => game.frame(dt),
    onResize: (w, h, a) => game.onResize(w, h, a),
    onQualityChange: (q) => game.onQualityChange(q),
  });

  setTimeout(() => boot.classList.add('gone'), 120);
  setTimeout(() => boot.remove(), 900);

  // ---- automation / debugging surface -------------------------------------
  // Deterministic hooks so an E2E run can advance the game without having to
  // simulate a convincing human finger for a full minute.
  const api = {
    get step(): StepName { return game.stepName; },
    get quality() { return app.quality.tier; },
    get mud(): number { return game.ctx.geode.mud.refresh(); },
    get powder(): number { return game.ctx.geode.powderLeft; },
    get variety(): string { return game.ctx.geode.variety.id; },
    get seed(): number { return game.ctx.session.seed; },
    get shot(): string { return game.ctx.rig.shotName; },
    get open(): number { return game.ctx.geode.openAmount; },
    get choicesVisible(): boolean { return game.ctx.overlay.choicesVisible; },
    /** Where the stone currently is on screen, in CSS pixels. */
    get pos(): { x: number; y: number } { return game.ctx.toScreen(game.ctx.geode.root.position); },
    go(step: StepName) { game.ctx.go(step); },
    restart(s?: number) { game.restart(s ?? game.ctx.session.seed); },
    /** Wash off `amount` of the mud instantly. */
    scrub(amount = 1) {
      const g = game.ctx.geode;
      g.mud.fill(Math.max(0, g.mud.coverage - amount));
      g.wet.fill(Math.min(1, 0.2 + amount));
      g.mud.refresh(); g.wet.refresh();
    },
    sweep(amount = 1) {
      const g = game.ctx.geode;
      g.powderBottom.fill(Math.max(0, g.powderBottom.coverage - amount));
      g.powderTop.fill(Math.max(0, g.powderTop.coverage - amount));
      g.powderBottom.refresh(); g.powderTop.refresh();
    },
    tap(x?: number, y?: number) {
      const px = x ?? canvas.clientWidth * 0.5;
      const py = y ?? canvas.clientHeight * 0.5;
      game.ctx.input.simulate('down', px, py);
      game.frame(1 / 60);
      game.ctx.input.simulate('up', px, py);
      game.frame(1 / 60);
    },
    /** A gesture is only meaningful if the game gets to tick between samples. */
    drag(x0: number, y0: number, x1: number, y1: number, steps = 12) {
      game.ctx.input.simulate('down', x0, y0);
      game.frame(1 / 60);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        game.ctx.input.simulate('move', x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
        game.frame(1 / 60);
      }
      game.ctx.input.simulate('up', x1, y1);
      game.frame(1 / 60);
    },
    /** Scrub in a loop over the stone, the way a child actually washes it. */
    rub(cx: number, cy: number, rx = 46, ry = 34, laps = 3, samples = 24) {
      const total = laps * samples;
      game.ctx.input.simulate('down', cx + rx, cy);
      game.frame(1 / 60);
      for (let i = 1; i <= total; i++) {
        const a = (i / samples) * Math.PI * 2;
        game.ctx.input.simulate('move', cx + Math.cos(a) * rx, cy + Math.sin(a * 1.7) * ry);
        game.frame(1 / 60);
      }
      game.ctx.input.simulate('up', cx + rx, cy);
      game.frame(1 / 60);
    },
    frames(n = 1, dt = 1 / 60) {
      for (let i = 0; i < n; i++) game.frame(dt);
    },
  };
  (window as unknown as { __GEODE__: typeof api }).__GEODE__ = api;
}

main().catch((err) => {
  console.error(err);
  fail('読み込み中に問題が起きました。ページを再読み込みしてください。'
     + '\nSomething went wrong while loading.');
});
