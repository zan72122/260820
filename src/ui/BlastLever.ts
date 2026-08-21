import * as THREE from 'three';
import { galvanisedMaps, rubberMaps } from '../world/Textures';
import { approach, clamp } from '../core/Rng';

function dialTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  ctx.fillStyle = '#efeee8';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.47, 0, Math.PI * 2);
  ctx.fill();

  // Colour bands instead of numbers: the child reads the sweep, not a value.
  const bands: Array<[number, number, string]> = [
    [0.62, 0.95, '#9fd6e8'],
    [0.95, 1.32, '#4aa7d8'],
    [1.32, 1.72, '#f2c14a'],
    [1.72, 2.05, '#e0673c'],
  ];
  for (const [from, to, colour] of bands) {
    ctx.beginPath();
    ctx.strokeStyle = colour;
    ctx.lineWidth = size * 0.1;
    ctx.arc(size / 2, size / 2, size * 0.34, from * Math.PI, to * Math.PI);
    ctx.stroke();
  }
  ctx.strokeStyle = '#31383d';
  ctx.lineWidth = size * 0.012;
  for (let i = 0; i <= 10; i++) {
    const a = (0.62 + (i / 10) * 1.43) * Math.PI;
    const r0 = size * 0.27;
    const r1 = size * 0.31;
    ctx.beginPath();
    ctx.moveTo(size / 2 + Math.cos(a) * r0, size / 2 + Math.sin(a) * r0);
    ctx.lineTo(size / 2 + Math.cos(a) * r1, size / 2 + Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
  ctx.lineWidth = size * 0.035;
  ctx.strokeStyle = '#8f9599';
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * The blast control, built as real equipment bolted to the edge of the test
 * station rather than as an on-screen button. It sits at the corner of the
 * frame so a thumb on it never covers the nozzles or the raft.
 */
export class BlastLever {
  readonly group = new THREE.Group();
  private readonly pivot = new THREE.Object3D();
  private readonly needle = new THREE.Object3D();
  private readonly interlock: THREE.Mesh;
  private lever = 0;
  private tremble = 0;
  private time = 0;
  private locked = true;

  constructor(private readonly camera: THREE.PerspectiveCamera) {
    const steel = galvanisedMaps();
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x9aa2a7,
      metalness: 0.85,
      roughness: 0.42,
      map: steel.map,
      roughnessMap: steel.roughnessMap,
      normalMap: steel.normalMap,
      envMapIntensity: 0.9,
    });
    const caseMat = new THREE.MeshStandardMaterial({
      color: 0x6d7a80,
      metalness: 0.3,
      roughness: 0.5,
      map: steel.map,
      normalMap: steel.normalMap,
      envMapIntensity: 0.7,
    });

    // Pedestal, running out of frame the way real floor-mounted plant does.
    const column = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.7, 0.075), steelMat);
    column.position.set(0, -0.42, 0);
    this.group.add(column);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.18), steelMat);
    foot.position.set(0, -0.76, 0);
    this.group.add(foot);

    // The console itself: a cast box with the lever slot cut into the top.
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.13, 0.17), caseMat);
    body.rotation.x = -0.2;
    this.group.add(body);
    const topPlate = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.012, 0.18), steelMat);
    topPlate.rotation.x = -0.2;
    topPlate.position.set(0, 0.068, 0.012);
    this.group.add(topPlate);
    for (const bx of [-0.15, 0.15]) {
      for (const bz of [-0.07, 0.07]) {
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.012, 6), steelMat);
        bolt.position.set(bx, 0.074, bz);
        this.group.add(bolt);
      }
    }
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.008, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x1c2226, roughness: 0.9 }),
    );
    slot.rotation.x = -0.2;
    slot.position.set(-0.075, 0.073, 0.012);
    this.group.add(slot);

    // Lever arm with a moulded rubber grip.
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.16, 0.03), steelMat);
    arm.position.set(0, 0.08, 0);
    this.pivot.add(arm);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.03, 10), steelMat);
    collar.position.set(0, 0.015, 0);
    this.pivot.add(collar);
    const gripMat = new THREE.MeshStandardMaterial({
      color: 0xc9502a,
      roughness: 0.75,
      metalness: 0.02,
      map: rubberMaps().map,
      normalMap: rubberMaps().normalMap,
      envMapIntensity: 0.45,
    });
    const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.05, 5, 10), gripMat);
    grip.position.set(0, 0.175, 0);
    this.pivot.add(grip);
    this.pivot.position.set(-0.075, 0.062, 0.012);
    this.group.add(this.pivot);

    // Pressure gauge, banded rather than numbered.
    const dial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.048, 0.016, 22),
      [
        steelMat,
        new THREE.MeshStandardMaterial({
          map: dialTexture(),
          roughness: 0.3,
          metalness: 0.05,
          envMapIntensity: 0.7,
        }),
        steelMat,
      ],
    );
    dial.rotation.set(1.12, 0, 0);
    dial.position.set(0.088, 0.088, 0.03);
    this.group.add(dial);
    const needleMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.005, 0.038, 0.003),
      new THREE.MeshStandardMaterial({ color: 0x1e2427, roughness: 0.5 }),
    );
    needleMesh.position.y = 0.016;
    this.needle.add(needleMesh);
    this.needle.position.set(0.088, 0.096, 0.043);
    this.needle.rotation.x = -0.45;
    this.group.add(this.needle);

    // Braided supply hose leaving the back of the console.
    const hoseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.02, -0.05, -0.08),
      new THREE.Vector3(0.12, -0.24, -0.12),
      new THREE.Vector3(0.05, -0.5, -0.06),
      new THREE.Vector3(0.1, -0.78, -0.02),
    ]);
    const hose = new THREE.Mesh(
      new THREE.TubeGeometry(hoseCurve, 16, 0.016, 6, false),
      new THREE.MeshStandardMaterial({ color: 0x2b3237, roughness: 0.8, map: rubberMaps().map }),
    );
    this.group.add(hose);

    // Interlock flag: the supply is not armed until a raft is on the course.
    this.interlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.052, 0.024, 0.006),
      new THREE.MeshStandardMaterial({ color: 0xdca92f, roughness: 0.55, metalness: 0.1 }),
    );
    this.interlock.position.set(-0.135, 0.052, 0.075);
    this.interlock.rotation.set(-0.2, 0, 0.25);
    this.group.add(this.interlock);

    this.group.traverse((o) => {
      o.renderOrder = 20;
    });
    camera.add(this.group);
    this.layout(false);
  }

  setLocked(locked: boolean): void {
    this.locked = locked;
  }

  /** Park the control in the lower corner of whatever screen we are on. */
  layout(portrait: boolean): void {
    const distance = 1.05;
    const halfH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * distance;
    const halfW = halfH * this.camera.aspect;
    // The console is bolted to the corner of the test station: it keeps a
    // constant share of the screen, and it never covers the flume.
    const scale = clamp(halfH * 1.0, 0.3, 0.8);
    this.group.scale.setScalar(scale);
    const x = -halfW + Math.min(halfW * 0.34, 0.24 * scale + 0.1);
    const y = -halfH + (portrait ? 0.2 : 0.16) * scale + 0.02;
    this.group.position.set(x, y, -distance);
    this.group.rotation.set(-0.16, 0.34, 0);
  }

  update(dt: number, leverTarget: number, charge: number): void {
    this.time += dt;
    this.lever = approach(this.lever, leverTarget, 0.07, dt);
    // Water pressure makes the whole control shiver, whether or not it is held.
    this.tremble = approach(this.tremble, charge * 0.45 + (this.locked ? 0 : 0), 0.2, dt);
    const shiver = Math.sin(this.time * 47) * 0.006 * this.tremble;
    this.pivot.rotation.x = -this.lever * 0.72 + shiver;
    this.needle.rotation.z = -(charge * 1.43 + 0.62) * Math.PI + Math.PI / 2 + shiver * 2;
    this.interlock.visible = this.locked;
    this.interlock.rotation.z = 0.3 + Math.sin(this.time * 5) * 0.02;
  }

  /** A single pressure shiver, used as the game's only nudge. */
  nudge(strength: number): void {
    this.tremble = Math.max(this.tremble, strength);
  }
}
