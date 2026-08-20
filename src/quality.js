// ---------------------------------------------------------------------------
// 端末に応じた描画予算。iPhone / iPad Safari を基準にする。
// ---------------------------------------------------------------------------

const params = new URLSearchParams(location.search);

export const FAST = params.get('fast') === '1' || !!window.__E2E_FAST;
// テストが論理時間を自分で進めたいとき（描画は 1 フレームずつ）
export const MANUAL = params.get('manual') === '1';

function detectTier() {
  if (FAST) return 'low';
  const dpr = window.devicePixelRatio || 1;
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const small = Math.min(window.innerWidth, window.innerHeight) < 420;
  if (mem <= 2 || cores <= 3) return 'low';
  if (small && dpr >= 3) return 'mid';
  return 'high';
}

const tier = params.get('tier') || detectTier();

const TABLE = {
  low:  { pixelRatio: 1.0,  bubbles: 420,  shadow: 0,    droplets: 48,  ice: 12,  lathe: 32, shadowMap: 512 },
  mid:  { pixelRatio: 1.6,  bubbles: 1000, shadow: 1024, droplets: 100, ice: 14, lathe: 44, shadowMap: 768 },
  high: { pixelRatio: 1.8,  bubbles: 1700, shadow: 1024, droplets: 150, ice: 18, lathe: 56, shadowMap: 1024 },
};

export const Q = { tier, ...TABLE[tier], fast: FAST };

/** 実測 FPS に応じて解像度を落とす（上げはしない） */
export function makeAdaptiveScaler(renderer, initialRatio) {
  let ratio = initialRatio;
  let acc = 0, frames = 0, cooldown = 2.0;
  return (dt) => {
    if (FAST) return;
    cooldown -= dt;
    if (cooldown > 0) return;
    acc += dt; frames++;
    if (acc < 1.2) return;
    const fps = frames / acc;
    acc = 0; frames = 0;
    if (fps < 42 && ratio > 1.0) {
      ratio = Math.max(1.0, ratio - 0.35);
      renderer.setPixelRatio(ratio);
      cooldown = 3.0;
    }
  };
}
