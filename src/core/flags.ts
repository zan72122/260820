/**
 * Runtime flags, parsed once from the URL. `e2eFast` implements the
 * CLAUDE.md E2E_FAST profile: DPR 1, reduced canvas, no nonessential
 * shadows/particles, fixed seed, deterministic stepping via the test seam.
 */
export interface Flags {
  /** Reduced-cost deterministic profile for headless/SwiftShader E2E runs. */
  e2eFast: boolean
  /** Install window.__game test seam (implied by e2eFast). */
  test: boolean
  /** World seed. */
  seed: number
  /** Debug helpers, e.g. 'shadow' shows the sun shadow frustum. */
  debug: string | null
}

export const DEFAULT_SEED = 42

export function readFlags(search: string): Flags {
  const q = new URLSearchParams(search)
  const e2eFast = q.get('e2efast') === '1'
  const seedRaw = Number.parseInt(q.get('seed') ?? '', 10)
  return {
    e2eFast,
    test: e2eFast || q.get('test') === '1',
    seed: Number.isFinite(seedRaw) ? seedRaw >>> 0 : DEFAULT_SEED,
    debug: q.get('debug'),
  }
}
