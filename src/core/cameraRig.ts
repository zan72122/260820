/**
 * Directed camera — no free orbit. Each station supplies named views;
 * the rig eases between them and can softly track the test ball.
 * Portrait framing pulls back and lifts so letter (top) + handle (bottom)
 * both fit above/below each other on a phone held upright.
 */
import * as THREE from 'three';
import { damp } from './math';

export type ViewName = 'front' | 'threequarter' | 'operate' | 'follow' | 'overview';

export interface StationViews {
  front: { pos: THREE.Vector3; target: THREE.Vector3 };
  threequarter: { pos: THREE.Vector3; target: THREE.Vector3 };
  operate: { pos: THREE.Vector3; target: THREE.Vector3 };
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private goalPos = new THREE.Vector3();
  private goalTarget = new THREE.Vector3();
  private curTarget = new THREE.Vector3();
  private followRef: THREE.Object3D | null = null;
  private followWeight = 0;
  private basePos = new THREE.Vector3();
  private baseTarget = new THREE.Vector3();
  private view: ViewName = 'front';
  portrait = false;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 60);
    this.camera.position.set(0, 2.6, 3.4);
    this.curTarget.set(0, 0.6, 0);
    this.goalPos.copy(this.camera.position);
    this.goalTarget.copy(this.curTarget);
    this.basePos.copy(this.goalPos);
    this.baseTarget.copy(this.goalTarget);
  }

  setAspect(aspect: number) {
    this.portrait = aspect < 1;
    this.camera.aspect = aspect;
    this.camera.fov = this.portrait ? 54 : 46;
    this.camera.updateProjectionMatrix();
    this.applyView();
  }

  goTo(view: ViewName, views: StationViews, immediate = false) {
    this.view = view === 'follow' || view === 'overview' ? this.view : view;
    const v =
      view === 'follow' || view === 'overview'
        ? views[this.view as 'front' | 'threequarter' | 'operate']
        : views[view];
    this.basePos.copy(v.pos);
    this.baseTarget.copy(v.target);
    this.applyView();
    if (immediate) {
      this.camera.position.copy(this.goalPos);
      this.curTarget.copy(this.goalTarget);
      this.camera.lookAt(this.curTarget);
    }
  }

  private applyView() {
    this.goalPos.copy(this.basePos);
    this.goalTarget.copy(this.baseTarget);
    if (this.portrait) {
      // pull back along the view ray and lift slightly
      const dir = this.goalPos.clone().sub(this.goalTarget);
      dir.multiplyScalar(1.52);
      this.goalPos.copy(this.goalTarget).add(dir);
      this.goalPos.y += 0.3;
    }
  }

  /** Blend a moving object (the ball) into the look target. */
  follow(obj: THREE.Object3D | null, weight = 0.55) {
    this.followRef = obj;
    this.followWeight = obj ? weight : 0;
  }

  update(dt: number) {
    const l = 3.2;
    this.camera.position.x = damp(this.camera.position.x, this.goalPos.x, l, dt);
    this.camera.position.y = damp(this.camera.position.y, this.goalPos.y, l, dt);
    this.camera.position.z = damp(this.camera.position.z, this.goalPos.z, l, dt);
    const t = new THREE.Vector3().copy(this.goalTarget);
    if (this.followRef && this.followWeight > 0) {
      const bp = new THREE.Vector3();
      this.followRef.getWorldPosition(bp);
      t.lerp(bp, this.followWeight);
    }
    this.curTarget.x = damp(this.curTarget.x, t.x, 4.5, dt);
    this.curTarget.y = damp(this.curTarget.y, t.y, 4.5, dt);
    this.curTarget.z = damp(this.curTarget.z, t.z, 4.5, dt);
    this.camera.lookAt(this.curTarget);
  }
}
