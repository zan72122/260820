import * as THREE from 'three';
import type { Materials } from './Materials';

/**
 * The clinical skills lab itself: far ground only. Depth comes from scale,
 * overlap, illumination falloff and silhouette density — the background is
 * never blurred out.
 */
export const buildRoom = (mats: Materials): THREE.Group => {
  const room = new THREE.Group();
  room.name = 'room';

  const WALL_Z = -2.45;
  const WALL_H = 3.0;
  const ROOM_W = 7.4;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  room.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshStandardMaterial({ color: 0xe6e9e6, roughness: 0.95 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = WALL_H;
  room.add(ceiling);

  // --- back wall, built around a window opening ---------------------------
  const win = { x0: -2.55, x1: -0.55, y0: 1.02, y1: 2.24 };
  const panel = (
    w: number,
    h: number,
    x: number,
    y: number,
    z = WALL_Z,
  ): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats.wall);
    m.position.set(x, y, z);
    m.receiveShadow = false;
    return m;
  };
  room.add(panel(ROOM_W, win.y0, 0, win.y0 / 2));
  room.add(panel(ROOM_W, WALL_H - win.y1, 0, (WALL_H + win.y1) / 2));
  room.add(
    panel(
      win.x0 + ROOM_W / 2,
      win.y1 - win.y0,
      -ROOM_W / 2 + (win.x0 + ROOM_W / 2) / 2,
      (win.y0 + win.y1) / 2,
    ),
  );
  room.add(
    panel(
      ROOM_W / 2 - win.x1,
      win.y1 - win.y0,
      win.x1 + (ROOM_W / 2 - win.x1) / 2,
      (win.y0 + win.y1) / 2,
    ),
  );

  // Window: frame, mullion, glass, and a bright card outside for the morning.
  const frameMat = mats.doorPaint;
  const frameW = 0.055;
  const addFrame = (w: number, h: number, x: number, y: number) => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.09), frameMat);
    f.position.set(x, y, WALL_Z - 0.02);
    room.add(f);
  };
  addFrame(win.x1 - win.x0 + frameW * 2, frameW, (win.x0 + win.x1) / 2, win.y0);
  addFrame(win.x1 - win.x0 + frameW * 2, frameW, (win.x0 + win.x1) / 2, win.y1);
  addFrame(frameW, win.y1 - win.y0, win.x0, (win.y0 + win.y1) / 2);
  addFrame(frameW, win.y1 - win.y0, win.x1, (win.y0 + win.y1) / 2);
  addFrame(0.035, win.y1 - win.y0, (win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2);

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(win.x1 - win.x0, win.y1 - win.y0),
    mats.glass,
  );
  glass.position.set((win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2, WALL_Z - 0.04);
  room.add(glass);

  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry((win.x1 - win.x0) * 1.4, (win.y1 - win.y0) * 1.4),
    new THREE.MeshBasicMaterial({ color: 0xdfe9ef }),
  );
  sky.position.set((win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2 + 0.1, WALL_Z - 0.5);
  room.add(sky);

  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(win.x1 - win.x0 + 0.22, 0.04, 0.16),
    frameMat,
  );
  sill.position.set((win.x0 + win.x1) / 2, win.y0 - 0.04, WALL_Z + 0.05);
  room.add(sill);

  // --- curtain, half drawn, with real pleats ------------------------------
  const pleatCount = 13;
  const curtainGroup = new THREE.Group();
  for (let i = 0; i < pleatCount; i++) {
    const t = i / (pleatCount - 1);
    const w = 0.085;
    const depth = Math.sin(t * Math.PI * 5.5) * 0.035;
    const pleat = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.5, w * 0.62, win.y1 - win.y0 + 0.28, 6, 1, true, 0, Math.PI),
      mats.curtain,
    );
    pleat.position.set(
      win.x0 - 0.16 + t * 0.78,
      (win.y0 + win.y1) / 2 + 0.06,
      WALL_Z + 0.09 + depth,
    );
    pleat.rotation.y = Math.PI + depth * 4;
    curtainGroup.add(pleat);
  }
  const rail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 2.5, 8),
    mats.steelFrame,
  );
  rail.rotation.z = Math.PI / 2;
  rail.position.set(win.x0 + 0.45, win.y1 + 0.14, WALL_Z + 0.1);
  curtainGroup.add(rail);
  room.add(curtainGroup);

  // --- side walls and door ------------------------------------------------
  const left = new THREE.Mesh(new THREE.PlaneGeometry(6, WALL_H), mats.wall);
  left.rotation.y = Math.PI / 2;
  left.position.set(-ROOM_W / 2 + 0.1, WALL_H / 2, WALL_Z + 3);
  room.add(left);

  const right = new THREE.Mesh(new THREE.PlaneGeometry(6, WALL_H), mats.wall);
  right.rotation.y = -Math.PI / 2;
  right.position.set(ROOM_W / 2 - 0.1, WALL_H / 2, WALL_Z + 3);
  room.add(right);

  const doorFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 2.16, 1.0),
    frameMat,
  );
  doorFrame.position.set(ROOM_W / 2 - 0.13, 1.06, WALL_Z + 1.35);
  room.add(doorFrame);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.045, 2.03, 0.9), mats.doorPaint);
  door.position.set(ROOM_W / 2 - 0.16, 1.015, WALL_Z + 1.35);
  room.add(door);
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8),
    mats.steelSatin,
  );
  handle.rotation.x = Math.PI / 2;
  handle.position.set(ROOM_W / 2 - 0.2, 1.02, WALL_Z + 1.72);
  room.add(handle);

  // --- cabinet ------------------------------------------------------------
  const cabinet = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.9, 0.44), mats.laminate);
  body.position.set(0, 0.95, 0);
  body.castShadow = false;
  cabinet.add(body);
  for (let i = 0; i < 3; i++) {
    const shelfDoor = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.58, 0.02),
      mats.laminate,
    );
    shelfDoor.position.set(-0.39 + (i % 2) * 0.78, 0.42 + Math.floor(i / 2) * 0.62, 0.23);
    cabinet.add(shelfDoor);
    const pull = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.1, 6),
      mats.steelSatin,
    );
    pull.rotation.z = Math.PI / 2;
    pull.position.set(-0.39 + (i % 2) * 0.78, 0.42 + Math.floor(i / 2) * 0.62, 0.25);
    cabinet.add(pull);
  }
  const glassDoor = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.62), mats.glass);
  glassDoor.position.set(0, 1.55, 0.23);
  cabinet.add(glassDoor);
  cabinet.position.set(1.75, 0, WALL_Z + 0.24);
  room.add(cabinet);

  // --- mid-ground trolley (empty, quiet silhouette) -----------------------
  const wagon = new THREE.Group();
  for (const y of [0.78, 0.42]) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.44), mats.steelFrame);
    shelf.position.y = y;
    wagon.add(shelf);
  }
  for (const [dx, dz] of [
    [-0.27, -0.18],
    [0.27, -0.18],
    [-0.27, 0.18],
    [0.27, 0.18],
  ]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 0.76, 6),
      mats.steelFrame,
    );
    leg.position.set(dx, 0.4, dz);
    wagon.add(leg);
    const caster = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.016, 8),
      mats.elastomerRim,
    );
    caster.rotation.z = Math.PI / 2;
    caster.position.set(dx, 0.028, dz);
    wagon.add(caster);
  }
  wagon.position.set(-1.55, 0, -1.15);
  room.add(wagon);
  const wagonShadow = mats.makeShadowPatch(0.9, 0.7);
  wagonShadow.position.set(-1.55, 0.004, -1.15);
  room.add(wagonShadow);

  // --- wall rail with a coiled tube, far ground detail --------------------
  const railBar = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.05, 0.03),
    mats.steelSatin,
  );
  railBar.position.set(-1.0, 1.42, WALL_Z + 0.03);
  room.add(railBar);

  return room;
};
