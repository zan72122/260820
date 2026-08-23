/** World scale: 1 em (cap height) = this many meters. Letters are ~1.8 m tall. */
export const EM = 1.8;
/** Top of the steel bogies = baseline the letters stand on. */
export const BASE_Y = 0.35;
/** Extrusion depth of the precast letters (m). */
export const LETTER_DEPTH = 0.45;
/** Test capsule radius (m). */
export const CAPSULE_R = 0.12;
/** Safety net rest height (m). */
export const NET_Y = 0.07;
/** Water surface height inside the recovery tray (m). */
export const TRAY_WATER_Y = 0.19;
/** Tray rim height (m). */
export const TRAY_TOP_Y = 0.27;
/** Height the capsule + water are released from (m). */
export const DROP_Y = 2.4;
/** Fixed physics timestep (s) — deterministic across devices. */
export const PHYS_DT = 1 / 120;
