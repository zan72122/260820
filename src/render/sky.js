import { Rng } from '../rng.js';
import { clamp } from '../math.js';

const rs = new Rng(7717);
const STARS = [];
for (let i = 0; i < 190; i++) {
  STARS.push({
    kx: rs.range(-2.2, 2.2),
    ky: rs.range(0.06, 1.55),          // 水平線からの角度（tanθ）
    m: rs.range(0.16, 1.0) ** 2.1,     // 明るさ
    tw: rs.range(0, 6.28),
    c: rs.next(),
  });
}

/**
 * 夜空。長岡の空は真っ黒ではなく、市街地の光で地平近くが濁って明るい。
 * その「濁り」を描くかどうかで現地感がまるで変わる。
 */
export function drawSky(ctx, cam, env) {
  const W = cam.W, H = cam.H;
  const hy = cam.horizonY();
  const flash = env.flash || 0;
  const warm = env.warmGlow || 0;   // ナイアガラの照り返し

  const top = Math.min(hy - H * 1.6, -H * 0.2);
  const grd = ctx.createLinearGradient(0, top, 0, hy);
  grd.addColorStop(0.00, '#03050b');
  grd.addColorStop(0.42, '#070c17');
  grd.addColorStop(0.74, '#0d1524');
  grd.addColorStop(0.92, '#16202f');
  grd.addColorStop(1.00, '#1d2635');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, Math.max(0, hy) + 2);

  // 星（市街光で控えめ）
  const starFade = clamp(1 - flash * 1.6 - warm * 0.35, 0, 1) * 0.9;
  if (starFade > 0.02) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < STARS.length; i++) {
      const s = STARS[i];
      const y = hy - cam.f * s.ky;
      if (y < -10 || y > hy) continue;
      const x = cam.cx + cam.f * s.kx;
      if (x < -10 || x > W + 10) continue;
      // 地平に近い星ほど霞んで消える
      const alt = clamp((hy - y) / (H * 0.55), 0, 1);
      const a = s.m * starFade * (0.25 + 0.75 * alt) * (0.7 + 0.3 * Math.sin(env.t * 1.7 + s.tw));
      if (a < 0.02) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = s.c > 0.75 ? '#ffe9d0' : (s.c > 0.4 ? '#ffffff' : '#cfe0ff');
      const r = 0.7 + s.m * 1.0;
      ctx.fillRect(x - r * 0.5, y - r * 0.5, r, r);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // 市街地の光害（地平のすぐ上が茶色くにじむ）
  ctx.globalCompositeOperation = 'lighter';
  const gg = ctx.createLinearGradient(0, hy - H * 0.36, 0, hy);
  gg.addColorStop(0, 'rgba(60,44,26,0)');
  gg.addColorStop(0.55, 'rgba(72,52,28,0.16)');
  gg.addColorStop(1, 'rgba(104,74,38,0.36)');
  ctx.fillStyle = gg;
  ctx.fillRect(0, Math.max(0, hy - H * 0.36), W, Math.min(H, H * 0.36) + 2);
  ctx.globalCompositeOperation = 'source-over';
}

/** 開発の閃光が空気全体を染める（画面全体の加算） */
export function drawAirFlash(ctx, cam, flash, tint) {
  if (flash <= 0.004) return;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = clamp(flash, 0, 1);
  ctx.fillStyle = tint || '#4a4437';
  ctx.fillRect(0, 0, cam.W, cam.H);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/** 画面の四隅を落とす。写真的な締まりを出す */
export function drawVignette(ctx, cam) {
  const W = cam.W, H = cam.H;
  const g = ctx.createRadialGradient(W * 0.5, H * 0.52, Math.min(W, H) * 0.28, W * 0.5, H * 0.52, Math.hypot(W, H) * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.62, 'rgba(0,0,0,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
