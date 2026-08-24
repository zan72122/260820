import * as THREE from 'three';

/**
 * One shared metric layout. Everything — camera rails, hit targets, hand
 * poses — reads from here so the foreground props, the arm and the room stay
 * in agreement in both screen orientations.
 */
export const LAYOUT = {
  /** Axis height of the manikin's arm module where it lies on the couch. */
  armY: 0.72,
  armZ: 0.02,
  shoulderX: 0.05,
  cuffCenterX: 0.3,
  cuffWidth: 0.14,
  cuffRadius: 0.062,
  upperArmRadius: 0.055,
  elbowX: 0.545,
  foreArmRadius: 0.046,
  wristX: 0.86,

  /** Centre of the generous antecubital acceptance region. */
  fossa: new THREE.Vector3(0.545, 0.768, 0.022),
  /** Acrylic inspection window on the arm module, just distal to the cuff. */
  inspection: new THREE.Vector3(0.42, 0.762, 0.028),

  couchTop: 0.62,
  trolleyTop: 0.66,

  bulbCenter: new THREE.Vector3(0.6, 0.706, 0.72),
  valveCenter: new THREE.Vector3(0.618, 0.742, 0.826),
  gaugeCenter: new THREE.Vector3(0.4, 0.9, 0.55),
  standTop: new THREE.Vector3(0.95, 0.72, 0.56),
} as const;
