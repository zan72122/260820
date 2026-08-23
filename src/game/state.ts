/**
 * One casting cycle. Phases advance strictly forward; the loop restarts
 * with a new letter. Screen rotation never changes the phase.
 */

export enum Phase {
  TITLE = 'TITLE',     // attract: lever rocks, shadow on sand
  ALIGN = 'ALIGN',     // 1. slide the pattern carriage over the sand
  PRESS = 'PRESS',     // 2. pull the press lever down
  RAISE = 'RAISE',     // 3. return the lever up -> cavity + islands
  BRUSH = 'BRUSH',     // 4. brush loose sand off the mold
  POUR = 'POUR',       // 5. hold the crucible lever -> metal fills
  COOL = 'COOL',       // 6. watch colour and sound settle
  BREAK = 'BREAK',     // 7. open the flask, sand crumbles, letter out
  REVEAL = 'REVEAL',   // letter held up to the camera
  DONE = 'DONE',       // letter rack: choose the next letter
}

export const PHASE_ORDER: Phase[] = [
  Phase.TITLE, Phase.ALIGN, Phase.PRESS, Phase.RAISE, Phase.BRUSH,
  Phase.POUR, Phase.COOL, Phase.BREAK, Phase.REVEAL, Phase.DONE,
];

export function nextPhase(p: Phase): Phase {
  const i = PHASE_ORDER.indexOf(p);
  return PHASE_ORDER[Math.min(i + 1, PHASE_ORDER.length - 1)];
}
