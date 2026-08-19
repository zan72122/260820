/** All units are centimetres, so gravity is simply 981 cm/s^2. */
export const DIM = {
  /** cake board sits with its top face at y = 0 */
  boardTop: 0,
  boardRadius: 11.6,
  boardThickness: 1.15,
  turntableRadius: 13.4,
  tableTop: -3.1,

  cakeRadius: 9,
  holeRadius: 3.5,
  layerH: 2.4,
  creamH: 0.5,

  /** outer buttercream coat thickness */
  coatThickness: 0.45,

  /**
   * The pre-cut slice. It points front-right rather than straight at the camera
   * so the first (hand-made) cut plane faces the lens and reads clearly, while
   * the slice still travels towards the viewer when it is pulled out.
   */
  wedgeAngle: (52 * Math.PI) / 180,
  wedgeCenter: (62 * Math.PI) / 180,
} as const

export const Y = (() => {
  const l = DIM.layerH
  const c = DIM.creamH
  const base0 = 0
  const base1 = base0 + l
  const cream1 = base1 + c
  const ring1 = cream1 + l
  const cream2 = ring1 + c
  const ring2 = cream2 + l
  const cream3 = ring2 + c
  const lid = cream3 + l
  return {
    base: [base0, base1] as const,
    cream1: [base1, cream1] as const,
    ring1: [cream1, ring1] as const,
    cream2: [ring1, cream2] as const,
    ring2: [cream2, ring2] as const,
    cream3: [ring2, cream3] as const,
    lid: [cream3, lid] as const,
    /** candy rests on top of the base sponge */
    cavityFloor: base1,
    /** the lid closes the cavity here */
    cavityCeil: cream3,
    top: lid,
  }
})()

export const WEDGE_START = DIM.wedgeCenter - DIM.wedgeAngle / 2
export const WEDGE_END = DIM.wedgeCenter + DIM.wedgeAngle / 2
