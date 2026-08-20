// 小さな数学ユーティリティ。外部依存なし。
export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : clamp((v - a) / (b - a), 0, 1));
export const smoothstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInOutCubic = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

// フレームレート非依存の指数追従。
export const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));

// 決定的な擬似乱数（テストと「同じ河川敷」の再現のため）。
export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function rng() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
export const rngRange = (rng, a, b) => a + (b - a) * rng();
export const rngPick = (rng, arr) => arr[(rng() * arr.length) | 0];

// HSL -> RGB(0..255)。花火の色づくりに使う。
export function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

export const rgbStr = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
