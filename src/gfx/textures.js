import * as THREE from 'three';

// Everything in the background is procedurally painted into canvases and then
// softened. That is not a shortcut for its own sake: a macro lens at ~25cm has
// almost no depth of field, so painting the distance *already defocused* is both
// cheaper and more truthful than rendering geometry and blurring it later.

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Downscale/upscale blur. Works on every WebView, unlike ctx.filter.
function softBlur(canvas, strength, iterations = 3) {
  const w = canvas.width;
  const h = canvas.height;
  const k = Math.max(2, Math.round(strength));
  const small = makeCanvas(Math.max(2, Math.floor(w / k)), Math.max(2, Math.floor(h / k)));
  const sctx = small.getContext('2d');
  const ctx = canvas.getContext('2d');
  sctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingEnabled = true;
  for (let i = 0; i < iterations; i++) {
    sctx.clearRect(0, 0, small.width, small.height);
    sctx.drawImage(canvas, 0, 0, small.width, small.height);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(small, 0, 0, w, h);
  }
  return canvas;
}

function toTexture(canvas, { srgb = true, wrap = THREE.ClampToEdgeWrapping } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = wrap;
  tex.wrapT = wrap;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 2;
  tex.needsUpdate = true;
  return tex;
}

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

// --- radial falloffs used by every additive sprite in the game ----------------

export function radialGlowTexture(size = 128, gamma = 2.4, inner = 0.0) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - half) / half;
      const dy = (y + 0.5 - half) / half;
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      let a = Math.pow(Math.max(0, 1 - d), gamma);
      if (inner > 0) a = Math.max(a, Math.pow(Math.max(0, 1 - d / inner), 1.4));
      const i = (y * size + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(Math.min(1, a) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, { srgb: false });
}

export function smokeTexture(size = 128, seed = 7) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const r = rng(seed);
  ctx.clearRect(0, 0, size, size);
  // A few overlapping blobs, then blurred: reads as a wisp, not a ball.
  for (let i = 0; i < 9; i++) {
    const cx = size * (0.5 + (r() - 0.5) * 0.45);
    const cy = size * (0.5 + (r() - 0.5) * 0.45);
    const rad = size * (0.14 + r() * 0.2);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, `rgba(255,255,255,${0.28 + r() * 0.2})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  softBlur(c, 5, 2);
  // Fade the border so the quad edge never shows.
  const g2 = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size * 0.5);
  g2.addColorStop(0, 'rgba(0,0,0,0)');
  g2.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';
  return toTexture(c, { srgb: false });
}

// --- background plates -------------------------------------------------------

// Deep summer dusk turning to night. Never pure black: the brief asks for a
// low-key scene you can still read, not a black screen with a dot on it.
export function skyTexture(w = 1024, h = 1024, seed = 11) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const r = rng(seed);

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.0, '#070c22');
  g.addColorStop(0.24, '#0d1533');
  g.addColorStop(0.48, '#16244f');
  g.addColorStop(0.68, '#243363');
  g.addColorStop(0.83, '#3d3f6b');
  g.addColorStop(0.93, '#6a4c62');
  g.addColorStop(1.0, '#8a5b52');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Residual sun glow, off to one side, very low.
  const sun = ctx.createRadialGradient(w * 0.74, h * 1.02, 0, w * 0.74, h * 1.02, h * 0.55);
  sun.addColorStop(0, 'rgba(255,150,90,0.42)');
  sun.addColorStop(0.45, 'rgba(190,95,80,0.14)');
  sun.addColorStop(1, 'rgba(120,70,90,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);

  // Thin cloud bands catching the last light. Kept very low contrast: at this
  // hour they are a suggestion, and hard bands read as compression artefacts.
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 9; i++) {
    const y = h * (0.60 + r() * 0.32);
    const hh = h * (0.02 + r() * 0.05);
    const cg = ctx.createLinearGradient(0, y - hh, 0, y + hh);
    cg.addColorStop(0, 'rgba(255,180,150,0)');
    cg.addColorStop(0.5, `rgba(255,${(165 + r() * 45) | 0},${(140 + r() * 35) | 0},${0.25 + r() * 0.3})`);
    cg.addColorStop(1, 'rgba(255,180,150,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(w * (r() * 0.4 - 0.2), y - hh, w * (0.5 + r() * 0.8), hh * 2);
  }
  ctx.globalAlpha = 1;

  softBlur(c, 10, 3);

  // Stars go on after the blur so a few of them stay pin-sharp.
  for (let i = 0; i < 170; i++) {
    const x = r() * w;
    const y = r() * h * 0.55;
    const a = 0.1 + r() * 0.5 * (1 - y / (h * 0.55));
    const rad = 0.6 + r() * 1.1;
    ctx.fillStyle = `rgba(${210 + r() * 45 | 0},${220 + r() * 35 | 0},255,${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(c);
}

// Far treeline: a silhouette, lifted out of black by haze so it stays readable.
// Drawn as overlapping crowns on trunks rather than as a ridge line -- a smooth
// horizon profile at this scale reads as distant hills, not as a garden.
export function treelineTexture(w = 3072, h = 384, seed = 23) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const r = rng(seed);
  ctx.clearRect(0, 0, w, h);

  const baseY = h * 0.78;

  // Ground and undergrowth mass.
  ctx.fillStyle = '#0a1020';
  ctx.fillRect(0, baseY - h * 0.02, w, h - baseY + h * 0.02);

  const puff = (cx, cy, rx, ry, fill) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, (r() - 0.5) * 0.6, 0, Math.PI * 2);
    ctx.fill();
  };

  // A row of trees: trunk, then a cluster of small crowns so the outline is
  // lumpy and leaf-like instead of conical.
  const trees = 64;
  for (let i = 0; i < trees; i++) {
    const cx = (i / trees) * w + (r() - 0.5) * (w / trees) * 0.9;
    const height = h * (0.26 + r() * 0.32);
    const top = baseY - height;
    const spread = h * (0.08 + r() * 0.08);
    const dark = `rgba(${(7 + r() * 6) | 0},${(13 + r() * 8) | 0},${(26 + r() * 12) | 0},1)`;

    ctx.fillStyle = 'rgba(7,11,22,1)';
    ctx.fillRect(cx - w * 0.0006, top + spread * 0.6, w * 0.0012, baseY - top);

    const puffs = 5 + Math.floor(r() * 5);
    for (let k = 0; k < puffs; k++) {
      const a = (k / puffs) * Math.PI * 2 + r();
      const rad = spread * (0.35 + r() * 0.75);
      puff(
        cx + Math.cos(a) * rad,
        top + spread * 0.7 + Math.sin(a) * rad * 0.62,
        spread * (0.42 + r() * 0.34),
        spread * (0.32 + r() * 0.28),
        dark
      );
    }
  }

  // Low shrubs filling the gaps between trunks.
  for (let i = 0; i < 170; i++) {
    const cx = r() * w;
    puff(cx, baseY - h * (0.01 + r() * 0.06), h * (0.025 + r() * 0.06), h * (0.02 + r() * 0.045), 'rgba(8,13,24,1)');
  }

  // Haze: distance is mostly a matter of contrast, not detail.
  const haze = ctx.createLinearGradient(0, baseY - h * 0.5, 0, h);
  haze.addColorStop(0, 'rgba(56,74,124,0.22)');
  haze.addColorStop(0.6, 'rgba(38,50,92,0.14)');
  haze.addColorStop(1, 'rgba(24,32,60,0.07)');
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';

  softBlur(c, 6, 3);
  return toTexture(c);
}

// Midground: the veranda (engawa) with the warm house behind it, a wind chime,
// a mosquito coil, and -- quietly, because a grown-up thought of it first --
// a bucket of water at the foot of the step.
//
// The plate is square and taller than the frame so its edges never show; only
// the building's own silhouette is allowed to be a hard edge.
export function houseTexture(size = 1024) {
  // A 2:1 plate. The veranda runs off the left edge of it, because in landscape
  // the frame is wide enough to find the end of a plate that stops politely.
  const w = size * 2;
  const h = size;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  const ROOF = h * 0.115;
  const WALL = h * 0.175;
  const SHOJI_TOP = h * 0.225;
  const DECK_TOP = h * 0.62;
  const DECK_FRONT = h * 0.695;
  const houseRight = w * 0.62;
  const U = size; // one "tile" of building, used to keep features at real size

  // Eave: a dark soffit and the underside of the roof, seen from below.
  const roof = ctx.createLinearGradient(0, ROOF, 0, WALL);
  roof.addColorStop(0, '#100c0a');
  roof.addColorStop(1, '#1d1610');
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(0, ROOF);
  ctx.lineTo(houseRight, ROOF + h * 0.022);
  ctx.lineTo(houseRight, WALL + h * 0.022);
  ctx.lineTo(0, WALL);
  ctx.closePath();
  ctx.fill();

  // The eave overhangs the corner, and a post carries it. Without those two
  // shapes the building reads as a black rectangle pasted over the garden.
  const overhang = U * 0.055;
  ctx.fillStyle = '#0e0b09';
  ctx.beginPath();
  ctx.moveTo(houseRight, ROOF + h * 0.022);
  ctx.lineTo(houseRight + overhang, ROOF + h * 0.036);
  ctx.lineTo(houseRight + overhang, WALL + h * 0.030);
  ctx.lineTo(houseRight, WALL + h * 0.022);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(58,44,32,0.75)';
  ctx.lineWidth = Math.max(2, U * 0.003);
  ctx.beginPath();
  ctx.moveTo(0, ROOF);
  ctx.lineTo(houseRight + overhang, ROOF + h * 0.036);
  ctx.stroke();

  // Wall behind the screens.
  ctx.fillStyle = '#171009';
  ctx.fillRect(0, WALL, houseRight, DECK_TOP - WALL + h * 0.02);

  // Shoji panels: the warm light of the house, seen through paper.
  const panelW = U * 0.132;
  const gap = U * 0.152;
  const panels = Math.floor(houseRight / gap);
  for (let i = 0; i < panels; i++) {
    const x = houseRight - U * 0.045 - (i + 1) * gap;
    if (x < -panelW) break;
    const y = SHOJI_TOP;
    const ph = DECK_TOP - y - h * 0.025;
    const pg = ctx.createLinearGradient(x, y, x, y + ph);
    pg.addColorStop(0, 'rgba(255,190,116,0.50)');
    pg.addColorStop(0.55, 'rgba(255,168,94,0.60)');
    pg.addColorStop(1, 'rgba(224,134,70,0.44)');
    ctx.fillStyle = pg;
    ctx.fillRect(x, y, panelW, ph);
    ctx.strokeStyle = 'rgba(34,20,12,0.9)';
    ctx.lineWidth = Math.max(1.5, U * 0.0024);
    for (let k = 1; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(x + (panelW * k) / 4, y);
      ctx.lineTo(x + (panelW * k) / 4, y + ph);
      ctx.stroke();
    }
    for (let k = 1; k < 7; k++) {
      ctx.beginPath();
      ctx.moveTo(x, y + (ph * k) / 7);
      ctx.lineTo(x + panelW, y + (ph * k) / 7);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(26,15,9,0.95)';
    ctx.lineWidth = Math.max(2, U * 0.0042);
    ctx.strokeRect(x, y, panelW, ph);
  }

  // Corner post, catching a sliver of the light from inside.
  const postG = ctx.createLinearGradient(houseRight - U * 0.016, 0, houseRight + U * 0.006, 0);
  postG.addColorStop(0, '#3a2a1c');
  postG.addColorStop(0.55, '#241a12');
  postG.addColorStop(1, '#120d09');
  ctx.fillStyle = postG;
  ctx.fillRect(houseRight - U * 0.016, WALL + h * 0.02, U * 0.022, DECK_FRONT - WALL);

  // Eave shadow falling down the face of the screens.
  const eave = ctx.createLinearGradient(0, WALL, 0, WALL + h * 0.12);
  eave.addColorStop(0, 'rgba(6,8,14,0.9)');
  eave.addColorStop(1, 'rgba(6,8,14,0)');
  ctx.fillStyle = eave;
  ctx.fillRect(0, WALL, houseRight, h * 0.12);

  // The deck, warm where the screen light lands on it.
  const deck = ctx.createLinearGradient(0, DECK_TOP, 0, DECK_FRONT);
  deck.addColorStop(0, '#5c3d24');
  deck.addColorStop(1, '#3a2617');
  ctx.fillStyle = deck;
  ctx.beginPath();
  ctx.moveTo(0, DECK_TOP);
  ctx.lineTo(houseRight, DECK_TOP + h * 0.022);
  ctx.lineTo(houseRight, DECK_FRONT + h * 0.028);
  ctx.lineTo(0, DECK_FRONT);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,12,7,0.55)';
  ctx.lineWidth = Math.max(1, U * 0.0014);
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    ctx.beginPath();
    ctx.moveTo(0, DECK_TOP + (DECK_FRONT - DECK_TOP) * t);
    ctx.lineTo(houseRight, DECK_TOP + h * 0.022 + (DECK_FRONT - DECK_TOP) * t);
    ctx.stroke();
  }

  // Step face, then the dark underneath, then ground all the way to the bottom
  // of the plate so its lower edge can never show as a line.
  ctx.fillStyle = '#1b110b';
  ctx.beginPath();
  ctx.moveTo(0, DECK_FRONT);
  ctx.lineTo(houseRight, DECK_FRONT + h * 0.028);
  ctx.lineTo(houseRight, DECK_FRONT + h * 0.075);
  ctx.lineTo(0, DECK_FRONT + h * 0.05);
  ctx.closePath();
  ctx.fill();
  const under = ctx.createLinearGradient(0, DECK_FRONT + h * 0.05, 0, h);
  under.addColorStop(0, 'rgba(4,6,10,0.95)');
  under.addColorStop(0.45, 'rgba(6,9,14,0.8)');
  under.addColorStop(1, 'rgba(8,12,18,0.0)');
  ctx.fillStyle = under;
  ctx.fillRect(0, DECK_FRONT + h * 0.05, houseRight, h - DECK_FRONT - h * 0.05);

  // Wind chime under the eave. A background element: small, mostly silhouette,
  // one warm highlight and nothing more.
  const cxx = houseRight - U * 0.10;
  const cy = WALL + h * 0.055;
  ctx.strokeStyle = 'rgba(18,14,12,0.9)';
  ctx.lineWidth = Math.max(1, U * 0.0012);
  ctx.beginPath();
  ctx.moveTo(cxx, WALL);
  ctx.lineTo(cxx, cy);
  ctx.stroke();
  ctx.fillStyle = 'rgba(28,24,24,0.95)';
  ctx.beginPath();
  ctx.ellipse(cxx, cy, U * 0.013, h * 0.020, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cxx, cy + h * 0.019, U * 0.013, h * 0.006, 0, 0, Math.PI * 2);
  ctx.fill();
  const glint = ctx.createLinearGradient(cxx - U * 0.013, cy, cxx + U * 0.013, cy);
  glint.addColorStop(0, 'rgba(255,190,130,0)');
  glint.addColorStop(0.28, 'rgba(255,200,150,0.45)');
  glint.addColorStop(0.55, 'rgba(255,220,180,0.12)');
  glint.addColorStop(1, 'rgba(255,190,130,0)');
  ctx.fillStyle = glint;
  ctx.beginPath();
  ctx.ellipse(cxx, cy, U * 0.013, h * 0.020, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(36,30,28,0.8)';
  ctx.beginPath();
  ctx.moveTo(cxx, cy + h * 0.022);
  ctx.lineTo(cxx + U * 0.001, cy + h * 0.052);
  ctx.stroke();
  ctx.fillStyle = 'rgba(214,206,190,0.30)';
  ctx.fillRect(cxx - U * 0.0045, cy + h * 0.052, U * 0.009, h * 0.034);

  // Mosquito coil on the deck: a dark spiral and one dim orange point.
  const mx = houseRight - U * 0.30;
  const my = DECK_TOP + h * 0.032;
  ctx.strokeStyle = 'rgba(40,28,20,0.9)';
  ctx.lineWidth = Math.max(1.2, U * 0.0018);
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 6; a += 0.15) {
    const rad = U * 0.003 + a * U * 0.0011;
    const px = mx + Math.cos(a) * rad;
    const py = my + Math.sin(a) * rad * 0.42;
    if (a === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  const coilGlow = ctx.createRadialGradient(mx + U * 0.021, my, 0, mx + U * 0.021, my, U * 0.009);
  coilGlow.addColorStop(0, 'rgba(255,120,50,0.8)');
  coilGlow.addColorStop(1, 'rgba(255,120,50,0)');
  ctx.fillStyle = coilGlow;
  ctx.fillRect(mx, my - U * 0.011, U * 0.045, U * 0.022);

  // Bucket of water at the foot of the step. Nobody points at it; it is simply
  // there, the way a careful adult leaves it there.
  const bx = houseRight + U * 0.11;
  const by = DECK_FRONT + h * 0.115;
  const bw = U * 0.040;
  const bh = h * 0.082;
  const bodyG = ctx.createLinearGradient(bx - bw, by, bx + bw, by);
  bodyG.addColorStop(0, '#1a212a');
  bodyG.addColorStop(0.55, '#252d38');
  bodyG.addColorStop(0.82, '#48331f');
  bodyG.addColorStop(1, '#221a13');
  ctx.fillStyle = bodyG;
  ctx.beginPath();
  ctx.moveTo(bx - bw, by);
  ctx.lineTo(bx + bw, by);
  ctx.lineTo(bx + bw * 0.82, by + bh);
  ctx.lineTo(bx - bw * 0.82, by + bh);
  ctx.closePath();
  ctx.fill();
  const waterG = ctx.createLinearGradient(bx - bw, by - h * 0.008, bx + bw, by + h * 0.008);
  waterG.addColorStop(0, '#0e131c');
  waterG.addColorStop(0.5, '#182430');
  waterG.addColorStop(0.8, '#573c27');
  waterG.addColorStop(1, '#1d161c');
  ctx.fillStyle = waterG;
  ctx.beginPath();
  ctx.ellipse(bx, by, bw, h * 0.013, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,96,70,0.4)';
  ctx.lineWidth = Math.max(1, U * 0.0014);
  ctx.beginPath();
  ctx.ellipse(bx, by, bw, h * 0.013, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(96,76,56,0.42)';
  ctx.lineWidth = Math.max(1.2, U * 0.0016);
  ctx.beginPath();
  ctx.arc(bx, by - h * 0.003, bw * 0.98, Math.PI * 1.06, Math.PI * 1.94);
  ctx.stroke();

  softBlur(c, 5, 3);
  return toTexture(c);
}

// Near garden: shrubs and grass, rim-lit from the house side. A 6:1 plate, so
// that a thirty-metre-wide bed still has knee-high grass on it.
export function gardenTexture(w = 3072, h = 512, seed = 67) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const r = rng(seed);
  ctx.clearRect(0, 0, w, h);

  const baseY = h * 0.62;
  ctx.fillStyle = '#111b28';
  ctx.fillRect(0, baseY, w, h - baseY);

  // Feather the bed's upper edge, or the plate reads as a rectangle laid over
  // the treeline.
  const fade = ctx.createLinearGradient(0, baseY - h * 0.12, 0, baseY + h * 0.03);
  fade.addColorStop(0, 'rgba(17,27,40,0)');
  fade.addColorStop(1, 'rgba(17,27,40,1)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, baseY - h * 0.12, w, h * 0.15);

  // Shrub clumps along the bed.
  for (let i = 0; i < 150; i++) {
    const cx = r() * w;
    const cy = baseY + h * (r() * 0.06);
    const rx = h * (0.05 + r() * 0.13);
    const ry = h * (0.05 + r() * 0.13);
    ctx.fillStyle = `rgba(${(9 + r() * 9) | 0},${(18 + r() * 12) | 0},${(30 + r() * 16) | 0},1)`;
    ctx.beginPath();
    ctx.ellipse(cx, cy - ry * 0.6, rx, ry, (r() - 0.5) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Grass blades along the near edge.
  for (let i = 0; i < 1500; i++) {
    const x = r() * w;
    const y = h * (0.64 + r() * 0.36);
    const len = h * (0.03 + r() * 0.09);
    const lean = (r() - 0.5) * len * 0.8;
    ctx.strokeStyle = `rgba(${(20 + r() * 14) | 0},${(34 + r() * 16) | 0},${(42 + r() * 18) | 0},0.95)`;
    ctx.lineWidth = Math.max(1, h * 0.0035 * (0.5 + r()));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.4, y - len * 0.6, x + lean, y - len);
    ctx.stroke();
  }

  // Warm rim from the house, falling off away from it.
  const rim = ctx.createLinearGradient(0, 0, w * 0.5, 0);
  rim.addColorStop(0, 'rgba(255,150,80,0.22)');
  rim.addColorStop(0.4, 'rgba(220,120,70,0.09)');
  rim.addColorStop(1, 'rgba(120,90,80,0)');
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, w, h);
  // Cool sky bounce on the tops.
  const sky = ctx.createLinearGradient(0, baseY - h * 0.22, 0, baseY + h * 0.16);
  sky.addColorStop(0, 'rgba(80,100,158,0.24)');
  sky.addColorStop(1, 'rgba(36,46,84,0)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';

  softBlur(c, 6, 3);
  return toTexture(c);
}

// A defocused point of light. Real bokeh is brighter at the rim than the centre;
// that detail is most of what sells "this is behind the focal plane".
export function bokehTexture(size = 96) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const half = size / 2;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - half) / half;
      const dy = (y + 0.5 - half) / half;
      const d = Math.sqrt(dx * dx + dy * dy);
      const disc = 1 - smooth(d, 0.62, 0.88);
      const rim = Math.exp(-Math.pow((d - 0.72) / 0.13, 2)) * 0.55;
      const a = Math.max(0, disc * 0.55 + rim);
      const i = (y * size + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(Math.min(1, a) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  softBlur(c, 3, 1);
  return toTexture(c, { srgb: false });
}

function smooth(x, a, b) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export { softBlur, makeCanvas };
