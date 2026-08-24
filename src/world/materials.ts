import * as THREE from 'three';

/**
 * Procedural hero materials. All textures are generated on small canvases at
 * boot (no downloads). Weathering is placed only where load, water, hands,
 * grease and gravity would put it — never uniformly.
 */

// Deterministic PRNG so E2E screenshots are reproducible.
let seed = 941;
export function rand(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
export function resetSeed(s = 941): void { seed = s; }

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}

function grain(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, alpha: number, dark = true): void {
  for (let i = 0; i < n; i++) {
    const v = Math.floor(rand() * 60);
    ctx.fillStyle = dark
      ? `rgba(${20 + v},${20 + v},${22 + v},${alpha * rand()})`
      : `rgba(${200 + v * 0.5},${200 + v * 0.5},${200 + v * 0.5},${alpha * rand()})`;
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
  }
}

function tex(c: HTMLCanvasElement, repeatX = 1, repeatY = 1, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface MaterialKit {
  beamPaint: THREE.MeshStandardMaterial;       // painted steel switch girder (light warm grey)
  beamPaintSide: THREE.MeshStandardMaterial;   // flexing guide-face band, slightly different sheen
  pcTrack: THREE.MeshStandardMaterial;         // PC track girder concrete
  runningSurface: THREE.MeshStandardMaterial;  // tire-polished top of the beams
  concrete: THREE.MeshStandardMaterial;        // deck / piers
  concreteDark: THREE.MeshStandardMaterial;    // shaded understructure
  galv: THREE.MeshStandardMaterial;            // galvanised fittings, fence
  steelBlue: THREE.MeshStandardMaterial;       // machinery paint (drive units)
  steelDark: THREE.MeshStandardMaterial;       // trolley frames
  grease: THREE.MeshStandardMaterial;          // pivots / bearings
  machined: THREE.MeshStandardMaterial;        // lock faces, bed plates
  rubber: THREE.MeshStandardMaterial;          // tires
  cabinet: THREE.MeshStandardMaterial;         // control cabinet enamel
  trainBody: THREE.MeshStandardMaterial;
  trainStripe: THREE.MeshStandardMaterial;
  glassDark: THREE.MeshStandardMaterial;
  doorPanel: THREE.MeshStandardMaterial;
  roofKit: THREE.MeshStandardMaterial;
  headlight: THREE.MeshStandardMaterial;
  asphalt: THREE.MeshStandardMaterial;
}

export function buildMaterials(): MaterialKit {
  resetSeed(941);

  // --- painted steel (switch girders): light warm grey, faint rain streaks
  const [pc, pctx] = canvas(256, 256);
  pctx.fillStyle = '#b8bcba'; pctx.fillRect(0, 0, 256, 256);
  grain(pctx, 256, 256, 900, 0.05);
  // rain streaks fall from the top edge only (gravity), sparse
  for (let i = 0; i < 7; i++) {
    const x = rand() * 256;
    const len = 40 + rand() * 120;
    const g = pctx.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, 'rgba(88,92,90,0.16)');
    g.addColorStop(1, 'rgba(88,92,90,0)');
    pctx.fillStyle = g;
    pctx.fillRect(x, 0, 1.5 + rand() * 2, len);
  }
  const beamPaint = new THREE.MeshStandardMaterial({
    map: tex(pc, 1.4, 1.4), roughness: 0.62, metalness: 0.18,
  });

  const beamPaintSide = new THREE.MeshStandardMaterial({
    color: 0xb2b6b4, roughness: 0.5, metalness: 0.22,
  });

  // --- PC concrete track girder
  const [cc, cctx] = canvas(256, 256);
  cctx.fillStyle = '#b9b4ab'; cctx.fillRect(0, 0, 256, 256);
  grain(cctx, 256, 256, 1400, 0.07);
  for (let i = 0; i < 40; i++) { // pores: subtle, small
    cctx.fillStyle = `rgba(80,76,70,${0.06 + rand() * 0.09})`;
    cctx.beginPath();
    cctx.arc(rand() * 256, rand() * 256, 0.4 + rand() * 0.8, 0, 7);
    cctx.fill();
  }
  const pcTrack = new THREE.MeshStandardMaterial({
    map: tex(cc, 2, 1), roughness: 0.93, metalness: 0.0,
  });

  // --- tire-polished running surface: dark twin wear bands where the tires run
  const [rs, rstx] = canvas(128, 256);
  rstx.fillStyle = '#a9aca9'; rstx.fillRect(0, 0, 128, 256);
  grain(rstx, 128, 256, 350, 0.05);
  const band = (cx: number) => {
    const g = rstx.createLinearGradient(cx - 22, 0, cx + 22, 0);
    g.addColorStop(0, 'rgba(52,52,52,0)');
    g.addColorStop(0.5, 'rgba(52,52,52,0.55)');
    g.addColorStop(1, 'rgba(52,52,52,0)');
    rstx.fillStyle = g; rstx.fillRect(cx - 22, 0, 44, 256);
  };
  band(38); band(90);
  const runningSurface = new THREE.MeshStandardMaterial({
    map: tex(rs, 1, 6), roughness: 0.55, metalness: 0.05,
  });

  // --- deck concrete with drainage stains only along seams
  const [dc, dctx] = canvas(512, 512);
  dctx.fillStyle = '#a8a49c'; dctx.fillRect(0, 0, 512, 512);
  grain(dctx, 512, 512, 4200, 0.06);
  for (let i = 0; i < 4; i++) { // expansion joints with light dirt build-up
    const y = 64 + i * 128 + rand() * 20;
    dctx.fillStyle = 'rgba(70,68,62,0.22)';
    dctx.fillRect(0, y, 512, 1.4);
    dctx.fillStyle = 'rgba(70,68,62,0.07)';
    dctx.fillRect(0, y + 1.4, 512, 4);
  }
  const concrete = new THREE.MeshStandardMaterial({
    map: tex(dc, 3, 3), roughness: 0.96, metalness: 0.0,
  });
  const concreteDark = new THREE.MeshStandardMaterial({
    color: 0x8d897f, roughness: 0.97,
  });

  const galv = new THREE.MeshStandardMaterial({
    color: 0x9aa2a6, roughness: 0.55, metalness: 0.6,
  });

  const steelBlue = new THREE.MeshStandardMaterial({
    color: 0x3b6a8f, roughness: 0.48, metalness: 0.3,
  });

  const steelDark = new THREE.MeshStandardMaterial({
    color: 0x585d62, roughness: 0.55, metalness: 0.4,
  });

  const grease = new THREE.MeshStandardMaterial({
    color: 0x1d1c1a, roughness: 0.3, metalness: 0.5,
  });

  const machined = new THREE.MeshStandardMaterial({
    color: 0xc4c8ca, roughness: 0.3, metalness: 0.55,
  });

  const rubber = new THREE.MeshStandardMaterial({
    color: 0x1a1a1c, roughness: 0.92, metalness: 0.0,
  });

  const cabinet = new THREE.MeshStandardMaterial({
    color: 0xbfc7c4, roughness: 0.42, metalness: 0.25,
  });

  const trainBody = new THREE.MeshStandardMaterial({
    color: 0xe6e9ea, roughness: 0.32, metalness: 0.35,
  });
  const trainStripe = new THREE.MeshStandardMaterial({
    color: 0x2f7fa8, roughness: 0.35, metalness: 0.3,
  });
  const glassDark = new THREE.MeshStandardMaterial({
    color: 0x20262c, roughness: 0.12, metalness: 0.6,
  });
  const doorPanel = new THREE.MeshStandardMaterial({
    color: 0xd6dadb, roughness: 0.4, metalness: 0.3,
  });
  const roofKit = new THREE.MeshStandardMaterial({
    color: 0xb9bdbd, roughness: 0.6, metalness: 0.3,
  });
  const headlight = new THREE.MeshStandardMaterial({
    color: 0xdadfe2, emissive: 0x666045, emissiveIntensity: 0.7,
  });

  const asphalt = new THREE.MeshStandardMaterial({
    color: 0x757570, roughness: 0.98,
  });

  return {
    beamPaint, beamPaintSide, pcTrack, runningSurface, concrete, concreteDark,
    galv, steelBlue, steelDark, grease, machined, rubber, cabinet,
    trainBody, trainStripe, glassDark, doorPanel, roofKit, headlight, asphalt,
  };
}
