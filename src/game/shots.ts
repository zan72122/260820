import { shot, type Shot } from '../core/CameraRig';
import { STATION } from '../world/Workshop';

const W = STATION.wash, C = STATION.cradle, P = STATION.pedestal;

/**
 * The camera chain. Each shot is a deliberate statement:
 *   wide  -> "there is a stone here, and a room around it"
 *   wash  -> "your hands are on it"
 *   crack -> "look at THIS" (the turn from mystery to understanding)
 *   reveal-> "and look what it did to the whole thing"
 */
export const SHOTS: Record<string, Shot> = {
  // A room with a muddy lump in it. Nothing yet says "treasure".
  intro: shot('intro', [W.x + 0.55, 1.55, 2.45], [W.x - 0.02, 0.40, W.z], 0.92, 42, 1.35, 0.9),

  // Down at working distance: the stone fills the frame, hands-on.
  wash: shot('wash', [W.x + 0.06, 1.06, 1.06], [W.x, W.y - 0.02, W.z], 0.50, 40, 2.2, 0.8),

  // Pull back just enough to see there is somewhere to put it.
  place: shot('place', [-0.16, 1.30, 1.86], [-0.18, 0.42, 0.05], 0.98, 44, 1.9, 0.7),

  // Eye-level with the seam, the wedge in frame, the stone dominant.
  wedge: shot('wedge', [C.x + 0.08, 0.86, 1.02], [C.x, C.y - 0.02, C.z], 0.44, 34, 2.4, 0.75),

  // The money shot. Nearly inside the crack.
  crack: shot('crack', [C.x + 0.02, 0.615, 0.60], [C.x, C.y - 0.03, C.z], 0.175, 26, 4.6, 0.45),

  // Breathe out: the whole stone, changed.
  reveal: shot('reveal', [C.x - 0.18, 1.18, 1.16], [C.x, C.y - 0.06, C.z], 0.62, 40, 1.5, 0.7),

  // Close enough to see powder leave individual crystals.
  dust: shot('dust', [C.x + 0.05, 0.99, 0.84], [C.x, C.y - 0.05, C.z], 0.40, 36, 2.4, 0.8),

  // Room for the stone to rise into the window light, wall visible behind.
  hold: shot('hold', [C.x + 0.30, 1.30, 1.44], [C.x + 0.12, 1.00, 0.10], 0.78, 42, 2.0, 0.95),

  // Low, reverent, the velvet catching the last of the light.
  display: shot('display', [P.x - 0.28, 0.94, 1.12], [P.x, P.y - 0.03, P.z], 0.48, 38, 1.6, 0.5),

  // Slow drift around the finished stone while the choices fade in.
  displayArc: shot('displayArc', [P.x + 0.42, 1.02, 1.02], [P.x, P.y - 0.02, P.z], 0.52, 38, 0.55, 0.5),
};
