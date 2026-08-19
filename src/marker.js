import * as THREE from 'three';

/* A wordless "look here" marker: a pulsing ring plus a bouncing arrow.
   Used to walk a first-time player through wall -> auger -> chute -> bed. */

export class Marker {
  constructor(scene) {
    const g = new THREE.Group();
    g.visible = false;
    scene.add(g);
    this.group = g;

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd34d, transparent: true, opacity: 0.75, depthTest: false, depthWrite: false,
    });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.075, 8, 28), ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.renderOrder = 20;
    g.add(this.ring);

    this.ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.05, 8, 28), ringMat.clone());
    this.ring2.rotation.x = -Math.PI / 2;
    this.ring2.renderOrder = 20;
    g.add(this.ring2);

    const arrowMat = new THREE.MeshBasicMaterial({
      color: 0xffd34d, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false,
    });
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.75, 4), arrowMat);
    this.arrow.rotation.x = Math.PI;      // point down
    this.arrow.rotation.y = Math.PI / 4;
    this.arrow.renderOrder = 21;
    g.add(this.arrow);

    this._t = 0;
    this.target = new THREE.Vector3();
    this.scaleBase = 1;
  }

  show(x, y, z, scale = 1) {
    this.target.set(x, y, z);
    this.group.position.set(x, y, z);
    this.group.visible = true;
    this.scaleBase = scale;
  }

  moveTo(x, y, z) { this.target.set(x, y, z); }

  hide() { this.group.visible = false; }

  update(dt) {
    if (!this.group.visible) return;
    this._t += dt;
    this.group.position.lerp(this.target, Math.min(1, dt * 6));
    const s = this.scaleBase;
    const p = (Math.sin(this._t * 3.2) * 0.5 + 0.5);
    this.ring.scale.setScalar(s * (0.9 + p * 0.3));
    this.ring.material.opacity = 0.3 + 0.4 * (1 - p);
    const p2 = ((this._t * 0.9) % 1);
    this.ring2.scale.setScalar(s * (0.9 + p2 * 1.1));
    this.ring2.material.opacity = 0.5 * (1 - p2);
    this.arrow.position.y = s * (1.35 + Math.sin(this._t * 3.6) * 0.22);
    this.arrow.scale.setScalar(s * 0.9);
    this.arrow.rotation.y += dt * 1.6;
  }
}
