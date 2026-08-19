// Procedural textures. No image files ship with the game: every surface here is
// painted into a 2D canvas at boot and uploaded as a CanvasTexture.
import * as THREE from '../vendor/three/three.module.min.js';
import { fbm, ridged, paint, paintGray, heightToNormal, canvas2d, clamp, lerp, smoothstep, makeRng } from './noise.js';

const SRGB = THREE.SRGBColorSpace;
const LINEAR = THREE.LinearSRGBColorSpace;

function tex(canvas, { srgb = false, repeat = [1, 1], aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? SRGB : LINEAR;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------- road snow
// Shared height field: used both to paint the texture and to displace the mesh,
// so the ruts you see are the ruts the geometry actually has.
// u runs along the street, v runs across it (0 = far kerb, 1 = gutter side).
const snowBase = fbm(1337, 8, 5);
const snowFine = fbm(4211, 40, 4);
const snowCrust = ridged(9001, 24, 3);

function trackProfile(v, center, halfWidth) {
  const d = Math.abs(v - center) / halfWidth;
  return d >= 1 ? 0 : Math.pow(Math.cos(d * Math.PI * 0.5), 1.6);
}

/** Returns { h: 0..1 height, packed: 0..1 how compacted, grit: 0..1 } */
export function roadSnowField(u, v) {
  let h = 0.52 + (snowBase(u, v) - 0.5) * 0.5 + (snowFine(u, v) - 0.5) * 0.13;

  // two tyre ruts down the middle, wobbling slightly along the street
  const wob = (snowBase(u * 0.6, 0.3) - 0.5) * 0.05;
  const rutA = trackProfile(v, 0.34 + wob, 0.11);
  const rutB = trackProfile(v, 0.63 + wob, 0.11);
  const rut = Math.max(rutA, rutB);
  h -= rut * 0.3;

  // plough blade pass: a broad shallow scrape with a windrow ridge on the gutter side
  const plough = smoothstep(0.06, 0.16, v) * (1 - smoothstep(0.72, 0.84, v));
  h -= plough * 0.16;
  const windrow = trackProfile(v, 0.9, 0.13);
  h += windrow * 0.34;
  // chatter marks left by the blade
  h -= plough * Math.pow(Math.max(0, Math.sin(u * 74 + v * 3)), 8) * 0.045;

  // far kerb keeps its untouched drift
  h += smoothstep(0.14, 0.0, v) * 0.3;

  const packed = clamp(rut * 1.15 + plough * 0.55, 0, 1);
  const grit = clamp(packed * (snowFine(u * 1.7, v * 1.7) - 0.34) * 3.2, 0, 1);
  // where the blade and the tyres have worn through, wet asphalt shows
  const bare = clamp((rut - 0.62) * 3.0, 0, 1) *
    smoothstep(0.50, 0.60, snowBase(u * 2.6, v * 0.7) + (snowFine(u * 3.4, v * 3.4) - 0.5) * 0.34);
  return { h: clamp(h, 0, 1), packed, grit, bare };
}

/** Boot prints stamped along the gutter side, returned as a list of oval stamps. */
function bootPrints(rng) {
  const prints = [];
  for (let lane = 0; lane < 2; lane++) {
    const baseV = 0.79 + lane * 0.1;
    let u = 0.02 + rng() * 0.05;
    let side = 0;
    while (u < 0.99) {
      prints.push({
        u,
        v: baseV + (side ? 0.035 : -0.035) + (rng() - 0.5) * 0.02,
        rot: (rng() - 0.5) * 0.5 + (lane ? Math.PI : 0),
        s: 0.85 + rng() * 0.3,
      });
      u += 0.028 + rng() * 0.014;
      side ^= 1;
    }
  }
  return prints;
}

function stampPrints(ctx, w, h, prints, paintFn) {
  for (const p of prints) {
    ctx.save();
    ctx.translate(p.u * w, p.v * h);
    ctx.rotate(p.rot);
    ctx.scale(p.s, p.s);
    paintFn(ctx);
    ctx.restore();
  }
}

function bootShape(ctx, style) {
  ctx.fillStyle = style;
  // sole
  ctx.beginPath();
  ctx.ellipse(0, -5, 8, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  // heel
  ctx.beginPath();
  ctx.ellipse(0, 12, 6.5, 8, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function makeRoadSnow(size = 1280) {
  const W = size, H = Math.round(size / 5.8);
  const rng = makeRng(77);
  const prints = bootPrints(rng);

  // one pass over the field; the three maps then read from it
  const fh = new Float32Array(W * H), fp = new Float32Array(W * H);
  const fg = new Float32Array(W * H), fb = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const f = roadSnowField(x / W, y / H);
      const i = y * W + x;
      fh[i] = f.h; fp[i] = f.packed; fg[i] = f.grit; fb[i] = f.bare;
    }
  }

  const heightC = paintGray(W, H, (u, v, x, y) => fh[y * W + x]);
  const hctx = heightC.getContext('2d', { willReadFrequently: true });
  hctx.globalCompositeOperation = 'source-over';
  stampPrints(hctx, W, H, prints, (c) => bootShape(c, 'rgba(24,24,24,0.55)'));
  const normal = tex(heightToNormal(heightC, 2.0), { aniso: 16 });

  // albedo
  const albC = paint(W, H, (u, v, px, py) => {
    const i = py * W + px;
    const f = { h: fh[i], packed: fp[i], grit: fg[i], bare: fb[i] };
    const shade = 0.60 + f.h * 0.40 + (snowFine(u * 2.6, v * 2.6) - 0.5) * 0.14;
    // powder is faintly blue in the shadows, packed snow greys off and goes icy
    let r = lerp(232, 196, f.packed) * shade;
    let g = lerp(240, 205, f.packed) * shade;
    let b = lerp(252, 216, f.packed) * shade;
    const dirt = f.grit * (0.35 + 0.65 * snowFine(u * 3.1, v * 3.1));
    r = lerp(r, 108, dirt * 0.55);
    g = lerp(g, 106, dirt * 0.55);
    b = lerp(b, 104, dirt * 0.55);
    // wet asphalt showing through the worn strips
    const ash = 46 + snowFine(u * 4.3, v * 4.3) * 26;
    r = lerp(r, ash, f.bare); g = lerp(g, ash * 1.02, f.bare); b = lerp(b, ash * 1.1, f.bare);
    const sparkle = snowCrust(u * 2.2, v * 2.2) > 0.965 && f.packed < 0.4 ? 26 : 0;
    return [clamp(r + sparkle, 0, 255), clamp(g + sparkle, 0, 255), clamp(b + sparkle, 0, 255)];
  });
  const actx = albC.getContext('2d', { willReadFrequently: true });
  stampPrints(actx, W, H, prints, (c) => {
    bootShape(c, 'rgba(150,168,190,0.5)');
    c.globalCompositeOperation = 'lighter';
    c.translate(0.5, -1.6);
    bootShape(c, 'rgba(255,255,255,0.16)');
  });
  const map = tex(albC, { srgb: true, aniso: 16 });

  // roughness: packed / rutted snow is polished, powder is matte
  const roughC = paintGray(W, H, (u, v, px, py) => {
    const i = py * W + px;
    return clamp(0.95 - fp[i] * 0.5 - fb[i] * 0.55 - (1 - fh[i]) * 0.12, 0.14, 1);
  });
  const roughness = tex(roughC, { aniso: 8 });

  return { map, normal, roughness };
}

// ------------------------------------------------------------- powder snow
export function makeSnowBank(size = 512) {
  const lumps = fbm(505, 7, 5);
  const fine = fbm(808, 46, 4);
  const glint = ridged(1212, 90, 2);

  const heightC = paintGray(size, size, (u, v) => lumps(u, v) * 0.75 + fine(u, v) * 0.25);
  const normal = tex(heightToNormal(heightC, 1.5), { repeat: [1, 1], aniso: 8 });

  const map = tex(paint(size, size, (u, v) => {
    const l = lumps(u, v), f = fine(u, v);
    const shade = 0.78 + l * 0.26 + (f - 0.5) * 0.1;
    const spark = glint(u, v) > 0.972 ? 34 : 0;
    return [
      clamp(238 * shade + spark, 0, 255),
      clamp(244 * shade + spark, 0, 255),
      clamp(253 * shade + spark, 0, 255),
    ];
  }), { srgb: true, aniso: 8 });

  const roughness = tex(paintGray(size, size, (u, v) => 0.88 + (fine(u, v) - 0.5) * 0.12));
  return { map, normal, roughness };
}

// --------------------------------------------------------------- asphalt
export function makeAsphalt(size = 512) {
  const grain = fbm(2024, 70, 4);
  const agg = fbm(3131, 130, 3);
  const wet = fbm(4747, 5, 4);
  const cracks = ridged(5151, 9, 4);

  const heightC = paintGray(size, size, (u, v) => 0.5 + (agg(u, v) - 0.5) * 0.9 + (grain(u, v) - 0.5) * 0.4);
  const normal = tex(heightToNormal(heightC, 1.7), { repeat: [4, 1], aniso: 8 });

  const map = tex(paint(size, size, (u, v) => {
    const g = grain(u, v), a = agg(u, v);
    const wetness = smoothstep(0.42, 0.72, wet(u, v));
    let base = 54 + g * 30 + (a > 0.66 ? 34 : 0);
    base = lerp(base, base * 0.62, wetness);          // damp patches go darker
    const crack = smoothstep(0.86, 0.98, cracks(u, v)) * 22;
    return [clamp(base - crack, 0, 255), clamp(base - crack + 2, 0, 255), clamp(base - crack + 5, 0, 255)];
  }), { srgb: true, repeat: [4, 1], aniso: 8 });

  // wet asphalt = dull but real reflection; dry areas stay matte
  const roughness = tex(paintGray(size, size, (u, v) => {
    const wetness = smoothstep(0.40, 0.74, wet(u, v));
    return clamp(lerp(0.92, 0.30, wetness) + (grain(u, v) - 0.5) * 0.14, 0.16, 1);
  }), { repeat: [4, 1] });

  return { map, normal, roughness };
}

// ------------------------------------------------------- steel inlet cover
export function makeSteelPlate(size = 512) {
  // checker plate: raised lozenges in alternating directions
  const { canvas: hC, ctx } = canvas2d(size);
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(0, 0, size, size);
  const cell = size / 7;
  ctx.lineCap = 'round';
  for (let iy = 0; iy < 7; iy++) {
    for (let ix = 0; ix < 7; ix++) {
      const cx = (ix + 0.5) * cell, cy = (iy + 0.5) * cell;
      const dir = ((ix + iy) & 1) ? 1 : -1;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(dir * 0.62);
      ctx.strokeStyle = '#e8e8e8';
      ctx.lineWidth = cell * 0.2;
      for (const off of [-cell * 0.22, cell * 0.22]) {
        ctx.beginPath();
        ctx.moveTo(-cell * 0.3, off);
        ctx.lineTo(cell * 0.3, off);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  const normal = tex(heightToNormal(hC, 1.25), { aniso: 8 });

  const rust = fbm(6161, 6, 5);
  const rustFine = fbm(6262, 26, 3);
  const wetStreak = fbm(6363, 3, 4);
  const plate = ctx.getImageData(0, 0, size, size).data;

  const map = tex(paint(size, size, (u, v, x, y) => {
    const relief = plate[(y * size + x) * 4] / 255;          // 0 flat, 1 lozenge top
    const edge = Math.min(u, 1 - u, v, 1 - v);
    const worn = smoothstep(0.09, 0.0, edge);                // rims are polished by boots
    let base = 96 + relief * 46 + worn * 44;
    let r = base, g = base * 0.99, b = base * 1.02;

    // rust blooms, strongest near the rim and in the low ground between lozenges
    const rr = clamp((rust(u, v) - 0.44) * 3.0, 0, 1) * (0.35 + 0.65 * (1 - relief)) * (0.45 + worn * 0.9);
    const rf = 0.6 + 0.4 * rustFine(u, v);
    r = lerp(r, 132 * rf, rr); g = lerp(g, 74 * rf, rr); b = lerp(b, 42 * rf, rr);

    // damp grime running along the plate
    const damp = smoothstep(0.5, 0.85, wetStreak(u * 0.6, v * 2.4)) * (1 - relief * 0.7);
    r = lerp(r, r * 0.55, damp); g = lerp(g, g * 0.57, damp); b = lerp(b, b * 0.62, damp);
    return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)];
  }), { srgb: true, aniso: 8 });

  const roughness = tex(paintGray(size, size, (u, v, x, y) => {
    const relief = plate[(y * size + x) * 4] / 255;
    const edge = Math.min(u, 1 - u, v, 1 - v);
    const worn = smoothstep(0.09, 0.0, edge);
    const rr = clamp((rust(u, v) - 0.44) * 3.0, 0, 1);
    const damp = smoothstep(0.5, 0.85, wetStreak(u * 0.6, v * 2.4));
    return clamp(0.62 - relief * 0.2 - worn * 0.2 + rr * 0.35 - damp * 0.22, 0.12, 1);
  }));

  const metalness = tex(paintGray(size, size, (u, v) => {
    const rr = clamp((rust(u, v) - 0.44) * 3.0, 0, 1);
    return clamp(0.95 - rr * 0.75, 0.12, 1);
  }));

  return { map, normal, roughness, metalness };
}

// -------------------------------------------------------------- concrete
export function makeConcrete({ size = 512, moss = 0, wetLine = -1, tint = 1 } = {}) {
  const g = fbm(7373 + size, 12, 5);
  const fine = fbm(7474, 60, 3);
  const stain = fbm(7575, 4, 4);
  const pits = ridged(7676, 40, 3);
  const mossN = fbm(7777, 16, 4);

  const heightC = paintGray(size, size, (u, v) =>
    0.55 + (g(u, v) - 0.5) * 0.4 + (fine(u, v) - 0.5) * 0.35 - smoothstep(0.9, 1.0, pits(u, v)) * 0.4);
  const normal = tex(heightToNormal(heightC, 1.5), { aniso: 8 });

  const map = tex(paint(size, size, (u, v) => {
    const base = (150 + (g(u, v) - 0.5) * 46 + (fine(u, v) - 0.5) * 22) * tint;
    let r = base, gg = base * 1.005, b = base * 1.02;
    // vertical damp staining
    const st = smoothstep(0.45, 0.85, stain(u * 0.5, v * 2.0));
    r = lerp(r, r * 0.62, st); gg = lerp(gg, gg * 0.64, st); b = lerp(b, b * 0.68, st);
    if (wetLine >= 0) {
      const w = smoothstep(wetLine + 0.16, wetLine - 0.02, v);   // below the line stays wet
      r = lerp(r, r * 0.48, w); gg = lerp(gg, gg * 0.5, w); b = lerp(b, b * 0.56, w);
    }
    if (moss > 0) {
      const m = moss * smoothstep(0.52, 0.86, mossN(u, v)) * smoothstep(wetLine - 0.28, wetLine + 0.1, v);
      r = lerp(r, 62, m); gg = lerp(gg, 88, m); b = lerp(b, 52, m);
    }
    return [clamp(r, 0, 255), clamp(gg, 0, 255), clamp(b, 0, 255)];
  }), { srgb: true, aniso: 8 });

  const roughness = tex(paintGray(size, size, (u, v) => {
    let rgh = 0.86 + (fine(u, v) - 0.5) * 0.16;
    if (wetLine >= 0) rgh = lerp(rgh, 0.24, smoothstep(wetLine + 0.18, wetLine - 0.04, v));
    return clamp(rgh, 0.14, 1);
  }));

  return { map, normal, roughness };
}

// ------------------------------------------------------------------ soil
export function makeSoil(size = 256) {
  const g = fbm(8181, 10, 5);
  const stones = ridged(8282, 26, 3);
  const heightC = paintGray(size, size, (u, v) => g(u, v) * 0.7 + smoothstep(0.82, 1, stones(u, v)) * 0.5);
  const normal = tex(heightToNormal(heightC, 1.8), { repeat: [6, 1], aniso: 4 });
  const map = tex(paint(size, size, (u, v) => {
    const n = g(u, v), s = smoothstep(0.84, 1, stones(u, v));
    const band = smoothstep(0.0, 0.35, v);                 // gravel bedding on top, darker soil below
    let r = lerp(126, 74, band) + (n - 0.5) * 40;
    let gg = lerp(116, 63, band) + (n - 0.5) * 36;
    let b = lerp(102, 54, band) + (n - 0.5) * 30;
    r = lerp(r, 150, s); gg = lerp(gg, 148, s); b = lerp(b, 145, s);
    return [clamp(r, 0, 255), clamp(gg, 0, 255), clamp(b, 0, 255)];
  }), { srgb: true, repeat: [6, 1] });
  return { map, normal };
}

// ------------------------------------------------------------- block wall
export function makeBlockWall(size = 512) {
  const { canvas: hC, ctx } = canvas2d(size);
  const rows = 6, cols = 3;
  const bw = size / cols, bh = size / rows;
  ctx.fillStyle = '#303030';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#d8d8d8';
  for (let r = 0; r < rows; r++) {
    for (let c = -1; c <= cols; c++) {
      const x = c * bw + (r % 2 ? bw * 0.5 : 0) + 3;
      ctx.fillRect(x, r * bh + 3, bw - 6, bh - 6);
      // the hollow-block dimples
      ctx.fillStyle = '#b4b4b4';
      ctx.fillRect(x + bw * 0.14, r * bh + bh * 0.22, bw * 0.28, bh * 0.56);
      ctx.fillRect(x + bw * 0.58, r * bh + bh * 0.22, bw * 0.28, bh * 0.56);
      ctx.fillStyle = '#d8d8d8';
    }
  }
  const normal = tex(heightToNormal(hC, 1.1), { repeat: [8, 1], aniso: 4 });
  const relief = ctx.getImageData(0, 0, size, size).data;
  const stain = fbm(9191, 5, 4);
  const grain = fbm(9292, 40, 3);
  const map = tex(paint(size, size, (u, v, x, y) => {
    const rel = relief[(y * size + x) * 4] / 255;
    let base = lerp(96, 172, rel) + (grain(u, v) - 0.5) * 22;
    const st = smoothstep(0.5, 0.9, stain(u * 0.7, v * 1.6));
    base = lerp(base, base * 0.68, st * 0.8);
    return [clamp(base, 0, 255), clamp(base * 1.01, 0, 255), clamp(base * 1.02, 0, 255)];
  }), { srgb: true, repeat: [8, 1], aniso: 4 });
  const roughness = tex(paintGray(size, size, () => 0.92), { repeat: [8, 1] });
  return { map, normal, roughness };
}

// ------------------------------------------------------------- house skin
export function makeSiding(size = 256, hue = 0) {
  const grain = fbm(1010 + hue * 31, 34, 4);
  const { canvas: hC, ctx } = canvas2d(size);
  ctx.fillStyle = '#c8c8c8'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#3a3a3a';
  for (let i = 0; i < 8; i++) ctx.fillRect(0, (i + 1) * size / 8 - 2, size, 3);
  const normal = tex(heightToNormal(hC, 0.9), { repeat: [3, 2], aniso: 4 });
  const relief = ctx.getImageData(0, 0, size, size).data;
  const palettes = [[196, 188, 176], [168, 158, 150], [186, 176, 160], [142, 136, 132]];
  const p = palettes[hue % palettes.length];
  const map = tex(paint(size, size, (u, v, x, y) => {
    const rel = relief[(y * size + x) * 4] / 255;
    const n = (grain(u, v) - 0.5) * 26;
    const sh = 0.72 + rel * 0.34;
    return [clamp(p[0] * sh + n, 0, 255), clamp(p[1] * sh + n, 0, 255), clamp(p[2] * sh + n, 0, 255)];
  }), { srgb: true, repeat: [3, 2], aniso: 4 });
  const roughness = tex(paintGray(size, size, () => 0.82), { repeat: [3, 2] });
  return { map, normal, roughness };
}

export function makeRoofTile(size = 256) {
  const { canvas: hC, ctx } = canvas2d(size);
  ctx.fillStyle = '#606060'; ctx.fillRect(0, 0, size, size);
  const n = 8, w = size / n;
  for (let i = 0; i < n; i++) {
    const g = ctx.createLinearGradient(i * w, 0, (i + 1) * w, 0);
    g.addColorStop(0, '#2c2c2c'); g.addColorStop(0.5, '#e0e0e0'); g.addColorStop(1, '#2c2c2c');
    ctx.fillStyle = g; ctx.fillRect(i * w, 0, w, size);
  }
  ctx.fillStyle = '#8a8a8a';
  for (let r = 0; r < 6; r++) ctx.fillRect(0, r * size / 6, size, 3);
  const normal = tex(heightToNormal(hC, 1.4), { repeat: [6, 3], aniso: 4 });
  const relief = ctx.getImageData(0, 0, size, size).data;
  const grain = fbm(1313, 30, 3);
  const map = tex(paint(size, size, (u, v, x, y) => {
    const rel = relief[(y * size + x) * 4] / 255;
    const sh = 0.55 + rel * 0.6 + (grain(u, v) - 0.5) * 0.12;
    return [clamp(64 * sh, 0, 255), clamp(72 * sh, 0, 255), clamp(84 * sh, 0, 255)];
  }), { srgb: true, repeat: [6, 3], aniso: 4 });
  const roughness = tex(paintGray(size, size, (u, v) => 0.5 + (grain(u, v) - 0.5) * 0.2), { repeat: [6, 3] });
  return { map, normal, roughness };
}

// ----------------------------------------------------------------- water
export function makeWaterNormal(size = 512) {
  // stretched along the flow direction so ripples read as a current, not a pond
  const a = fbm(2121, 10, 5);
  const b = fbm(2222, 22, 4);
  const heightC = paintGray(size, size, (u, v) =>
    a(u * 0.42, v * 2.4) * 0.62 + b(u * 0.3, v * 3.0) * 0.38);
  return tex(heightToNormal(heightC, 2.6), { repeat: [3, 1], aniso: 8 });
}

export function makeFoam(size = 512) {
  const streak = fbm(3232, 8, 4);
  const fine = fbm(3333, 40, 3);
  const { canvas, ctx } = canvas2d(size);
  const img = ctx.createImageData(size, size);
  const d = img.data;
  let i = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const s = streak(u * 0.35, v * 3.2);
      const f = fine(u * 0.5, v * 2.0);
      const a = clamp((s - 0.58) * 3.4, 0, 1) * (0.45 + 0.55 * f);
      d[i++] = 255; d[i++] = 255; d[i++] = 255; d[i++] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = SRGB;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 1);
  return t;
}

// ---------------------------------------------------------------- sprites
export function makeSoftDot(size = 64, hardness = 0.0) {
  const { canvas, ctx } = canvas2d(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.04, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(clamp(0.35 + hardness * 0.4, 0, 0.95), 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = SRGB;
  return t;
}

export function makeRingSprite(size = 256) {
  const { canvas, ctx } = canvas2d(size);
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,1)';
  ctx.lineWidth = size * 0.055;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.38, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = size * 0.02;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
  ctx.stroke();
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = SRGB;
  return t;
}

// -------------------------------------------------------------------- sky
export function makeSkyEquirect(w = 512) {
  const h = w >> 1;
  const cloud = fbm(4545, 6, 5);
  const canvas = paint(w, h, (u, v) => {
    if (v < 0.5) {
      const t = v / 0.5;                                   // 0 zenith -> 1 horizon
      let r = lerp(150, 233, Math.pow(t, 0.75));
      let g = lerp(172, 240, Math.pow(t, 0.75));
      let b = lerp(196, 246, Math.pow(t, 0.75));
      const c = cloud(u, v * 0.6);
      const cl = smoothstep(0.42, 0.72, c) * (1 - t * 0.4);
      r = lerp(r, 236, cl * 0.55); g = lerp(g, 240, cl * 0.55); b = lerp(b, 244, cl * 0.55);
      // low winter sun, hazy through the overcast
      const du = Math.min(Math.abs(u - 0.68), 1 - Math.abs(u - 0.68));
      const dv = v - 0.34;
      const sun = Math.exp(-(du * du * 34 + dv * dv * 90));
      r += sun * 62; g += sun * 54; b += sun * 40;
      return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)];
    }
    const t = (v - 0.5) / 0.5;
    const r = lerp(226, 176, t), g = lerp(233, 184, t), b = lerp(240, 192, t);
    return [r, g, b];
  });
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = SRGB;
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

// ------------------------------------------------- section-cut strata band
export function makeStrata(w = 512, h = 256) {
  const g = fbm(5656, 14, 4);
  const stones = ridged(5757, 30, 3);
  const canvas = paint(w, h, (u, v) => {
    // v: 0 top (road crust) -> 1 bottom (bedding soil)
    let r, gg, b;
    if (v < 0.16) { r = 226; gg = 233; b = 244; }             // snow crust
    else if (v < 0.34) { r = 58; gg = 58; b = 62; }           // asphalt
    else if (v < 0.55) { r = 148; gg = 146; b = 142; }        // concrete slab
    else { r = 118; gg = 104; b = 88; }                       // bedding gravel
    const n = (g(u, v) - 0.5) * 34;
    const s = smoothstep(0.86, 1, stones(u, v)) * (v > 0.55 ? 60 : 12);
    return [clamp(r + n + s, 0, 255), clamp(gg + n + s, 0, 255), clamp(b + n + s, 0, 255)];
  });
  return tex(canvas, { srgb: true, repeat: [8, 1], aniso: 4 });
}
