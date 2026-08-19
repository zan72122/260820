import * as THREE from 'three';
import { Rng, clamp } from './math';

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function finish(c: HTMLCanvasElement, repeat = 1, srgb = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Height field -> tangent-space normal map, kept small (used for micro detail only). */
function normalFromHeight(height: Float32Array, size: number, strength: number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx;
      let ny = -dy;
      const nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      const i = (y * size + x) * 4;
      data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((nz / l * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/** Fine parallel striations left by the piping tip. */
export function creamStreakNormal(size = 128): THREE.DataTexture {
  const h = new Float32Array(size * size);
  const rng = new Rng(20260819);
  const lanes = 15;
  const offs = Array.from({ length: lanes }, () => rng.range(0, 1));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = y / size;
      let acc = Math.sin(v * Math.PI * 2 * 9) * 0.35;
      for (let l = 0; l < lanes; l++) {
        const c = (offs[l] + Math.sin((x / size) * 6.283 + l) * 0.01) % 1;
        const d = Math.abs(v - c);
        acc += Math.exp(-(d * d) / 0.0006) * 0.42;
      }
      acc += (rng.next() - 0.5) * 0.12;
      h[y * size + x] = acc;
    }
  }
  return normalFromHeight(h, size, 1.1);
}

/** Brushed stainless: fine circumferential scratches. */
export function steelScratchNormal(size = 256): THREE.DataTexture {
  const h = new Float32Array(size * size);
  const rng = new Rng(4242);
  for (let i = 0; i < 2600; i++) {
    const y = Math.floor(rng.next() * size);
    const x0 = Math.floor(rng.next() * size);
    const len = Math.floor(rng.range(6, 70));
    const depth = rng.range(0.15, 1) * (rng.next() < 0.5 ? -1 : 1);
    for (let k = 0; k < len; k++) {
      const x = (x0 + k) % size;
      const yy = (y + (rng.next() < 0.06 ? 1 : 0)) % size;
      h[yy * size + x] += depth * Math.sin((k / len) * Math.PI);
    }
  }
  return normalFromHeight(h, size, 0.28);
}

export function steelRoughness(size = 256): THREE.CanvasTexture {
  const [c, ctx] = canvas(size);
  const rng = new Rng(77);
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const g = Math.floor(rng.range(56, 88));
    ctx.strokeStyle = `rgba(${g},${g},${g},0.5)`;
    ctx.lineWidth = rng.range(0.4, 1.6);
    const y = rng.next() * size;
    ctx.beginPath();
    ctx.moveTo(rng.next() * size, y);
    ctx.lineTo(rng.next() * size, y + rng.sym(2));
    ctx.stroke();
  }
  // faint fingerprint smudges
  for (let i = 0; i < 10; i++) {
    const x = rng.next() * size;
    const y = rng.next() * size;
    const r = rng.range(12, 34);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(120,120,120,0.16)');
    g.addColorStop(1, 'rgba(120,120,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return finish(c, 1);
}

/** Baking parchment: fibre grain plus a couple of translucent grease spots. */
export function parchmentMap(size = 256): { color: THREE.CanvasTexture; rough: THREE.CanvasTexture } {
  const [c, ctx] = canvas(size);
  const rng = new Rng(991);
  ctx.fillStyle = '#efe6d4';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 5000; i++) {
    const x = rng.next() * size;
    const y = rng.next() * size;
    const a = rng.range(0.02, 0.09);
    ctx.fillStyle = rng.next() < 0.5 ? `rgba(120,104,80,${a})` : `rgba(255,252,244,${a})`;
    ctx.fillRect(x, y, rng.range(1, 7), rng.range(0.5, 1.4));
  }
  const [rc, rctx] = canvas(size);
  rctx.fillStyle = '#c8c8c8';
  rctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 6; i++) {
    const x = rng.next() * size;
    const y = rng.next() * size;
    const r = rng.range(10, 30);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(206,178,128,0.35)');
    g.addColorStop(1, 'rgba(206,178,128,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    const g2 = rctx.createRadialGradient(x, y, 0, x, y, r);
    g2.addColorStop(0, 'rgba(90,90,90,0.9)');
    g2.addColorStop(1, 'rgba(90,90,90,0)');
    rctx.fillStyle = g2;
    rctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return { color: finish(c, 1, true), rough: finish(rc, 1) };
}

/** Sponge crumb for the cake side, plus a matching roughness map. */
export function spongeMap(size = 256): { color: THREE.CanvasTexture; rough: THREE.CanvasTexture; normal: THREE.DataTexture } {
  const [c, ctx] = canvas(size);
  const [rc, rctx] = canvas(size);
  const rng = new Rng(5150);
  ctx.fillStyle = '#e8c489';
  ctx.fillRect(0, 0, size, size);
  rctx.fillStyle = '#d0d0d0';
  rctx.fillRect(0, 0, size, size);
  const h = new Float32Array(size * size);
  for (let i = 0; i < 2400; i++) {
    const x = rng.next() * size;
    const y = rng.next() * size;
    const r = rng.range(1.2, 5.5);
    const dark = rng.range(0.06, 0.3);
    ctx.fillStyle = `rgba(150,104,54,${dark})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.283);
    ctx.fill();
    rctx.fillStyle = `rgba(255,255,255,${dark * 0.7})`;
    rctx.beginPath();
    rctx.arc(x, y, r, 0, 6.283);
    rctx.fill();
    const ri = Math.ceil(r);
    for (let dy = -ri; dy <= ri; dy++)
      for (let dx = -ri; dx <= ri; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > r) continue;
        const px = (Math.floor(x) + dx + size) % size;
        const py = (Math.floor(y) + dy + size) % size;
        h[py * size + px] -= (1 - d / r) * 1.4;
      }
  }
  for (let i = 0; i < 900; i++) {
    const x = rng.next() * size;
    const y = rng.next() * size;
    ctx.fillStyle = `rgba(255,238,203,${rng.range(0.05, 0.22)})`;
    ctx.beginPath();
    ctx.arc(x, y, rng.range(1, 3), 0, 6.283);
    ctx.fill();
  }
  return { color: finish(c, 1, true), rough: finish(rc, 1), normal: normalFromHeight(h, size, 0.6) };
}

/** Worn hardwood worktop. */
export function woodMap(size = 512): { color: THREE.CanvasTexture; rough: THREE.CanvasTexture; normal: THREE.DataTexture } {
  const [c, ctx] = canvas(size);
  const [rc, rctx] = canvas(size);
  const rng = new Rng(3131);
  ctx.fillStyle = '#8d6647';
  ctx.fillRect(0, 0, size, size);
  rctx.fillStyle = '#8a8a8a';
  rctx.fillRect(0, 0, size, size);
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const band = Math.sin(y * 0.19 + Math.sin(y * 0.021) * 3.4) * 0.5 + 0.5;
    const grain = band * 0.35 + rng.next() * 0.1;
    ctx.fillStyle = `rgba(64,44,30,${grain * 0.28})`;
    ctx.fillRect(0, y, size, 1);
    rctx.fillStyle = `rgba(255,255,255,${grain * 0.25})`;
    rctx.fillRect(0, y, size, 1);
    for (let x = 0; x < size; x++) h[y * size + x] = -grain;
  }
  for (let i = 0; i < 260; i++) {
    const y = rng.next() * size;
    ctx.strokeStyle = `rgba(58,40,26,${rng.range(0.04, 0.16)})`;
    ctx.lineWidth = rng.range(0.5, 2.2);
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.01 + i) * 3);
    ctx.stroke();
  }
  return { color: finish(c, 1, true), rough: finish(rc, 1), normal: normalFromHeight(h, size, 0.5) };
}

/** Soft radial blob used for cheap contact shadows under props. */
export function contactShadowTexture(size = 128): THREE.CanvasTexture {
  const [c, ctx] = canvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(24,15,8,0.5)');
  g.addColorStop(0.32, 'rgba(24,15,8,0.24)');
  g.addColorStop(0.62, 'rgba(24,15,8,0.07)');
  g.addColorStop(1, 'rgba(24,15,8,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

/** Plaster / tile wall behind the bench. */
export function wallMap(size = 256): THREE.CanvasTexture {
  const [c, ctx] = canvas(size);
  const rng = new Rng(808);
  ctx.fillStyle = '#cfc7bb';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 9000; i++) {
    const v = clamp(rng.range(-0.1, 0.1), -1, 1);
    ctx.fillStyle = `rgba(${v > 0 ? 255 : 60},${v > 0 ? 255 : 60},${v > 0 ? 250 : 60},${Math.abs(v)})`;
    ctx.fillRect(rng.next() * size, rng.next() * size, 2, 2);
  }
  return finish(c, 1, true);
}
