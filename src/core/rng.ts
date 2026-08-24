/**
 * Deterministic small PRNG (mulberry32).
 * Every procedural texture, wear pattern and synthesised heart-sound component
 * is generated from a fixed seed so the experience is identical on every run.
 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Value noise in 1D, useful for gentle organic variation (tube sag, wear). */
export function valueNoise1D(seed: number, samples = 256): (x: number) => number {
  const rng = makeRng(seed);
  const table = new Float32Array(samples);
  for (let i = 0; i < samples; i++) table[i] = rng() * 2 - 1;
  return (x: number) => {
    const t = ((x % samples) + samples) % samples;
    const i0 = Math.floor(t);
    const i1 = (i0 + 1) % samples;
    const f = t - i0;
    const s = f * f * (3 - 2 * f);
    return table[i0] * (1 - s) + table[i1] * s;
  };
}
