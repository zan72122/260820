/**
 * Cloud CI has no GPU: Chromium falls back to SwiftShader, where full
 * resolution and shadow maps make an automated play-through impossible.
 * `?fast=1` trades pixels for a runnable frame rate. It changes nothing
 * about the simulation, only how much of it is drawn.
 */
const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const fast = params.get('fast') === '1';

export const perf = {
  fast,
  antialias: !fast,
  /** Hard cap on renderer pixel ratio. */
  pixelRatioCap: fast ? 0.55 : 2,
  shadowSize: fast ? 1024 : 1536,
  /** Multiplier on background crop density. */
  foliage: fast ? 0.4 : 1,
  treeCount: fast ? 60 : 150,
};
