import { App, type DebugApi } from './core/App';
import type { QualityTier } from './core/Quality';
import type { StageId } from './core/GameState';

declare global {
  interface Window {
    __ume?: DebugApi;
  }
}

const params = new URLSearchParams(location.search);
const fast = params.get('fast') === '1' || params.get('e2e') === '1';
// Manual mode hands the clock to the test runner: no requestAnimationFrame,
// so a software rasteriser only ever draws the frames a test asks for.
const manual = params.get('manual') === '1';
const qualityParam = params.get('quality');
const stageParam = params.get('stage');

const quality: QualityTier | null =
  qualityParam === 'low' || qualityParam === 'balanced' || qualityParam === 'high'
    ? qualityParam
    : null;
const stage: StageId | null =
  stageParam === 'orchard' || stageParam === 'pickling' || stageParam === 'drying'
    ? stageParam
    : null;

function fail(err: unknown): void {
  const box = document.getElementById('err');
  if (!box) return;
  box.style.display = 'grid';
  box.textContent =
    'WebGL を初期化できませんでした / could not start WebGL\n\n' +
    (err instanceof Error ? `${err.name}: ${err.message}` : String(err));
  document.getElementById('boot')?.classList.add('gone');
}

function boot(): void {
  const canvas = document.getElementById('gl') as HTMLCanvasElement | null;
  const uiHost = document.getElementById('ui');
  if (!canvas || !uiHost) return;

  let app: App;
  try {
    app = new App({ canvas, uiHost, fast, forcedQuality: quality, startStage: stage });
  } catch (err) {
    fail(err);
    return;
  }

  window.__ume = app.debugApi();

  // One frame before revealing, so the first thing seen is the finished world.
  app.step(1 / 60);
  if (!manual) app.start();
  requestAnimationFrame(() => {
    document.getElementById('boot')?.classList.add('gone');
  });

  window.addEventListener('error', (e) => {
    if (e.error) console.error(e.error);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
