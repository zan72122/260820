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
  intro: shot('intro', [W.x + 0.95, 1.75, 2.70], [W.x + 0.24, 0.34, W.z], 1.20, 44, 1.25, 0.9),

  // Down at working distance: the stone fills the frame, hands-on.
  wash: shot('wash', [W.x + 0.10, 1.12, 1.20], [W.x, W.y - 0.04, W.z], 0.62, 40, 1.9, 0.8),

  // Pull back just enough to see there is somewhere to put it.
  place: shot('place', [-0.12, 1.58, 2.30], [-0.16, 0.40, 0.05], 1.18, 44, 1.7, 0.7),

  // Eye-level with the seam, the wedge in frame, the stone dominant.
  wedge: shot('wedge', [C.x + 0.24, 0.95, 1.30], [C.x - 0.04, C.y - 0.02, C.z], 0.76, 34, 2.2, 0.75),

  // The money shot. Nearly inside the crack.
  crack: shot('crack', [C.x + 0.10, 0.660, 0.92], [C.x + 0.02, C.y - 0.01, C.z], 0.36, 28, 4.2, 0.45),

  // Breathe out: the whole stone, changed.
  reveal: shot('reveal', [C.x - 0.16, 1.30, 1.62], [C.x, C.y - 0.02, C.z - 0.34], 0.92, 40, 1.4, 0.7),

  // Close enough to see powder leave individual crystals.
  dust: shot('dust', [C.x + 0.06, 1.06, 1.02], [C.x, C.y - 0.06, C.z - 0.06], 0.58, 36, 2.2, 0.8),

  // Room for the stone to rise into the window light, wall visible behind.
  hold: shot('hold', [C.x + 0.34, 1.40, 1.95], [C.x + 0.16, 0.98, -0.10], 1.10, 42, 1.8, 0.95),

  // Low, reverent, the velvet catching the last of the light.
  display: shot('display', [P.x - 0.24, 1.04, 1.30], [P.x - 0.09, P.y - 0.08, P.z - 0.30], 0.92, 38, 1.5, 0.5),

  // Slow drift around the finished stone while the choices fade in.
  displayArc: shot('displayArc', [P.x + 0.38, 1.10, 1.24], [P.x - 0.09, P.y - 0.08, P.z - 0.30], 0.96, 38, 0.5, 0.5),
};
