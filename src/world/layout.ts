import * as THREE from 'three';
import { roundedPath } from './parts';

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const ROOM = {
  floor: -12,
  ceiling: -5.6,
  minX: -9.4,
  maxX: 9.0,
  minZ: -7.2,
  maxZ: 7.0,
};

export const GROUND = 0;
export const TOWER_X = 4.6;
export const TOWER_Z = -1.2;
export const HEADER_Y = 13.4;
export const SLIDE_HEAD_Y = 12.35;

export const TANK = { x: -6.4, z: -0.6, radius: 1.75, height: 3.5 };
export const MAIN_VALVE = V(-3.0, -11.0, 1.05);
export const SIGHT_GLASS = V(-1.86, -10.95, 1.05);
export const PUMP = V(0.2, -11.15, 1.0);
export const MOTOR = V(2.15, -11.12, 1.0);
export const PRIME_PUMP = V(-0.8, -10.28, 1.62);
export const START_STAND = V(2.6, -11.98, 2.35);
export const BYPASS_VALVE = V(2.35, -6.95, -0.15);

/** Suction leg: tank nozzle → main valve → sight glass → pump eye. */
export const suctionCurve = () =>
  roundedPath(
    [
      V(TANK.x + 0.6, ROOM.floor + 0.55, TANK.z),
      V(TANK.x + 1.5, ROOM.floor + 0.55, 1.05),
      V(MAIN_VALVE.x - 0.55, MAIN_VALVE.y, 1.05),
      V(SIGHT_GLASS.x - 0.35, MAIN_VALVE.y, 1.05),
      V(PUMP.x - 0.72, PUMP.y, 1.0),
    ],
    0.34,
  );

/** Discharge: pump top → ceiling → across the room → the riser column. */
export const dischargeCurve = () =>
  roundedPath(
    [
      V(PUMP.x, PUMP.y + 0.62, PUMP.z),
      V(PUMP.x, ROOM.ceiling - 0.85, PUMP.z),
      V(PUMP.x, ROOM.ceiling - 0.85, TOWER_Z),
      V(TOWER_X, ROOM.ceiling - 0.85, TOWER_Z),
    ],
    0.46,
  );

/** The long climb — basement ceiling, through the slab, up the tower spine. */
export const riserCurve = () =>
  roundedPath(
    [
      V(TOWER_X, ROOM.ceiling - 0.85, TOWER_Z),
      V(TOWER_X, ROOM.ceiling - 0.2, TOWER_Z),
      V(TOWER_X, HEADER_Y - 0.4, TOWER_Z),
      V(TOWER_X, HEADER_Y, TOWER_Z),
    ],
    0.4,
  );

export const RISER_BOTTOM_Y = ROOM.ceiling - 0.85;
export const RISER_TOP_Y = HEADER_Y;

/** Manifold along the crown of the tower. */
export const headerCurve = () =>
  roundedPath([V(TOWER_X, HEADER_Y, TOWER_Z), V(TOWER_X, HEADER_Y, -5.6)], 0.35);

export const BRANCH_TEE = {
  A: V(TOWER_X, HEADER_Y, -2.45),
  B: V(TOWER_X, HEADER_Y, -3.75),
  C: V(TOWER_X, HEADER_Y, -5.15),
} as const;

export const BRANCH_VALVE = {
  A: V(TOWER_X + 0.0, HEADER_Y + 0.72, -2.45),
  B: V(TOWER_X + 0.0, HEADER_Y + 0.72, -3.75),
  C: V(TOWER_X + 0.0, HEADER_Y + 0.72, -5.15),
} as const;

export const SLIDE_HEAD = {
  A: V(TOWER_X + 2.5, SLIDE_HEAD_Y, -2.45),
  B: V(TOWER_X - 2.6, SLIDE_HEAD_Y, -3.75),
  C: V(TOWER_X + 0.15, SLIDE_HEAD_Y, -7.6),
} as const;

export const branchCurve = (id: 'A' | 'B' | 'C') => {
  const tee = BRANCH_TEE[id];
  const head = SLIDE_HEAD[id];
  if (id === 'A')
    return roundedPath([tee, V(tee.x + 1.5, tee.y, tee.z), V(head.x, tee.y, tee.z), V(head.x, head.y + 0.35, head.z)], 0.32);
  if (id === 'B')
    return roundedPath([tee, V(tee.x - 1.4, tee.y, tee.z), V(head.x, tee.y, tee.z), V(head.x, head.y + 0.35, head.z)], 0.3);
  return roundedPath([tee, V(tee.x, tee.y, tee.z - 1.2), V(head.x, tee.y, head.z), V(head.x, head.y + 0.35, head.z)], 0.32);
};

/** Bypass / plant-return line teed off the discharge — the harmless "wrong" valve. */
export const bypassCurve = () =>
  roundedPath(
    [
      V(BYPASS_VALVE.x, ROOM.ceiling - 0.85, TOWER_Z),
      V(BYPASS_VALVE.x, ROOM.ceiling - 0.85, BYPASS_VALVE.z),
      V(BYPASS_VALVE.x, BYPASS_VALVE.y - 0.4, BYPASS_VALVE.z),
      V(BYPASS_VALVE.x, ROOM.floor + 2.9, TANK.z + 0.2),
      V(TANK.x + 0.2, ROOM.floor + 2.9, TANK.z + 0.2),
      V(TANK.x + 0.2, ROOM.floor + TANK.height - 0.15, TANK.z + 0.2),
    ],
    0.3,
  );

/** Flume centre lines. Each slide has its own character and water appetite. */
export function slideCurve(id: 'A' | 'B' | 'C'): THREE.CatmullRomCurve3 {
  const P: Record<string, [number, number, number][]> = {
    // long blue tube: one and a half lazy turns round the tower
    A: [
      [7.1, 11.9, -2.45],
      [8.9, 10.2, -4.4],
      [8.4, 8.4, -6.8],
      [6.2, 6.8, -8.2],
      [4.2, 5.4, -7.0],
      [3.6, 4.0, -4.6],
      [5.4, 2.9, -3.2],
      [8.0, 2.0, -4.4],
      [10.0, 1.25, -7.4],
      [10.6, 0.9, -10.8],
      [10.2, 0.66, -13.4],
      [9.6, 0.55, -14.6],
    ],
    // short translucent tube: steep and quickly over
    B: [
      [2.0, 11.85, -3.75],
      [0.4, 9.4, -5.2],
      [-0.6, 6.6, -6.8],
      [-1.2, 3.6, -8.8],
      [-1.4, 1.5, -11.2],
      [-1.5, 0.66, -13.2],
      [-1.5, 0.55, -14.4],
    ],
    // wide raft channel: broad and gentle, straight down the middle
    C: [
      [4.75, 11.9, -7.6],
      [4.9, 9.8, -9.2],
      [4.4, 7.2, -10.6],
      [4.8, 4.6, -12.2],
      [4.6, 2.0, -14.4],
      [4.6, 0.7, -16.4],
      [4.6, 0.58, -17.4],
    ],
  };
  return new THREE.CatmullRomCurve3(
    P[id].map(([x, y, z]) => V(x, y, z)),
    false,
    'catmullrom',
    0.4,
  );
}

/** One run-out pool takes all three flumes. */
export const BASIN = { x: 4.4, z: -14.6, w: 19.0, d: 8.4 };

/**
 * The way home. It drops through the very same opening the camera climbed out
 * of, so the last shot can retrace the journey in reverse and land on the tank.
 */
export const returnCurve = () =>
  roundedPath(
    [
      V(BASIN.x - BASIN.w / 2 - 0.7, 0.16, BASIN.z + 2.0),
      V(-7.8, 0.16, BASIN.z + 2.2),
      V(-7.8, 0.16, -3.0),
      V(2.2, 0.16, -0.9),
      V(2.2, -0.9, -0.9),
      V(2.2, ROOM.ceiling - 0.7, -0.9),
      V(TANK.x - 1.6, ROOM.ceiling - 0.7, TANK.z + 0.2),
      V(TANK.x - 1.6, ROOM.floor + TANK.height + 0.55, TANK.z + 0.2),
    ],
    0.55,
  );

/** Where the returning water falls back into the balance tank. */
export const RETURN_OUTLET = V(TANK.x - 1.6, ROOM.floor + TANK.height + 0.4, TANK.z + 0.2);

/**
 * Daylight opening in the slab. It sits directly over the riser on purpose: the
 * camera that follows the water out of the basement climbs through this hole,
 * past the grating bars, and into the morning light without a cut.
 */
export const LIGHT_SHAFT = { x: TOWER_X - 1.0, z: TOWER_Z + 0.6, w: 3.9, d: 3.2 };
