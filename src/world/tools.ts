import * as THREE from 'three';
import { MaterialLibrary } from '../materials/library';
import { anodised, feltFloor, timber } from '../materials/recipes';
import { damp } from '../util/math';
import { grabProxy } from './rig';

/**
 * The clean-up brush.
 *
 * Marks are never wiped automatically — a crater the child made is theirs to
 * look at for as long as they want. When they *do* want a clean surface, they
 * drag this across it, which doubles as a way back into the next test.
 */
export class Brush {
  readonly group = new THREE.Group();
  readonly head: THREE.Mesh;
  readonly proxy!: THREE.Mesh;
  readonly home = new THREE.Vector3(-0.36, 0.4, 0.06);
  private homeQuat = new THREE.Quaternion();
  private carried = false;
  private returning = false;

  constructor(lib: MaterialLibrary) {
    const timberMat = lib.get(timber, { repeat: 1, normalScale: 1.1 }, 'brush');
    const anodMat = lib.get(anodised, { repeat: 1, normalScale: 0.8 }, 'brush');
    const bristleMat = lib.get(feltFloor, { repeat: 2, normalScale: 1.6 }, 'brush');

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.075), timberMat);
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    const bristles = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.045, 0.07), bristleMat);
    bristles.position.y = -0.045;
    bristles.castShadow = true;
    this.group.add(bristles);

    // A grab knob big enough for a small hand.
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 12), anodMat);
    this.head.position.y = 0.055;
    this.head.castShadow = true;
    this.group.add(this.head);
    const proxy = grabProxy(new THREE.SphereGeometry(0.13, 10, 8), 'brush');
    proxy.position.copy(this.head.position);
    this.group.add(proxy);
    this.proxy = proxy;

    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 6, 12), anodMat);
    hook.position.set(0.11, 0.03, 0);
    hook.rotation.y = Math.PI / 2;
    this.group.add(hook);

    this.homeQuat.setFromEuler(new THREE.Euler(0, 0.62, 0));
    this.group.position.copy(this.home);
    this.group.quaternion.copy(this.homeQuat);
  }

  /** Park the brush beside whichever area is currently being tested. */
  setHome(x: number, y: number, z: number) {
    this.home.set(x, y, z);
    this.returning = true;
  }

  pickUp() {
    this.carried = true;
    this.returning = false;
  }

  drop() {
    this.carried = false;
    this.returning = true;
  }

  get isCarried() {
    return this.carried;
  }

  /** Follow the finger, held flat and just above the surface. */
  moveTo(point: THREE.Vector3, surfaceY: number) {
    this.group.position.set(point.x, Math.max(surfaceY + 0.055, point.y), point.z);
    this.group.quaternion.slerp(new THREE.Quaternion(), 0.3);
  }

  update(dt: number) {
    if (this.carried || !this.returning) return;
    this.group.position.x = damp(this.group.position.x, this.home.x, 8, dt);
    this.group.position.y = damp(this.group.position.y, this.home.y, 8, dt);
    this.group.position.z = damp(this.group.position.z, this.home.z, 8, dt);
    this.group.quaternion.slerp(this.homeQuat, 1 - Math.exp(-8 * dt));
    if (this.group.position.distanceToSquared(this.home) < 1e-5) this.returning = false;
  }
}
