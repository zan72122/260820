/**
 * The room: daylight + task light, concrete floor, dark tool-wall, distant
 * shelving kept dim and low-detail so the letters own the frame.
 */
import * as THREE from 'three';
import type { LabMaterials } from '../core/materials';
import { makeRng } from '../core/math';

export interface Environment {
  group: THREE.Group;
  key: THREE.DirectionalLight;
  /** aim the key light + shadow box at the active station */
  focus(x: number): void;
}

export function makeEnvironment(mats: LabMaterials, shadowSize: number): Environment {
  const g = new THREE.Group();
  const rng = makeRng(41);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 12), mats.concrete);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);

  // back wall with tool panels
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(26, 4.2), mats.wallDark);
  wall.position.set(0, 2.1, -3.1);
  g.add(wall);
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x35373a, roughness: 0.9 });
  for (let i = -5; i <= 5; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.5, 0.04), panelMat);
    p.position.set(i * 2.1, 1.9, -3.05);
    g.add(p);
  }

  // dim shelving with crates along the wall (silhouette density only)
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x232425, roughness: 1 });
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x2c2e30, roughness: 0.9, metalness: 0.3 });
  for (const sx of [-7.5, -5.5, 5.5, 7.5]) {
    const unit = new THREE.Group();
    for (let lv = 0; lv < 3; lv++) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.6), shelfMat);
      shelf.position.set(0, 0.5 + lv * 0.7, 0);
      unit.add(shelf);
      const count = 1 + ((rng() * 3) | 0);
      for (let c = 0; c < count; c++) {
        const w = 0.2 + rng() * 0.3;
        const h = 0.18 + rng() * 0.3;
        const crate = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.4), crateMat);
        crate.position.set(-0.55 + rng() * 1.1, 0.525 + lv * 0.7 + h / 2, 0);
        unit.add(crate);
      }
    }
    for (const px of [-0.72, 0.72]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.1, 0.05), shelfMat);
      post.position.set(px, 1.05, -0.25);
      unit.add(post);
    }
    unit.position.set(sx, 0, -2.6);
    g.add(unit);
  }

  // ceiling beam + hanging lamp housings (visual sources for the task light)
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x303234, roughness: 0.8, metalness: 0.5 });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(24, 0.18, 0.22), beamMat);
  beam.position.set(0, 3.4, -0.4);
  g.add(beam);
  for (const lx of [-4, 0, 4]) {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 6), beamMat);
    cord.position.set(lx, 3.05, -0.4);
    g.add(cord);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.18, 20, 1, true), beamMat);
    shade.position.set(lx, 2.76, -0.4);
    g.add(shade);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe8c0 }),
    );
    bulb.position.set(lx, 2.72, -0.4);
    g.add(bulb);
  }

  // electrical conduit feeding each bench (cables that go somewhere)
  const conduitMat = new THREE.MeshStandardMaterial({ color: 0x3d3f41, roughness: 0.7, metalness: 0.4 });
  const run = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 24, 8), conduitMat);
  run.rotation.z = Math.PI / 2;
  run.position.set(0, 0.25, -3.02);
  g.add(run);
  for (const bx of [-4, 0, 4]) {
    const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.3, 8), conduitMat);
    drop.rotation.x = Math.PI / 2;
    drop.position.set(bx - 0.8, 0.22, -1.9);
    g.add(drop);
  }

  // lights
  const hemi = new THREE.HemisphereLight(0xa8b6c4, 0x555049, 0.55);
  g.add(hemi);
  const key = new THREE.DirectionalLight(0xfff0da, 2.1);
  key.position.set(1.8, 4.4, 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(shadowSize, shadowSize);
  key.shadow.camera.left = -1.7;
  key.shadow.camera.right = 1.7;
  key.shadow.camera.top = 1.9;
  key.shadow.camera.bottom = -1.7;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 12;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.015;
  g.add(key);
  g.add(key.target);
  const fill = new THREE.DirectionalLight(0x92a6bc, 0.5);
  fill.position.set(-3, 2.4, 1.6);
  g.add(fill);

  return {
    group: g,
    key,
    focus(x: number) {
      key.position.set(x + 1.8, 4.4, 2.6);
      key.target.position.set(x, 0.8, 0);
      key.target.updateMatrixWorld();
    },
  };
}
