import type { ObjectId } from '../objects/profiles';
import type { StartZoneId } from '../world/slideCurve';

export interface RunRecord {
  id: ObjectId;
  zone: StartZoneId;
  /** Coarse fingerprint of the bed state, for "did they change the surface?" */
  surface: string;
  stoppedOnSlide: boolean;
  stopX: number;
  at: number;
}

/**
 * Quiet observation of what the child actually did. Nothing here is shown on
 * the normal screen and nothing leaves the device; it exists so the design can
 * be checked with `?debug=1`.
 */
export class Telemetry {
  startedAt = performance.now() / 1000;
  firstGateTouch: number | null = null;
  hintStage = 0;
  matMovedAfterResult = false;
  private sawResult = false;
  readonly runs: RunRecord[] = [];

  noteGateTouch(): void {
    if (this.firstGateTouch === null) {
      this.firstGateTouch = performance.now() / 1000 - this.startedAt;
    }
  }

  noteResult(): void {
    this.sawResult = true;
  }

  noteMatMoved(): void {
    if (this.sawResult) this.matMovedAfterResult = true;
  }

  record(r: RunRecord): void {
    this.runs.push(r);
  }

  /** Did they run two different materials from the same band? */
  get sameZoneDifferentObjects(): boolean {
    const byZone = new Map<string, Set<string>>();
    for (const r of this.runs) {
      const set = byZone.get(r.zone) ?? new Set<string>();
      set.add(r.id);
      byZone.set(r.zone, set);
    }
    for (const set of byZone.values()) if (set.size >= 2) return true;
    return false;
  }

  /** Did they run the same material from two different heights? */
  get sameObjectDifferentZones(): boolean {
    const byId = new Map<string, Set<string>>();
    for (const r of this.runs) {
      const set = byId.get(r.id) ?? new Set<string>();
      set.add(r.zone);
      byId.set(r.id, set);
    }
    for (const set of byId.values()) if (set.size >= 2) return true;
    return false;
  }

  /** Did they run the same material over two different bed states? */
  get sameObjectDifferentSurfaces(): boolean {
    const byId = new Map<string, Set<string>>();
    for (const r of this.runs) {
      const set = byId.get(r.id) ?? new Set<string>();
      set.add(r.surface);
      byId.set(r.id, set);
    }
    for (const set of byId.values()) if (set.size >= 2) return true;
    return false;
  }

  /**
   * Two different materials have now been down the slide. Deliberately not
   * "run 1 differs from run 2": a child who repeats the first object a few
   * times before trying the second has still made the comparison.
   */
  get comparedFirstTwo(): boolean {
    return this.runs.length >= 2 && this.distinctObjects >= 2;
  }

  get distinctObjects(): number {
    return new Set(this.runs.map((r) => r.id)).size;
  }
}
