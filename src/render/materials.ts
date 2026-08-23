import * as THREE from 'three';
import { makeRng } from '../core/math';

/**
 * Procedural material kit. Everything is generated from a fixed seed so the
 * result is identical on every device — no downloaded assets, no variance.
 */

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function toTexture(c: HTMLCanvasElement, repeat = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * Precast concrete: aggregate speckle, bug holes, form-panel seams, faint
 * repair patches, grime concentrated at the bottom (splash zone) and a few
 * vertical run-off streaks — dirt follows water, not symmetry.
 */
export function concreteCanvas(seed: number, size = 512): HTMLCanvasElement {
  const rng = makeRng(seed);
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = '#b6b1a8';
  ctx.fillRect(0, 0, size, size);

  // large soft tonal blotches
  for (let i = 0; i < 26; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 40 + rng() * 140;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const l = 158 + rng() * 40;
    g.addColorStop(0, `rgba(${l},${l - 3},${l - 9},${0.1 + rng() * 0.12})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // form panel seams (horizontal) with slight offset — cast in lifts
  ctx.strokeStyle = 'rgba(84,80,74,0.45)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const y = size * (0.22 + i * 0.3) + rng() * 14;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + rng() * 4 - 2);
    ctx.stroke();
  }
  // form-tie holes on a loose grid, patched with mortar rings
  for (const ty of [0.3, 0.62]) {
    for (const tx of [0.22, 0.55, 0.86]) {
      const x = size * tx + rng() * 10 - 5;
      const y = size * ty + rng() * 10 - 5;
      ctx.fillStyle = 'rgba(96,92,86,0.55)';
      ctx.beginPath();
      ctx.arc(x, y, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,146,138,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 6.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // aggregate speckle + bug holes
  for (let i = 0; i < 1500; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 0.5 + rng() * 1.8;
    const dark = rng() < 0.62;
    const l = dark ? 96 + rng() * 46 : 196 + rng() * 34;
    ctx.fillStyle = `rgba(${l},${l - 2},${l - 8},${0.25 + rng() * 0.4})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 70; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 1.2 + rng() * 2.6;
    ctx.fillStyle = `rgba(72,69,64,${0.3 + rng() * 0.3})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // a couple of lighter repair patches (trowelled mortar)
  for (let i = 0; i < 3; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const w = 26 + rng() * 60;
    const h = 18 + rng() * 44;
    ctx.fillStyle = `rgba(202,198,188,${0.35 + rng() * 0.2})`;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,116,108,0.25)';
    ctx.stroke();
  }

  // vertical run-off streaks from a few anchor points
  for (let i = 0; i < 5; i++) {
    const x = rng() * size;
    const y0 = rng() * size * 0.5;
    const len = size * (0.25 + rng() * 0.5);
    const w = 3 + rng() * 8;
    const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
    g.addColorStop(0, 'rgba(84,80,72,0.3)');
    g.addColorStop(1, 'rgba(84,80,72,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - w / 2, y0, w, len);
  }

  // splash-zone grime at the bottom edge
  const g = ctx.createLinearGradient(0, size * 0.8, 0, size);
  g.addColorStop(0, 'rgba(70,68,60,0)');
  g.addColorStop(1, 'rgba(70,68,60,0.34)');
  ctx.fillStyle = g;
  ctx.fillRect(0, size * 0.8, size, size * 0.2);

  return c;
}

/** Galvanized steel spangle. */
export function steelCanvas(seed: number, size = 256): HTMLCanvasElement {
  const rng = makeRng(seed);
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = '#a8adb2';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 240; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 4 + rng() * 16;
    const l = 148 + rng() * 60;
    ctx.fillStyle = `rgba(${l},${l + 3},${l + 6},${0.14 + rng() * 0.16})`;
    ctx.beginPath();
    const n = 5 + Math.floor(rng() * 3);
    for (let k = 0; k <= n; k++) {
      const a = (k / n) * Math.PI * 2 + rng() * 0.5;
      const rr = r * (0.7 + rng() * 0.4);
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  return c;
}

/** Pale wood with growth rings + fiber direction. */
export function woodCanvas(seed: number, size = 256): HTMLCanvasElement {
  const rng = makeRng(seed);
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = '#cfa057';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 26; i++) {
    const y = (i / 26) * size + rng() * 6;
    ctx.strokeStyle = `rgba(${120 + rng() * 30},${86 + rng() * 22},${48 + rng() * 16},${0.2 + rng() * 0.25})`;
    ctx.lineWidth = 1 + rng() * 2.4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 16) {
      ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 3 + rng() * 2);
    }
    ctx.stroke();
  }
  return c;
}

export interface WetUniforms {
  uWetAmount: { value: number };
  uWetCenter: { value: number };
  uWetHalf: { value: number };
  uWetTopY: { value: number };
}

/**
 * Inject a "wet band" into a standard material: surfaces inside a horizontal
 * band (the water channel) darken and turn glossy while uWetAmount > 0.
 * Only where water actually runs — never a full-object tint.
 */
export function applyWetness(mat: THREE.MeshStandardMaterial): WetUniforms {
  const uniforms: WetUniforms = {
    uWetAmount: { value: 0 },
    uWetCenter: { value: 0 },
    uWetHalf: { value: 0.6 },
    uWetTopY: { value: 1.9 },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vKcWorld;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvKcWorld = (modelMatrix * vec4(position, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vKcWorld;\nuniform float uWetAmount;\nuniform float uWetCenter;\nuniform float uWetHalf;\nuniform float uWetTopY;',
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float kcWx = smoothstep(uWetHalf, uWetHalf * 0.3, abs(vKcWorld.x - uWetCenter));
        float kcWy = smoothstep(uWetTopY + 0.3, uWetTopY - 0.4, vKcWorld.y);
        float kcWet = clamp(uWetAmount, 0.0, 1.0) * kcWx * kcWy;
        diffuseColor.rgb *= mix(1.0, 0.42, kcWet);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.16, kcWet);`,
      );
  };
  mat.customProgramCacheKey = () => 'kc-wet';
  return uniforms;
}

export function makeConcreteMaterial(seed: number, repeat = 0.7): THREE.MeshStandardMaterial {
  const map = toTexture(concreteCanvas(seed), repeat);
  return new THREE.MeshStandardMaterial({
    map,
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0.0,
  });
}

export function makeSteelMaterial(seed: number): THREE.MeshStandardMaterial {
  const map = toTexture(steelCanvas(seed), 1.4);
  return new THREE.MeshStandardMaterial({
    map,
    color: 0xb2bbc3,
    roughness: 0.46,
    metalness: 0.85,
  });
}

export function makeWornSteelMaterial(seed: number): THREE.MeshStandardMaterial {
  // brighter, smoother — wheel-run and contact surfaces only
  const map = toTexture(steelCanvas(seed), 2);
  return new THREE.MeshStandardMaterial({
    map,
    color: 0xf2f4f5,
    roughness: 0.3,
    metalness: 0.9,
  });
}

export function makeRubberMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x3b3e42,
    roughness: 0.88,
    metalness: 0.0,
  });
}

export function makeWoodMaterial(seed: number): THREE.MeshStandardMaterial {
  const map = toTexture(woodCanvas(seed), 1);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.72, metalness: 0 });
}

/** Large ground texture: drainage falls, rail grooves, worn paint, wet border. */
export function floorCanvas(seed: number, size = 1024): HTMLCanvasElement {
  const rng = makeRng(seed);
  const c = concreteCanvas(seed + 7, size);
  const ctx = c.getContext('2d')!;

  // yard slab sits darker than the fresh precast letters
  ctx.fillStyle = 'rgba(88,86,82,0.22)';
  ctx.fillRect(0, 0, size, size);

  // broom finish: faint directional lines
  ctx.strokeStyle = 'rgba(100,96,90,0.07)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 140; i++) {
    const y = rng() * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + rng() * 3);
    ctx.stroke();
  }

  // expansion joints
  ctx.strokeStyle = 'rgba(70,68,64,0.26)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo((size * i) / 4 + rng() * 8, 0);
    ctx.lineTo((size * i) / 4 + rng() * 8, size);
    ctx.stroke();
  }

  // wet zone around the center drain, irregular border
  ctx.save();
  ctx.beginPath();
  const cy = size * 0.52;
  ctx.moveTo(0, cy - 60);
  for (let x = 0; x <= size; x += 32) {
    ctx.lineTo(x, cy - 60 - rng() * 46);
  }
  for (let x = size; x >= 0; x -= 32) {
    ctx.lineTo(x, cy + 60 + rng() * 46);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(58,58,56,0.2)';
  ctx.fill();
  ctx.restore();

  // worn yellow walkway line, off to one side, chipped
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#b99b3e';
  for (let x = 0; x < size; x += 26) {
    if (rng() < 0.82) ctx.fillRect(x, size * 0.86 + rng() * 3, 18, 7);
  }
  ctx.restore();
  return c;
}

export function makeFloorMaterial(seed: number): THREE.MeshStandardMaterial {
  const map = toTexture(floorCanvas(seed), 1);
  map.repeat.set(1, 1);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.96, metalness: 0 });
}

/** Alpha grid for the safety net. */
export function netCanvas(size = 256): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(size);
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,1)';
  ctx.lineWidth = 2.5;
  const step = size / 12;
  for (let i = 0; i <= 12; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }
  return c;
}

/** Mechanical distance gauge: engraved ticks on steel, no numbers needed. */
export function rulerCanvas(size = 1024): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#8f959a';
  ctx.fillRect(0, 0, size, 128);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(0, 0, size, 22);
  ctx.strokeStyle = 'rgba(40,42,45,0.85)';
  for (let i = 0; i <= 64; i++) {
    const x = (i / 64) * size;
    const major = i % 8 === 0;
    ctx.lineWidth = major ? 5 : 2.5;
    ctx.beginPath();
    ctx.moveTo(x, 128);
    ctx.lineTo(x, major ? 34 : 76);
    ctx.stroke();
  }
  return c;
}

export function makeStripeAlpha(size = 128): THREE.CanvasTexture {
  // broken vertical streaks: the ribbon reads as moving water, not a bar
  const rng = makeRng(606);
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(0, 0, size, size);
  // brighter core
  const core = ctx.createLinearGradient(0, 0, size, 0);
  core.addColorStop(0, 'rgba(255,255,255,0)');
  core.addColorStop(0.5, 'rgba(255,255,255,0.28)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 26; i++) {
    const x = rng() * size;
    const w = 2 + rng() * 5;
    const y0 = rng() * size;
    const len = size * (0.25 + rng() * 0.6);
    const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, `rgba(255,255,255,${0.5 + rng() * 0.45})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - w / 2, y0, w, len);
    // texture wraps vertically
    ctx.fillRect(x - w / 2, y0 - size, w, len);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}
