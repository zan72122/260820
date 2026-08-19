/** Everything in metres. A 17 cm chiffon pan is the yardstick for the scene. */
export const PAN = {
  /** Inner radius at the rim (17 cm across). */
  rTop: 0.085,
  /** Inner radius at the base — real chiffon pans taper. */
  rBot: 0.0774,
  height: 0.1,
  wall: 0.0012,
  tubeOuterBot: 0.0246,
  tubeOuterTop: 0.0216,
  tubeHeight: 0.105,
}

export const BOTTLE = {
  bodyR: 0.034,
  neckR: 0.0148,
  height: 0.225,
  /** Where the pan's central tube comes to rest. */
  mouthY: 0.225,
}

export const BOWL = { r: 0.115, height: 0.085 }

export const WORKTOP = { y: 0, width: 1.6, depth: 1.25, centerZ: -0.225, thickness: 0.045 }

/** Radius of the pan's inner wall at a given height above its base. */
export const panInnerR = (y: number) => PAN.rBot + (PAN.rTop - PAN.rBot) * Math.min(1, Math.max(0, y / PAN.height))
/** Radius of the central tube's outer face at a given height. */
export const tubeOuterR = (y: number) =>
  PAN.tubeOuterBot + (PAN.tubeOuterTop - PAN.tubeOuterBot) * Math.min(1, Math.max(0, y / PAN.tubeHeight))
