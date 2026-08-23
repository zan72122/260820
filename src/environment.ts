import * as THREE from 'three';
import { MatLib, makeFloorTexture, makeWallTexture, rand } from './materials';
import { RAIL_Z_A, RAIL_Z_B, STATION_SPACING } from './const';

// The optics workshop: floor with embedded transfer rails, back/side walls,
// a daylight window band, workbench, storage rack. Deliberately plain and
// functional — depth comes from illumination and material response.

const ROOM_X0 = -5.2;
const ROOM_X1 = 2 * STATION_SPACING + 5.2;
const ROOM_Z0 = -1.7;
const ROOM_Z1 = 7.4;
const ROOM_H = 4.1;

export function buildEnvironment(scene: THREE.Scene, M: MatLib): void {
  const g = new THREE.Group();
  g.name = 'environment';

  // ---- floor
  const { map, rough } = makeFloorTexture();
  map.repeat.set(3.4, 1.4);
  rough.repeat.set(3.4, 1.4);
  const floorMat = new THREE.MeshStandardMaterial({
    map, roughnessMap: rough, roughness: 1.0, metalness: 0.02, color: 0xffffff,
  });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_X1 - ROOM_X0, ROOM_Z1 - ROOM_Z0), floorMat,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((ROOM_X0 + ROOM_X1) / 2, 0, (ROOM_Z0 + ROOM_Z1) / 2);
  floor.receiveShadow = true;
  g.add(floor);

  // ---- walls
  const wallTex = makeWallTexture();
  wallTex.repeat.set(6, 1.6);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.92, metalness: 0 });
  const mkWall = (w: number, h: number): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    m.receiveShadow = true;
    return m;
  };
  const back = mkWall(ROOM_X1 - ROOM_X0, ROOM_H);
  back.position.set((ROOM_X0 + ROOM_X1) / 2, ROOM_H / 2, ROOM_Z0);
  g.add(back);
  const front = mkWall(ROOM_X1 - ROOM_X0, ROOM_H);
  front.rotation.y = Math.PI;
  front.position.set((ROOM_X0 + ROOM_X1) / 2, ROOM_H / 2, ROOM_Z1);
  g.add(front);
  const left = mkWall(ROOM_Z1 - ROOM_Z0, ROOM_H);
  left.rotation.y = Math.PI / 2;
  left.position.set(ROOM_X0, ROOM_H / 2, (ROOM_Z0 + ROOM_Z1) / 2);
  g.add(left);
  const right = mkWall(ROOM_Z1 - ROOM_Z0, ROOM_H);
  right.rotation.y = -Math.PI / 2;
  right.position.set(ROOM_X1, ROOM_H / 2, (ROOM_Z0 + ROOM_Z1) / 2);
  g.add(right);

  // ceiling: dark, with sparse joists
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x3f4145, roughness: 0.95 });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_X1 - ROOM_X0, ROOM_Z1 - ROOM_Z0), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set((ROOM_X0 + ROOM_X1) / 2, ROOM_H, (ROOM_Z0 + ROOM_Z1) / 2);
  g.add(ceil);
  const joistMat = new THREE.MeshStandardMaterial({ color: 0x505257, roughness: 0.85, metalness: 0.3 });
  for (let x = ROOM_X0 + 2.1; x < ROOM_X1; x += 3.9) {
    const j = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, ROOM_Z1 - ROOM_Z0), joistMat);
    j.position.set(x, ROOM_H - 0.15, (ROOM_Z0 + ROOM_Z1) / 2);
    g.add(j);
  }

  // ---- daylight window band on the left wall (light rakes across the shop)
  const winG = new THREE.Group();
  const frameMat = M.steelPaintedDark;
  const skyMat = new THREE.MeshBasicMaterial({ color: 0xcfd8de });
  for (let i = 0; i < 3; i++) {
    const wz = 0.6 + i * 2.0;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 1.55), frameMat);
    frame.position.set(ROOM_X0 + 0.03, 2.6, wz);
    winG.add(frame);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.3), skyMat);
    glass.rotation.y = Math.PI / 2;
    glass.position.set(ROOM_X0 + 0.09, 2.6, wz);
    winG.add(glass);
    // muntins
    for (const dy of [-0.32, 0.32]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 1.4), frameMat);
      m.position.set(ROOM_X0 + 0.1, 2.6 + dy, wz);
      winG.add(m);
    }
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.35, 0.05), frameMat);
    v.position.set(ROOM_X0 + 0.1, 2.6, wz);
    winG.add(v);
  }
  g.add(winG);

  // ---- transfer rails for the lamp carts, embedded along the shop
  const railMat = new THREE.MeshStandardMaterial({ color: 0x6a6c70, roughness: 0.34, metalness: 0.9 });
  const railLen = ROOM_X1 - ROOM_X0 - 1.6;
  for (const z of [RAIL_Z_A, RAIL_Z_B]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(railLen, 0.035, 0.055), railMat);
    rail.position.set((ROOM_X0 + ROOM_X1) / 2, 0.0325, z);
    rail.castShadow = false;
    rail.receiveShadow = true;
    g.add(rail);
    const base = new THREE.Mesh(new THREE.BoxGeometry(railLen, 0.018, 0.13), M.steelDark);
    base.position.set((ROOM_X0 + ROOM_X1) / 2, 0.009, z);
    g.add(base);
    // anchor plates, staggered
    for (let x = ROOM_X0 + 1.2; x < ROOM_X1 - 1.2; x += 1.35 + rand() * 0.25) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.014, 0.2), M.steelPaintedDark);
      p.position.set(x, 0.007, z + (rand() > 0.5 ? 0.09 : -0.09));
      g.add(p);
    }
  }

  // ---- workbench under the window (far left)
  const bench = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.07, 0.75), M.wood);
  top.position.set(ROOM_X0 + 1.25, 0.92, 1.6);
  top.castShadow = true; top.receiveShadow = true;
  bench.add(top);
  for (const [dx, dz] of [[-0.92, -0.3], [0.92, -0.3], [-0.92, 0.3], [0.92, 0.3]] as const) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), M.steelPaintedDark);
    leg.position.set(ROOM_X0 + 1.25 + dx, 0.45, 1.6 + dz);
    bench.add(leg);
  }
  // vise + a few tools, loosely placed
  const vise = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.14), M.castIron);
  vise.position.set(ROOM_X0 + 0.55, 1.03, 1.45);
  vise.rotation.y = 0.2;
  bench.add(vise);
  const viseScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.26), M.steelDark);
  viseScrew.rotation.z = Math.PI / 2;
  viseScrew.position.set(ROOM_X0 + 0.55, 0.99, 1.45);
  bench.add(viseScrew);
  for (let i = 0; i < 4; i++) {
    const t = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012 + rand() * 0.01, 0.012 + rand() * 0.01, 0.16 + rand() * 0.2),
      i % 2 ? M.steelDark : M.rubber,
    );
    t.rotation.set(Math.PI / 2, 0, rand() * 3);
    t.position.set(ROOM_X0 + 1.0 + rand() * 0.9, 0.965, 1.35 + rand() * 0.45);
    bench.add(t);
  }
  g.add(bench);

  // ---- storage rack along the back wall between stations
  for (const rx of [STATION_SPACING * 0.5, STATION_SPACING * 1.5]) {
    const rack = new THREE.Group();
    const H = 2.2, W = 2.0, D = 0.55;
    for (const [dx, dz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]] as const) {
      const up = new THREE.Mesh(new THREE.BoxGeometry(0.055, H, 0.055), M.steelPaintedDark);
      up.position.set(dx, H / 2, dz);
      rack.add(up);
    }
    for (const sy of [0.35, 1.0, 1.65]) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(W, 0.035, D), M.steelPainted);
      sh.position.set(0, sy, 0);
      sh.castShadow = true;
      rack.add(sh);
      // bins / boxes, irregular
      let x = -W / 2 + 0.18;
      while (x < W / 2 - 0.2) {
        const bw = 0.22 + rand() * 0.2;
        if (rand() > 0.28) {
          const bh = 0.14 + rand() * 0.16;
          const box = new THREE.Mesh(
            new THREE.BoxGeometry(bw, bh, 0.34 + rand() * 0.12),
            rand() > 0.5 ? M.cardboard : M.binPlastic,
          );
          box.position.set(x + bw / 2, sy + bh / 2 + 0.02, (rand() - 0.5) * 0.08);
          box.rotation.y = (rand() - 0.5) * 0.12;
          rack.add(box);
        }
        x += bw + 0.05 + rand() * 0.1;
      }
    }
    rack.position.set(rx, 0, ROOM_Z0 + 0.42);
    g.add(rack);
  }

  // ---- wall power conduit + outlets near each rail end
  const conduitMat = new THREE.MeshStandardMaterial({ color: 0x8d9094, roughness: 0.5, metalness: 0.6 });
  const conduit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, ROOM_X1 - ROOM_X0 - 1.0), conduitMat,
  );
  conduit.rotation.z = Math.PI / 2;
  conduit.position.set((ROOM_X0 + ROOM_X1) / 2, 2.9, ROOM_Z1 - 0.03);
  g.add(conduit);
  for (let i = 0; i < 3; i++) {
    const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.35), conduitMat);
    drop.position.set(i * STATION_SPACING + 1.9, 1.72, ROOM_Z1 - 0.03);
    g.add(drop);
    const boxOut = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.09), M.steelPaintedDark);
    boxOut.position.set(i * STATION_SPACING + 1.9, 0.45, ROOM_Z1 - 0.06);
    g.add(boxOut);
  }

  scene.add(g);
}

/** ambient + daylight rig (the projection lamps live in the stations) */
export function buildAmbientLights(scene: THREE.Scene): void {
  const hemi = new THREE.HemisphereLight(0xbfc6cc, 0x4a4640, 0.38);
  scene.add(hemi);
  // daylight raking in from the window band on the left wall
  const sun = new THREE.DirectionalLight(0xe8eef2, 0.8);
  sun.position.set(ROOM_X0 + 0.4, 3.1, 2.4);
  sun.target.position.set(6, 0.4, 3.2);
  sun.castShadow = false;
  scene.add(sun);
  scene.add(sun.target);
  // faint bounce from the floor
  const bounce = new THREE.DirectionalLight(0xcabfae, 0.16);
  bounce.position.set(4, 0.1, 3);
  bounce.target.position.set(4, 2, 0);
  scene.add(bounce);
  scene.add(bounce.target);
}
