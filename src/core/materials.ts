/**
 * Hero materials, all procedural (no downloads). Textures are generated
 * once on small canvases with a seeded RNG so every device renders the
 * same laboratory.
 */
import * as THREE from 'three';
import { makeRng } from './math';

function canvasTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  repeat = 1,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

function speckle(
  ctx: CanvasRenderingContext2D,
  size: number,
  base: string,
  dots: { color: string; count: number; rMin: number; rMax: number }[],
  seed: number,
) {
  const rng = makeRng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (const d of dots) {
    ctx.fillStyle = d.color;
    for (let i = 0; i < d.count; i++) {
      const r = d.rMin + rng() * (d.rMax - d.rMin);
      ctx.globalAlpha = 0.35 + rng() * 0.5;
      ctx.beginPath();
      ctx.arc(rng() * size, rng() * size, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function streaks(
  ctx: CanvasRenderingContext2D,
  size: number,
  base: string,
  tone: string,
  count: number,
  seed: number,
  vertical = false,
) {
  const rng = makeRng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = tone;
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = 0.04 + rng() * 0.1;
    ctx.lineWidth = 0.5 + rng() * 1.6;
    const p = rng() * size;
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(p, -4);
      ctx.lineTo(p + (rng() - 0.5) * 6, size + 4);
    } else {
      ctx.moveTo(-4, p);
      ctx.lineTo(size + 4, p + (rng() - 0.5) * 6);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export interface LabMaterials {
  blackSteel: THREE.MeshStandardMaterial; // blackened (oxide) letter segments
  blackSteelSlide: THREE.MeshStandardMaterial; // sliding faces — only these are shiny
  aluminum: THREE.MeshStandardMaterial; // guides, rails, adjusters (extruded/machined)
  aluminumDark: THREE.MeshStandardMaterial;
  castIron: THREE.MeshStandardMaterial; // handles, heavy stands
  castIronWorn: THREE.MeshStandardMaterial; // gripped rim, polished by hands
  epdm: THREE.MeshStandardMaterial; // industrial rubber / bellows
  granite: THREE.MeshStandardMaterial; // surface plate
  graniteSide: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  brass: THREE.MeshStandardMaterial; // small gauge frames / pins
  felt: THREE.MeshStandardMaterial; // tray lining
  concrete: THREE.MeshStandardMaterial;
  wallDark: THREE.MeshStandardMaterial;
  rubberBall: THREE.MeshStandardMaterial;
  woodBall: THREE.MeshStandardMaterial;
  steelBall: THREE.MeshStandardMaterial;
}

export function createMaterials(): LabMaterials {
  const graniteMap = canvasTexture(
    256,
    (ctx, s) =>
      speckle(
        ctx,
        s,
        '#34383b',
        [
          { color: '#2b2d30', count: 2600, rMin: 0.4, rMax: 1.4 },
          { color: '#6a7076', count: 1800, rMin: 0.3, rMax: 1.1 },
          { color: '#9aa0a4', count: 400, rMin: 0.25, rMax: 0.8 },
          { color: '#1d1e20', count: 300, rMin: 0.8, rMax: 2.2 },
        ],
        7,
      ),
    3,
  );
  const graniteRough = canvasTexture(
    128,
    (ctx, s) =>
      speckle(ctx, s, '#3a3a3a', [{ color: '#565656', count: 900, rMin: 0.4, rMax: 1.6 }], 11),
    3,
  );

  const aluMap = canvasTexture(128, (ctx, s) => streaks(ctx, s, '#9aa0a5', '#c8ced2', 90, 3), 2);
  const aluRough = canvasTexture(128, (ctx, s) => streaks(ctx, s, '#6a6a6a', '#3d3d3d', 120, 5), 2);

  const ironBump = canvasTexture(
    128,
    (ctx, s) =>
      speckle(ctx, s, '#808080', [
        { color: '#5c5c5c', count: 700, rMin: 0.6, rMax: 2.4 },
        { color: '#9a9a9a', count: 700, rMin: 0.5, rMax: 1.8 },
      ], 13),
    2,
  );

  const steelRough = canvasTexture(
    128,
    (ctx, s) =>
      speckle(ctx, s, '#8f8f8f', [
        { color: '#a8a8a8', count: 500, rMin: 0.8, rMax: 2.6 },
        { color: '#767676', count: 400, rMin: 0.8, rMax: 2.2 },
      ], 17),
    2,
  );

  const epdmBump = canvasTexture(64, (ctx, s) => streaks(ctx, s, '#7a7a7a', '#2f2f2f', 26, 19, true), 4);

  const concreteMap = canvasTexture(
    256,
    (ctx, s) =>
      speckle(
        ctx,
        s,
        '#474645',
        [
          { color: '#3e3d3b', count: 1600, rMin: 0.6, rMax: 2.6 },
          { color: '#524f4c', count: 1100, rMin: 0.5, rMax: 2.2 },
          { color: '#343331', count: 220, rMin: 1.2, rMax: 4 },
        ],
        23,
      ),
    6,
  );

  const woodMap = canvasTexture(128, (ctx, s) => {
    const rng = makeRng(29);
    ctx.fillStyle = '#a07647';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = i % 2 ? '#8a6238' : '#b28453';
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1 + rng() * 3;
      ctx.beginPath();
      const y = rng() * s;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(s * 0.3, y + rng() * 8 - 4, s * 0.7, y + rng() * 8 - 4, s, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, 2);

  return {
    blackSteel: new THREE.MeshStandardMaterial({
      color: 0x232427,
      metalness: 0.82,
      roughness: 0.62,
      roughnessMap: steelRough,
    }),
    blackSteelSlide: new THREE.MeshStandardMaterial({
      color: 0x42474f,
      metalness: 0.92,
      roughness: 0.26,
      roughnessMap: steelRough,
    }),
    aluminum: new THREE.MeshStandardMaterial({
      color: 0xb7bdc3,
      metalness: 0.95,
      roughness: 0.3,
      map: aluMap,
      roughnessMap: aluRough,
    }),
    aluminumDark: new THREE.MeshStandardMaterial({
      color: 0x787d82,
      metalness: 0.85,
      roughness: 0.5,
      roughnessMap: aluRough,
    }),
    castIron: new THREE.MeshStandardMaterial({
      color: 0x49505b,
      metalness: 0.35,
      roughness: 0.82,
      bumpMap: ironBump,
      bumpScale: 0.6,
    }),
    castIronWorn: new THREE.MeshStandardMaterial({
      color: 0x60646a,
      metalness: 0.75,
      roughness: 0.38,
    }),
    epdm: new THREE.MeshStandardMaterial({
      color: 0x1e1f21,
      metalness: 0,
      roughness: 0.92,
      bumpMap: epdmBump,
      bumpScale: 0.5,
    }),
    granite: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: graniteMap,
      metalness: 0.05,
      roughness: 0.36,
      roughnessMap: graniteRough,
    }),
    graniteSide: new THREE.MeshStandardMaterial({
      color: 0x8e9092,
      map: graniteMap,
      metalness: 0.02,
      roughness: 0.8,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xdce4e6,
      metalness: 0,
      roughness: 0.06,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    brass: new THREE.MeshStandardMaterial({ color: 0x8d774a, metalness: 0.9, roughness: 0.42 }),
    felt: new THREE.MeshStandardMaterial({ color: 0x31473c, metalness: 0, roughness: 1 }),
    concrete: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: concreteMap,
      metalness: 0,
      roughness: 0.95,
    }),
    wallDark: new THREE.MeshStandardMaterial({ color: 0x2c2d2f, metalness: 0.1, roughness: 0.95 }),
    rubberBall: new THREE.MeshStandardMaterial({
      color: 0xa8423a,
      metalness: 0,
      roughness: 0.78,
      bumpMap: ironBump,
      bumpScale: 0.15,
    }),
    woodBall: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: woodMap,
      metalness: 0,
      roughness: 0.55,
    }),
    steelBall: new THREE.MeshStandardMaterial({
      color: 0xd9dde0,
      metalness: 1,
      roughness: 0.12,
    }),
  };
}
