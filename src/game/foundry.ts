import * as THREE from 'three';
import { FLASK_W } from './sand';
import { hash2, makeCanvasTexture } from './moldField';

/**
 * The foundry set. A small working non-ferrous casting shop:
 * near - flask + sand on a bench, pattern press overhead
 * mid  - press column, tilting crucible station, safety glass
 * far  - crucible furnace, vent hood, stock rack, safety robot
 *
 * World: y up, floor at 0, flask centre at x=0,z=0. Camera side is +z.
 */

export const TABLE_Y = 0.78;
export const SAND_Y = 0.9;          // world height of sand surface
export const FLASK_WALL_H = 0.17;
export const FLASK_WALL_T = 0.045;
export const RAM_TRAVEL_TOP = 1.62; // pattern bottom when raised
export const CARRIAGE_HOME_X = 0.62; // pattern parked to the right
export const BEAM_Y = 1.98;

export interface FoundryRefs {
  group: THREE.Group;
  carriage: THREE.Group;       // slides along beam (ALIGN)
  ram: THREE.Group;            // moves down inside carriage (PRESS)
  patternSocket: THREE.Group;  // pattern mesh mounts here (bottom of ram)
  pressLever: THREE.Group;     // big lever, right side of press column
  flaskGroup: THREE.Group;
  flaskFront: THREE.Group;     // hinged wall (BREAK)
  flaskLatch: THREE.Mesh;
  crucibleTilt: THREE.Group;   // rotates to pour
  crucibleLever: THREE.Group;
  spoutTip: THREE.Object3D;
  meltSurface: THREE.Mesh;
  gripper: THREE.Group;        // manipulator that lifts the finished letter
  gripperFingers: THREE.Group[];
  robotHead: THREE.Object3D;
  glass: THREE.Group;
  furnaceGlow: THREE.PointLight;
}

/* ------------------------------------------------- shared materials */

function concreteTex(): THREE.CanvasTexture {
  return makeCanvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#6b675f';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 5000; i++) {
      const x = hash2(i, 1, 51) * s, y = hash2(i, 2, 52) * s;
      const g = 90 + hash2(i, 3, 53) * 40;
      ctx.fillStyle = `rgba(${g},${g},${g - 4},0.35)`;
      ctx.fillRect(x, y, 2 + hash2(i, 4, 54) * 3, 2 + hash2(i, 5, 55) * 3);
    }
    // worn traffic path + a couple of old stains, deliberately off-centre
    ctx.fillStyle = 'rgba(48,45,40,0.25)';
    ctx.beginPath(); ctx.ellipse(s * 0.38, s * 0.62, s * 0.3, s * 0.14, 0.4, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(60,50,35,0.3)';
    ctx.beginPath(); ctx.ellipse(s * 0.72, s * 0.28, s * 0.06, s * 0.09, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(40,38,34,0.35)';
    ctx.beginPath(); ctx.ellipse(s * 0.15, s * 0.2, s * 0.05, s * 0.04, 0, 0, 7); ctx.fill();
  });
}

function paintedSteel(color: number, rough = 0.5): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: rough });
}

function bareSteel(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x8e9296, metalness: 0.9, roughness: 0.38 });
}

function castIron(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x3d4043, metalness: 0.75, roughness: 0.7 });
}

function refractory(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0xb7a488, metalness: 0.05, roughness: 0.92 });
}

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  return m;
}

function cyl(rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 20): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* ------------------------------------------------------------------ */

export function buildFoundry(): FoundryRefs {
  const group = new THREE.Group();

  /* ---- room ---- */
  const floorTex = concreteTex();
  floorTex.repeat.set(2, 2);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 7),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x7e7a6e, roughness: 0.9, metalness: 0 });
  const backWall = box(9, 3.4, 0.1, wallMat, 0, 1.7, -2.6, false);
  backWall.receiveShadow = true;
  group.add(backWall);
  const sideWallL = box(0.1, 3.4, 7, wallMat, -3.4, 1.7, 0, false);
  const sideWallR = box(0.1, 3.4, 7, wallMat, 3.4, 1.7, 0, false);
  group.add(sideWallL, sideWallR);
  // lower wainscot of steel plate along the back wall
  group.add(box(9, 0.9, 0.06, paintedSteel(0x4c5352, 0.6), 0, 0.45, -2.55, false));

  /* ---- work bench ---- */
  const benchTop = box(1.5, 0.07, 1.1, castIron(), 0, TABLE_Y - 0.035, 0);
  group.add(benchTop);
  for (const [lx, lz] of [[-0.65, -0.45], [0.65, -0.45], [-0.65, 0.45], [0.65, 0.45]] as const) {
    group.add(box(0.07, TABLE_Y - 0.07, 0.07, paintedSteel(0x39514f, 0.55), lx, (TABLE_Y - 0.07) / 2, lz));
  }
  // lower shelf with a spare flask + rammer
  group.add(box(1.3, 0.04, 0.9, paintedSteel(0x39514f, 0.6), 0, 0.24, 0));
  group.add(box(0.4, 0.1, 0.3, castIron(), -0.4, 0.31, -0.15));
  group.add(cyl(0.025, 0.025, 0.4, bareSteel(), 0.35, 0.3, 0.1, 10).rotateZ(Math.PI / 2));

  /* ---- flask (鋳型枠) ---- */
  const flaskGroup = new THREE.Group();
  flaskGroup.position.set(0, 0, 0);
  const inner = FLASK_W;
  const t = FLASK_WALL_T, h = FLASK_WALL_H;
  const wallY = SAND_Y - 0.115 + h / 2;
  const fMat = castIron();
  // back / left / right fixed walls
  const backW = box(inner + t * 2, h, t, fMat, 0, wallY, -(inner / 2 + t / 2));
  const leftW = box(t, h, inner, fMat, -(inner / 2 + t / 2), wallY, 0);
  const rightW = box(t, h, inner, fMat, inner / 2 + t / 2, wallY, 0);
  flaskGroup.add(backW, leftW, rightW);
  // pour basin notch on the left wall: a small refractory funnel block
  const basin = box(0.09, 0.05, 0.09, refractory(), -(inner / 2) + 0.02, SAND_Y + 0.012, 0);
  flaskGroup.add(basin);

  // hinged front wall
  const flaskFront = new THREE.Group();
  flaskFront.position.set(-(inner / 2 + t), wallY, inner / 2 + t / 2); // hinge at left-front corner
  const frontW = box(inner + t * 2, h, t, fMat, inner / 2 + t, 0, 0);
  flaskFront.add(frontW);
  // latch handle on the right end of the front wall
  const flaskLatch = box(0.075, 0.05, 0.07, bareSteel(), inner + t * 1.2, 0.01, 0.045);
  flaskFront.add(flaskLatch);
  // hinge barrels
  flaskFront.add(cyl(0.018, 0.018, h * 0.9, bareSteel(), 0, 0, 0, 10));
  flaskGroup.add(flaskFront);

  // clamps on the fixed corners
  for (const [cx, cz] of [[-inner / 2 - t, -inner / 2 - t], [inner / 2 + t, -inner / 2 - t]] as const) {
    flaskGroup.add(box(0.05, 0.09, 0.05, bareSteel(), cx, wallY + 0.01, cz));
  }
  // side handles
  flaskGroup.add(cyl(0.014, 0.014, 0.16, bareSteel(), -(inner / 2 + t + 0.03), wallY, -0.1, 10).rotateX(Math.PI / 2));
  flaskGroup.add(cyl(0.014, 0.014, 0.16, bareSteel(), inner / 2 + t + 0.03, wallY, 0.12, 10).rotateX(Math.PI / 2));
  group.add(flaskGroup);

  // sand bulk below the heightfield surface (so cavity walls look filled)
  const bulk = box(inner, 0.09, inner, new THREE.MeshStandardMaterial({ color: 0x76614a, roughness: 1 }), 0, SAND_Y - 0.055, 0, false);
  bulk.receiveShadow = true;
  group.add(bulk);

  /* ---- pattern press ---- */
  const colMat = paintedSteel(0x39514f, 0.5);
  const column = box(0.16, 2.3, 0.2, colMat, 0.95, 1.15, -0.62);
  group.add(column);
  group.add(box(0.42, 0.06, 0.42, colMat, 0.95, 0.03, -0.62)); // base plate
  // overhead beam the carriage slides on (runs in x above the flask)
  const beam = box(1.9, 0.12, 0.14, colMat, 0.15, BEAM_Y, -0.28);
  group.add(beam);
  group.add(box(0.1, 0.1, 0.42, colMat, 0.95, BEAM_Y, -0.45)); // beam-to-column bracket
  // wear: bright rubbed strip on the beam underside where the carriage runs
  group.add(box(1.5, 0.012, 0.05, bareSteel(), 0.1, BEAM_Y - 0.062, -0.28, false));

  // carriage + vertical ram
  const carriage = new THREE.Group();
  carriage.position.set(CARRIAGE_HOME_X, BEAM_Y, -0.28);
  const carBody = box(0.24, 0.2, 0.24, castIron(), 0, -0.02, 0);
  carriage.add(carBody);
  carriage.add(cyl(0.03, 0.03, 0.1, bareSteel(), -0.09, 0.08, 0, 12)); // rollers
  carriage.add(cyl(0.03, 0.03, 0.1, bareSteel(), 0.09, 0.08, 0, 12));

  const ram = new THREE.Group();
  carriage.add(ram);
  const ramShaft = box(0.075, 0.78, 0.075, bareSteel(), 0, -0.33, 0);
  ram.add(ramShaft);
  // pattern plate at the ram foot; the pattern bolts on below, offset so the
  // glyph centre hangs under the shaft
  const patternSocket = new THREE.Group();
  patternSocket.position.set(0, -0.66, 0.28); // z: reach over flask centre
  ram.add(patternSocket);
  const plate = box(0.5, 0.03, 0.5, castIron(), 0, 0.015, 0);
  patternSocket.add(plate);
  // arm connecting shaft to plate
  ram.add(box(0.07, 0.05, 0.3, castIron(), 0, -0.63, 0.13));
  for (const [bx, bz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]] as const) {
    patternSocket.add(cyl(0.012, 0.012, 0.02, bareSteel(), bx, 0.04, bz, 8)); // bolts
  }
  group.add(carriage);

  /* ---- press lever (the child's big control) ---- */
  const pressLever = new THREE.Group();
  pressLever.position.set(1.06, 1.42, -0.5);
  const leverArm = cyl(0.02, 0.026, 0.62, bareSteel(), 0, 0.31, 0, 14);
  pressLever.add(leverArm);
  const grip = cyl(0.042, 0.042, 0.13, new THREE.MeshStandardMaterial({ color: 0x8c2f22, roughness: 0.6, metalness: 0.1 }), 0, 0.62, 0, 16);
  pressLever.add(grip);
  const pivotHub = cyl(0.05, 0.05, 0.09, castIron(), 0, 0, 0, 16);
  pivotHub.rotation.x = Math.PI / 2;
  pressLever.add(pivotHub);
  pressLever.rotation.z = 0.5; // resting angle (up)
  group.add(pressLever);

  /* ---- crucible station (left) ---- */
  const cruBase = new THREE.Group();
  cruBase.position.set(-1.02, 0, 0.02);
  cruBase.add(box(0.5, 0.05, 0.5, castIron(), 0, 0.025, 0));
  cruBase.add(box(0.08, 1.05, 0.08, paintedSteel(0x39514f, 0.5), -0.18, 0.55, -0.16));
  cruBase.add(box(0.08, 1.05, 0.08, paintedSteel(0x39514f, 0.5), -0.18, 0.55, 0.16));
  cruBase.add(box(0.08, 0.06, 0.42, paintedSteel(0x39514f, 0.5), -0.18, 1.1, 0));

  const crucibleTilt = new THREE.Group();
  crucibleTilt.position.set(-0.14, 1.08, 0); // trunnion axis (z)
  // crucible body: graphite/clay, worn rim
  const cru = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.10, 0.3, 22),
    new THREE.MeshStandardMaterial({ color: 0x4a4340, roughness: 0.85, metalness: 0.08 })
  );
  cru.position.set(0.05, -0.02, 0);
  cru.castShadow = true;
  crucibleTilt.add(cru);
  // refractory collar + spout
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.135, 0.05, 22), refractory());
  collar.position.set(0.05, 0.13, 0);
  crucibleTilt.add(collar);
  const spout = box(0.12, 0.035, 0.07, refractory(), 0.17, 0.135, 0);
  spout.rotation.z = -0.18;
  crucibleTilt.add(spout);
  const spoutTip = new THREE.Object3D();
  spoutTip.position.set(0.235, 0.12, 0);
  crucibleTilt.add(spoutTip);
  // visible melt surface
  const meltSurface = new THREE.Mesh(
    new THREE.CircleGeometry(0.115, 22),
    new THREE.MeshStandardMaterial({ color: 0x2a1206, emissive: 0xff7726, emissiveIntensity: 2.2, roughness: 0.35, metalness: 0.4 })
  );
  meltSurface.rotation.x = -Math.PI / 2;
  meltSurface.position.set(0.05, 0.145, 0);
  crucibleTilt.add(meltSurface);
  // trunnion pins
  crucibleTilt.add(cyl(0.02, 0.02, 0.46, bareSteel(), 0.05, 0, 0, 12).rotateX(Math.PI / 2));
  cruBase.add(crucibleTilt);

  // tilt lever, reachable at the front of the station
  const crucibleLever = new THREE.Group();
  crucibleLever.position.set(0.05, 1.08, 0.26);
  const cArm = cyl(0.018, 0.023, 0.5, bareSteel(), 0, 0.25, 0, 12);
  crucibleLever.add(cArm);
  crucibleLever.add(cyl(0.04, 0.04, 0.11, new THREE.MeshStandardMaterial({ color: 0x8c2f22, roughness: 0.6, metalness: 0.1 }), 0, 0.5, 0, 14));
  crucibleLever.rotation.x = 0.35;
  cruBase.add(crucibleLever);
  group.add(cruBase);

  /* ---- furnace (background) ---- */
  const furnace = new THREE.Group();
  furnace.position.set(-1.85, 0, -1.5);
  const fBody = cyl(0.42, 0.46, 1.0, castIron(), 0, 0.5, 0, 26);
  furnace.add(fBody);
  const fLid = cyl(0.45, 0.45, 0.09, refractory(), 0, 1.04, 0, 26);
  furnace.add(fLid);
  furnace.add(box(0.1, 0.5, 0.1, paintedSteel(0x39514f, 0.5), 0.5, 0.25, 0.1)); // lid lever post
  // narrow glow in the lid gap - temperature light, not neon
  const furnaceGlow = new THREE.PointLight(0xff8a3c, 1.6, 2.4, 2);
  furnaceGlow.position.set(0, 1.02, 0.2);
  furnace.add(furnaceGlow);
  const gapGlow = new THREE.Mesh(
    new THREE.TorusGeometry(0.43, 0.012, 8, 40),
    new THREE.MeshStandardMaterial({ color: 0x140a06, emissive: 0xff6a1e, emissiveIntensity: 1.8, roughness: 1 })
  );
  gapGlow.rotation.x = Math.PI / 2;
  gapGlow.position.y = 1.0;
  furnace.add(gapGlow);
  group.add(furnace);

  /* ---- vent hood over crucible + furnace ---- */
  const hood = new THREE.Group();
  hood.position.set(-1.4, 0, -0.6);
  const canopy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.85, 0.5, 4, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x5a5f63, metalness: 0.7, roughness: 0.5, side: THREE.DoubleSide })
  );
  canopy.rotation.y = Math.PI / 4;
  canopy.position.y = 2.25;
  canopy.castShadow = true;
  hood.add(canopy);
  const duct = cyl(0.16, 0.16, 0.9, paintedSteel(0x5a5f63, 0.5), 0, 2.95, 0, 18);
  hood.add(duct);
  // smoke stain on the canopy lip, heavier on the furnace side
  const stain = new THREE.Mesh(
    new THREE.CylinderGeometry(0.86, 0.87, 0.1, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x2c2a27, roughness: 1, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  stain.position.set(-0.1, 2.0, -0.1);
  hood.add(stain);
  group.add(hood);

  /* ---- stock rack (background right) ---- */
  const rack = new THREE.Group();
  rack.position.set(1.9, 0, -1.9);
  const rackMat = paintedSteel(0x6b5d4a, 0.6);
  for (const rx of [-0.5, 0.5]) rack.add(box(0.06, 1.7, 0.5, rackMat, rx, 0.85, 0));
  for (const ry of [0.5, 1.0, 1.5]) rack.add(box(1.06, 0.04, 0.5, rackMat, 0, ry, 0));
  // bronze ingots, stacked loosely
  const ingotMat = new THREE.MeshStandardMaterial({ color: 0x9c6a34, metalness: 0.85, roughness: 0.5 });
  for (let i = 0; i < 7; i++) {
    const ing = box(0.24, 0.05, 0.08, ingotMat,
      -0.3 + (i % 3) * 0.27 + hash2(i, 1, 61) * 0.03,
      0.55 + Math.floor(i / 3) * 0.055,
      -0.1 + hash2(i, 2, 62) * 0.16);
    ing.rotation.y = (hash2(i, 3, 63) - 0.5) * 0.3;
    rack.add(ing);
  }
  // spare flasks on upper shelf
  rack.add(box(0.36, 0.14, 0.36, castIron(), -0.25, 1.1, 0));
  rack.add(box(0.36, 0.14, 0.36, castIron(), 0.22, 1.1, 0.05));
  group.add(rack);

  /* ---- safety robot (background, checks only) ---- */
  const robot = new THREE.Group();
  robot.position.set(-2.45, 0, -0.4);
  robot.rotation.y = 0.7;
  robot.add(box(0.3, 0.12, 0.4, castIron(), 0, 0.09, 0)); // tracked base
  robot.add(box(0.24, 0.5, 0.26, paintedSteel(0xa8912f, 0.55), 0, 0.42, 0)); // body
  robot.add(box(0.24, 0.06, 0.26, castIron(), 0, 0.15, 0));
  const mast = cyl(0.025, 0.025, 0.4, bareSteel(), 0, 0.85, 0, 10);
  robot.add(mast);
  const robotHead = new THREE.Group();
  robotHead.position.set(0, 1.08, 0);
  robotHead.add(box(0.14, 0.1, 0.16, paintedSteel(0x4c5352, 0.45), 0, 0, 0));
  const lens = cyl(0.028, 0.028, 0.02, new THREE.MeshStandardMaterial({ color: 0x14181c, metalness: 0.2, roughness: 0.2 }), 0, 0, 0.09, 12);
  lens.rotation.x = Math.PI / 2;
  robotHead.add(lens);
  robot.add(robotHead);
  group.add(robot);

  /* ---- safety glass between child and shop ---- */
  const glass = new THREE.Group();
  glass.position.set(0, 0, 1.02);
  const frameMat = paintedSteel(0x39514f, 0.45);
  glass.add(box(3.2, 0.1, 0.08, frameMat, 0, 0.72, 0));
  glass.add(box(3.2, 0.1, 0.08, frameMat, 0, 2.3, 0));
  for (const gx of [-1.55, 0.0, 1.55]) glass.add(box(0.09, 1.6, 0.08, frameMat, gx, 1.51, 0));
  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 1.5),
    new THREE.MeshPhysicalMaterial({
      color: 0xdfe8ea, transparent: true, opacity: 0.07,
      roughness: 0.05, metalness: 0, side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  pane.position.set(0, 1.51, 0);
  glass.add(pane);
  // one local reflection streak, off to the side
  const streak = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 1.3),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.035, depthWrite: false })
  );
  streak.position.set(-1.0, 1.5, 0.005);
  streak.rotation.z = 0.18;
  glass.add(streak);
  group.add(glass);

  /* ---- manipulator gripper (used at reveal) ---- */
  const gripper = new THREE.Group();
  gripper.position.set(0, 2.6, 0); // parked high, out of shot
  const gShaft = cyl(0.03, 0.03, 0.7, bareSteel(), 0, 0.35, 0, 12);
  gripper.add(gShaft);
  gripper.add(box(0.2, 0.06, 0.08, castIron(), 0, 0.02, 0));
  const fingerMat = bareSteel();
  const fingers: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const f = new THREE.Group();
    f.position.set(side * 0.09, 0, 0);
    f.add(box(0.025, 0.16, 0.05, fingerMat, 0, -0.08, 0));
    f.add(box(0.045, 0.025, 0.05, fingerMat, -side * 0.012, -0.16, 0));
    gripper.add(f);
    fingers.push(f);
  }
  group.add(gripper);

  return {
    group,
    carriage, ram, patternSocket, pressLever,
    flaskGroup, flaskFront, flaskLatch,
    crucibleTilt, crucibleLever, spoutTip, meltSurface,
    gripper, gripperFingers: fingers,
    robotHead,
    glass,
    furnaceGlow,
  };
}
