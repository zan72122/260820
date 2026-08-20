import type { Recipe } from '../materials/texgen';
import {
  clayFloor,
  feltFloor,
  foamBall,
  hollowMetalBall,
  metalFloor,
  rubberBall,
  rubberFloor,
  sandFloor,
  solidMetalBall,
  waterBall,
  waterBedFloor,
  woodBall,
  woodFloor,
} from '../materials/recipes';

/**
 * The whole game is decided by these two tables. None of it is ever shown to
 * the player: no coefficients, no bars, no scores. The numbers exist so that
 * the *perceptual* result — bounce height, contact time, sound, the mark left
 * behind — is consistent and repeatable, which is what makes the causal link
 * discoverable in a single try.
 */

export type MarkKind = 'none' | 'scuff' | 'crater' | 'dent' | 'press' | 'ripple';
export type VoiceId = FloorId | 'concrete';
export type FloorId = 'rubber' | 'sand' | 'clay' | 'wood' | 'metal' | 'felt' | 'water';
export type BallId = 'rubber' | 'wood' | 'hollowMetal' | 'solidMetal' | 'foam' | 'water';

export interface FloorSpec {
  id: FloorId | 'concrete';
  recipe: Recipe;
  /** Fraction of impact speed returned, before the ball's own losses. */
  restitution: number;
  /** Tangential friction at contact; also how much spin the impact induces. */
  friction: number;
  /** Speed lost per second while the ball rolls on this surface. */
  rollingResistance: number;
  /** Peak surface sink, in metres, at the reference impact. */
  deformation: number;
  /** How much of the sink stays behind: 0 springs back, 1 keeps the mark. */
  markPersistence: number;
  /** Seconds the ball stays in contact — the visible "squash" window. */
  contactTime: number;
  /** What the impact leaves on the surface. */
  mark: MarkKind;
  /** Particles thrown up per impact at the reference speed. */
  debris: number;
  /** Audio voice used for the impact. */
  voice: VoiceId;
  /** Slight vertical offset of the sample surface inside its pocket. */
  surfaceInset: number;
  /** How far the ball settles into the surface once it has come to rest. */
  restSink: number;
}

export interface BallSpec {
  id: BallId;
  recipe: Recipe;
  mass: number;
  radius: number;
  /** Fraction of impact speed the ball itself returns. */
  restitution: number;
  /** Extra rolling drag contributed by the ball. */
  rollingDrag: number;
  /** Peak squash as a fraction of the radius. */
  squash: number;
  /** Multiplier on the floor's contact time — soft balls linger. */
  contactScale: number;
  /** How readily the ball picks up spin from friction. */
  spinGain: number;
  /** Timbre shaping for the impact voice. */
  brightness: number;
  ring: number;
  /** Rendering hints. */
  physical?: boolean;
  clearcoat?: number;
  clearcoatRoughness?: number;
  sheen?: number;
  transmission?: number;
  envIntensity?: number;
}

export const FLOORS: Record<FloorId, FloorSpec> = {
  rubber: {
    id: 'rubber',
    recipe: rubberFloor,
    restitution: 0.9,
    friction: 0.9,
    rollingResistance: 0.9,
    deformation: 0.011,
    markPersistence: 0.0,
    contactTime: 0.055,
    mark: 'scuff',
    debris: 0,
    voice: 'rubber',
    surfaceInset: 0.0,
    restSink: 0.002,
  },
  sand: {
    id: 'sand',
    recipe: sandFloor,
    restitution: 0.09,
    friction: 0.78,
    rollingResistance: 3.2,
    deformation: 0.026,
    markPersistence: 1.0,
    contactTime: 0.095,
    mark: 'crater',
    debris: 26,
    voice: 'sand',
    surfaceInset: 0.004,
    restSink: 0.006,
  },
  clay: {
    id: 'clay',
    recipe: clayFloor,
    restitution: 0.07,
    friction: 0.62,
    rollingResistance: 2.6,
    deformation: 0.02,
    markPersistence: 1.0,
    contactTime: 0.115,
    mark: 'dent',
    debris: 8,
    voice: 'clay',
    surfaceInset: 0.002,
    restSink: 0.005,
  },
  wood: {
    id: 'wood',
    recipe: woodFloor,
    restitution: 0.56,
    friction: 0.45,
    rollingResistance: 0.42,
    deformation: 0.0028,
    markPersistence: 0.06,
    contactTime: 0.022,
    mark: 'scuff',
    debris: 2,
    voice: 'wood',
    surfaceInset: 0.0,
    restSink: 0.0,
  },
  metal: {
    id: 'metal',
    recipe: metalFloor,
    restitution: 0.84,
    friction: 0.16,
    rollingResistance: 0.1,
    deformation: 0.0007,
    markPersistence: 0.02,
    contactTime: 0.013,
    mark: 'scuff',
    debris: 0,
    voice: 'metal',
    surfaceInset: 0.0,
    restSink: 0.0,
  },
  felt: {
    id: 'felt',
    recipe: feltFloor,
    restitution: 0.06,
    friction: 0.88,
    rollingResistance: 4.0,
    deformation: 0.032,
    markPersistence: 0.55,
    contactTime: 0.165,
    mark: 'press',
    debris: 3,
    voice: 'felt',
    surfaceInset: 0.0,
    restSink: 0.014,
  },
  water: {
    id: 'water',
    recipe: waterBedFloor,
    restitution: 0.13,
    friction: 0.36,
    rollingResistance: 2.2,
    deformation: 0.024,
    markPersistence: 0.0,
    contactTime: 0.13,
    mark: 'ripple',
    debris: 30,
    voice: 'water',
    surfaceInset: 0.026,
    restSink: 0.022,
  },
};

export const BALLS: Record<BallId, BallSpec> = {
  rubber: {
    id: 'rubber',
    recipe: rubberBall,
    mass: 0.12,
    radius: 0.07,
    restitution: 0.93,
    rollingDrag: 1.0,
    squash: 0.17,
    contactScale: 1.2,
    spinGain: 1.0,
    brightness: 0.35,
    ring: 0.1,
    envIntensity: 0.7,
  },
  wood: {
    id: 'wood',
    recipe: woodBall,
    mass: 0.085,
    radius: 0.07,
    restitution: 0.6,
    rollingDrag: 0.85,
    squash: 0.02,
    contactScale: 0.8,
    spinGain: 0.9,
    brightness: 0.55,
    ring: 0.4,
    physical: true,
    clearcoat: 0.35,
    clearcoatRoughness: 0.45,
    envIntensity: 0.85,
  },
  hollowMetal: {
    id: 'hollowMetal',
    recipe: hollowMetalBall,
    mass: 0.15,
    radius: 0.076,
    restitution: 0.63,
    rollingDrag: 0.7,
    squash: 0.055,
    contactScale: 0.7,
    spinGain: 0.8,
    brightness: 0.95,
    ring: 1.0,
    envIntensity: 1.25,
  },
  solidMetal: {
    id: 'solidMetal',
    recipe: solidMetalBall,
    mass: 1.15,
    radius: 0.058,
    restitution: 0.95,
    rollingDrag: 0.5,
    squash: 0.004,
    contactScale: 0.55,
    spinGain: 0.6,
    brightness: 1.0,
    ring: 0.55,
    envIntensity: 1.5,
  },
  foam: {
    id: 'foam',
    recipe: foamBall,
    mass: 0.014,
    radius: 0.086,
    restitution: 0.42,
    rollingDrag: 1.8,
    squash: 0.33,
    contactScale: 2.2,
    spinGain: 1.2,
    brightness: 0.15,
    ring: 0.0,
    physical: true,
    sheen: 0.7,
    envIntensity: 0.5,
  },
  water: {
    id: 'water',
    recipe: waterBall,
    mass: 0.36,
    radius: 0.075,
    restitution: 0.3,
    rollingDrag: 1.4,
    squash: 0.26,
    contactScale: 1.8,
    spinGain: 1.1,
    brightness: 0.28,
    ring: 0.05,
    physical: true,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    transmission: 0.22,
    envIntensity: 1.0,
  },
};

/** Turntable order. Slot 0 and slot 1 are the two discovery trials. */
export const FLOOR_ORDER: FloorId[] = ['rubber', 'sand', 'clay', 'wood', 'metal', 'felt', 'water'];

/** Shelf order, left to right. Slot 0 is the ball the discovery uses. */
export const BALL_ORDER: BallId[] = ['rubber', 'wood', 'foam', 'hollowMetal', 'solidMetal', 'water'];

/** The three clamp heights, in metres above the sample surface. */
export const DROP_HEIGHTS = [0.72, 1.28, 1.92];
export const DEFAULT_HEIGHT_INDEX = 1;

/**
 * The concrete apron. It is never offered as a choice, but the ball has to be
 * able to land on it when it rolls off a panel, and it needs to sound like
 * concrete when it does.
 */
export const GROUND_SPEC: FloorSpec = {
  id: 'concrete',
  recipe: sandFloor, // unused: the apron has its own material
  restitution: 0.38,
  friction: 0.72,
  rollingResistance: 1.1,
  deformation: 0.0009,
  markPersistence: 0.0,
  contactTime: 0.02,
  mark: 'none',
  debris: 1,
  voice: 'concrete',
  surfaceInset: 0,
  restSink: 0,
};
