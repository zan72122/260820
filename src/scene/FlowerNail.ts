import * as THREE from 'three';
import { MaterialLibrary } from './materials';
import { LAYOUT, contactShadow } from './Patisserie';
import { NAIL_RADIUS, NAIL_PLATE_THICKNESS } from '../game/flowerParams';
import { Config } from '../engine/config';
import { Rng } from '../util/math';

/**
 * 50 mm stainless flower nail on a stand. `spinner` turns slowly so petals lay
 * themselves around the flower while the child keeps drawing the same short arc.
 */
export class FlowerNail {
  readonly group = new THREE.Group();
  /** Rotating part; the flower lives in here. */
  readonly spinner = new THREE.Group();
  /** Flower-local space: origin on the parchment surface. */
  readonly flowerRoot = new THREE.Group();
  readonly parchment: THREE.Mesh;
  readonly headY = LAYOUT.nailHeight;
  spinSpeed = 0;
  parchmentPlaced = false;
  /** Radians still owed to the turn that presents the next empty spot. */
  private spinQueue = 0;

  constructor(mats: MaterialLibrary, scene: THREE.Scene) {
    this.group.position.copy(LAYOUT.nail);
    scene.add(this.group);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.006, 36), mats.steelDark);
    base.position.y = 0.003;
    base.receiveShadow = true;
    base.castShadow = !Config.fast;
    this.group.add(base);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0032, 0.0042, this.headY - 0.006, 18),
      mats.steel,
    );
    stem.position.y = 0.006 + (this.headY - 0.006) / 2;
    stem.castShadow = !Config.fast;
    this.group.add(stem);

    const shadow = contactShadow(0.055, 0.85);
    shadow.position.y = 0.0009;
    this.group.add(shadow);

    this.spinner.position.y = this.headY;
    this.group.add(this.spinner);

    // nail head: thin plate with a chamfered edge, so it reads as sheet metal
    const profile: THREE.Vector2[] = [
      new THREE.Vector2(0.0001, 0),
      new THREE.Vector2(NAIL_RADIUS - 0.0006, 0),
      new THREE.Vector2(NAIL_RADIUS, 0.0004),
      new THREE.Vector2(NAIL_RADIUS, NAIL_PLATE_THICKNESS - 0.0004),
      new THREE.Vector2(NAIL_RADIUS - 0.0006, NAIL_PLATE_THICKNESS),
      new THREE.Vector2(0.0001, NAIL_PLATE_THICKNESS),
    ];
    const head = new THREE.Mesh(new THREE.LatheGeometry(profile, Config.fast ? 30 : 56), mats.steel);
    head.castShadow = !Config.fast;
    head.receiveShadow = true;
    this.spinner.add(head);

    this.flowerRoot.position.y = NAIL_PLATE_THICKNESS + 0.0009;
    this.spinner.add(this.flowerRoot);

    // parchment square starts on the bench, waiting to be dragged on
    const pg = new THREE.PlaneGeometry(0.036, 0.036, 6, 6);
    const rng = new Rng(63);
    const p = pg.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const edge = Math.max(Math.abs(p.getX(i)), Math.abs(p.getY(i))) / 0.018;
      p.setZ(i, Math.pow(edge, 3) * 0.0016 + rng.sym(0.00015));
    }
    pg.computeVertexNormals();
    pg.rotateX(-Math.PI / 2);
    this.parchment = new THREE.Mesh(pg, mats.parchmentMat);
    this.parchment.castShadow = !Config.fast;
    this.parchment.receiveShadow = true;
    this.parchment.position.set(LAYOUT.nail.x + 0.062, 0.0009, LAYOUT.nail.z + 0.05);
    this.parchment.rotation.y = 0.35;
    scene.add(this.parchment);
  }

  /** World position of the flower origin (parchment surface centre). */
  worldOrigin(target: THREE.Vector3) {
    return this.flowerRoot.getWorldPosition(target);
  }

  /** Turn the nail so the next petal lands on a fresh part of the flower. */
  advance(radians: number) {
    this.spinQueue += radians;
  }

  get settling() {
    return this.spinQueue > 0.02;
  }

  update(dt: number) {
    const step = Math.min(this.spinQueue, 2.6 * dt);
    this.spinQueue -= step;
    this.spinner.rotation.y += this.spinSpeed * dt + step;
  }
}
