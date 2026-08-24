import type { BodySoundField, ChestCoord, WindowId } from '../audio/BodySoundField';
import type { CardiacClock } from '../core/CardiacClock';

export interface DiscoveryEvent {
  id: WindowId;
  coord: ChestCoord;
  /** True the first time this area has ever been held long enough. */
  firstTime: boolean;
}

/**
 * Notices when the child has actually *stayed somewhere and listened*.
 *
 * Nothing is unlocked by arriving at a spot — only by resting on it for a few
 * complete cycles with the diaphragm seated. That ordering is the whole point:
 * place, listen, move, notice, and only then see.
 */
export class WindowDiscovery {
  private beatsHere = 0;
  private lastBeatIndex = -1;
  private currentId: WindowId | null = null;
  private discovered = new Set<WindowId>();
  private visitedThisRound = new Set<WindowId>();
  private listeners: Array<(e: DiscoveryEvent) => void> = [];

  /** Complete cycles that must pass on one area before it counts. */
  beatsRequired = 3;

  constructor(
    private field: BodySoundField,
    private clock: CardiacClock,
  ) {}

  onDiscover(fn: (e: DiscoveryEvent) => void): void {
    this.listeners.push(fn);
  }

  isDiscovered(id: WindowId): boolean {
    return this.discovered.has(id);
  }

  get discoveredCount(): number {
    return this.discovered.size;
  }

  get discoveredIds(): WindowId[] {
    return [...this.discovered];
  }

  /** Areas the child has settled on since the last round change. */
  get visitedThisRoundCount(): number {
    return this.visitedThisRound.size;
  }

  resetRoundVisits(): void {
    this.visitedThisRound.clear();
  }

  /** How far through the required dwell the current area is, 0..1. */
  get dwellProgress(): number {
    return Math.min(1, this.beatsHere / this.beatsRequired);
  }

  get currentArea(): WindowId | null {
    return this.currentId;
  }

  update(coord: ChestCoord, contact: number): void {
    const idx = this.clock.beatIndex();
    const here = contact > 0.42 ? this.field.windowUnder(coord) : null;

    if (here !== this.currentId) {
      this.currentId = here;
      this.beatsHere = 0;
      this.lastBeatIndex = idx;
      return;
    }
    if (here === null) return;

    if (idx !== this.lastBeatIndex) {
      this.beatsHere += idx - this.lastBeatIndex;
      this.lastBeatIndex = idx;
      if (this.beatsHere >= this.beatsRequired) {
        const firstTime = !this.discovered.has(here);
        this.discovered.add(here);
        this.visitedThisRound.add(here);
        this.beatsHere = 0;
        const e: DiscoveryEvent = { id: here, coord: { ...coord }, firstTime };
        for (const fn of this.listeners) fn(e);
      }
    }
  }
}
