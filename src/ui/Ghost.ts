import * as THREE from 'three';
import { ghostPath } from '../game/PetalShaper';
import type { LayerDef } from '../game/flowerParams';

/**
 * The only teaching in the game: a translucent path where the next petal wants
 * to go, with a bead running along it like a chef showing the move once.
 * It fades out as soon as the child starts drawing.
 */
export class Ghost {
  readonly group = new THREE.Group();
  private tube: THREE.Mesh;
  private bead: THREE.Mesh;
  private ring: THREE.Mesh;
  private arrow: THREE.Mesh;
  private curve: THREE.CatmullRomCurve3 | null = null;
  private t = 0;
  private opacity = 0;
  private targetOpacity = 0;
  private mode: 'none' | 'path' | 'centre' = 'none';

  constructor(parent: THREE.Object3D) {
    parent.add(this.group);
    const mat = (o: number, c: number) =>
      new THREE.MeshBasicMaterial({
        color: c,
        transparent: true,
        opacity: o,
        depthWrite: false,
        depthTest: false,
      });
    this.tube = new THREE.Mesh(new THREE.BufferGeometry(), mat(0.3, 0xfff2d8));
    this.tube.renderOrder = 20;
    this.group.add(this.tube);
    this.bead = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 12, 8), mat(0.8, 0xffffff));
    this.bead.renderOrder = 21;
    this.group.add(this.bead);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0008, 8, 32), mat(0.5, 0xffe9c0));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.renderOrder = 20;
    this.group.add(this.ring);
    const cone = new THREE.ConeGeometry(0.0035, 0.006, 14);
    cone.rotateX(Math.PI);
    this.arrow = new THREE.Mesh(cone, mat(0.6, 0xffffff));
    this.arrow.renderOrder = 21;
    this.group.add(this.arrow);
    this.group.visible = false;
  }

  showPetalPath(layer: LayerDef, coneHeight: number, startAngle: number) {
    const pts = ghostPath(layer, coneHeight, startAngle);
    this.curve = new THREE.CatmullRomCurve3(pts);
    this.tube.geometry.dispose();
    this.tube.geometry = new THREE.TubeGeometry(this.curve, 40, 0.0011, 6, false);
    this.mode = 'path';
    this.targetOpacity = 1;
    this.group.visible = true;
    this.ring.visible = false;
    this.arrow.visible = false;
    this.bead.visible = true;
    this.tube.visible = true;
  }

  showCentre(height: number) {
    this.mode = 'centre';
    this.targetOpacity = 1;
    this.group.visible = true;
    this.ring.visible = true;
    this.arrow.visible = true;
    this.bead.visible = false;
    this.tube.visible = false;
    this.ring.position.y = height + 0.002;
    this.arrow.position.y = height + 0.016;
  }

  hide() {
    this.targetOpacity = 0;
  }

  update(dt: number, coneHeight = 0) {
    this.opacity += (this.targetOpacity - this.opacity) * Math.min(1, dt * 4);
    if (this.opacity < 0.01) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    this.t = (this.t + dt * 0.45) % 1;
    const pulse = 0.55 + 0.45 * Math.sin(this.t * Math.PI * 2);
    for (const m of [this.tube, this.bead, this.ring, this.arrow]) {
      const mm = m.material as THREE.MeshBasicMaterial;
      mm.opacity = this.opacity * (m === this.bead ? 0.85 : 0.34) * (0.6 + pulse * 0.6);
    }
    if (this.mode === 'path' && this.curve) {
      this.curve.getPointAt(Math.min(0.999, this.t), this.bead.position);
    } else if (this.mode === 'centre') {
      this.ring.position.y = coneHeight + 0.002;
      this.ring.scale.setScalar(0.9 + pulse * 0.25);
      this.arrow.position.y = coneHeight + 0.014 + pulse * 0.004;
    }
  }
}
