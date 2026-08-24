import * as THREE from 'three';
import { makeRng } from '../util/math';

function canvasTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  opts: { repeat?: [number, number]; srgb?: boolean } = {}
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (opts.repeat) tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  if (opts.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** 床板。導管・繊維方向・板の継ぎ目・節。釣り口周辺の濡れは material 側で重ねる。 */
export function woodFloorTexture(): THREE.CanvasTexture {
  const rng = makeRng(11);
  return canvasTexture(512, (ctx, S) => {
    ctx.fillStyle = '#6d5236';
    ctx.fillRect(0, 0, S, S);
    const plankH = S / 6;
    for (let p = 0; p < 6; p++) {
      const y0 = p * plankH;
      const base = 0.88 + rng() * 0.22;
      ctx.fillStyle = `rgb(${Math.round(104 * base)},${Math.round(79 * base)},${Math.round(52 * base)})`;
      ctx.fillRect(0, y0, S, plankH);
      // 繊維方向（横方向）の導管
      for (let i = 0; i < 46; i++) {
        const gy = y0 + rng() * plankH;
        const alpha = 0.05 + rng() * 0.1;
        const dark = rng() > 0.35;
        ctx.strokeStyle = dark ? `rgba(38,25,14,${alpha})` : `rgba(178,142,96,${alpha * 0.7})`;
        ctx.lineWidth = 0.6 + rng() * 1.4;
        ctx.beginPath();
        let x = -10;
        let y = gy;
        ctx.moveTo(x, y);
        while (x < S + 10) {
          x += 18 + rng() * 30;
          y = gy + Math.sin(x * 0.02 + p) * (1.2 + rng() * 2);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // 節（非対称に、まばらに）
      if (rng() > 0.45) {
        const kx = rng() * S;
        const ky = y0 + plankH * (0.25 + rng() * 0.5);
        const kr = 3 + rng() * 6;
        const grad = ctx.createRadialGradient(kx, ky, 0.5, kx, ky, kr);
        grad.addColorStop(0, 'rgba(30,18,9,0.85)');
        grad.addColorStop(0.6, 'rgba(52,34,18,0.5)');
        grad.addColorStop(1, 'rgba(52,34,18,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(kx, ky, kr, 0, Math.PI * 2);
        ctx.fill();
      }
      // 板の継ぎ目
      ctx.fillStyle = 'rgba(20,12,6,0.75)';
      ctx.fillRect(0, y0 + plankH - 1.6, S, 1.6);
      // 擦れ（通路になる中央帯を明るく摩耗させる…片寄らせて左右対称を避ける）
      const wear = ctx.createLinearGradient(0, y0, S, y0);
      wear.addColorStop(0, 'rgba(200,170,130,0)');
      wear.addColorStop(0.38 + rng() * 0.1, `rgba(206,176,136,${0.05 + rng() * 0.06})`);
      wear.addColorStop(0.62 + rng() * 0.15, 'rgba(206,176,136,0.02)');
      wear.addColorStop(1, 'rgba(206,176,136,0)');
      ctx.fillStyle = wear;
      ctx.fillRect(0, y0, S, plankH);
    }
  });
}

/** 床の粗さマップ。濡れ・摩耗で艶が変わる。 */
export function woodRoughnessTexture(): THREE.CanvasTexture {
  const rng = makeRng(12);
  return canvasTexture(
    256,
    (ctx, S) => {
      ctx.fillStyle = '#b8b8b8';
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 900; i++) {
        const v = 150 + Math.floor(rng() * 90);
        ctx.fillStyle = `rgba(${v},${v},${v},0.25)`;
        ctx.fillRect(rng() * S, rng() * S, 1 + rng() * 3, 1 + rng() * 2);
      }
    },
    { srgb: false }
  );
}

/** 樹脂（リールボディ）。パーティングラインと軽い擦れ。 */
export function plasticTexture(hue = '#2c3138'): THREE.CanvasTexture {
  const rng = makeRng(21);
  return canvasTexture(256, (ctx, S) => {
    ctx.fillStyle = hue;
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 500; i++) {
      const a = 0.02 + rng() * 0.05;
      ctx.fillStyle = rng() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
      ctx.fillRect(rng() * S, rng() * S, 1 + rng() * 2, 1);
    }
    // 擦れ跡（斜めに数本、非対称）
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.03 + rng() * 0.04})`;
      ctx.lineWidth = 1 + rng() * 4;
      ctx.beginPath();
      const y = rng() * S;
      ctx.moveTo(0, y);
      ctx.lineTo(S, y + (rng() - 0.3) * 60);
      ctx.stroke();
    }
  });
}

/** 金属スプール。回転方向のブラシ痕。 */
export function brushedMetalTexture(): THREE.CanvasTexture {
  const rng = makeRng(31);
  return canvasTexture(
    256,
    (ctx, S) => {
      ctx.fillStyle = '#9aa0a6';
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 700; i++) {
        const v = 120 + Math.floor(rng() * 110);
        ctx.strokeStyle = `rgba(${v},${v},${v + 6},${0.12 + rng() * 0.2})`;
        ctx.lineWidth = 0.5 + rng();
        const y = rng() * S;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(S, y);
        ctx.stroke();
      }
    },
    { srgb: true }
  );
}

/** ゴム押し面。細かいステップル。 */
export function rubberTexture(): THREE.CanvasTexture {
  const rng = makeRng(41);
  return canvasTexture(128, (ctx, S) => {
    ctx.fillStyle = '#20242a';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 1400; i++) {
      const a = 0.05 + rng() * 0.12;
      ctx.fillStyle = rng() > 0.4 ? `rgba(255,255,255,${a * 0.5})` : `rgba(0,0,0,${a})`;
      ctx.beginPath();
      ctx.arc(rng() * S, rng() * S, 0.6 + rng() * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** ドーム天幕（内側）。縫い目と汚れ。半透明の生地感。 */
export function tentTexture(): THREE.CanvasTexture {
  const rng = makeRng(51);
  return canvasTexture(512, (ctx, S) => {
    ctx.fillStyle = '#cfd6d2';
    ctx.fillRect(0, 0, S, S);
    // 生地むら
    for (let i = 0; i < 1600; i++) {
      const a = 0.015 + rng() * 0.03;
      ctx.fillStyle = rng() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(90,100,96,${a})`;
      ctx.fillRect(rng() * S, rng() * S, 2 + rng() * 6, 1 + rng() * 3);
    }
    // 縫い目（縦帯、ごく控えめに）
    for (let x = 0; x < S; x += S / 4) {
      ctx.strokeStyle = 'rgba(104,112,108,0.18)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x + 2, 0);
      ctx.lineTo(x + 2, S);
      ctx.stroke();
    }
    // 下端の使用汚れ（非対称）
    const g = ctx.createLinearGradient(0, S * 0.7, 0, S);
    g.addColorStop(0, 'rgba(70,72,66,0)');
    g.addColorStop(1, 'rgba(70,72,66,0.22)');
    ctx.fillStyle = g;
    ctx.fillRect(0, S * 0.7, S, S * 0.3);
  });
}

/** 湖面（外の冬の湖）。 */
export function lakeTexture(): THREE.CanvasTexture {
  const rng = makeRng(61);
  return canvasTexture(
    512,
    (ctx, S) => {
      ctx.fillStyle = '#39515e';
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 700; i++) {
        const a = 0.02 + rng() * 0.05;
        ctx.strokeStyle = rng() > 0.4 ? `rgba(205,220,226,${a})` : `rgba(20,32,40,${a})`;
        ctx.lineWidth = 0.6 + rng() * 1.4;
        const y = rng() * S;
        const x = rng() * S;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 14 + rng() * 60, y + (rng() - 0.5) * 5);
        ctx.stroke();
      }
    },
    { repeat: [4, 4] }
  );
}

/** 座布団・防寒着などの布。 */
export function clothTexture(base: string): THREE.CanvasTexture {
  const rng = makeRng(71);
  return canvasTexture(128, (ctx, S) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 2400; i++) {
      const a = 0.03 + rng() * 0.05;
      ctx.fillStyle = rng() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
      ctx.fillRect(rng() * S, rng() * S, 1, 1);
    }
  });
}
