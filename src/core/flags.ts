/**
 * Runtime switches. `?fast=1` (or E2E_FAST at build time) trades visual polish
 * for a deterministic, software-renderer-friendly frame: it is what the Chromium
 * smoke test runs under, and it is never used to judge look or FPS.
 */
const params = new URLSearchParams(
  typeof location !== 'undefined' ? location.search : '',
)

const envFast =
  typeof import.meta !== 'undefined' &&
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_E2E_FAST === '1'

export const FAST = params.get('fast') === '1' || !!envFast

/** Fixed seed keeps candy colours/shapes reproducible for tests. */
export const SEED = params.has('seed') ? Number(params.get('seed')) || 1 : 0

export const MAX_PIXEL_RATIO = FAST ? 1 : 2

export const DEBUG = params.get('debug') === '1'
