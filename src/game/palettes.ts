/**
 * Palettes are chosen so that *any* mixture of the three stays appetising —
 * the film mixes colours by mass, so complementary pairs are avoided on
 * purpose. Nothing here can turn grey.
 */
export interface Palette {
  id: string;
  name: string;
  colors: [number, number, number];
}

export const PALETTES: Palette[] = [
  {
    id: 'sakura',
    name: 'さくら',
    colors: [0xff9dbe, 0xfff2e4, 0xa8d8f6],
  },
  {
    id: 'rainbow',
    name: 'にじいろ',
    colors: [0xffb489, 0xa7e9cd, 0xc3b2f7],
  },
  {
    id: 'berry',
    name: 'ベリー',
    colors: [0xf4739d, 0xffd9e4, 0xc06ac0],
  },
  {
    id: 'night',
    name: 'よぞら',
    colors: [0x7d8ce8, 0xbecaff, 0xf0f2ff],
  },
  {
    id: 'mint',
    name: 'ミントソーダ',
    colors: [0x9fe6dd, 0xfdf6df, 0x8fc0f0],
  },
];

export function nextPalette(current: string): Palette {
  const i = PALETTES.findIndex((p) => p.id === current);
  return PALETTES[(i + 1) % PALETTES.length];
}
