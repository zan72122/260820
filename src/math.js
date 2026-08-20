// 小さな数学ユーティリティ
export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const smootherstep = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInCubic = (t) => Math.pow(clamp(t, 0, 1), 3);
export const easeInOut = (t) => smootherstep(t);
// 0→1→0 の山
export const bump = (t) => { t = clamp(t, 0, 1); return Math.sin(t * Math.PI); };

/** 区間 [a,b] を 0→1 に正規化して smoothstep */
export const ramp = (v, a, b) => smoothstep(invLerp(a, b, v));

/** クリティカルダンプのばね。カメラのなめらかな追従に使う（カットを作らないため） */
export function spring(cur, vel, target, omega, dt) {
  // 半陰解法：dt が大きくても発散しない
  const f = 1 + 2 * dt * omega;
  const oo = omega * omega;
  const hoo = dt * oo;
  const hhoo = dt * hoo;
  const det = 1 / (f + hhoo);
  const detX = (cur * f + vel * dt + target * hhoo) * det;
  const detV = (vel + (target - cur) * hoo) * det;
  return [detX, detV];
}

/** 値ノイズ（決定的・軽量）。煙や水面のゆらぎに使う */
export function hash1(n) {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}
export function noise1(x) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash1(i), hash1(i + 1), u) * 2 - 1;
}
export function fbm1(x, oct = 3) {
  let a = 0.5, s = 0, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise1(x * f); f *= 2.03; a *= 0.5; }
  return s;
}
