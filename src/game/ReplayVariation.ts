import { ALL_KEYS, KEY_A, KeyProfileSpec } from './FictionalKeyProfile';

/**
 * What changes between plays:
 * - play 1: only the correct key exists, already half inserted;
 * - play 2+: three differently-contoured fictional keys wait on the tray;
 * - play 3+: picking a key first holds it beside the keyway so the
 *   mountain line can be compared with the pins before inserting.
 */
export class ReplayVariation {
  playCount: number;

  constructor(playCount: number) {
    this.playCount = playCount;
  }

  availableKeys(): readonly KeyProfileSpec[] {
    return this.playCount === 0 ? [KEY_A] : ALL_KEYS;
  }

  trayEnabled(): boolean {
    return this.playCount >= 1;
  }

  showInspectBeforeInsert(): boolean {
    return this.playCount >= 2;
  }

  completed(): void {
    this.playCount++;
  }
}
