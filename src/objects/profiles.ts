import type { SurfaceKind } from '../world/surface';

export type ObjectId =
  | 'steel'
  | 'rubberball'
  | 'woodcyl'
  | 'feltbag'
  | 'minicar'
  | 'icedisc'
  | 'leaf'
  | 'sponge';

export type GroundKind = 'rubberFloor' | 'soil' | 'mat';

export type MotionKind = 'roll' | 'slide';

export interface GroundResponse {
  /** Deceleration coefficient once the thing is down and moving. */
  mu: number;
  /** Vertical restitution on impact. */
  bounce: number;
}

export interface ObjectProfile {
  id: ObjectId;
  /** Japanese label, only ever used by the debug overlay. */
  label: string;
  motion: MotionKind;
  /** Contact radius: how far the centre sits off the bed. */
  radius: number;
  mass: number;
  /**
   * Translational share of kinetic energy, 1/(1 + I/mr^2).
   * 1 for pure sliders, ~0.71 for a solid ball, ~0.67 for a cylinder.
   */
  rollFactor: number;
  /** Friction against each state of the bed. */
  mu: Record<SurfaceKind, number>;
  /** Quadratic air drag coefficient (per unit mass). */
  drag: number;
  ground: Record<GroundKind, GroundResponse>;
  /** How much the shape visibly compresses on contact, 0..1. */
  squash: number;
  /** Tendency to wander sideways / flutter while sliding. */
  wander: number;
  /** Extra loss when crossing sprinkled sand (rollers get jostled). */
  sandJitter: number;
  audio: string;
  /** Roughly how heavy it feels, drives impact loudness. */
  impactGain: number;
  /** Centre-to-boom distance when the gate is holding it, so it visibly touches. */
  gateGap: number;
}

const P = (p: ObjectProfile): ObjectProfile => p;

export const PROFILES: Record<ObjectId, ObjectProfile> = {
  steel: P({
    id: 'steel',
    label: '金属の玉',
    motion: 'roll',
    radius: 0.036,
    mass: 0.19,
    rollFactor: 0.714,
    mu: { dry: 0.019, wet: 0.012, sand: 0.1, rubber: 0.14 },
    drag: 0.02,
    ground: {
      rubberFloor: { mu: 0.36, bounce: 0.16 },
      soil: { mu: 0.6, bounce: 0.08 },
      mat: { mu: 0.95, bounce: 0.05 },
    },
    squash: 0,
    wander: 0.05,
    sandJitter: 0.5,
    audio: 'steel',
    gateGap: 0.0355,
    impactGain: 1,
  }),
  rubberball: P({
    id: 'rubberball',
    label: 'ゴムのボール',
    motion: 'roll',
    radius: 0.062,
    mass: 0.09,
    rollFactor: 0.714,
    mu: { dry: 0.055, wet: 0.038, sand: 0.12, rubber: 0.21 },
    drag: 0.05,
    ground: {
      rubberFloor: { mu: 0.48, bounce: 0.58 },
      soil: { mu: 0.75, bounce: 0.3 },
      mat: { mu: 1.1, bounce: 0.22 },
    },
    squash: 0.55,
    wander: 0.12,
    sandJitter: 0.35,
    audio: 'rubber',
    gateGap: 0.053,
    impactGain: 0.7,
  }),
  woodcyl: P({
    id: 'woodcyl',
    label: '木の円柱',
    motion: 'roll',
    radius: 0.048,
    mass: 0.11,
    rollFactor: 0.667,
    mu: { dry: 0.047, wet: 0.07, sand: 0.15, rubber: 0.2 },
    drag: 0.04,
    ground: {
      rubberFloor: { mu: 0.52, bounce: 0.14 },
      soil: { mu: 0.8, bounce: 0.06 },
      mat: { mu: 1.15, bounce: 0.04 },
    },
    squash: 0,
    wander: 0.08,
    sandJitter: 0.7,
    audio: 'wood',
    gateGap: 0.0445,
    impactGain: 0.85,
  }),
  feltbag: P({
    id: 'feltbag',
    label: 'フェルトの袋',
    motion: 'slide',
    radius: 0.033,
    mass: 0.07,
    rollFactor: 1,
    mu: { dry: 0.63, wet: 0.42, sand: 0.8, rubber: 1.0 },
    drag: 0.08,
    ground: {
      rubberFloor: { mu: 1.5, bounce: 0.02 },
      soil: { mu: 1.7, bounce: 0.01 },
      mat: { mu: 2.0, bounce: 0.0 },
    },
    squash: 0.7,
    wander: 0.2,
    sandJitter: 0.1,
    audio: 'felt',
    gateGap: 0.056,
    impactGain: 0.45,
  }),
  minicar: P({
    id: 'minicar',
    label: 'ミニカー',
    motion: 'roll',
    radius: 0.02,
    mass: 0.06,
    rollFactor: 0.93,
    mu: { dry: 0.036, wet: 0.03, sand: 0.17, rubber: 0.085 },
    drag: 0.06,
    ground: {
      rubberFloor: { mu: 0.25, bounce: 0.1 },
      soil: { mu: 0.7, bounce: 0.05 },
      mat: { mu: 1.3, bounce: 0.03 },
    },
    squash: 0,
    wander: 0.04,
    sandJitter: 1.2,
    audio: 'tyre',
    gateGap: 0.055,
    impactGain: 0.6,
  }),
  icedisc: P({
    id: 'icedisc',
    label: '氷の円ばん',
    motion: 'slide',
    radius: 0.013,
    mass: 0.13,
    rollFactor: 1,
    mu: { dry: 0.07, wet: 0.016, sand: 0.3, rubber: 0.38 },
    drag: 0.03,
    ground: {
      rubberFloor: { mu: 0.37, bounce: 0.12 },
      soil: { mu: 0.65, bounce: 0.05 },
      mat: { mu: 1.4, bounce: 0.02 },
    },
    squash: 0,
    wander: 0.3,
    sandJitter: 0.4,
    audio: 'ice',
    gateGap: 0.056,
    impactGain: 0.75,
  }),
  leaf: P({
    id: 'leaf',
    label: 'かれ葉',
    motion: 'slide',
    radius: 0.007,
    mass: 0.004,
    rollFactor: 1,
    mu: { dry: 0.3, wet: 0.62, sand: 0.36, rubber: 0.52 },
    drag: 1.35,
    ground: {
      rubberFloor: { mu: 1.2, bounce: 0.02 },
      soil: { mu: 1.35, bounce: 0.01 },
      mat: { mu: 1.6, bounce: 0.0 },
    },
    squash: 0.25,
    wander: 0.9,
    sandJitter: 0.2,
    audio: 'leaf',
    gateGap: 0.086,
    impactGain: 0.2,
  }),
  sponge: P({
    id: 'sponge',
    label: 'ぬれたスポンジ',
    motion: 'slide',
    radius: 0.026,
    mass: 0.08,
    rollFactor: 1,
    mu: { dry: 0.56, wet: 0.34, sand: 0.86, rubber: 1.05 },
    drag: 0.1,
    ground: {
      rubberFloor: { mu: 1.45, bounce: 0.03 },
      soil: { mu: 1.6, bounce: 0.02 },
      mat: { mu: 1.9, bounce: 0.0 },
    },
    squash: 0.85,
    wander: 0.15,
    sandJitter: 0.1,
    audio: 'sponge',
    gateGap: 0.047,
    impactGain: 0.5,
  }),
};

/** Order the objects appear in the trolley. */
export const OBJECT_ORDER: ObjectId[] = [
  'steel',
  'feltbag',
  'rubberball',
  'woodcyl',
  'minicar',
  'icedisc',
  'leaf',
  'sponge',
];
