import { clamp01, damp, smoothstep } from '../util/math';
import {
  PRESSURE_WINDOW_BOTTOM,
  PRESSURE_WINDOW_TOP,
} from './CuffPressureModel';

/**
 * The transparent training module inside the manikin's arm.
 *
 * The vessel opens whenever the module's own line pressure rises above the
 * cuff pressure, which is the real ordering of events: hold the cuff above the
 * peak and it never opens; let it fall between peak and trough and it opens
 * for part of every beat; let it fall below the trough and it simply stays
 * open. That single rule produces the whole sound window, so the cutaway and
 * the audio can never contradict each other. No pressure value is ever shown.
 */

/** Module peak, on the same normalised scale as the cuff. */
export const MODULE_PEAK = PRESSURE_WINDOW_TOP;
/** Module trough. */
export const MODULE_TROUGH = PRESSURE_WINDOW_BOTTOM;

/** Line pressure inside the module across one beat, 0..1 of beat phase. */
export const modulePressure = (beatPhase: number): number => {
  const p = beatPhase - Math.floor(beatPhase);
  const upstroke = smoothstep(0.0, 0.085, p);
  const runoff = Math.exp(-Math.max(0, p - 0.085) * 2.9);
  // A small secondary rebound, as an elastic line gives after the pump closes.
  const rebound = Math.exp(-((p - 0.36) ** 2) / 0.004) * 0.16;
  const wave = clamp01(upstroke * runoff + rebound);
  return MODULE_TROUGH + (MODULE_PEAK - MODULE_TROUGH) * wave;
};

/** How far the vessel is open right now: 0 shut, 1 fully open. */
export const lumenAt = (cuffPressure: number, beatPhase: number): number => {
  const line = modulePressure(beatPhase);
  return smoothstep(cuffPressure - 0.005, cuffPressure + 0.075, line);
};

/**
 * Flow is turbulent only while the vessel is partly open — that is where the
 * tapping comes from. Wide open or fully shut, it is quiet.
 */
export const turbulenceAt = (lumen: number): number =>
  smoothstep(0.02, 0.3, lumen) * (1 - smoothstep(0.55, 0.95, lumen));

export class TrainingArmReveal {
  /** 0 = ordinary skin over the slot, 1 = looking straight into the module. */
  exposure = 0;
  /** Interior illumination of the module, follows exposure. */
  interiorLight = 0;
  /** True once the reveal has been shown in this run. */
  shown = false;

  private target = 0;

  open(): void {
    this.target = 1;
    this.shown = true;
  }

  close(): void {
    this.target = 0;
  }

  reset(): void {
    this.exposure = 0;
    this.interiorLight = 0;
    this.target = 0;
    this.shown = false;
  }

  update(dt: number): void {
    this.exposure = damp(this.exposure, this.target, 3.6, dt);
    this.interiorLight = damp(this.interiorLight, this.target, 2.8, dt);
  }
}
