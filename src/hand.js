// ---------------------------------------------------------------------------
// A knitted mitten that follows the finger. It gives the sweeping gesture a
// physical actor and, just as importantly, gives the scene its sense of scale:
// once you see a hand next to the snow, you know how deep the snow is.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { lerp, clamp01, damp } from './util.js';

export function makeMitten(grain) {
  const g = new THREE.Group();

  const woolBump = grain.clone();
  woolBump.repeat.set(9, 9);
  woolBump.needsUpdate = true;

  const wool = new THREE.MeshStandardMaterial({
    color: 0xc0392b, roughness: 1.0, metalness: 0,
    bumpMap: woolBump, bumpScale: 0.55,
  });
  const fleece = new THREE.MeshStandardMaterial({
    color: 0xf2ede3, roughness: 1.0, metalness: 0,
    bumpMap: woolBump, bumpScale: 0.9,
  });

  // palm + fingers, a single rounded mitt shape
  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), wool);
  palm.scale.set(0.038, 0.024, 0.052);
  palm.position.set(0, 0, -0.009);
  g.add(palm);

  const tip = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), wool);
  tip.scale.set(0.033, 0.020, 0.026);
  tip.position.set(0, -0.0015, -0.053);
  g.add(tip);

  const thumb = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), wool);
  thumb.scale.set(0.014, 0.013, 0.025);
  thumb.position.set(-0.035, -0.0015, -0.015);
  thumb.rotation.y = 0.42;
  g.add(thumb);

  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.037, 0.042, 16), fleece);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.set(0, 0.003, 0.037);
  g.add(cuff);

  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.042, 0.30, 14),
    new THREE.MeshStandardMaterial({ color: 0x2f5f8a, roughness: 0.95 }));
  // the forearm runs back and down, the way the player's own arm would
  sleeve.rotation.x = Math.PI / 2 + 0.30;
  sleeve.position.set(0, 0.030, 0.190);
  g.add(sleeve);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  g.visible = false;
  return g;
}

/**
 * Drives the mitten: it hovers just over the snow, leans into the direction of
 * travel and squashes down while sweeping, then closes into a fist for the pull.
 */
export class HandController {
  constructor(mesh) {
    this.mesh = mesh;
    this.pos = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.dir = new THREE.Vector2(0, -1);
    this.speed = 0;
    this.press = 0;
    this.want = 0;
    this.grip = 0;
    this.wantGrip = 0;
    this.yaw = 0;
    this._up = new THREE.Vector3(0, 1, 0);
  }
  show(v) { this.want = v ? 1 : 0; }
  setGrip(v) { this.wantGrip = v; }
  moveTo(x, y, z, vx, vz, speed) {
    this.target.set(x, y, z);
    if (Math.abs(vx) + Math.abs(vz) > 1e-4) {
      this.dir.set(vx, vz).normalize();
    }
    this.speed = speed;
  }
  update(dt, camera) {
    this.press = damp(this.press, this.want, 9, dt);
    this.grip = damp(this.grip, this.wantGrip, 10, dt);
    this.mesh.visible = this.press > 0.02;
    if (!this.mesh.visible) return;
    this.pos.x = damp(this.pos.x, this.target.x, 22, dt);
    this.pos.y = damp(this.pos.y, this.target.y, 18, dt);
    this.pos.z = damp(this.pos.z, this.target.z, 22, dt);

    const hover = lerp(0.045, 0.013, this.press) + (1 - this.press) * 0.08;
    this.mesh.position.set(this.pos.x, this.pos.y + hover + this.grip * 0.02, this.pos.z);

    // face away from the camera, then lean into the stroke
    const toCam = Math.atan2(camera.position.x - this.pos.x, camera.position.z - this.pos.z);
    const strokeYaw = Math.atan2(this.dir.x, this.dir.y);
    const blend = clamp01(this.speed * 2.2);
    let wantYaw = lerp(toCam + 0.55, strokeYaw, 0.55 * blend);
    // shortest-arc damping
    let d = wantYaw - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * (1 - Math.exp(-12 * dt));
    this.mesh.rotation.set(0, this.yaw, 0);
    // tilt: knuckles down while sweeping, wrist up while gripping
    this.mesh.rotateX(lerp(0.55, 0.12, this.grip) - clamp01(this.speed) * 0.12);
    this.mesh.rotateZ(Math.sin(this.pos.x * 3.0) * 0.05);
    const squash = 1 + clamp01(this.speed) * 0.05 - this.grip * 0.06;
    this.mesh.scale.set(1 / squash, squash, 1 / squash);
  }
}
