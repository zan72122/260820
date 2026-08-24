import { clamp, clamp01, lerp, smoothstep } from '../core/mathutil';

/**
 * Surface coordinates on the manikin's chest.
 *  lat: -1 = the manikin's right, +1 = the manikin's left
 *  sup: -1 = towards the abdomen, +1 = towards the clavicles
 * The whole anterior chest is addressable; there are no buttons and no zones.
 */
export interface ChestCoord {
  lat: number;
  sup: number;
}

export type WindowId = 'aortic' | 'pulmonic' | 'tricuspid' | 'mitral';

export interface ListeningWindow {
  id: WindowId;
  /** Position of the peak of this area of the sound field. */
  at: ChestCoord;
  /** Radius over which this area dominates. Deliberately generous for小さな指. */
  radius: number;
  /** Japanese label — only ever used in the accompanying adult's notes, never on the chest. */
  label: string;
  profile: SoundProfile;
}

/**
 * How the one heartbeat is coloured by where the chestpiece rests.
 *
 * These are teaching exaggerations of real surface acoustics: the balance of
 * the first and second sound, how near the chest wall feels, and how much high
 * frequency survives the trip through it. No window gets its own rhythm, its
 * own pitch, or its own instrument — every number below only re-weights the
 * exact same two sounds coming from the exact same clock.
 */
export interface SoundProfile {
  /** Loudness of the first sound (mitral+tricuspid closure). */
  s1: number;
  /** Loudness of the second sound (aortic+pulmonic closure). */
  s2: number;
  /** Balance inside S1 between its mitral and tricuspid components. 0..1 -> tricuspid..mitral */
  s1Balance: number;
  /** Balance inside S2 between its aortic and pulmonic components. 0..1 -> pulmonic..aortic */
  s2Balance: number;
  /** Low-pass corner (Hz). Lower = the sound arrives from further inside. */
  cutoff: number;
  /** Low shelf gain (dB) — chest-wall weight. */
  lowShelf: number;
  /** Presence peak gain (dB) around 150 Hz — definition of the sound's edge. */
  presence: number;
  /** Overall proximity 0..1 — how close the heart feels here. */
  proximity: number;
  /** How much the chestpiece trembles here (drives the visible micro-tremor). */
  tremor: number;
}

const WINDOW_DEFS: ListeningWindow[] = [
  {
    id: 'aortic',
    label: '大動脈弁領域',
    at: { lat: -0.44, sup: 0.68 },
    radius: 0.62,
    profile: {
      s1: 0.46,
      s2: 1.0,
      s1Balance: 0.5,
      s2Balance: 0.86,
      cutoff: 980,
      lowShelf: -2.5,
      presence: 5.0,
      proximity: 0.82,
      tremor: 0.5,
    },
  },
  {
    id: 'pulmonic',
    label: '肺動脈弁領域',
    at: { lat: 0.36, sup: 0.64 },
    radius: 0.6,
    profile: {
      s1: 0.5,
      s2: 0.93,
      s1Balance: 0.42,
      s2Balance: 0.2,
      cutoff: 900,
      lowShelf: -1.4,
      presence: 4.2,
      proximity: 0.8,
      tremor: 0.52,
    },
  },
  {
    id: 'tricuspid',
    label: '三尖弁領域',
    at: { lat: 0.16, sup: 0.06 },
    radius: 0.6,
    profile: {
      s1: 0.86,
      s2: 0.56,
      s1Balance: 0.18,
      s2Balance: 0.5,
      cutoff: 690,
      lowShelf: 3.0,
      presence: 2.0,
      proximity: 0.86,
      tremor: 0.72,
    },
  },
  {
    id: 'mitral',
    label: '僧帽弁領域',
    at: { lat: 0.62, sup: -0.36 },
    radius: 0.66,
    profile: {
      s1: 1.0,
      s2: 0.44,
      s1Balance: 0.9,
      s2Balance: 0.55,
      cutoff: 640,
      lowShelf: 4.4,
      presence: 3.6,
      proximity: 0.95,
      tremor: 0.9,
    },
  },
];

/** Everything outside the four areas still hears the heart — just further away. */
const FAR_FIELD: SoundProfile = {
  s1: 0.5,
  s2: 0.46,
  s1Balance: 0.55,
  s2Balance: 0.52,
  cutoff: 400,
  lowShelf: 1.0,
  presence: -6.5,
  proximity: 0.3,
  tremor: 0.22,
};

function blendProfiles(a: SoundProfile, b: SoundProfile, t: number): SoundProfile {
  return {
    s1: lerp(a.s1, b.s1, t),
    s2: lerp(a.s2, b.s2, t),
    s1Balance: lerp(a.s1Balance, b.s1Balance, t),
    s2Balance: lerp(a.s2Balance, b.s2Balance, t),
    // Interpolate the corner logarithmically so the sweep sounds even.
    cutoff: Math.exp(lerp(Math.log(a.cutoff), Math.log(b.cutoff), t)),
    lowShelf: lerp(a.lowShelf, b.lowShelf, t),
    presence: lerp(a.presence, b.presence, t),
    proximity: lerp(a.proximity, b.proximity, t),
    tremor: lerp(a.tremor, b.tremor, t),
  };
}

export interface FieldSample extends SoundProfile {
  /** Nearest window and how strongly it dominates here (0..1). */
  nearest: WindowId;
  nearestStrength: number;
  /** Distance in chest units to the nearest window peak. */
  nearestDistance: number;
}

/**
 * A continuous acoustic field over the whole chest surface.
 *
 * The four classic areas exist as *peaks* of this field, not as hit-boxes.
 * Sliding the chestpiece a couple of centimetres always changes the sound a
 * little; crossing "into" an area never switches anything.
 */
export class BodySoundField {
  readonly windows: ReadonlyArray<ListeningWindow> = WINDOW_DEFS;

  /** Extra weighting for the mitral area when the manikin is rolled left. */
  private lateralRoll = 0;

  setLateralRoll(v: number): void {
    this.lateralRoll = clamp01(v);
  }

  getWindow(id: WindowId): ListeningWindow {
    const w = this.windows.find((x) => x.id === id);
    if (!w) throw new Error(`unknown window ${id}`);
    return w;
  }

  distanceTo(id: WindowId, c: ChestCoord): number {
    const w = this.getWindow(id);
    // The chest is wider than it is long in these units; weight accordingly so
    // "close" means the same physical distance in either direction.
    const dx = (c.lat - w.at.lat) * 0.9;
    const dy = (c.sup - w.at.sup) * 1.15;
    return Math.hypot(dx, dy);
  }

  sample(c: ChestCoord): FieldSample {
    let wSum = 0;
    let nearest: WindowId = 'tricuspid';
    let nearestW = -1;
    let nearestDist = Infinity;

    const weights: number[] = [];
    for (let i = 0; i < this.windows.length; i++) {
      const win = this.windows[i];
      const d = this.distanceTo(win.id, c);
      // Smooth, wide, overlapping falloff — this is what makes the change
      // continuous rather than zoned.
      let w = Math.exp(-(d * d) / (win.radius * win.radius * 0.62));
      if (win.id === 'mitral') w *= 1 + this.lateralRoll * 0.35;
      weights.push(w);
      wSum += w;
      if (w > nearestW) {
        nearestW = w;
        nearest = win.id;
        nearestDist = d;
      }
    }

    // Blend the peaks together...
    let acc = blendProfiles(FAR_FIELD, FAR_FIELD, 0);
    if (wSum > 1e-6) {
      acc = {
        s1: 0,
        s2: 0,
        s1Balance: 0,
        s2Balance: 0,
        cutoff: 0,
        lowShelf: 0,
        presence: 0,
        proximity: 0,
        tremor: 0,
      };
      let logCut = 0;
      for (let i = 0; i < this.windows.length; i++) {
        const p = this.windows[i].profile;
        const k = weights[i] / wSum;
        acc.s1 += p.s1 * k;
        acc.s2 += p.s2 * k;
        acc.s1Balance += p.s1Balance * k;
        acc.s2Balance += p.s2Balance * k;
        logCut += Math.log(p.cutoff) * k;
        acc.lowShelf += p.lowShelf * k;
        acc.presence += p.presence * k;
        acc.proximity += p.proximity * k;
        acc.tremor += p.tremor * k;
      }
      acc.cutoff = Math.exp(logCut);
    }

    // ...then fade the whole thing towards the far field as we leave the
    // useful part of the chest, so the edges are distant but never silent.
    const reach = smoothstep(0.22, 0.9, nearestDist);
    const profile = blendProfiles(acc, FAR_FIELD, reach);

    // Off the chest altogether (shoulders, belly): further still.
    const offChest =
      smoothstep(0.86, 1.18, Math.abs(c.lat)) + smoothstep(0.9, 1.25, Math.abs(c.sup));
    const away = clamp01(offChest);
    profile.proximity *= 1 - 0.55 * away;
    profile.cutoff = lerp(profile.cutoff, 300, away * 0.7);
    profile.tremor *= 1 - 0.7 * away;

    const strength = clamp01(1 - nearestDist / (this.getWindow(nearest).radius * 0.72));

    return {
      ...profile,
      nearest,
      nearestStrength: strength,
      nearestDistance: nearestDist,
    };
  }

  /**
   * "Am I on a window?" — used only *after* the child has already heard the
   * difference, to unlock the reveal and to save a record tile. It is never
   * used to draw anything on the chest.
   */
  windowUnder(c: ChestCoord, threshold = 0.34): WindowId | null {
    let best: WindowId | null = null;
    let bestD = Infinity;
    for (const w of this.windows) {
      const d = this.distanceTo(w.id, c);
      if (d < w.radius * threshold && d < bestD) {
        bestD = d;
        best = w.id;
      }
    }
    return best;
  }

  clampToChest(c: ChestCoord): ChestCoord {
    return { lat: clamp(c.lat, -1.05, 1.05), sup: clamp(c.sup, -1.0, 1.02) };
  }
}
