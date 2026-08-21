import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rng } from '../core/Rng';
import { GROUND_Y } from './Structure';

/**
 * The rest of the park, loaded after the test section is already playable.
 * Nothing here is interactive: it exists to give the middle and far distance
 * something to be, and to let aerial perspective do its work.
 */
export class Scenery {
  readonly group = new THREE.Group();

  build(): void {
    if (this.group.children.length) return;
    this.buildHills();
    this.buildTowers();
    this.buildSlides();
    this.buildPools();
    this.buildPlanting();
  }

  /** A low ridge behind the park, so the far distance has something to fade
   *  into instead of ending at a hard horizon. */
  private buildHills(): void {
    const rng = new Rng(0x1d3e);
    const mat = new THREE.MeshStandardMaterial({ color: 0x76866a, roughness: 1, metalness: 0 });
    const hills = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const r = rng.range(60, 130);
      const geo = new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      const hill = new THREE.Mesh(geo, mat);
      hill.scale.set(1, rng.range(0.16, 0.34), 0.75);
      hill.position.set(rng.range(-420, 560), GROUND_Y - 4, rng.range(-560, -300));
      hills.add(hill);
    }
    this.group.add(hills);
  }

  private buildTowers(): void {
    const concrete = new THREE.MeshStandardMaterial({ color: 0xcac6bb, roughness: 0.9 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x7fb4c9, roughness: 0.6 });
    const towers: Array<[number, number, number]> = [
      [-52, -96, 22],
      [96, -128, 27],
      [148, -70, 17],
    ];
    for (const [x, z, h] of towers) {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.6, h, 12), concrete);
      shaft.position.set(x, GROUND_Y + h / 2, z);
      this.group.add(shaft);
      for (let i = 1; i <= 3; i++) {
        const deck = new THREE.Mesh(new THREE.CylinderGeometry(6.2 - i * 0.6, 6.2 - i * 0.6, 0.5, 14), trim);
        deck.position.set(x, GROUND_Y + (h * i) / 3.4, z);
        this.group.add(deck);
      }
      const roof = new THREE.Mesh(new THREE.ConeGeometry(7.2, 4.2, 14), trim);
      roof.position.set(x, GROUND_Y + h + 2, z);
      this.group.add(roof);
    }
  }

  private buildSlides(): void {
    const rng = new Rng(0x5eed);
    const colours = [0x3fa9d6, 0xf0c34b, 0xe0704f];
    for (let i = 0; i < 3; i++) {
      const pts: THREE.Vector3[] = [];
      const baseX = -46 + i * 84;
      const baseZ = -92 - i * 14;
      const top = 20 + rng.range(-3, 5);
      for (let t = 0; t <= 1.0001; t += 1 / 14) {
        const ang = t * Math.PI * 2.4 + i;
        const r = 12 + t * 20;
        pts.push(
          new THREE.Vector3(
            baseX + Math.cos(ang) * r,
            GROUND_Y + top * (1 - t) + 1.6,
            baseZ + Math.sin(ang) * r * 0.7,
          ),
        );
      }
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 1.15, 8, false);
      const mesh = new THREE.Mesh(
        tube,
        new THREE.MeshStandardMaterial({ color: colours[i], roughness: 0.42, metalness: 0.05 }),
      );
      this.group.add(mesh);
    }
  }

  private buildPools(): void {
    const water = new THREE.MeshStandardMaterial({
      color: 0x69b7d2,
      roughness: 0.08,
      metalness: 0,
      envMapIntensity: 1.4,
    });
    const deck = new THREE.MeshStandardMaterial({ color: 0xbdb9ad, roughness: 0.95 });

    const pool = new THREE.Mesh(new THREE.BoxGeometry(74, 0.4, 42), water);
    pool.position.set(52, GROUND_Y + 0.2, -104);
    this.group.add(pool);
    const surround = new THREE.Mesh(new THREE.BoxGeometry(94, 0.3, 62), deck);
    surround.position.set(52, GROUND_Y + 0.05, -104);
    this.group.add(surround);

    const hall = new THREE.Mesh(new THREE.BoxGeometry(38, 12, 26), deck);
    hall.position.set(-72, GROUND_Y + 6, -46);
    this.group.add(hall);
    const hallRoof = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 38, 16, 1, false, 0, Math.PI), 
      new THREE.MeshStandardMaterial({ color: 0x9fb6bd, roughness: 0.45, metalness: 0.3 }));
    hallRoof.rotation.z = Math.PI / 2;
    hallRoof.position.set(-72, GROUND_Y + 12, -46);
    this.group.add(hallRoof);
  }

  private buildPlanting(): void {
    const rng = new Rng(0xb005);
    const trunk = new THREE.CylinderGeometry(0.22, 0.3, 2.4, 6);
    trunk.translate(0, 1.2, 0);
    const crown1 = new THREE.ConeGeometry(1.9, 3.4, 8);
    crown1.translate(0, 3.4, 0);
    const crown2 = new THREE.ConeGeometry(1.4, 2.6, 8);
    crown2.translate(0, 4.8, 0);
    const merged = mergeGeometries([trunk, crown1, crown2], false);
    if (!merged) return;
    const mat = new THREE.MeshStandardMaterial({ color: 0x5f7a4a, roughness: 0.95 });
    const count = 120;
    const trees = new THREE.InstancedMesh(merged, mat, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      // Planting stays on the far side of the rig: the camera side is kept
      // clear so nothing ever crosses in front of the test section.
      const x = rng.range(-120, 200);
      const z = rng.range(-280, -34);
      dummy.position.set(x, GROUND_Y, z);
      dummy.rotation.y = rng.range(0, Math.PI * 2);
      dummy.scale.setScalar(rng.range(0.75, 1.6));
      dummy.updateMatrix();
      trees.setMatrixAt(i, dummy.matrix);
    }
    trees.instanceMatrix.needsUpdate = true;
    this.group.add(trees);
  }
}
