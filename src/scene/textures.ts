import * as THREE from 'three';

/**
 * Procedural texture factory. Everything is generated on canvas at load so
 * the game ships zero binary assets. A fixed seed keeps every run (and the
 * E2E screenshots) identical.
 */

let seed = 1837;
export function resetSeed(): void {
  seed = 1837;
}
function rand(): number {
  // deterministic LCG — Math.random is banned for reproducible visuals
  seed = (seed * 48271) % 2147483647;
  return seed / 2147483647;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function toTexture(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** fine directional brushing for machined metal (roughness map, linear) */
export function brushedRoughness(base: number, streak: number, vertical = false): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  const g = Math.round(base * 255);
  ctx.fillStyle = `rgb(${g},${g},${g})`;
  ctx.fillRect(0, 0, 256, 256);
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 900; i++) {
    const v = base + (rand() - 0.5) * streak;
    const gv = Math.max(0, Math.min(255, Math.round(v * 255)));
    ctx.strokeStyle = `rgb(${gv},${gv},${gv})`;
    ctx.lineWidth = 0.6 + rand() * 0.9;
    const p = rand() * 256;
    const len = 40 + rand() * 216;
    const off = rand() * (256 - len);
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(p, off);
      ctx.lineTo(p + (rand() - 0.5) * 3, off + len);
    } else {
      ctx.moveTo(off, p);
      ctx.lineTo(off + len, p + (rand() - 0.5) * 3);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return toTexture(c, false);
}

/** faint fingerprints + oil smear variation for often-touched brass (roughness) */
export function handledRoughness(base: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  const g = Math.round(base * 255);
  ctx.fillStyle = `rgb(${g},${g},${g})`;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 26; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const r = 12 + rand() * 30;
    const smoother = rand() > 0.5;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
    const dv = smoother ? -22 : 16;
    grad.addColorStop(0, `rgba(${g + dv},${g + dv},${g + dv},0.35)`);
    grad.addColorStop(1, `rgba(${g},${g},${g},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(c, false);
}

export interface WoodOptions {
  light: string;
  dark: string;
  rings: number;
  /** grain runs along U (true) or V (false) */
  alongU: boolean;
}

/** cabinet-grade wood with pores and growth-ring variation */
export function woodAlbedo(opt: WoodOptions): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 512);
  const grad = ctx.createLinearGradient(0, 0, opt.alongU ? 0 : 512, opt.alongU ? 512 : 0);
  grad.addColorStop(0, opt.light);
  grad.addColorStop(1, opt.light);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // growth rings: nearly straight, faint bands across the grain
  for (let i = 0; i < opt.rings; i++) {
    const pos = (i / opt.rings) * 512 + (rand() - 0.5) * 10;
    const width = 1.2 + rand() * 3.4;
    const alpha = 0.05 + rand() * 0.09;
    ctx.strokeStyle = opt.dark;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.beginPath();
    const wobbleF = 1 + rand() * 2;
    const wobbleA = 1 + rand() * 2.5;
    for (let t = 0; t <= 512; t += 8) {
      const w = pos + Math.sin((t / 512) * Math.PI * wobbleF + i) * wobbleA;
      if (opt.alongU) {
        if (t === 0) ctx.moveTo(t, w);
        else ctx.lineTo(t, w);
      } else {
        if (t === 0) ctx.moveTo(w, t);
        else ctx.lineTo(w, t);
      }
    }
    ctx.stroke();
  }
  // vessels / pores: short dashes strictly along the grain direction
  ctx.globalAlpha = 0.09;
  ctx.strokeStyle = opt.dark;
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 2200; i++) {
    const a = rand() * 512;
    const b = rand() * 512;
    const len = 3 + rand() * 16;
    ctx.beginPath();
    if (opt.alongU) {
      ctx.moveTo(a, b);
      ctx.lineTo(a + len, b);
    } else {
      ctx.moveTo(a, b);
      ctx.lineTo(a, b + len);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return toTexture(c);
}

export function woodRoughness(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = 'rgb(140,140,140)';
  ctx.fillRect(0, 0, 256, 256);
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 500; i++) {
    const v = 110 + Math.floor(rand() * 80);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(rand() * 256, rand() * 256, 1 + rand() * 20, 1 + rand() * 2);
  }
  ctx.globalAlpha = 1;
  return toTexture(c, false);
}

/** painted plaster wall with restrained tonal noise */
export function plasterAlbedo(tone: string, fleck: string): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = tone;
  ctx.fillRect(0, 0, 256, 256);
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = fleck;
    ctx.fillRect(rand() * 256, rand() * 256, 1 + rand() * 2, 1 + rand() * 2);
  }
  ctx.globalAlpha = 1;
  return toTexture(c);
}

/** dark felt work mat with woven speckle */
export function feltAlbedo(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#2b322f';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4200; i++) {
    const v = rand();
    ctx.fillStyle = v > 0.5 ? 'rgba(62,74,70,0.5)' : 'rgba(24,29,27,0.5)';
    ctx.fillRect(rand() * 256, rand() * 256, 1.3, 1.3);
  }
  return toTexture(c);
}

/** worn oak floor boards, grain along U, seams along V */
export function floorAlbedo(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 512);
  const boardH = 64;
  for (let b = 0; b < 8; b++) {
    const l = 96 + Math.floor(rand() * 26);
    ctx.fillStyle = `rgb(${l + 22},${l - 4},${l - 34})`;
    ctx.fillRect(0, b * boardH, 512, boardH);
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = 'rgb(70,50,30)';
    for (let i = 0; i < 10; i++) {
      const y = b * boardH + rand() * boardH;
      ctx.lineWidth = 0.8 + rand() * 1.6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 512; x += 16) {
        ctx.lineTo(x, y + Math.sin(x * 0.02 + b) * 2);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(40,28,16,0.85)';
    ctx.fillRect(0, b * boardH, 512, 2);
    // board end joints, staggered per row
    const joint = (b * 197) % 512;
    ctx.fillRect(joint, b * boardH, 2, boardH);
  }
  return toTexture(c);
}
