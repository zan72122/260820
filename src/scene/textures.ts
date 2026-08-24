import { CanvasTexture, RepeatWrapping, SRGBColorSpace, Texture } from 'three';
import { makeRng } from '../core/rng';

/**
 * Procedural maps for the skills lab.
 *
 * All wear is authored where a hand, a wheel or a shoe would actually put it:
 * the rim of the chestpiece, the bend of the tube, the contact strip of the
 * exam pad, the handle of the cart, the traffic line on the floor. There is no
 * symmetric grime and no all-over grunge layer.
 */

function canvas(size: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas unavailable');
  return { c, g };
}

function finish(c: HTMLCanvasElement, srgb: boolean, repeat = 1): CanvasTexture {
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = SRGBColorSpace;
  return t;
}

function speckle(
  g: CanvasRenderingContext2D,
  size: number,
  seed: number,
  count: number,
  radius: number,
  colors: string[],
): void {
  const rng = makeRng(seed);
  for (let i = 0; i < count; i++) {
    g.fillStyle = colors[Math.floor(rng() * colors.length)];
    const r = radius * (0.4 + rng() * 1.3);
    g.beginPath();
    g.arc(rng() * size, rng() * size, r, 0, Math.PI * 2);
    g.fill();
  }
}

/** Sheet-vinyl floor: welded seams and a worn traffic line along the room. */
export function makeFloorTexture(): CanvasTexture {
  const size = 1024;
  const { c, g } = canvas(size);
  g.fillStyle = '#8d8577';
  g.fillRect(0, 0, size, size);
  speckle(g, size, 4242, 5200, 1.5, ['#7d7568', '#9b937f', '#847c6e', '#a49b88']);

  // Welded seams between sheet runs.
  g.strokeStyle = 'rgba(92,86,76,0.55)';
  g.lineWidth = 2.5;
  for (let i = 0; i <= 2; i++) {
    const x = (size / 2) * i;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, size);
    g.stroke();
  }

  // Traffic wear: a polished band along the way people walk, nothing else.
  const grad = g.createLinearGradient(0, size * 0.38, 0, size * 0.72);
  grad.addColorStop(0, 'rgba(190,183,168,0)');
  grad.addColorStop(0.5, 'rgba(196,189,174,0.34)');
  grad.addColorStop(1, 'rgba(190,183,168,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return finish(c, true, 3);
}

export function makeFloorRoughness(): CanvasTexture {
  const size = 512;
  const { c, g } = canvas(size);
  g.fillStyle = '#c8c8c8';
  g.fillRect(0, 0, size, size);
  const grad = g.createLinearGradient(0, size * 0.38, 0, size * 0.72);
  grad.addColorStop(0, 'rgba(120,120,120,0)');
  grad.addColorStop(0.5, 'rgba(120,120,120,0.65)');
  grad.addColorStop(1, 'rgba(120,120,120,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  speckle(g, size, 991, 2400, 1.2, ['#d4d4d4', '#bcbcbc']);
  return finish(c, false, 3);
}

/** Laminate worktop of the instrument cart. */
export function makeLaminateTexture(): CanvasTexture {
  const size = 512;
  const { c, g } = canvas(size);
  g.fillStyle = '#b9ae99';
  g.fillRect(0, 0, size, size);
  const rng = makeRng(7788);
  for (let i = 0; i < 900; i++) {
    g.strokeStyle = `rgba(${140 + rng() * 40 | 0},${130 + rng() * 36 | 0},${112 + rng() * 30 | 0},0.35)`;
    g.lineWidth = 0.6 + rng() * 1.6;
    const y = rng() * size;
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(size * 0.3, y + rng() * 6 - 3, size * 0.7, y + rng() * 8 - 4, size, y + rng() * 4 - 2);
    g.stroke();
  }
  // Wear concentrated where things get slid on and off the near edge.
  const w = g.createLinearGradient(0, size * 0.86, 0, size);
  w.addColorStop(0, 'rgba(206,198,180,0)');
  w.addColorStop(1, 'rgba(206,198,180,0.4)');
  g.fillStyle = w;
  g.fillRect(0, 0, size, size);
  return finish(c, true, 1);
}

/** Upholstered vinyl of the exam-table pad. */
export function makeVinylTexture(): CanvasTexture {
  const size = 512;
  const { c, g } = canvas(size);
  g.fillStyle = '#4d6a72';
  g.fillRect(0, 0, size, size);
  const rng = makeRng(3131);
  for (let i = 0; i < 4200; i++) {
    const x = rng() * size;
    const y = rng() * size;
    g.fillStyle = `rgba(${58 + rng() * 26 | 0},${86 + rng() * 26 | 0},${94 + rng() * 26 | 0},0.5)`;
    g.fillRect(x, y, 2.2, 2.2);
  }
  // Sheen loss along the strip a body actually rests on.
  const wear = g.createLinearGradient(size * 0.3, 0, size * 0.7, 0);
  wear.addColorStop(0, 'rgba(96,124,132,0)');
  wear.addColorStop(0.5, 'rgba(101,130,138,0.3)');
  wear.addColorStop(1, 'rgba(96,124,132,0)');
  g.fillStyle = wear;
  g.fillRect(0, 0, size, size);
  return finish(c, true, 1);
}

/** Disposable paper sheet across the pad. */
export function makePaperTexture(): CanvasTexture {
  const size = 512;
  const { c, g } = canvas(size);
  g.fillStyle = '#e8e4d9';
  g.fillRect(0, 0, size, size);
  speckle(g, size, 5511, 2600, 0.9, ['#e0dbcf', '#efece3', '#dcd6c9']);
  const rng = makeRng(6622);
  g.strokeStyle = 'rgba(198,192,180,0.5)';
  for (let i = 0; i < 26; i++) {
    g.lineWidth = 0.6 + rng() * 1.1;
    const x = rng() * size;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + rng() * 18 - 9, size * 0.35, x + rng() * 22 - 11, size * 0.7, x + rng() * 12 - 6, size);
    g.stroke();
  }
  return finish(c, true, 1);
}

/** Woven cubicle curtain. */
export function makeCurtainTexture(): CanvasTexture {
  const size = 256;
  const { c, g } = canvas(size);
  g.fillStyle = '#8b9a90';
  g.fillRect(0, 0, size, size);
  g.globalAlpha = 0.22;
  for (let y = 0; y < size; y += 3) {
    g.fillStyle = y % 6 === 0 ? '#748376' : '#9dab9f';
    g.fillRect(0, y, size, 1.6);
  }
  for (let x = 0; x < size; x += 3) {
    g.fillStyle = x % 6 === 0 ? '#77877a' : '#a1afa3';
    g.fillRect(x, 0, 1.6, size);
  }
  g.globalAlpha = 1;
  return finish(c, true, 4);
}

/**
 * Synthetic skin of the training torso: a warm, slightly matte polymer with
 * mould texture, not human dermis. Deliberately reads as equipment.
 */
export function makeSkinTexture(): CanvasTexture {
  const size = 1024;
  const { c, g } = canvas(size);
  g.fillStyle = '#c8a189';
  g.fillRect(0, 0, size, size);
  const rng = makeRng(9090);
  for (let i = 0; i < 26000; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const v = rng();
    g.fillStyle =
      v < 0.5
        ? 'rgba(178,138,116,0.16)'
        : v < 0.85
          ? 'rgba(214,178,154,0.14)'
          : 'rgba(160,120,100,0.12)';
    g.fillRect(x, y, 1.6, 1.6);
  }
  // Broad mould mottle.
  for (let i = 0; i < 90; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 40 + rng() * 130;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${188 + rng() * 26 | 0},${150 + rng() * 22 | 0},${128 + rng() * 20 | 0},0.10)`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return finish(c, true, 1);
}

export function makeSkinRoughness(): CanvasTexture {
  const size = 512;
  const { c, g } = canvas(size);
  g.fillStyle = '#a6a6a6';
  g.fillRect(0, 0, size, size);
  speckle(g, size, 1717, 9000, 1.1, ['#b4b4b4', '#9a9a9a', '#adadad']);
  return finish(c, false, 1);
}

/**
 * Roughness for the chestpiece: polish worn off strictly at the rim, where it
 * is picked up and set down, and nowhere else.
 */
export function makeChestpieceWear(): CanvasTexture {
  const size = 256;
  const { c, g } = canvas(size);
  g.fillStyle = '#4a4a4a';
  g.fillRect(0, 0, size, size);
  const rng = makeRng(2468);
  // The map is applied around the rim band, so wear lives along one axis only.
  for (let i = 0; i < 420; i++) {
    const x = rng() * size;
    const y = size * (0.62 + rng() * 0.38);
    g.strokeStyle = `rgba(${150 + rng() * 70 | 0},${150 + rng() * 70 | 0},${150 + rng() * 70 | 0},${0.1 + rng() * 0.35})`;
    g.lineWidth = 0.5 + rng() * 1.3;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + rng() * 16 - 8, y + rng() * 3 - 1.5);
    g.stroke();
  }
  return finish(c, false, 1);
}

/**
 * The engraving on a record tile: a small achromatic chest outline with a
 * struck mark at the place that was listened to. No colour, no name, no number.
 */
export function makeTileEngraving(lat: number, sup: number): Texture {
  const size = 256;
  const { c, g } = canvas(size);
  g.fillStyle = '#8e8b84';
  g.fillRect(0, 0, size, size);
  speckle(g, size, 3344, 1400, 1.0, ['#96938c', '#86837c']);

  const cx = size * 0.5;
  const cy = size * 0.52;
  const w = size * 0.24;
  const h = size * 0.3;

  g.strokeStyle = 'rgba(70,68,64,0.85)';
  g.lineWidth = 3;
  g.beginPath();
  // Simple shoulders-to-waist outline.
  g.moveTo(cx - w * 0.95, cy - h);
  g.bezierCurveTo(cx - w * 1.15, cy - h * 0.3, cx - w * 0.9, cy + h * 0.6, cx - w * 0.62, cy + h);
  g.lineTo(cx + w * 0.62, cy + h);
  g.bezierCurveTo(cx + w * 0.9, cy + h * 0.6, cx + w * 1.15, cy - h * 0.3, cx + w * 0.95, cy - h);
  g.bezierCurveTo(cx + w * 0.4, cy - h * 1.12, cx - w * 0.4, cy - h * 1.12, cx - w * 0.95, cy - h);
  g.stroke();
  // Highlight below the engraved line, as struck metal reads.
  g.strokeStyle = 'rgba(196,192,183,0.5)';
  g.lineWidth = 1.2;
  g.stroke();

  // The struck mark. lat +1 is the manikin's left, which is drawn on the
  // viewer's right here because the silhouette is seen from the front.
  const mx = cx + lat * w * 0.86;
  const my = cy - sup * h * 0.8;
  g.fillStyle = 'rgba(58,56,52,0.9)';
  g.beginPath();
  g.arc(mx, my, 8, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(206,202,193,0.55)';
  g.beginPath();
  g.arc(mx - 1.4, my - 1.4, 5.2, 0, Math.PI * 2);
  g.fill();

  return finish(c, true, 1);
}

/** Powder-coat: fine orange-peel, and rub-through only where hands grip. */
export function makePowderCoatRoughness(): CanvasTexture {
  const size = 256;
  const { c, g } = canvas(size);
  g.fillStyle = '#b0b0b0';
  g.fillRect(0, 0, size, size);
  speckle(g, size, 8181, 5000, 1.4, ['#a0a0a0', '#bcbcbc']);
  const wear = g.createLinearGradient(0, size * 0.42, 0, size * 0.58);
  wear.addColorStop(0, 'rgba(70,70,70,0)');
  wear.addColorStop(0.5, 'rgba(70,70,70,0.55)');
  wear.addColorStop(1, 'rgba(70,70,70,0)');
  g.fillStyle = wear;
  g.fillRect(0, 0, size, size);
  return finish(c, false, 1);
}
