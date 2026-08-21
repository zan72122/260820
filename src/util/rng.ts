/** mulberry32: シード付き決定論PRNG。摩耗・汚れ・個体差は全てここから引く。 */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** [min, max) の一様乱数 */
export function uniform(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}

/** 平均0・おおよそ正規（Irwin–Hall近似, n=6） */
export function gaussish(rng: Rng): number {
  let s = 0;
  for (let i = 0; i < 6; i++) s += rng();
  return (s - 3) / 1.5;
}
