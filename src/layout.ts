// All shared dimensions in meters. Y is up. The track beam runs along X at z=0.

export const L = {
  // PC track beam (standard Japanese straddle-type section: 850 mm wide)
  beamWidth: 0.85,
  beamHeight: 1.4,
  beamTopY: 3.0,          // in-depot loading track sits on low plinths
  beamLength: 64,

  // Bogie (straddle type: running wheels on top, guide wheels upper sides, stabilizer wheels lower sides)
  bogieSpacing: 9.2,      // between bogie centers
  bogieCenters: [-4.6, 4.6],
  runningWheelDia: 0.97,
  guideWheelDia: 0.56,
  stabWheelDia: 0.52,
  bolsterTopAboveBeam: 0.95,   // top of air springs / body seat above beam top

  // Car body (lead car of a fictional urban monorail)
  carLength: 14.6,
  carWidth: 2.98,
  carBodyHeight: 3.15,    // underframe bottom -> roof
  skirtDrop: 0.62,        // side skirts extend below underframe around bogie openings
  doorsPerSide: 3,

  // Lift points: holes below the door sills, 4 total (per prototype practice)
  liftPointX: [-4.6, 4.6] as const,   // aligned over bogie centers
  liftPointZ: 1.49,

  // Start position: body on a low-bed trailer at the unloading apron
  carStartZ: 8.4,
  trailerDeckY: 0.95,
  blockH: 0.85,     // stacked timber cribbing: keeps the hanging skirts clear of the deck

  // Cranes
  craneBaseX: 11.8,
  craneBaseZ: 3.4,
  boomLen: 17.5,
  boomPivotY: 2.05,

  // Rigging: hook block -> spreader beam above the roof -> two long web slings
  // running outside the body sides down to the sill brackets
  spreaderLen: 3.6,       // across car width — ends clear the body sides so slings hang outside
  spreaderDrop: 2.6,      // hook bottom to spreader center (keeps leg angle < 90°)
  slingLen: 3.5,          // spreader end down to lift bracket (clears the roof)
  bracketY: 0.78,         // sling anchor height above the underframe bottom

  // Derived heights
  springTravel: 0.09,     // air spring compression as weight transfers (readably exaggerated)
  // car underside when fully seated = compressed spring top
  get dockUndersideY() { return this.beamTopY + this.bolsterTopAboveBeam - this.springTravel },
  get startUndersideY() { return this.trailerDeckY + this.blockH },
  clearHeight: 5.35,      // underside height required before traverse is allowed

  // Inspection hall (vehicle mover tows the finished car this way, -X)
  hallX: -38,

  maxLiftY: 7.2
}

export type Vec3Like = { x: number, y: number, z: number }
