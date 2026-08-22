import * as THREE from 'three';
import { MaterialSet } from './materials';

/**
 * Museum conservation room: floor, walls, an interior window onto a quiet
 * corridor, a restoration bench with mat and tools, specimen shelving and
 * a work lamp. Far dressing is deliberately low-poly (it is only ever seen
 * soft-lit at distance).
 */
export interface RoomRig {
  group: THREE.Group;
  lampTarget: THREE.Object3D;
  keyTray: THREE.Group;
  /** resting slots for keys lying on the tray felt */
  traySlots: THREE.Group[];
}

export function buildRoom(mats: MaterialSet): RoomRig {
  const group = new THREE.Group();
  group.name = 'room';

  // ------------------------------------------------------------- shell
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const wallH = 3.1;
  const mkWall = (w: number, x: number, z: number, ry: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, wallH), mat);
    m.position.set(x, wallH / 2, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  mkWall(7, 0, -1.6, 0, mats.wall); // back wall behind cabinet
  mkWall(7, -3.2, 1.9, Math.PI / 2, mats.wall);
  mkWall(7, 3.2, 1.9, -Math.PI / 2, mats.wall);
  mkWall(7, 0, 3.6, Math.PI, mats.wall); // behind camera, closes reflections
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 7),
    new THREE.MeshStandardMaterial({ color: 0xcfc8ba, roughness: 0.95 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = wallH;
  group.add(ceiling);

  // baseboard
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(7, 0.09, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.8 })
  );
  base.position.set(0, 0.045, -1.59);
  group.add(base);

  // ------------------------------------- interior window onto the corridor
  const win = new THREE.Group();
  win.position.set(-1.7, 1.7, -1.595);
  const frameMat = mats.cabinetWoodSide;
  const fw = 1.2;
  const fh = 0.9;
  const bar = (w: number, h: number, x: number, y: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), frameMat);
    m.position.set(x, y, 0);
    win.add(m);
  };
  bar(fw, 0.06, 0, fh / 2);
  bar(fw, 0.06, 0, -fh / 2);
  bar(0.06, fh, -fw / 2, 0);
  bar(0.06, fh, fw / 2, 0);
  bar(0.03, fh, 0, 0);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(fw - 0.06, fh - 0.06), mats.glass);
  win.add(glass);
  // corridor beyond: dim wall + faint skylight tone, receding
  const corridor = new THREE.Mesh(new THREE.PlaneGeometry(fw * 1.4, fh * 1.4), mats.corridorWall);
  corridor.position.z = -0.9;
  win.add(corridor);
  const corridorGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, fh * 0.9),
    new THREE.MeshStandardMaterial({ color: 0x8b929c, emissive: 0x40484f, roughness: 1 })
  );
  corridorGlow.position.set(0.35, 0, -0.88);
  win.add(corridorGlow);
  group.add(win);

  // ---------------------------------------------------- restoration bench
  const bench = new THREE.Group();
  bench.position.set(-1.35, 0, -0.75);
  const benchTop = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.75), mats.benchWood);
  benchTop.position.y = 0.87;
  benchTop.castShadow = true;
  benchTop.receiveShadow = true;
  bench.add(benchTop);
  for (const [lx, lz] of [[-0.7, -0.32], [0.7, -0.32], [-0.7, 0.32], [0.7, 0.32]] as const) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.85, 0.06), mats.benchWood);
    leg.position.set(lx, 0.425, lz);
    leg.castShadow = true;
    bench.add(leg);
  }
  const mat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.006, 0.55), mats.felt);
  mat.position.y = 0.9;
  mat.receiveShadow = true;
  bench.add(mat);
  // small tools resting on the mat: tweezers, brush, parts jar
  const steel = mats.boltSteel;
  const tweezer1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.003, 0.008), steel);
  tweezer1.position.set(-0.2, 0.906, 0.1);
  tweezer1.rotation.y = 0.4;
  bench.add(tweezer1);
  const tweezer2 = tweezer1.clone();
  tweezer2.position.set(-0.16, 0.906, 0.14);
  tweezer2.rotation.y = 0.55;
  bench.add(tweezer2);
  const brushHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.14, 10), mats.benchWood);
  brushHandle.rotation.z = Math.PI / 2;
  brushHandle.rotation.y = -0.3;
  brushHandle.position.set(0.1, 0.91, 0.05);
  bench.add(brushHandle);
  const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.09, 20), mats.glass);
  jar.position.set(0.35, 0.945, -0.15);
  bench.add(jar);
  group.add(bench);

  // ------------------------------------------- standing work light
  // a conservation studio task light on a weighted floor stand, leaning
  // its head over toward the lock on the cabinet door
  const lamp = new THREE.Group();
  lamp.position.set(1.45, 0, 1.15);
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.035, 24), mats.darkIron);
  lampBase.position.y = 0.017;
  lampBase.castShadow = true;
  lamp.add(lampBase);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 1.62, 12), mats.darkIron);
  pole.position.y = 0.82;
  pole.castShadow = true;
  lamp.add(pole);
  // boom arm from the pole top toward the lock
  const boomLen = 0.62;
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, boomLen, 10), mats.darkIron);
  boom.position.set(-0.24, 1.6, -0.16);
  boom.rotation.z = 1.12;
  boom.rotation.x = 0.42;
  lamp.add(boom);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.15, 24, 1, false), mats.darkIron);
  shade.position.set(-0.5, 1.52, -0.3);
  shade.rotation.z = 0.7;
  shade.rotation.x = 0.5;
  lamp.add(shade);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff2dd, emissive: 0xffe9c4, emissiveIntensity: 2.4 })
  );
  bulb.position.set(-0.545, 1.475, -0.335);
  lamp.add(bulb);
  group.add(lamp);
  const lampTarget = new THREE.Object3D();
  lampTarget.position.set(0.3, 1.0, 0.15);
  group.add(lampTarget);

  // ----------------------------------------------------- specimen shelving
  const shelfUnit = new THREE.Group();
  shelfUnit.position.set(2.3, 0, -1.25);
  const shelfMat = mats.cabinetWoodSide;
  for (let i = 0; i < 4; i++) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.03, 0.35), shelfMat);
    board.position.set(0, 0.45 + i * 0.5, 0);
    board.castShadow = true;
    shelfUnit.add(board);
  }
  for (const sx of [-0.63, 0.63]) {
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.1, 0.35), shelfMat);
    upright.position.set(sx, 1.05, 0);
    shelfUnit.add(upright);
  }
  // jars and boxes, deterministic layout
  let s = 11;
  const nextRand = () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const r = nextRand();
      const x = -0.5 + j * 0.32 + (r - 0.5) * 0.06;
      if (nextRand() > 0.55) {
        const jr = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05 + r * 0.02, 0.05 + r * 0.02, 0.12 + r * 0.08, 14),
          mats.glass
        );
        jr.position.set(x, 0.53 + i * 0.5 + (0.12 + r * 0.08) / 2, 0);
        shelfUnit.add(jr);
      } else {
        const bx = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 0.09 + r * 0.05, 0.24),
          i % 2 ? mats.benchWood : shelfMat
        );
        bx.position.set(x, 0.465 + i * 0.5 + (0.09 + r * 0.05) / 2, 0);
        shelfUnit.add(bx);
      }
    }
  }
  group.add(shelfUnit);

  // ------------------------------------------------------------ key tray
  // wide felt-lined tray on a low side table, right of the cabinet
  const keyTray = new THREE.Group();
  keyTray.position.set(0.95, 0, 0.42);
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.42), mats.benchWood);
  tableTop.position.y = 0.72;
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  keyTray.add(tableTop);
  for (const [lx, lz] of [[-0.21, -0.17], [0.21, -0.17], [-0.21, 0.17], [0.21, 0.17]] as const) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, 0.04), mats.benchWood);
    leg.position.set(lx, 0.35, lz);
    keyTray.add(leg);
  }
  const trayFelt = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.008, 0.34), mats.felt);
  trayFelt.position.y = 0.745;
  trayFelt.receiveShadow = true;
  keyTray.add(trayFelt);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.025, 0.02), mats.benchWood);
  lip.position.set(0, 0.755, 0.17);
  keyTray.add(lip);
  const lip2 = lip.clone();
  lip2.position.z = -0.17;
  keyTray.add(lip2);

  const traySlots: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const slot = new THREE.Group();
    // keys lie flat on the felt, side by side, blades toward the cabinet.
    // local: Rz(π/2) lays the flat side down, Ry(~π/2) points the blade
    // along the tray width; slight per-key yaw so they read hand-placed.
    slot.position.set(-0.1, 0.762, -0.095 + i * 0.095);
    slot.rotation.set(0, Math.PI / 2 + 0.07 * (i - 1), Math.PI / 2);
    keyTray.add(slot);
    traySlots.push(slot);
  }
  group.add(keyTray);

  return { group, lampTarget, keyTray, traySlots };
}
