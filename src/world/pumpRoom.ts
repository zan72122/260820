import * as THREE from 'three';
import { MaterialLibrary } from '../core/materials';
import { PumpSim } from '../sim/state';
import {
  BYPASS_VALVE,
  LIGHT_SHAFT,
  MAIN_VALVE,
  PRIME_PUMP,
  PUMP,
  ROOM,
  SIGHT_GLASS,
  START_STAND,
  TANK,
  RETURN_OUTLET,
  TOWER_X,
  TOWER_Z,
  V,
  bypassCurve,
  dischargeCurve,
  suctionCurve,
} from './layout';
import {
  GateValveRig,
  PrimePumpRig,
  PumpRig,
  SightGlassRig,
  StartLeverRig,
  buildGateValve,
  buildPrimePump,
  buildPumpUnit,
  buildSightGlass,
  buildStartStand,
} from './machine';
import { PipeRun } from './piperun';
import { Splash } from './flow';
import { boltRing, channelSection } from './parts';

function boxBetween(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  mat: THREE.Material,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.receiveShadow = true;
  m.castShadow = true;
  return m;
}

function puddleAlpha(): THREE.CanvasTexture {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, s, s);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = s * (0.18 + Math.random() * 0.16);
    const x = s / 2 + Math.cos(a) * s * 0.14;
    const y = s / 2 + Math.sin(a) * s * 0.12;
    const rad = g.createRadialGradient(x, y, 0, x, y, r);
    rad.addColorStop(0, 'rgba(255,255,255,0.95)');
    rad.addColorStop(0.7, 'rgba(255,255,255,0.5)');
    rad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export interface PumpRoom {
  group: THREE.Group;
  mainValve: GateValveRig;
  bypassValve: GateValveRig;
  sightGlass: SightGlassRig;
  pump: PumpRig;
  prime: PrimePumpRig;
  starter: StartLeverRig;
  suction: PipeRun;
  discharge: PipeRun;
  bypass: PipeRun;
  daylight: THREE.DirectionalLight;
  update(dt: number, t: number, sim: PumpSim): void;
}

export function buildPumpRoom(lib: MaterialLibrary): PumpRoom {
  const group = new THREE.Group();
  const F = ROOM.floor;
  const C = ROOM.ceiling;

  /* ---------------- shell ---------------- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.maxX - ROOM.minX, ROOM.maxZ - ROOM.minZ), lib.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((ROOM.minX + ROOM.maxX) / 2, F, (ROOM.minZ + ROOM.maxZ) / 2);
  floor.receiveShadow = true;
  group.add(floor);

  const wallConcrete = lib.retile(lib.concrete, 6, 3);
  const wallT = 0.6;
  group.add(boxBetween(ROOM.minX - wallT, ROOM.minX, F - 0.4, C + 0.5, ROOM.minZ - wallT, ROOM.maxZ + wallT, wallConcrete));
  group.add(boxBetween(ROOM.maxX, ROOM.maxX + wallT, F - 0.4, C + 0.5, ROOM.minZ - wallT, ROOM.maxZ + wallT, wallConcrete));
  group.add(boxBetween(ROOM.minX, ROOM.maxX, F - 0.4, C + 0.5, ROOM.minZ - wallT, ROOM.minZ, wallConcrete));
  group.add(boxBetween(ROOM.minX, ROOM.maxX, F - 0.4, C + 0.5, ROOM.maxZ, ROOM.maxZ + wallT, wallConcrete));

  // slab with a daylight opening cut out of it
  const sx0 = LIGHT_SHAFT.x - LIGHT_SHAFT.w / 2;
  const sx1 = LIGHT_SHAFT.x + LIGHT_SHAFT.w / 2;
  const sz0 = LIGHT_SHAFT.z - LIGHT_SHAFT.d / 2;
  const sz1 = LIGHT_SHAFT.z + LIGHT_SHAFT.d / 2;
  const slabTop = C + 0.7;
  group.add(boxBetween(ROOM.minX, sx0, C, slabTop, ROOM.minZ, ROOM.maxZ, lib.concrete));
  group.add(boxBetween(sx1, ROOM.maxX, C, slabTop, ROOM.minZ, ROOM.maxZ, lib.concrete));
  group.add(boxBetween(sx0, sx1, C, slabTop, ROOM.minZ, sz0, lib.concrete));
  group.add(boxBetween(sx0, sx1, C, slabTop, sz1, ROOM.maxZ, lib.concrete));

  // light shaft walls running up to the surface
  const shaftT = 0.25;
  group.add(boxBetween(sx0 - shaftT, sx0, slabTop, 0.05, sz0 - shaftT, sz1 + shaftT, lib.concrete));
  group.add(boxBetween(sx1, sx1 + shaftT, slabTop, 0.05, sz0 - shaftT, sz1 + shaftT, lib.concrete));
  group.add(boxBetween(sx0, sx1, slabTop, 0.05, sz0 - shaftT, sz0, lib.concrete));
  group.add(boxBetween(sx0, sx1, slabTop, 0.05, sz1, sz1 + shaftT, lib.concrete));

  // safety grating over the opening — this is what stripes the floor below
  const grate = new THREE.Group();
  for (let i = 0; i <= 11; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, LIGHT_SHAFT.d), lib.galvanised);
    bar.position.set(sx0 + (i / 11) * LIGHT_SHAFT.w, 0.02, LIGHT_SHAFT.z);
    bar.castShadow = true;
    grate.add(bar);
  }
  for (let i = 0; i <= 3; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(LIGHT_SHAFT.w, 0.03, 0.03), lib.galvanised);
    bar.position.set(LIGHT_SHAFT.x, -0.02, sz0 + (i / 3) * LIGHT_SHAFT.d);
    bar.castShadow = true;
    grate.add(bar);
  }
  group.add(grate);

  // downstand beams read the ceiling as structure rather than a lid
  for (const bz of [-4.6, -1.2, 2.6, 5.6]) {
    group.add(boxBetween(ROOM.minX, ROOM.maxX, C - 0.42, C, bz - 0.22, bz + 0.22, lib.concrete));
  }

  /* ---------------- balance tank ---------------- */
  const tankConcrete = lib.retile(lib.concrete, 4, 2);
  const tankGroup = new THREE.Group();
  const tw = TANK.radius * 2.3;
  const td = TANK.radius * 1.9;
  const tx0 = TANK.x - tw / 2;
  const tx1 = TANK.x + tw / 2;
  const tz0 = TANK.z - td / 2;
  const tz1 = TANK.z + td / 2;
  const th = F + TANK.height;
  const wt = 0.24;
  tankGroup.add(boxBetween(tx0 - wt, tx0, F, th, tz0 - wt, tz1 + wt, tankConcrete));
  tankGroup.add(boxBetween(tx1, tx1 + wt, F, th, tz0 - wt, tz1 + wt, tankConcrete));
  tankGroup.add(boxBetween(tx0, tx1, F, th, tz0 - wt, tz0, tankConcrete));
  tankGroup.add(boxBetween(tx0, tx1, F, th, tz1, tz1 + wt, tankConcrete));
  tankGroup.add(boxBetween(tx0, tx1, F + 0.05, F + 0.12, tz0, tz1, tankConcrete));

  const tankWater = new THREE.Mesh(new THREE.PlaneGeometry(tw - 0.02, td - 0.02, 24, 24), lib.waterBody.clone());
  tankWater.rotation.x = -Math.PI / 2;
  tankWater.position.set(TANK.x, F + TANK.height * 0.72, TANK.z);
  (tankWater.material as THREE.MeshStandardMaterial).normalMap!.repeat.set(3, 3);
  tankGroup.add(tankWater);
  // submerged volume so the tank never looks like a painted plane
  const tankBody = boxBetween(tx0 + 0.01, tx1 - 0.01, F + 0.12, F + TANK.height * 0.72, tz0 + 0.01, tz1 - 0.01, lib.waterDeep);
  tankBody.castShadow = false;
  tankGroup.add(tankBody);

  // handrail round the open tank
  const rail = new THREE.Group();
  const railPts: [number, number][] = [
    [tx0 - wt / 2, tz0 - wt / 2],
    [tx1 + wt / 2, tz0 - wt / 2],
    [tx1 + wt / 2, tz1 + wt / 2],
    [tx0 - wt / 2, tz1 + wt / 2],
  ];
  for (let i = 0; i < railPts.length; i++) {
    const [x, z] = railPts[i];
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1.0, 10), lib.galvanised);
    post.position.set(x, th + 0.5, z);
    post.castShadow = true;
    rail.add(post);
    const [nx, nz] = railPts[(i + 1) % railPts.length];
    for (const hy of [1.0, 0.55]) {
      const len = Math.hypot(nx - x, nz - z);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, len, 8), lib.galvanised);
      bar.position.set((x + nx) / 2, th + hy, (z + nz) / 2);
      bar.rotation.z = Math.PI / 2;
      bar.rotation.y = -Math.atan2(nz - z, nx - x);
      bar.castShadow = true;
      rail.add(bar);
    }
  }
  tankGroup.add(rail);
  group.add(tankGroup);

  /* ---------------- pipework ---------------- */
  const suction = new PipeRun(lib, suctionCurve(), {
    radius: 0.3,
    kind: 'green',
    cutaways: [{ t0: 0.3, t1: 0.44 }],
    supports: [0.18, 0.55],
    supportHeight: 0.62,
    tubular: 90,
  });
  group.add(suction.group);

  const discharge = new PipeRun(lib, dischargeCurve(), {
    radius: 0.26,
    kind: 'blue',
    cutaways: [
      { t0: 0.08, t1: 0.2 },
      { t0: 0.62, t1: 0.72 },
    ],
    tubular: 110,
  });
  group.add(discharge.group);

  const bypass = new PipeRun(lib, bypassCurve(), {
    radius: 0.16,
    kind: 'grey',
    cutaways: [{ t0: 0.55, t1: 0.66 }],
    tubular: 90,
  });
  group.add(bypass.group);

  // hangers holding the high-level discharge under the beams
  for (const t of [0.34, 0.5, 0.82]) {
    const p = dischargeCurve().getPointAt(t);
    const hanger = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8), lib.stainlessRough);
    rod.position.y = 0.3;
    hanger.add(rod);
    const clamp = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.022, 6, 20), lib.stainlessRough);
    clamp.rotation.y = Math.PI / 2;
    hanger.add(clamp);
    hanger.position.copy(p);
    hanger.traverse((o) => (o.castShadow = true));
    group.add(hanger);
  }

  /* ---------------- valves, glass, machine ---------------- */
  const mainValve = buildGateValve(lib, {
    bore: 0.28,
    wheelRadius: 0.44,
    wheelColor: 0x2f6fa8,
    axis: 'x',
    cutaway: true,
    incline: 0.45,
  });
  mainValve.group.position.copy(MAIN_VALVE);
  group.add(mainValve.group);

  const bypassValve = buildGateValve(lib, { bore: 0.16, wheelRadius: 0.24, wheelColor: 0x3f7a4a, axis: 'x', cutaway: false });
  bypassValve.group.position.copy(BYPASS_VALVE);
  bypassValve.group.rotation.y = Math.PI / 2;
  group.add(bypassValve.group);

  const sightGlass = buildSightGlass(lib, 0.1, 0.62);
  sightGlass.group.position.copy(SIGHT_GLASS).add(V(0, 0.34, 0));
  group.add(sightGlass.group);
  // tee that lifts the sight glass off the suction line
  const tee = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.36, 16), lib.castIron);
  tee.position.copy(SIGHT_GLASS).add(V(0, 0.06, 0));
  tee.castShadow = true;
  group.add(tee);

  const pump = buildPumpUnit(lib);
  pump.group.position.copy(PUMP);
  group.add(pump.group);

  const prime = buildPrimePump(lib);
  prime.group.position.copy(PRIME_PUMP);
  prime.group.rotation.y = 0.35;
  group.add(prime.group);
  // small bore line linking the priming pump to the pump casing
  const primeLine = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.15, 8), lib.stainlessRough);
  primeLine.position.set(PRIME_PUMP.x + 0.5, PRIME_PUMP.y - 0.36, PRIME_PUMP.z - 0.3);
  primeLine.rotation.z = 1.15;
  primeLine.rotation.y = 0.5;
  primeLine.castShadow = true;
  group.add(primeLine);
  const primePlinth = boxBetween(
    PRIME_PUMP.x - 0.42,
    PRIME_PUMP.x + 0.42,
    F,
    PRIME_PUMP.y - 0.38,
    PRIME_PUMP.z - 0.34,
    PRIME_PUMP.z + 0.34,
    lib.concrete,
  );
  group.add(primePlinth);

  const starter = buildStartStand(lib);
  starter.group.position.copy(START_STAND);
  starter.group.rotation.y = -0.5;
  group.add(starter.group);

  /* ---------------- room detail ---------------- */
  // inspection walkway along the back wall
  const walkY = F + 1.3;
  const walk = new THREE.Group();
  const walkGalv = lib.retile(lib.galvanised, 18, 2);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.06, 1.2), walkGalv);
  deck.position.set(1.0, walkY, ROOM.minZ + 0.9);
  deck.castShadow = true;
  deck.receiveShadow = true;
  walk.add(deck);
  for (let i = 0; i < 14; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 1.2), lib.galvanised);
    slat.position.set(-3.4 + i * 0.66, walkY + 0.06, ROOM.minZ + 0.9);
    slat.castShadow = true;
    walk.add(slat);
  }
  for (let i = 0; i < 6; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.05, 8), lib.galvanised);
    post.position.set(-3.4 + i * 1.8, walkY + 0.55, ROOM.minZ + 1.45);
    post.castShadow = true;
    walk.add(post);
  }
  for (const hy of [1.05, 0.6]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 9.0, 8), lib.retile(lib.galvanised, 1, 18));
    bar.rotation.z = Math.PI / 2;
    bar.position.set(1.0, walkY + hy, ROOM.minZ + 1.45);
    bar.castShadow = true;
    walk.add(bar);
  }
  for (let i = 0; i < 5; i++) {
    const leg = channelSection(1.3, 0.08, 0.1, lib.stainlessRough);
    leg.rotation.z = Math.PI / 2;
    leg.position.set(-3.0 + i * 2.0, walkY - 0.65, ROOM.minZ + 1.2);
    walk.add(leg);
  }
  group.add(walk);

  // cable tray + conduit along the wall
  const trayGalv = lib.retile(lib.galvanised, 26, 1);
  const tray = new THREE.Group();
  const trayBase = new THREE.Mesh(new THREE.BoxGeometry(13.0, 0.03, 0.36), trayGalv);
  trayBase.position.set(0, C - 0.95, ROOM.minZ + 0.35);
  tray.add(trayBase);
  for (const s of [-1, 1]) {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(13.0, 0.1, 0.025), trayGalv);
    lip.position.set(0, C - 0.9, ROOM.minZ + 0.35 + s * 0.17);
    tray.add(lip);
  }
  for (let i = 0; i < 4; i++) {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 13.0, 8), lib.rubber);
    cable.rotation.z = Math.PI / 2;
    cable.position.set(0, C - 0.9, ROOM.minZ + 0.24 + i * 0.07);
    tray.add(cable);
  }
  tray.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  group.add(tray);

  // ventilation duct in the far ceiling
  const duct = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 12.0, 20), lib.retile(lib.galvanised, 4, 10));
  duct.rotation.z = Math.PI / 2;
  duct.position.set(0.5, C - 0.75, ROOM.maxZ - 1.4);
  duct.castShadow = true;
  duct.receiveShadow = true;
  group.add(duct);
  for (let i = 0; i < 5; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.575, 0.03, 6, 20), lib.galvanised);
    band.rotation.y = Math.PI / 2;
    band.position.set(-4.5 + i * 2.4, C - 0.75, ROOM.maxZ - 1.4);
    band.castShadow = true;
    group.add(band);
  }

  // wall control panel
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.6, 0.28), lib.paintedCast(0x8d8a80, 1, 0.3));
  panel.position.set(-4.6, F + 2.2, ROOM.minZ + 0.25);
  panel.castShadow = true;
  panel.receiveShadow = true;
  group.add(panel);
  const panelDoor = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.42, 0.04), lib.paintedCast(0xa5a29a, 1, 0.35));
  panelDoor.position.set(-4.6, F + 2.2, ROOM.minZ + 0.42);
  panelDoor.castShadow = true;
  group.add(panelDoor);
  group.add(boltRing(4, 0.5, 0.02, 0.04, lib.stainlessRough).translateY(F + 2.2).translateZ(ROOM.minZ + 0.44));

  // floor drain, puddles and the general damp
  const drain = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), lib.stainlessRough);
  drain.position.set(-1.4, F + 0.01, 2.4);
  drain.receiveShadow = true;
  group.add(drain);
  for (let i = 0; i < 7; i++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.44), lib.stainlessRough);
    slot.position.set(-1.62 + i * 0.073, F + 0.03, 2.4);
    group.add(slot);
  }

  const alphaMap = puddleAlpha();
  const puddleMat = new THREE.MeshStandardMaterial({
    color: 0x2b3a40,
    roughness: 0.04,
    metalness: 0.3,
    transparent: true,
    opacity: 0.5,
    alphaMap,
    depthWrite: false,
    envMapIntensity: 2.0,
  });
  for (const [px, pz, ps] of [
    [-1.0, 1.9, 1.5],
    [0.9, 2.2, 1.0],
    [-3.4, 0.4, 0.9],
    [2.6, -0.4, 0.8],
    [PUMP.x + 0.4, PUMP.z - 1.5, 1.2],
  ]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(ps, ps * 0.8), puddleMat);
    p.rotation.x = -Math.PI / 2;
    p.rotation.z = Math.random() * Math.PI;
    p.position.set(px, F + 0.004, pz);
    p.renderOrder = 1;
    group.add(p);
  }

  // hose reel + step ladder: human-scale props, no signage needed
  const reel = new THREE.Group();
  const reelDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.26, 20), lib.paintedCast(0x9c3f2c, 1, 0.25));
  reelDrum.rotation.x = Math.PI / 2;
  reel.add(reelDrum);
  for (let i = 0; i < 9; i++) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.31 + i * 0.017, 0.016, 6, 22), lib.rubber);
    coil.position.z = -0.1 + (i % 5) * 0.045;
    reel.add(coil);
  }
  reel.position.set(ROOM.minX + 0.5, F + 1.9, 3.4);
  reel.rotation.y = Math.PI / 2;
  reel.traverse((o) => (o.castShadow = true));
  group.add(reel);

  const ladder = new THREE.Group();
  for (const s of [-1, 1]) {
    const rail2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.0, 8), lib.stainlessRough);
    rail2.position.set(s * 0.22, 1.0, 0);
    rail2.rotation.x = 0.12;
    ladder.add(rail2);
  }
  for (let i = 0; i < 6; i++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.44, 8), lib.stainlessRough);
    rung.rotation.z = Math.PI / 2;
    rung.position.set(0, 0.25 + i * 0.32, -0.11 + i * 0.038);
    ladder.add(rung);
  }
  ladder.position.set(ROOM.maxX - 1.0, F, ROOM.maxZ - 1.2);
  ladder.rotation.y = -0.7;
  ladder.traverse((o) => (o.castShadow = true));
  group.add(ladder);

  // technician in the mid-ground, purely for scale and a safety look
  const worker = new THREE.Group();
  const coverall = lib.paintedCast(0x2a3542, 1, 0.05);
  const vest = new THREE.MeshStandardMaterial({ color: 0x8d9435, roughness: 0.85, metalness: 0 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.4, 6, 12), coverall);
  torso.position.y = 1.24;
  worker.add(torso);
  const vestMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.205, 0.3, 6, 12), vest);
  vestMesh.position.y = 1.26;
  worker.add(vestMesh);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.55, 5, 10), coverall);
    leg.position.set(s * 0.11, 0.45, 0);
    worker.add(leg);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.42, 5, 10), coverall);
    arm.position.set(s * 0.27, 1.2, 0.02);
    arm.rotation.z = -s * 0.12;
    worker.add(arm);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.26), lib.rubber);
    boot.position.set(s * 0.11, 0.06, 0.03);
    worker.add(boot);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), new THREE.MeshStandardMaterial({ color: 0x6b4b3a, roughness: 0.75 }));
  head.position.y = 1.6;
  worker.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: 0xdedad0, roughness: 0.32 }));
  helmet.position.y = 1.63;
  worker.add(helmet);
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.018, 6, 18), new THREE.MeshStandardMaterial({ color: 0xdedad0, roughness: 0.32 }));
  brim.rotation.x = Math.PI / 2;
  brim.position.y = 1.62;
  worker.add(brim);
  worker.position.set(3.9, walkY + 0.09, ROOM.minZ + 0.9);
  worker.rotation.y = 2.4;
  worker.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  group.add(worker);

  /* ---------------- lighting ---------------- */
  const daylight = new THREE.DirectionalLight(0xd3e6f8, 3.4);
  daylight.position.set(LIGHT_SHAFT.x + 4.2, 11, LIGHT_SHAFT.z + 5.5);
  daylight.target.position.set(LIGHT_SHAFT.x - 1.4, F, LIGHT_SHAFT.z - 2.6);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(1024, 1024);
  daylight.shadow.camera.near = 1;
  daylight.shadow.camera.far = 34;
  daylight.shadow.camera.left = -9;
  daylight.shadow.camera.right = 9;
  daylight.shadow.camera.top = 9;
  daylight.shadow.camera.bottom = -9;
  daylight.shadow.bias = -0.0012;
  daylight.shadow.normalBias = 0.02;
  group.add(daylight, daylight.target);

  // visible shaft of cold air-lit dust
  const shaftCone = new THREE.Mesh(
    new THREE.CylinderGeometry(LIGHT_SHAFT.w * 0.42, LIGHT_SHAFT.w * 0.78, Math.abs(F - 0.2) - 0.3, 22, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xa9cbe6,
      transparent: true,
      opacity: 0.055,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  shaftCone.position.set(LIGHT_SHAFT.x - 0.9, (F + 0.2) / 2, LIGHT_SHAFT.z - 1.2);
  shaftCone.rotation.z = 0.075;
  shaftCone.rotation.x = 0.16;
  shaftCone.renderOrder = 6;
  group.add(shaftCone);

  const lampFixtures: THREE.PointLight[] = [];
  const fixtureMat = new THREE.MeshStandardMaterial({
    color: 0xdfe6ea,
    emissive: 0xffe3bb,
    emissiveIntensity: 1.35,
    roughness: 0.4,
  });
  for (const [lx, lz, shadow] of [
    [2.4, -3.4, false],
    [-3.6, 2.6, false],
    [6.4, 2.2, false],
  ] as [number, number, boolean][]) {
    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 0.3), lib.galvanised);
    housing.position.set(lx, C - 0.5, lz);
    housing.castShadow = true;
    group.add(housing);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.34, 12), fixtureMat);
    tube.rotation.z = Math.PI / 2;
    tube.position.set(lx, C - 0.6, lz);
    group.add(tube);
    const pl = new THREE.PointLight(0xffe3c2, 58, 17, 2);
    pl.position.set(lx, C - 0.75, lz);
    pl.castShadow = shadow;
    if (shadow) {
      pl.shadow.mapSize.set(1024, 1024);
      pl.shadow.bias = -0.004;
      pl.shadow.camera.far = 15;
    }
    group.add(pl);
    lampFixtures.push(pl);
  }

  // cool bounce off the wet floor
  const bounce = new THREE.HemisphereLight(0xa9cadf, 0x1b2226, 1.1);
  group.add(bounce);

  /* ---------------- drips ---------------- */
  const dripSources = [
    V(MAIN_VALVE.x + 0.3, MAIN_VALVE.y - 0.5, MAIN_VALVE.z + 0.1),
    V(PUMP.x - 0.8, PUMP.y - 0.5, PUMP.z + 0.3),
    V(TOWER_X - 0.3, C - 1.2, TOWER_Z),
  ];
  const dripGeo = new THREE.SphereGeometry(1, 6, 5);
  const dripMat = lib.waterDeep.clone();
  dripMat.opacity = 0.85;
  dripMat.roughness = 0.05;
  const drips = new THREE.InstancedMesh(dripGeo, dripMat, dripSources.length);
  drips.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(drips);
  const dripPhase = dripSources.map((_, i) => i * 0.77);
  const dm = new THREE.Matrix4();
  const dq = new THREE.Quaternion();
  const dp = new THREE.Vector3();
  const ds = new THREE.Vector3();

  // the water coming home: a falling stream and the disturbance it makes
  const pourMat = lib.waterBody.clone();
  pourMat.normalMap = lib.waterBody.normalMap!.clone();
  pourMat.normalMap.wrapS = pourMat.normalMap.wrapT = THREE.RepeatWrapping;
  pourMat.normalMap.repeat.set(2, 6);
  pourMat.normalMap.needsUpdate = true;
  pourMat.color = new THREE.Color(0x8ec9e4);
  pourMat.roughness = 0.08;
  pourMat.transparent = true;
  pourMat.opacity = 0.8;
  const pourH = RETURN_OUTLET.y - (F + TANK.height * 0.72);
  // a falling stream necks in as it accelerates
  const pour = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.075, pourH, 16, 1, true), pourMat);
  pour.position.set(RETURN_OUTLET.x, RETURN_OUTLET.y - pourH / 2, RETURN_OUTLET.z);
  pour.material.side = THREE.DoubleSide;
  pour.visible = false;
  group.add(pour);
  const pourSplash = new Splash(
    V(RETURN_OUTLET.x, F + TANK.height * 0.72 + 0.05, RETURN_OUTLET.z),
    18,
    lib.waterDeep.clone(),
    1.4,
  );
  group.add(pourSplash.mesh);

  const tankMat = tankWater.material as THREE.MeshStandardMaterial;
  const shaftMat = shaftCone.material as THREE.MeshBasicMaterial;

  return {
    group,
    mainValve,
    bypassValve,
    sightGlass,
    pump,
    prime,
    starter,
    suction,
    discharge,
    bypass,
    daylight,
    update(dt, t, sim) {
      mainValve.setOpen(sim.valves.main.open, sim.valves.main.wheelAngle);
      bypassValve.setOpen(sim.valves.bypass.open, sim.valves.bypass.wheelAngle);
      sightGlass.setLevel(sim.segments.sight.fill, t);
      prime.setAir(sim.primeAir, t);
      pump.update(dt, sim.rpm, sim.flow);

      suction.setFill(sim.segments.suction.fill, t, sim.flow);
      discharge.setFill(sim.segments.discharge.fill, t, sim.flow);
      bypass.setFill(sim.segments.bypass.fill, t, sim.flow * sim.valves.bypass.open);

      // tank surface: a slow breath at rest, real agitation once water returns
      const ripple = 0.25 + sim.tankRipple * 0.9;
      tankMat.normalMap!.offset.set(Math.sin(t * 0.19) * 0.05, -t * 0.035 * ripple);
      tankMat.normalScale.set(0.28 * ripple, 0.28 * ripple);
      tankWater.position.y = ROOM.floor + TANK.height * sim.tankLevel + Math.sin(t * 1.4) * 0.006 * ripple;

      // lamps: standby amber, running blue-white, both deliberately dim
      const running = sim.rpm;
      pump.lampStandby.emissive.setRGB(0.36 * (1 - running * 0.7), 0.22 * (1 - running * 0.7), 0.05);
      pump.lampStandby.emissiveIntensity = 0.9;
      pump.lampRun.emissive.setRGB(0.1 * running, 0.3 * running, 0.42 * running);
      pump.lampRun.emissiveIntensity = 1.1;
      starter.lampPower.emissive.setRGB(0.3, 0.17, 0.03);
      starter.lampPower.emissiveIntensity = 0.85;
      starter.lampRun.emissive.setRGB(0.09 * running, 0.28 * running, 0.4 * running);
      starter.lampRun.emissiveIntensity = 1.0;

      shaftMat.opacity = 0.045 + Math.sin(t * 0.3) * 0.006;

      const homeward = Math.min(1, sim.tankRipple);
      pour.visible = homeward > 0.03;
      pourMat.opacity = 0.5 + homeward * 0.4;
      pour.scale.set(0.5 + homeward * 0.7, 1, 0.5 + homeward * 0.7);
      pourMat.normalMap!.offset.y = -t * 3.4;
      pourSplash.update(t, homeward);

      for (let i = 0; i < dripSources.length; i++) {
        const u = (t * 0.5 + dripPhase[i]) % 1;
        const src = dripSources[i];
        const fall = u * u * 2.4;
        dp.set(src.x, src.y - fall, src.z);
        const alive = src.y - fall > ROOM.floor + 0.02;
        const dscale = alive ? 0.014 : 0.0001;
        ds.set(dscale, dscale * (1 + u * 1.6), dscale);
        drips.setMatrixAt(i, dm.compose(dp, dq, ds));
      }
      drips.instanceMatrix.needsUpdate = true;
    },
  };
}
