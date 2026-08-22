import { STORAGE_KEY } from './config';

export type StateName =
  | 'KEY_OUT'
  | 'KEY_PARTIAL'
  | 'KEY_INSERTING'
  | 'KEY_FULL'
  | 'PINS_ALIGNED'
  | 'PLUG_ROTATING'
  | 'BOLT_RETRACTING'
  | 'DOOR_OPEN'
  | 'FREE_PLAY';

export interface SaveData {
  state: StateName;
  keyIndex: number;
  depth: number;
  playCount: number;
  freePlay: boolean;
  introSeen: boolean;
}

const DEFAULT_SAVE: SaveData = {
  state: 'KEY_PARTIAL',
  keyIndex: 0,
  depth: 0.42,
  playCount: 0,
  freePlay: false,
  introSeen: false,
};

export class GameState {
  state: StateName = 'KEY_PARTIAL';
  keyIndex = 0;
  depth = 0.42;
  playCount = 0;
  freePlay = false;
  introSeen = false;
  plugAngle = 0; // radians
  boltProgress = 0; // 0 extended .. 1 retracted
  doorAngle = 0; // radians
  private listeners: Array<(s: StateName, prev: StateName) => void> = [];

  transition(next: StateName): void {
    if (next === this.state) return;
    const prev = this.state;
    this.state = next;
    for (const l of this.listeners) l(next, prev);
    this.persist();
  }

  onTransition(fn: (s: StateName, prev: StateName) => void): void {
    this.listeners.push(fn);
  }

  persist(): void {
    try {
      const data: SaveData = {
        state: this.persistableState(),
        keyIndex: this.keyIndex,
        depth: this.depth,
        playCount: this.playCount,
        freePlay: this.freePlay,
        introSeen: this.introSeen,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage unavailable (private mode) — the session still plays */
    }
  }

  /** transient motion states persist as their nearest stable state */
  private persistableState(): StateName {
    switch (this.state) {
      case 'KEY_INSERTING':
        return 'KEY_PARTIAL';
      case 'PLUG_ROTATING':
      case 'BOLT_RETRACTING':
        return 'KEY_FULL';
      default:
        return this.state;
    }
  }

  restore(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = { ...DEFAULT_SAVE, ...(JSON.parse(raw) as Partial<SaveData>) };
      this.state = data.state;
      this.keyIndex = data.keyIndex;
      this.depth = data.depth;
      this.playCount = data.playCount;
      this.freePlay = data.freePlay;
      this.introSeen = data.introSeen;
      if (this.state === 'DOOR_OPEN') {
        this.doorAngle = 0.42;
        this.boltProgress = 1;
        this.plugAngle = Math.PI / 2;
      }
      return true;
    } catch {
      return false;
    }
  }
}
