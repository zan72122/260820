import { Rng } from '../core/util';

export type StepId = 'peel' | 'brush' | 'fill' | 'smooth' | 'polish';

export type DefectKind = 'step' | 'cloudy' | 'scratch' | 'oldSealant' | 'wax';

/** Which treatments a given fault actually needs. Order is the treatment order. */
export const DEFECT_STEPS: Record<DefectKind, StepId[]> = {
  step: ['peel', 'brush', 'fill', 'smooth', 'polish'],
  cloudy: ['brush', 'polish'],
  scratch: ['fill', 'smooth', 'polish'],
  oldSealant: ['peel', 'brush', 'fill', 'smooth'],
  wax: ['polish'],
};

const LATER: DefectKind[] = ['scratch', 'oldSealant', 'wax', 'step', 'cloudy'];

/**
 * Round one is always the lip that stops the water, round two is always the dull
 * patch that slows it. From round three the faults recombine, which is the point
 * where a player starts predicting the tool instead of being handed it.
 */
export function defectForRound(round: number, rng: Rng): DefectKind {
  if (round === 0) return 'step';
  if (round === 1) return 'cloudy';
  return rng.pick(LATER);
}

/** Which seam of the flume holds the fault for this round. */
export function seamForRound(round: number, seamCount: number, rng: Rng): number {
  if (round === 0) return 0;
  if (round === 1) return 1;
  return 2 + rng.int(Math.max(1, seamCount - 2));
}
