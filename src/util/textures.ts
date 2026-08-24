import * as THREE from 'three';
import { Rng, makeValueNoise2D } from './rng';

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function toTexture(c: HTMLCanvasElement, srgb = true, repeat = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 2;
  return t;
}

// Multi-octave value noise painted into a canvas; returned canvas is reused
// by several material builders below.
function noiseCanvas(rng: Rng, size: number, octaves = 4): HTMLCanvasElement {
  const [c, ctx] = canvas(size);
  const img = ctx.createImageData(size, size);
  const noises = [] as Array<(x: number, y: number) => number>;
  for (let o = 0; o < octaves; o++) noises.push(makeValueNoise2D(rng, 16));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      let amp = 0.5;
      let freq = 4 / size;
      for (let o = 0; o < octaves; o++) {
        v += noises[o](x * freq, y * freq) * amp;
        amp *= 0.55;
        freq *= 2.1;
      }
      const i = (y * size + x) * 4;
      const b = Math.floor(v * 255);
      img.data[i] = b;
      img.data[i + 1] = b;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Linear-space tileable noise for shader lookups (water turbidity, murk wobble).
export function noiseDataTexture(rng: Rng, size = 128): THREE.CanvasTexture {
  const t = toTexture(noiseCanvas(rng, size, 4), false, true);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// Wet forest floor: dark humus with pressed leaf specks and fine grit.
export function groundTexture(rng: Rng): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = canvas(size);
  ctx.drawImage(noiseCanvas(rng, size, 5), 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = '#6b5844';
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';
  // pressed decayed leaves, darker and lighter
  for (let i = 0; i < 420; i++) {
    const x = rng.next() * size;
    const y = rng.next() * size;
    const w = rng.range(5, 16);
    const h = w * rng.range(0.45, 0.7);
    const a = rng.next() * Math.PI;
    const tone = rng.next();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.globalAlpha = rng.range(0.12, 0.35);
    ctx.fillStyle = tone < 0.55 ? '#4a3a28' : tone < 0.85 ? '#7d6647' : '#8f7a52';
    ctx.beginPath();
    ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // fine grit
  ctx.globalAlpha = 1;
  for (let i = 0; i < 2200; i++) {
    const x = rng.next() * size;
    const y = rng.next() * size;
    ctx.globalAlpha = rng.range(0.05, 0.2);
    ctx.fillStyle = rng.next() < 0.5 ? '#33291d' : '#83705a';
    ctx.fillRect(x, y, rng.range(1, 2.5), rng.range(1, 2.5));
  }
  ctx.globalAlpha = 1;
  return toTexture(c);
}

// Bark: vertical fissures on wet dark trunks.
export function barkTexture(rng: Rng): THREE.CanvasTexture {
  const size = 256;
  const [c, ctx] = canvas(size);
  ctx.drawImage(noiseCanvas(rng, size, 4), 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = '#5a4a3c';
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 46; i++) {
    const x = rng.next() * size;
    ctx.strokeStyle = rng.next() < 0.6 ? 'rgba(28,22,16,0.5)' : 'rgba(120,104,84,0.35)';
    ctx.lineWidth = rng.range(1, 4);
    ctx.beginPath();
    let px = x;
    ctx.moveTo(px, 0);
    for (let y = 0; y <= size; y += 16) {
      px += rng.range(-5, 5);
      ctx.lineTo(px, y);
    }
    ctx.stroke();
  }
  // damp moss dusting on one side
  for (let i = 0; i < 160; i++) {
    const x = rng.next() * size * 0.45;
    const y = rng.next() * size;
    ctx.globalAlpha = rng.range(0.05, 0.22);
    ctx.fillStyle = '#4d5c33';
    ctx.beginPath();
    ctx.arc(x, y, rng.range(2, 7), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return toTexture(c);
}

// One broadleaf litter leaf with alpha, used by instanced quads.
export function litterLeafTexture(rng: Rng): THREE.CanvasTexture {
  const size = 64;
  const [c, ctx] = canvas(size);
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;
  ctx.fillStyle = '#6d5432';
  ctx.beginPath();
  ctx.moveTo(cx, 6);
  ctx.bezierCurveTo(cx + 22, 14, cx + 20, 44, cx, size - 8);
  ctx.bezierCurveTo(cx - 20, 44, cx - 22, 14, cx, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(50,36,20,0.7)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx, 8);
  ctx.lineTo(cx, size - 10);
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const y = 14 + i * 8;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(cx + 12 - i, y + 6);
    ctx.moveTo(cx, y);
    ctx.lineTo(cx - 12 + i, y + 6);
    ctx.stroke();
  }
  const t = toTexture(c, true, false);
  return t;
}

// Fern frond with alpha for cross-quad forest-floor plants.
export function fernTexture(rng: Rng): THREE.CanvasTexture {
  const size = 128;
  const [c, ctx] = canvas(size);
  ctx.clearRect(0, 0, size, size);
  // rosette of arching fronds seen from the side — leaflets in pairs
  // along each curved stem, wider than tall, soft forest-green
  const base = { x: size * 0.5, y: size - 4 };
  const fronds = [
    { a: -1.25, len: 0.52, tone: 'rgba(78,100,54,0.95)' },
    { a: -0.55, len: 0.62, tone: 'rgba(90,114,62,0.95)' },
    { a: 0.0, len: 0.66, tone: 'rgba(70,92,48,0.95)' },
    { a: 0.55, len: 0.62, tone: 'rgba(96,120,66,0.95)' },
    { a: 1.25, len: 0.52, tone: 'rgba(80,102,56,0.95)' },
  ];
  for (const f of fronds) {
    ctx.strokeStyle = f.tone;
    ctx.fillStyle = f.tone;
    ctx.lineWidth = 2;
    const L = size * f.len;
    // arched stem: tip bends outward and down
    const steps = 12;
    let prev = { ...base };
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const bend = f.a + t * t * f.a * 0.9;
      const x = base.x + Math.sin(bend) * L * t;
      const y = base.y - Math.cos(Math.abs(bend) * 0.8) * L * t * (1 - t * 0.25);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      // paired leaflets perpendicular to the stem, shrinking to the tip
      const ll = 13 * (1 - t * 0.75);
      const nx = -(y - prev.y);
      const ny = x - prev.x;
      const nl = Math.hypot(nx, ny) || 1;
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(
          x + (sgn * nx * ll * 0.5) / nl,
          y + (sgn * ny * ll * 0.5) / nl,
          ll * 0.6,
          2.6,
          Math.atan2(ny, nx),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      prev = { x, y };
    }
  }
  return toTexture(c, true, false);
}

// Soft leaf-cluster blobs for high canopy billboards.
export function canopyTexture(rng: Rng): THREE.CanvasTexture {
  const size = 256;
  const [c, ctx] = canvas(size);
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 240; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = Math.sqrt(rng.next()) * size * 0.42;
    const x = size / 2 + Math.cos(a) * r;
    const y = size / 2 + Math.sin(a) * r * 0.8;
    const g = rng.range(0.25, 0.5);
    ctx.globalAlpha = rng.range(0.25, 0.6) * (1 - r / (size * 0.48));
    ctx.fillStyle = `rgba(${Math.floor(46 + g * 40)},${Math.floor(70 + g * 60)},${Math.floor(36 + g * 30)},1)`;
    ctx.beginPath();
    ctx.arc(x, y, rng.range(6, 20), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return toTexture(c, true, false);
}

// Soft round mist puff.
export function mistTexture(): THREE.CanvasTexture {
  const size = 128;
  const [c, ctx] = canvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(225,232,224,0.55)');
  g.addColorStop(0.55, 'rgba(218,226,218,0.22)');
  g.addColorStop(1, 'rgba(215,224,216,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(c, true, false);
}

// Expanding ripple ring.
export function rippleTexture(): THREE.CanvasTexture {
  const size = 128;
  const [c, ctx] = canvas(size);
  ctx.clearRect(0, 0, size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.5);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.72, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.82, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(c, true, false);
}
