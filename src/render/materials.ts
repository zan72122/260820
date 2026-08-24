import * as THREE from 'three';

/**
 * 手続きテクスチャ群。決定的(乱数は固定シードLCG)。
 */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

/**
 * 磁器タイル床。60cmグリッド、目地、摩耗導線(横切り廊下と入口導線)、
 * 清掃後の微細な艶差。左右対称にならないよう摩耗はシード乱数で崩す。
 * テクスチャは 8m×8m をカバーし、UVでワールドへ割り付ける。
 */
export function makeFloorTextures(): {
  map: THREE.Texture;
  roughnessMap: THREE.Texture;
} {
  const SIZE = 1024;
  const METERS = 8;
  const px = SIZE / METERS;
  const rand = lcg(20260824);

  const [c, ctx] = makeCanvas(SIZE);
  // 基調: 明るいグレージュの磁器タイル
  ctx.fillStyle = '#b9b4ac';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // タイルごとの微妙な色むら
  const tile = 0.6 * px;
  for (let ty = 0; ty < METERS / 0.6 + 1; ty++) {
    for (let tx = 0; tx < METERS / 0.6 + 1; tx++) {
      const v = (rand() - 0.5) * 14;
      const warm = (rand() - 0.5) * 6;
      ctx.fillStyle = `rgb(${185 + v + warm}, ${180 + v}, ${172 + v - warm})`;
      ctx.fillRect(tx * tile + 1, ty * tile + 1, tile - 2, tile - 2);
      // タイル内のごく薄い斑
      for (let i = 0; i < 14; i++) {
        const a = rand() * 0.05;
        ctx.fillStyle = `rgba(${120 + rand() * 60}, ${115 + rand() * 60}, ${110 + rand() * 55}, ${a})`;
        const rx = tx * tile + rand() * tile;
        const ry = ty * tile + rand() * tile;
        const rr = 1 + rand() * 5;
        ctx.beginPath();
        ctx.arc(rx, ry, rr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 目地
  ctx.strokeStyle = '#8f8a82';
  ctx.lineWidth = 2.2;
  for (let i = 0; i <= METERS / 0.6 + 1; i++) {
    const p = i * tile;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(SIZE, p);
    ctx.stroke();
  }

  // 摩耗導線(うっすら暗く)。非対称に、蛇行させる。
  const wearLane = (
    cx: number,
    cy: number,
    horizontal: boolean,
    widthM: number,
    alpha: number,
  ): void => {
    ctx.save();
    ctx.globalAlpha = alpha;
    const grd = horizontal
      ? ctx.createLinearGradient(0, cy - widthM * px * 0.5, 0, cy + widthM * px * 0.5)
      : ctx.createLinearGradient(cx - widthM * px * 0.5, 0, cx + widthM * px * 0.5, 0);
    grd.addColorStop(0, 'rgba(90,86,80,0)');
    grd.addColorStop(0.5, 'rgba(90,86,80,0.55)');
    grd.addColorStop(1, 'rgba(90,86,80,0)');
    ctx.fillStyle = grd;
    if (horizontal) ctx.fillRect(0, cy - widthM * px * 0.5, SIZE, widthM * px);
    else ctx.fillRect(cx - widthM * px * 0.5, 0, widthM * px, SIZE);
    ctx.restore();
  };
  // (UV割付: 床メッシュ側で 8m 周期。CanvasTexture は flipY のため
  //  横導線はキャンバス上で METERS - z の位置に描く)
  wearLane(0, (METERS - 2.6) * px, true, 1.4, 0.5);
  wearLane(0.35 * px, 0, false, 1.1, 0.4);

  // こすれ跡(非対称のランダム筋)
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#6f6a63';
  for (let i = 0; i < 26; i++) {
    ctx.lineWidth = 0.6 + rand() * 1.4;
    ctx.beginPath();
    const x0 = rand() * SIZE;
    const y0 = rand() * SIZE;
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(
      x0 + (rand() - 0.5) * 90,
      y0 + (rand() - 0.5) * 90,
      x0 + (rand() - 0.5) * 160,
      y0 + (rand() - 0.5) * 160,
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  // ラフネス: 摩耗導線はわずかに艶が出る(=ラフネス低下)。全面鏡面にはしない。
  const [rc, rctx] = makeCanvas(512);
  rctx.fillStyle = '#b8b8b8'; // 基本ラフネス ~0.72
  rctx.fillRect(0, 0, 512, 512);
  const rpx = 512 / METERS;
  const lane = (cy: number, w: number): void => {
    const g = rctx.createLinearGradient(0, cy - w * rpx * 0.5, 0, cy + w * rpx * 0.5);
    g.addColorStop(0, 'rgba(150,150,150,0)');
    g.addColorStop(0.5, 'rgba(150,150,150,0.7)');
    g.addColorStop(1, 'rgba(150,150,150,0)');
    rctx.fillStyle = g;
    rctx.fillRect(0, cy - w * rpx * 0.5, 512, w * rpx);
  };
  lane((METERS - 2.6) * rpx, 1.4);
  const rrand = lcg(7);
  for (let i = 0; i < 300; i++) {
    rctx.fillStyle = `rgba(${170 + rrand() * 40},${170 + rrand() * 40},${170 + rrand() * 40},0.25)`;
    rctx.fillRect(rrand() * 512, rrand() * 512, 2 + rrand() * 8, 2 + rrand() * 8);
  }
  const roughnessMap = new THREE.CanvasTexture(rc);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;

  return { map, roughnessMap };
}

/** 合わせガラスの視認マーク(ドット帯)。 */
export function makeGlassDotTexture(): THREE.Texture {
  const [c, ctx] = makeCanvas(256);
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(235,235,235,0.85)';
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 16; x++) {
      ctx.beginPath();
      ctx.arc(x * 16 + 8, 120 + y * 20, 4.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** センサー筐体の樹脂: 薄い清掃傷入りの黒ポリカーボネート。 */
export function makeHousingRoughness(): THREE.Texture {
  const [c, ctx] = makeCanvas(256);
  ctx.fillStyle = '#7d7d7d';
  ctx.fillRect(0, 0, 256, 256);
  const rand = lcg(99);
  ctx.strokeStyle = 'rgba(200,200,200,0.5)';
  for (let i = 0; i < 60; i++) {
    ctx.lineWidth = 0.5 + rand();
    ctx.beginPath();
    const y = rand() * 256;
    ctx.moveTo(rand() * 60, y);
    ctx.lineTo(256 - rand() * 60, y + (rand() - 0.5) * 8);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export interface MaterialSet {
  floor: THREE.MeshStandardMaterial;
  wall: THREE.MeshStandardMaterial;
  wallGuard: THREE.MeshStandardMaterial;
  ceiling: THREE.MeshStandardMaterial;
  aluminum: THREE.MeshStandardMaterial;
  aluminumDark: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  glassEdge: THREE.MeshStandardMaterial;
  glassDots: THREE.MeshBasicMaterial;
  housing: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  robotShell: THREE.MeshStandardMaterial;
  robotAccent: THREE.MeshStandardMaterial;
  foam: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  doorSeal: THREE.MeshStandardMaterial;
}

export function makeMaterials(envMap: THREE.Texture | null): MaterialSet {
  const floorTex = makeFloorTextures();
  const floor = new THREE.MeshStandardMaterial({
    map: floorTex.map,
    roughnessMap: floorTex.roughnessMap,
    roughness: 1,
    metalness: 0.02,
    envMapIntensity: 0.5,
  });

  const wall = new THREE.MeshStandardMaterial({ color: 0xdcd6cb, roughness: 0.92 });
  const wallGuard = new THREE.MeshStandardMaterial({ color: 0xb9c0bd, roughness: 0.6 });
  const ceiling = new THREE.MeshStandardMaterial({ color: 0xe8e6e1, roughness: 0.95 });

  const aluminum = new THREE.MeshStandardMaterial({
    color: 0xb8bcc0,
    metalness: 0.85,
    roughness: 0.38,
    envMapIntensity: 0.9,
  });
  const aluminumDark = new THREE.MeshStandardMaterial({
    color: 0x84888c,
    metalness: 0.8,
    roughness: 0.45,
  });

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xe8efec,
    metalness: 0,
    roughness: 0.06,
    transparent: true,
    opacity: 0.22,
    envMapIntensity: 1.3,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  // 合わせガラスの小口(エッジ)の淡い緑
  const glassEdge = new THREE.MeshStandardMaterial({
    color: 0x6d9a86,
    roughness: 0.35,
    metalness: 0.05,
    transparent: true,
    opacity: 0.85,
  });
  const glassDots = new THREE.MeshBasicMaterial({
    map: makeGlassDotTexture(),
    transparent: true,
    depthWrite: false,
  });

  const housing = new THREE.MeshStandardMaterial({
    color: 0x232526, // 光を吸収しすぎない黒
    roughness: 0.55,
    roughnessMap: makeHousingRoughness(),
    metalness: 0.08,
    envMapIntensity: 0.7,
  });

  const rubber = new THREE.MeshStandardMaterial({
    color: 0x2b2a28,
    roughness: 0.92,
    metalness: 0,
  });
  const robotShell = new THREE.MeshStandardMaterial({
    color: 0xeceae5,
    roughness: 0.42,
    metalness: 0.05,
    envMapIntensity: 0.8,
  });
  const robotAccent = new THREE.MeshStandardMaterial({
    color: 0x8a9aa6,
    roughness: 0.5,
    metalness: 0.2,
  });
  const foam = new THREE.MeshStandardMaterial({ color: 0xc9c2a8, roughness: 0.98 });
  const steel = new THREE.MeshStandardMaterial({
    color: 0x9aa0a4,
    metalness: 0.8,
    roughness: 0.4,
  });
  const doorSeal = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.95 });

  if (envMap) {
    for (const m of [floor, aluminum, aluminumDark, glass, housing, robotShell, steel]) {
      m.envMap = envMap;
    }
  }

  return {
    floor,
    wall,
    wallGuard,
    ceiling,
    aluminum,
    aluminumDark,
    glass,
    glassEdge,
    glassDots,
    housing,
    rubber,
    robotShell,
    robotAccent,
    foam,
    steel,
    doorSeal,
  };
}
