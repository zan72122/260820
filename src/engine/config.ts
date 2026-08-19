/** Runtime knobs. Tests drive these through the query string. */
const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');

export const Config = {
  /** `?fast=1` — the cheap deterministic profile used by headless E2E (SwiftShader). */
  fast: params.get('fast') === '1',
  /** `?seed=123` — fixes every random flower detail so runs are reproducible. */
  seed: params.has('seed') ? Number(params.get('seed')) : Math.floor(Math.random() * 1e9),
  /** `?lowres=1` — full materials at half resolution, for slow software GL. */
  lowres: params.get('lowres') === '1',
  /** `?debug=1` — draws the raycast work plane and prints state changes. */
  debug: params.get('debug') === '1',
  /** How far above the fingertip the piping tip is drawn, in CSS pixels. */
  tipLiftPx: 56,
} as const;

export const maxPixelRatio = () => (Config.fast ? 1 : 2);
