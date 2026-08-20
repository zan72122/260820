import { App } from './core/app.js';

const canvas = document.getElementById('stage');
const veil = document.getElementById('veil');

// A few query flags, for tuning and for the browser tests. Nothing here is part
// of the game: with no parameters you get a dark garden and one small light.
const q = new URLSearchParams(globalThis.location?.search || '');
const options = {
  seed: q.has('seed') ? Number(q.get('seed')) : undefined,
  tier: q.get('tier') || undefined,
  muted: q.has('muted'),
  preserveDrawingBuffer: q.has('capture'),
  maxPixelRatio: q.has('dpr') ? Number(q.get('dpr')) : undefined,
  debugShaders: q.has('debug'),
  onFirstFrame: () => veil?.classList.add('lifted'),
};

const app = new App(canvas, options);
app.start();

if (q.has('seek')) app.seek(Number(q.get('seek')));

// Exposed for the Playwright smoke test, which drives time by hand so it never
// has to judge anything by wall clock.
globalThis.__senko = app;
