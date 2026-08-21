/** Runtime flags read once from the query string. */

const params = new URLSearchParams(
  typeof location === 'undefined' ? '' : location.search,
);

const flag = (name: string): boolean => {
  const v = params.get(name);
  return v !== null && v !== '0' && v !== 'false';
};

export const settings = {
  /** Lean rendering profile used by automated smoke runs and very weak devices. */
  fast: flag('fast'),
  /** Exposes `window.__sd` so an automated browser pass can read game state. */
  e2e: flag('e2e'),
  /** Deterministic defect ordering. */
  seed: Number(params.get('seed') ?? 0) || 0,
  /** Shortens cinematic holds so a full loop can be verified quickly. */
  turbo: flag('turbo'),
};

export type QualityTier = 0 | 1 | 2;
