/**
 * 実行フラグ。E2E/CI では `?fast=1&seed=N` で起動する。
 * fast: 低解像度・影/高負荷表現オフ・手動シミュレーション（テストが論理時間を進める）。
 */
export interface Flags {
  fast: boolean;
  seed: number;
}

export function readFlags(search: string = location.search): Flags {
  const p = new URLSearchParams(search);
  const seedRaw = p.get('seed');
  return {
    fast: p.get('fast') === '1',
    seed: seedRaw !== null && Number.isFinite(Number(seedRaw)) ? Number(seedRaw) : 20260821,
  };
}
