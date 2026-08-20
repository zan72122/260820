import { NX, NZ } from '../world/layout';

const KEY = 'doronko.observation.v1';
const SIG = 8;

export interface RunRecord {
  layout: number;
  firstTouchSec: number | null;
  hintsBeforeFirstFlow: number;
  firstFlowSec: number | null;
  pondSec: number | null;
  gateGrabs: number;
  channelSignature: string;
  diggedCells: number;
  repairedCells: number;
}

/**
 * Observation data for the developer only. It never leaves the device and is
 * completely hidden unless the URL carries ?debug=1.
 */
export class Observation {
  enabled = false;
  run: RunRecord = Observation.blank(0);
  history: RunRecord[] = [];
  private t0 = 0;
  changedChannelOnSecondRun: boolean | null = null;

  static blank(layout: number): RunRecord {
    return {
      layout,
      firstTouchSec: null,
      hintsBeforeFirstFlow: 0,
      firstFlowSec: null,
      pondSec: null,
      gateGrabs: 0,
      channelSignature: '',
      diggedCells: 0,
      repairedCells: 0,
    };
  }

  constructor() {
    this.enabled = new URLSearchParams(location.search).get('debug') === '1';
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.history = JSON.parse(raw) as RunRecord[];
    } catch {
      this.history = [];
    }
  }

  begin(layout: number, now: number) {
    this.run = Observation.blank(layout);
    this.t0 = now;
  }

  private sec(now: number) {
    return Math.round((now - this.t0) * 10) / 10;
  }

  touch(now: number) {
    if (this.run.firstTouchSec === null) this.run.firstTouchSec = this.sec(now);
  }

  hint() {
    if (this.run.firstFlowSec === null) this.run.hintsBeforeFirstFlow++;
  }

  flow(now: number) {
    if (this.run.firstFlowSec === null) this.run.firstFlowSec = this.sec(now);
  }

  pond(now: number) {
    if (this.run.pondSec === null) this.run.pondSec = this.sec(now);
  }

  gateGrab() {
    this.run.gateGrabs++;
  }

  /** Coarse fingerprint of where the child carved, used only to see whether
      the second attempt took a different route. */
  finish(base: Float32Array, now: Float32Array, mud: Float32Array) {
    const bits: number[] = new Array(SIG * SIG).fill(0);
    let dug = 0;
    let fixed = 0;
    for (let z = 0; z < NZ; z++) {
      for (let x = 0; x < NX; x++) {
        const i = z * NX + x;
        const d = base[i] - now[i];
        if (d > 0.02) {
          dug++;
          const bi = (((z * SIG) / NZ) | 0) * SIG + (((x * SIG) / NX) | 0);
          bits[bi] = 1;
        }
        if (mud[i] > 0.3) fixed++;
      }
    }
    this.run.diggedCells = dug;
    this.run.repairedCells = fixed;
    this.run.channelSignature = bits.join('');
    const prev = this.history[this.history.length - 1];
    if (prev && prev.channelSignature) {
      let diff = 0;
      for (let i = 0; i < bits.length; i++) if (String(bits[i]) !== prev.channelSignature[i]) diff++;
      this.changedChannelOnSecondRun = diff > 4;
    }
    this.history.push({ ...this.run });
    if (this.history.length > 12) this.history.shift();
    try {
      localStorage.setItem(KEY, JSON.stringify(this.history));
    } catch {
      /* private mode: observation is optional */
    }
  }
}
