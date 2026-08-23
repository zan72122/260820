import * as THREE from 'three';

// Procedural textures + a small library of physically-plausible materials.
// Deterministic pseudo-random so E2E renders are stable.

let seed = 1234;
export function rand(): number {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
export function resetSeed(s = 1234): void { seed = s; }

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function grain(ctx: CanvasRenderingContext2D, size: number, n: number, alpha: number, dark = true): void {
  for (let i = 0; i < n; i++) {
    const v = Math.floor(rand() * 60);
    ctx.fillStyle = dark
      ? `rgba(${20 + v},${20 + v},${22 + v},${alpha * rand()})`
      : `rgba(${200 + v * 0.5},${200 + v * 0.5},${198 + v * 0.5},${alpha * rand()})`;
    const s = 1 + rand() * 3;
    ctx.fillRect(rand() * size, rand() * size, s, s);
  }
}

/** concrete workshop floor with expansion joints, wear path and stains */
export function makeFloorTexture(): { map: THREE.Texture; rough: THREE.Texture } {
  const S = 1024;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#8d8a84';
  ctx.fillRect(0, 0, S, S);
  // large tonal patches
  for (let i = 0; i < 42; i++) {
    const g = 128 + Math.floor(rand() * 30) - 15;
    ctx.fillStyle = `rgba(${g},${g - 3},${g - 8},0.14)`;
    ctx.beginPath();
    ctx.ellipse(rand() * S, rand() * S, 60 + rand() * 220, 40 + rand() * 160, rand() * 3, 0, 7);
    ctx.fill();
  }
  grain(ctx, S, 9000, 0.16);
  // oil stains, kept sparse and near the middle band (machine line)
  for (let i = 0; i < 7; i++) {
    const x = rand() * S, y = S * 0.35 + rand() * S * 0.3;
    const r = 12 + rand() * 40;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, 'rgba(38,36,34,0.34)');
    g.addColorStop(1, 'rgba(38,36,34,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // worn walking path (operator line, horizontal band)
  const wg = ctx.createLinearGradient(0, S * 0.62, 0, S * 0.86);
  wg.addColorStop(0, 'rgba(120,116,110,0)');
  wg.addColorStop(0.5, 'rgba(134,130,122,0.5)');
  wg.addColorStop(1, 'rgba(120,116,110,0)');
  ctx.fillStyle = wg;
  ctx.fillRect(0, S * 0.62, S, S * 0.24);
  // expansion joints
  ctx.strokeStyle = 'rgba(48,46,44,0.85)';
  ctx.lineWidth = 3;
  for (const fx of [0.25, 0.5, 0.75]) {
    ctx.beginPath(); ctx.moveTo(fx * S, 0); ctx.lineTo(fx * S, S); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(0, S * 0.55); ctx.lineTo(S, S * 0.55); ctx.stroke();

  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  const [c2, ctx2] = canvas(512);
  ctx2.fillStyle = '#b9b9b9';
  ctx2.fillRect(0, 0, 512, 512);
  grain(ctx2, 512, 4000, 0.3);
  // worn path is smoother (darker in roughness map = smoother)
  const wg2 = ctx2.createLinearGradient(0, 512 * 0.62, 0, 512 * 0.86);
  wg2.addColorStop(0, 'rgba(150,150,150,0)');
  wg2.addColorStop(0.5, 'rgba(122,122,122,0.7)');
  wg2.addColorStop(1, 'rgba(150,150,150,0)');
  ctx2.fillStyle = wg2;
  ctx2.fillRect(0, 512 * 0.62, 512, 512 * 0.24);
  const rough = new THREE.CanvasTexture(c2);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  return { map, rough };
}

/** painted plaster / light industrial wall */
export function makeWallTexture(): THREE.Texture {
  const S = 512;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#a8a49c';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) {
    const g = 160 + Math.floor(rand() * 22) - 11;
    ctx.fillStyle = `rgba(${g},${g - 4},${g - 10},0.05)`;
    ctx.beginPath();
    ctx.ellipse(rand() * S, rand() * S, 50 + rand() * 150, 40 + rand() * 120, rand() * 3, 0, 7);
    ctx.fill();
  }
  grain(ctx, S, 2600, 0.08);
  // subtle scuffs near the bottom
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = 'rgba(90,86,80,0.10)';
    ctx.fillRect(rand() * S, S * 0.82 + rand() * S * 0.16, 20 + rand() * 60, 2 + rand() * 5);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** milky projection screen: clean center, handling marks at edges, dirt at bottom */
export function makeScreenTexture(): { map: THREE.Texture; rough: THREE.Texture } {
  const S = 512;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#f4f2ee';
  ctx.fillRect(0, 0, S, S);
  // faint fabric/acrylic tone variation
  for (let i = 0; i < 20; i++) {
    const g = 240 + Math.floor(rand() * 10) - 5;
    ctx.fillStyle = `rgba(${g},${g - 1},${g - 3},0.10)`;
    ctx.beginPath();
    ctx.ellipse(rand() * S, rand() * S, 80 + rand() * 160, 60 + rand() * 120, rand() * 3, 0, 7);
    ctx.fill();
  }
  // dirt along the bottom edge and lower corners (handling)
  const bg = ctx.createLinearGradient(0, S * 0.9, 0, S);
  bg.addColorStop(0, 'rgba(120,112,100,0)');
  bg.addColorStop(1, 'rgba(120,112,100,0.16)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, S * 0.9, S, S * 0.1);
  for (const cx of [0.03, 0.97]) {
    const g = ctx.createRadialGradient(cx * S, S * 0.97, 2, cx * S, S * 0.97, 46);
    g.addColorStop(0, 'rgba(110,102,92,0.2)');
    g.addColorStop(1, 'rgba(110,102,92,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const [c2, ctx2] = canvas(256);
  ctx2.fillStyle = '#d2d2d2';
  ctx2.fillRect(0, 0, 256, 256);
  grain(ctx2, 256, 900, 0.12);
  const rough = new THREE.CanvasTexture(c2);
  return { map, rough };
}

/** engraved degree scale strip for the turntable rim */
export function makeScaleTexture(): THREE.Texture {
  const W = 1024, H = 64;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#3a3c40';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#c8cacc';
  for (let i = 0; i < 72; i++) {
    const x = (i / 72) * W;
    const major = i % 6 === 0;
    ctx.lineWidth = major ? 2.4 : 1.2;
    ctx.globalAlpha = major ? 0.9 : 0.55;
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x, major ? H * 0.28 : H * 0.55);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface MatLib {
  castIron: THREE.MeshStandardMaterial;
  ironRim: THREE.MeshStandardMaterial;
  steelPainted: THREE.MeshStandardMaterial;
  steelPaintedDark: THREE.MeshStandardMaterial;
  alu: THREE.MeshStandardMaterial;
  matteBlack: THREE.MeshStandardMaterial;
  steelDark: THREE.MeshStandardMaterial;
  lampHousing: THREE.MeshStandardMaterial;
  lens: THREE.MeshPhysicalMaterial;
  cable: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  cardboard: THREE.MeshStandardMaterial;
  binPlastic: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  concreteBase: THREE.MeshStandardMaterial;
}

export function makeMaterials(): MatLib {
  return {
    // cast iron: dark, rough, slightly speckled tone
    castIron: new THREE.MeshStandardMaterial({ color: 0x2e2f31, roughness: 0.74, metalness: 0.72 }),
    // handwheel rim polished by hands — reads bright against the dark table
    ironRim: new THREE.MeshStandardMaterial({ color: 0x686c71, roughness: 0.28, metalness: 0.85 }),
    // machine-tool grey-green paint
    steelPainted: new THREE.MeshStandardMaterial({ color: 0x6d7269, roughness: 0.52, metalness: 0.12 }),
    steelPaintedDark: new THREE.MeshStandardMaterial({ color: 0x4b5049, roughness: 0.56, metalness: 0.12 }),
    // bare aluminium extrusion
    alu: new THREE.MeshStandardMaterial({ color: 0xc7cbd0, roughness: 0.38, metalness: 0.92 }),
    // black-oxidised projection parts: functional low reflectance
    matteBlack: new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.92, metalness: 0.42 }),
    steelDark: new THREE.MeshStandardMaterial({ color: 0x36383b, roughness: 0.6, metalness: 0.78 }),
    lampHousing: new THREE.MeshStandardMaterial({ color: 0x3c3e42, roughness: 0.58, metalness: 0.55 }),
    lens: new THREE.MeshPhysicalMaterial({
      color: 0xf8f6ee, roughness: 0.12, metalness: 0,
      transparent: true, opacity: 0.9,
      emissive: 0xfff3da, emissiveIntensity: 0,
    }),
    cable: new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.85, metalness: 0.05 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x8a6f50, roughness: 0.8, metalness: 0 }),
    cardboard: new THREE.MeshStandardMaterial({ color: 0x9a7f5c, roughness: 0.92, metalness: 0 }),
    binPlastic: new THREE.MeshStandardMaterial({ color: 0x5a6a74, roughness: 0.7, metalness: 0 }),
    brass: new THREE.MeshStandardMaterial({ color: 0x9a824e, roughness: 0.45, metalness: 0.85 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x232324, roughness: 0.95, metalness: 0 }),
    concreteBase: new THREE.MeshStandardMaterial({ color: 0x7e7b76, roughness: 0.9, metalness: 0 }),
  };
}
