/* Hand-drawn canvas illustrations. No emoji, no text: every control is a
   picture a child who cannot read can still recognise. */

type Ctx = CanvasRenderingContext2D;

export function makeIconCanvas(size: number) {
  const c = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  c.width = Math.round(size * dpr);
  c.height = Math.round(size * dpr);
  const ctx = c.getContext('2d')!;
  ctx.scale(c.width / size, c.height / size);
  return { canvas: c, ctx, s: size };
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function sandDisc(ctx: Ctx, s: number, light = '#f0dfbe', dark = '#c9ab7c') {
  const g = ctx.createRadialGradient(s * 0.38, s * 0.32, s * 0.05, s * 0.5, s * 0.55, s * 0.62);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  ctx.fill();
  // grain speckle so it reads as sand, not as a flat swatch
  ctx.save();
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 260; i++) {
    const a = (i * 2.399) % (Math.PI * 2);
    const r = Math.sqrt(((i * 7919) % 1000) / 1000) * (s / 2);
    ctx.fillStyle = i % 3 === 0 ? '#7d6440' : '#fff6e0';
    ctx.fillRect(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r, 1.6, 1.6);
  }
  ctx.restore();
}

function waterBlob(ctx: Ctx, x: number, y: number, w: number, h: number) {
  const g = ctx.createLinearGradient(x, y - h / 2, x, y + h / 2);
  g.addColorStop(0, 'rgba(214,235,238,0.96)');
  g.addColorStop(0.5, 'rgba(140,183,190,0.95)');
  g.addColorStop(1, 'rgba(86,128,133,0.95)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drop(ctx: Ctx, x: number, y: number, r: number) {
  const g = ctx.createLinearGradient(x - r, y - r * 1.6, x + r, y + r);
  g.addColorStop(0, '#e9f6f7');
  g.addColorStop(0.55, '#a9ced3');
  g.addColorStop(1, '#6f9aa1');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.75);
  ctx.bezierCurveTo(x + r * 1.05, y - r * 0.4, x + r, y + r * 0.85, x, y + r * 0.95);
  ctx.bezierCurveTo(x - r, y + r * 0.85, x - r * 1.05, y - r * 0.4, x, y - r * 1.75);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.2, r * 0.32, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

function hand(ctx: Ctx, x: number, y: number, s: number, rot = 0, tone = '#f6d8b8', edge = '#c1926a') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.085;
  ctx.strokeStyle = edge;
  ctx.fillStyle = tone;

  // folded fingers, drawn first so the palm overlaps them
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(0.3 - i * 0.005, 0.28 + i * 0.2, 0.19, 0.115, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // thumb
  ctx.beginPath();
  ctx.ellipse(-0.34, 0.56, 0.155, 0.11, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // palm
  ctx.beginPath();
  roundRect(ctx, -0.36, 0.1, 0.72, 0.86, 0.26);
  ctx.fill();
  ctx.stroke();

  // extended index finger
  ctx.beginPath();
  roundRect(ctx, -0.17, -0.94, 0.32, 1.2, 0.155);
  ctx.fill();
  ctx.stroke();

  // knuckle crease, so the finger reads as separate from the palm
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 0.045;
  ctx.beginPath();
  ctx.moveTo(-0.14, 0.16);
  ctx.lineTo(0.12, 0.16);
  ctx.stroke();
  ctx.restore();
}

/* ------------------------------------------------------------------ */

export function drawStart(ctx: Ctx, s: number) {
  ctx.clearRect(0, 0, s, s);
  // outer ring
  const ring = ctx.createLinearGradient(0, 0, 0, s);
  ring.addColorStop(0, '#ffe6b0');
  ring.addColorStop(1, '#d79a4d');
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(s * 0.055, s * 0.055);
  ctx.scale(0.89, 0.89);
  sandDisc(ctx, s);
  ctx.save();
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  ctx.clip();
  // a wet hollow with ripples, and a drop about to land
  waterBlob(ctx, s * 0.5, s * 0.68, s * 0.62, s * 0.3);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = s * 0.014;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.68, s * (0.09 + i * 0.09), s * (0.04 + i * 0.042), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  drop(ctx, s * 0.5, s * 0.34, s * 0.1);
  ctx.restore();
  ctx.restore();

  // gloss
  const gl = ctx.createLinearGradient(0, 0, 0, s * 0.55);
  gl.addColorStop(0, 'rgba(255,255,255,0.4)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl;
  ctx.beginPath();
  ctx.ellipse(s / 2, s * 0.3, s * 0.38, s * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawDigTool(ctx: Ctx, s: number) {
  ctx.clearRect(0, 0, s, s);
  sandDisc(ctx, s);
  ctx.save();
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  ctx.clip();

  // a wide groove pushed through the sand, with spoil along its sides
  ctx.strokeStyle = '#b99a6b';
  ctx.lineWidth = s * 0.3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(s * 0.12, s * 0.86);
  ctx.quadraticCurveTo(s * 0.4, s * 0.66, s * 0.62, s * 0.34);
  ctx.stroke();
  ctx.strokeStyle = '#7d6440';
  ctx.lineWidth = s * 0.19;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(150,190,196,0.92)';
  ctx.lineWidth = s * 0.13;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = s * 0.025;
  ctx.beginPath();
  ctx.moveTo(s * 0.15, s * 0.82);
  ctx.quadraticCurveTo(s * 0.41, s * 0.63, s * 0.6, s * 0.34);
  ctx.stroke();

  // the fingertip that made it
  hand(ctx, s * 0.74, s * 0.3, s * 0.34, 2.55);
  ctx.restore();
}

export function drawMudTool(ctx: Ctx, s: number) {
  ctx.clearRect(0, 0, s, s);
  sandDisc(ctx, s, '#e6d3b0', '#bb9a6d');
  ctx.save();
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  ctx.clip();

  // a squashed lump of wet mud pressed into a gap
  const g = ctx.createRadialGradient(s * 0.4, s * 0.62, s * 0.02, s * 0.5, s * 0.72, s * 0.44);
  g.addColorStop(0, '#75593a');
  g.addColorStop(1, '#33261611');
  ctx.fillStyle = '#3e2f1d';
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.72, s * 0.36, s * 0.19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(s * 0.48, s * 0.69, s * 0.31, s * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(s * 0.38, s * 0.65, s * 0.1, s * 0.042, -0.32, 0, Math.PI * 2);
  ctx.fill();

  // the palm pressing down on it
  hand(ctx, s * 0.55, s * 0.16, s * 0.34, 3.14);
  ctx.restore();
}

export function drawSound(ctx: Ctx, s: number, on: boolean) {
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = 'rgba(255,252,244,0.001)';
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#6b4f2c';
  ctx.beginPath();
  ctx.moveTo(s * 0.28, s * 0.4);
  ctx.lineTo(s * 0.42, s * 0.4);
  ctx.lineTo(s * 0.56, s * 0.26);
  ctx.lineTo(s * 0.56, s * 0.74);
  ctx.lineTo(s * 0.42, s * 0.6);
  ctx.lineTo(s * 0.28, s * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#6b4f2c';
  ctx.lineWidth = s * 0.055;
  ctx.lineCap = 'round';
  if (on) {
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(s * 0.58, s * 0.5, s * (0.14 + i * 0.11), -0.9, 0.9);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(s * 0.66, s * 0.38);
    ctx.lineTo(s * 0.84, s * 0.62);
    ctx.moveTo(s * 0.84, s * 0.38);
    ctx.lineTo(s * 0.66, s * 0.62);
    ctx.stroke();
  }
}

export function drawMenuGlyph(ctx: Ctx, s: number) {
  ctx.clearRect(0, 0, s, s);
  const cells: [number, number][] = [
    [0.24, 0.24],
    [0.56, 0.24],
    [0.24, 0.56],
    [0.56, 0.56],
  ];
  const cols = ['#c9a468', '#8fb3b8', '#a98f6a', '#7f9d63'];
  cells.forEach(([x, y], i) => {
    ctx.fillStyle = cols[i];
    roundRect(ctx, s * x - s * 0.09, s * y - s * 0.09, s * 0.2, s * 0.2, s * 0.05);
    ctx.fill();
  });
}

export function drawBack(ctx: Ctx, s: number) {
  ctx.clearRect(0, 0, s, s);
  const cx = s * 0.52;
  const cy = s * 0.52;
  const r = s * 0.23;
  ctx.strokeStyle = '#6b4f2c';
  ctx.fillStyle = '#6b4f2c';
  ctx.lineWidth = s * 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, r, -0.35 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  // arrow head on the tangent at the end of the sweep
  const a = 0.85 * Math.PI;
  const px = cx + Math.cos(a) * r;
  const py = cy + Math.sin(a) * r;
  const tx = -Math.sin(a);
  const ty = Math.cos(a);
  const nx = -ty;
  const ny = tx;
  const hl = s * 0.15;
  const hw = s * 0.1;
  ctx.beginPath();
  ctx.moveTo(px + tx * hl, py + ty * hl);
  ctx.lineTo(px + nx * hw, py + ny * hw);
  ctx.lineTo(px - nx * hw, py - ny * hw);
  ctx.closePath();
  ctx.fill();
}

/* --- picture cards for the free-choice menu ------------------------ */

function cardBg(ctx: Ctx, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#f6ead2');
  g.addColorStop(1, '#e0c99f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(120,92,54,0.1)';
  for (let i = 0; i < 400; i++) {
    ctx.fillRect(((i * 7919) % 997) / 997 * w, ((i * 104729) % 991) / 991 * h, 1.5, 1.5);
  }
}

function gateGlyph(ctx: Ctx, w: number, h: number, cx: number, cy: number) {
  const k = Math.min(w, h);
  ctx.fillStyle = '#7a5a35';
  ctx.fillRect(cx - k * 0.11, cy - k * 0.03, k * 0.035, k * 0.16);
  ctx.fillRect(cx + k * 0.075, cy - k * 0.03, k * 0.035, k * 0.16);
  ctx.fillStyle = '#9c7847';
  ctx.fillRect(cx - k * 0.125, cy - k * 0.06, k * 0.25, k * 0.055);
}

function sandbox(ctx: Ctx, w: number, h: number, path: (x: number) => number, split: boolean) {
  ctx.save();
  ctx.strokeStyle = '#9a6f3e';
  ctx.lineWidth = Math.min(w, h) * 0.055;
  ctx.strokeRect(w * 0.1, h * 0.14, w * 0.8, h * 0.72);
  ctx.beginPath();
  ctx.rect(w * 0.1, h * 0.14, w * 0.8, h * 0.72);
  ctx.clip();

  // upper pool
  waterBlob(ctx, w * 0.5, h * 0.24, w * 0.44, h * 0.16);
  // channel
  ctx.strokeStyle = 'rgba(150,190,196,0.95)';
  ctx.lineWidth = Math.min(w, h) * 0.085;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.3);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    ctx.lineTo(w * path(t), h * (0.3 + t * 0.4));
  }
  ctx.stroke();
  if (split) {
    ctx.beginPath();
    ctx.moveTo(w * path(0.5), h * 0.5);
    ctx.quadraticCurveTo(w * 0.82, h * 0.58, w * 0.66, h * 0.7);
    ctx.stroke();
  }
  // lower pond
  waterBlob(ctx, w * 0.5, h * 0.76, w * 0.5, h * 0.17);
  gateGlyph(ctx, w, h, w * 0.5, h * 0.3);
  ctx.restore();
}

export function drawCardSame(ctx: Ctx, w: number, h: number) {
  cardBg(ctx, w, h);
  sandbox(ctx, w, h, (t) => 0.5 + Math.sin(t * 2.4) * 0.11, false);
}

export function drawCardNew(ctx: Ctx, w: number, h: number) {
  cardBg(ctx, w, h);
  sandbox(ctx, w, h, (t) => 0.36 + t * 0.3 + Math.sin(t * 4.2) * 0.09, true);
}

export function drawCardFree(ctx: Ctx, w: number, h: number) {
  cardBg(ctx, w, h);
  ctx.save();
  ctx.strokeStyle = '#9a6f3e';
  ctx.lineWidth = Math.min(w, h) * 0.055;
  ctx.strokeRect(w * 0.1, h * 0.14, w * 0.8, h * 0.72);
  ctx.beginPath();
  ctx.rect(w * 0.1, h * 0.14, w * 0.8, h * 0.72);
  ctx.clip();
  waterBlob(ctx, w * 0.5, h * 0.62, w * 0.72, h * 0.42);
  // a wooden gate standing open with water pouring through
  ctx.fillStyle = '#7a5a35';
  ctx.fillRect(w * 0.34, h * 0.2, w * 0.05, h * 0.36);
  ctx.fillRect(w * 0.61, h * 0.2, w * 0.05, h * 0.36);
  ctx.fillStyle = '#9c7847';
  ctx.fillRect(w * 0.34, h * 0.2, w * 0.32, h * 0.09);
  ctx.strokeStyle = 'rgba(220,240,242,0.95)';
  ctx.lineWidth = Math.min(w, h) * 0.075;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.34);
  ctx.lineTo(w * 0.5, h * 0.6);
  ctx.stroke();
  ctx.restore();
}

/** Faint guiding hand, used only as a last resort. */
export function drawGhostHand(ctx: Ctx, s: number) {
  ctx.clearRect(0, 0, s, s);
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = s * 0.06;
  hand(ctx, s * 0.5, s * 0.46, s * 0.3, 0, 'rgba(255,250,240,0.92)', 'rgba(120,95,60,0.85)');
  ctx.restore();
  // short upward stroke: the direction only, never the outcome
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = s * 0.05;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.24);
  ctx.lineTo(s * 0.5, s * 0.08);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.04);
  ctx.lineTo(s * 0.4, s * 0.17);
  ctx.lineTo(s * 0.6, s * 0.17);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();
}

export function drawVibration(ctx: Ctx, s: number, on: boolean) {
  ctx.clearRect(0, 0, s, s);
  ctx.strokeStyle = '#6b4f2c';
  ctx.fillStyle = '#6b4f2c';
  ctx.lineWidth = s * 0.055;
  ctx.lineCap = 'round';
  roundRect(ctx, s * 0.38, s * 0.26, s * 0.24, s * 0.48, s * 0.06);
  ctx.stroke();
  if (on) {
    for (const dir of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(s * (0.5 + dir * (0.2 + i * 0.09)), s * 0.4);
        ctx.lineTo(s * (0.5 + dir * (0.2 + i * 0.09)), s * 0.6);
        ctx.stroke();
      }
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(s * 0.22, s * 0.22);
    ctx.lineTo(s * 0.78, s * 0.78);
    ctx.stroke();
  }
}
