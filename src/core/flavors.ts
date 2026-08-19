export interface Flavor {
  id: string
  label: string
  /** Raw batter in the bowl / pan. */
  batter: number
  /** Crumb interior once baked. */
  crumb: string
  crumbShadow: string
  /** Top crust after the oven. */
  crustA: string
  crustB: string
  /** Smooth side face left by the pan wall. */
  side: number
  chip: string
  seed: number
}

export const FLAVORS: Flavor[] = [
  {
    id: 'plain',
    label: 'プレーン',
    batter: 0xf3d98d,
    crumb: '#f6e5bb',
    crumbShadow: '#c79f61',
    crustA: '#cf9a55',
    crustB: '#a9702f',
    side: 0xf0dcae,
    chip: '#f0d799',
    seed: 1201,
  },
  {
    id: 'strawberry',
    label: 'いちご',
    batter: 0xf0c2c1,
    crumb: '#f7dcda',
    crumbShadow: '#d19a95',
    crustA: '#d69a7d',
    crustB: '#b26f56',
    side: 0xf1cfcb,
    chip: '#f2c2c1',
    seed: 3307,
  },
  {
    id: 'cocoa',
    label: 'ココア',
    batter: 0xa8805e,
    crumb: '#b78e69',
    crumbShadow: '#6f4a31',
    crustA: '#7d5535',
    crustB: '#583823',
    side: 0xa9855f,
    chip: '#9c7350',
    seed: 5501,
  },
  {
    id: 'matcha',
    label: 'まっちゃ',
    batter: 0xc8d193,
    crumb: '#d2dba6',
    crumbShadow: '#8d9560',
    crustA: '#a89a5c',
    crustB: '#7d7040',
    side: 0xc6cf95,
    chip: '#c2cc8c',
    seed: 7703,
  },
]

export const flavorById = (id: string) => FLAVORS.find((f) => f.id === id) ?? FLAVORS[0]
