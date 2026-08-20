/**
 * Detail budget.
 *
 * `fast` is the profile used by automated runs on a software rasteriser: fixed
 * seed, no shadows, no particles, tiny textures. It exists so screenshots are
 * deterministic and cheap — never to judge how the game actually looks.
 */
const HIGH = {
  name: 'high',
  pixelRatioCap: 2.0,
  shadowMap: 2048,
  rindTexture: 1024,
  sectionTexture: 1024,
  sandTexture: 512,
  sheetTexture: 512,
  foamTexture: 512,
  clothTexture: 512,
  melonSegments: 96,
  chunkPhi: 44, chunkTheta: 18, chunkRadial: 14,
  seedCount: 26,
  dropletCount: 46,
  seaSegments: 128,
  crowdCount: 26,
  debrisCount: 90,
  shadows: true,
  particles: true,
};

const MEDIUM = {
  ...HIGH,
  name: 'medium',
  pixelRatioCap: 1.75,
  shadowMap: 1024,
  rindTexture: 768,
  sectionTexture: 768,
  melonSegments: 72,
  chunkPhi: 34, chunkTheta: 14, chunkRadial: 11,
  seedCount: 18,
  dropletCount: 30,
  seaSegments: 96,
  crowdCount: 18,
  debrisCount: 55,
};

const FAST = {
  ...MEDIUM,
  name: 'fast',
  pixelRatioCap: 1.0,
  shadowMap: 512,
  rindTexture: 512,
  sectionTexture: 512,
  sandTexture: 256,
  sheetTexture: 256,
  foamTexture: 256,
  clothTexture: 256,
  melonSegments: 48,
  chunkPhi: 26, chunkTheta: 10, chunkRadial: 8,
  seedCount: 10,
  dropletCount: 0,
  seaSegments: 48,
  crowdCount: 8,
  debrisCount: 20,
  shadows: false,
  particles: false,
};

export function pickQuality() {
  const q = new URLSearchParams(location.search);
  if (q.has('e2e') || q.has('fast') || window.__E2E_FAST) {
    // `shadows=1` re-enables sun shadows for a one-off look at the composition
    return { ...FAST, e2e: true, shadows: q.get('shadows') === '1' };
  }

  const dpr = window.devicePixelRatio || 1;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const small = Math.min(window.innerWidth, window.innerHeight) * dpr < 800;
  if (cores <= 4 || mem <= 3 || small) return { ...MEDIUM, e2e: false };
  return { ...HIGH, e2e: false };
}
