/**
 * Every dimension in this file is in metres, matched to a real Japanese
 * kindergarten hall (体育館兼ホール). The camera is a real PerspectiveCamera at a
 * four-year-old's eye height, so nothing here is "art units".
 */

export const LAYOUT = {
  /** House (audience) floor. Everything else is measured from here. */
  houseFloorY: 0,
  /** Stage deck top surface: a low kindergarten stage. */
  stageY: 0.55,

  /** Full stage box including both wings. */
  stage: {
    xMin: -8.2,
    xMax: 8.2,
    zFront: 0.0, // downstage edge
    zBack: 7.2, // upstage wall
  },

  /** Proscenium opening the audience actually sees through. */
  proscenium: {
    xMin: -4.6,
    xMax: 4.6,
    top: 4.95,
    z: -0.02,
    wallThickness: 0.4,
  },

  house: {
    zNear: -0.42,
    zBack: -14.2,
    xMin: -8.6,
    xMax: 8.6,
    ceilingY: 6.4,
  },

  /** Seating block. rows x seatsPerRow silhouettes. */
  seating: {
    rows: 11,
    seatsPerRow: 17,
    zStart: -2.35,
    rowPitch: 0.92,
    seatPitch: 0.52,
    aisleGap: 0.62, // widened gap in the middle of each row
  },

  /** The leg curtain (袖幕) the child parts. Hangs parallel to the proscenium. */
  legCurtain: {
    z: 1.2,
    xMin: -0.6,
    xMax: 7.9,
    seamX: 4.55,
    topY: 4.9,
    bottomY: 0.55,
    /** Peeking only ever opens this much: ~10-20cm, as a real child would dare. */
    peekMaxGap: 0.3,
    /** When the child actually walks out, the panels swing right open. */
    exitGap: 2.6,
  },

  /** Main house curtain (緞帳) at the proscenium line. */
  grandCurtain: {
    z: 0.3,
    topY: 5.0,
    bottomY: 0.55,
    halfWidth: 4.75,
  },

  /** Player's mark on the wing floor (a vinyl tape cross). */
  playerMark: { x: 6.3, z: 4.2 },

  teacherMark: { x: 5.62, z: 1.74 },

  /** Where the child ends up on stage, facing the house. */
  stageMark: { x: 0.7, z: 0.45 },
} as const;

export const CHILD_HEIGHT = 1.03; // typical 4-year-old
export const TEACHER_HEIGHT = 1.62;
/** Eye height of a standing four-year-old. */
export const CHILD_EYE_Y = 0.94;

export interface RuntimeFlags {
  /** `?fast=1` or E2E_FAST: deterministic, cheap, test-friendly. */
  fast: boolean;
  /** `?gl=1` forces the WebGL2 backend even where WebGPU exists. */
  forceWebGL: boolean;
  /** `?seed=123` fixes the round-to-round variation. */
  seed: number;
  /** `?quality=low|mid|high` pins the adaptive quality tier. */
  pinnedQuality: 'low' | 'mid' | 'high' | null;
}

export function readFlags(): RuntimeFlags {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(location.search);
  } catch {
    params = new URLSearchParams();
  }
  const q = params.get('quality');
  return {
    fast: params.get('fast') === '1' || params.get('e2e') === '1',
    forceWebGL: params.get('gl') === '1' || params.get('webgl') === '1',
    seed: params.has('seed') ? Number(params.get('seed')) || 1 : 0,
    pinnedQuality: q === 'low' || q === 'mid' || q === 'high' ? q : null,
  };
}
