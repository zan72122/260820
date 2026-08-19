import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { brushedSteel, trayGrime, radialAlpha } from '../core/tex';

export const RACK_TOP = 0.045;
export const RACK_R = 0.14;
export const TRAY_W = 0.4;
export const TRAY_D = 0.34;

export interface RackSet {
  group: THREE.Group;
  rack: THREE.Mesh;
  tray: THREE.Group;
  puddle: PuddleCanvas;
}

/**
 * The tray keeps a running record of everything that has dripped off the cake.
 * A 2D canvas is plenty here — a few dozen splashes over a whole run.
 */
export class PuddleCanvas {
  readonly texture: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private size: number;

  constructor(size = 256) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    this.size = size;
    this.ctx = c.getContext('2d')!;
    this.clear();
    this.texture = new THREE.CanvasTexture(c);
    this.texture.colorSpace = THREE.SRGBColorSpace;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.size, this.size);
    if (this.texture) this.texture.needsUpdate = true;
  }

  /** u,v in 0..1 across the tray, r in metres. */
  splash(u: number, v: number, r: number, color: THREE.Color) {
    const x = u * this.size;
    const y = v * this.size;
    const rad = Math.max(2.5, (r / TRAY_W) * this.size);
    const c = color.clone().convertLinearToSRGB();
    const hex = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
    const g = this.ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, hex);
    g.addColorStop(0.62, hex);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    this.ctx.globalAlpha = 0.92;
    this.ctx.fillStyle = g;
    this.ctx.beginPath();
    this.ctx.arc(x, y, rad, 0, Math.PI * 2);
    this.ctx.fill();
    // a couple of satellite specks, like a real splash
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = rad * (0.9 + Math.random() * 0.9);
      const rr = rad * (0.12 + Math.random() * 0.2);
      this.ctx.globalAlpha = 0.7;
      this.ctx.beginPath();
      this.ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rr, 0, Math.PI * 2);
      this.ctx.fillStyle = hex;
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
    this.texture.needsUpdate = true;
  }
}

export function buildRackSet(low: boolean): RackSet {
  const group = new THREE.Group();

  const steelRough = brushedSteel(low ? 256 : 512, 0.32, 0.1);
  const wireMat = new THREE.MeshPhysicalMaterial({
    color: 0xc3c8cc,
    metalness: 1.0,
    roughness: 0.22,
    roughnessMap: steelRough,
    envMapIntensity: 1.0,
    anisotropy: 0.6,
  });

  // ---- wire rack ---------------------------------------------------------
  const parts: THREE.BufferGeometry[] = [];
  const wire = 0.0018;
  const rings = [0.03, 0.062, 0.094, 0.122, RACK_R];
  for (const r of rings) {
    const t = new THREE.TorusGeometry(r, r === RACK_R ? wire * 1.5 : wire, 5, low ? 48 : 72);
    t.rotateX(Math.PI / 2);
    t.translate(0, RACK_TOP, 0);
    parts.push(t);
  }
  const spokes = low ? 8 : 12;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI;
    const c = new THREE.CylinderGeometry(wire, wire, RACK_R * 2, 5);
    c.rotateZ(Math.PI / 2);
    c.rotateY(a);
    c.translate(0, RACK_TOP - 0.0036, 0);
    parts.push(c);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const leg = new THREE.CylinderGeometry(wire * 1.2, wire * 1.2, RACK_TOP - 0.004, 6);
    leg.translate(Math.cos(a) * 0.118, (RACK_TOP - 0.004) / 2 + 0.004, Math.sin(a) * 0.118);
    parts.push(leg);
  }
  const rackGeo = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  const rack = new THREE.Mesh(rackGeo, wireMat);
  rack.castShadow = true;
  rack.receiveShadow = true;
  group.add(rack);

  // ---- catch tray --------------------------------------------------------
  const tray = new THREE.Group();
  const grime = trayGrime(low ? 256 : 512);
  grime.repeat.set(2, 2);
  const trayRough = brushedSteel(256, 0.44, 0.07);
  trayRough.repeat.set(3, 3);
  const trayMat = new THREE.MeshPhysicalMaterial({
    color: 0x8a9094,
    metalness: 0.92,
    roughness: 0.62,
    roughnessMap: trayRough,
    map: grime,
    envMapIntensity: 0.34,
    anisotropy: 0.7,
  });
  const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(TRAY_W, 0.005, TRAY_D), trayMat);
  floorMesh.position.y = 0.0025;
  floorMesh.receiveShadow = true;
  tray.add(floorMesh);

  const wallH = 0.02;
  const mk = (w: number, d: number, x: number, z: number, rot: number, axis: 'x' | 'z') => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), trayMat);
    m.position.set(x, wallH * 0.5, z);
    if (axis === 'x') m.rotation.x = rot;
    else m.rotation.z = rot;
    m.receiveShadow = true;
    tray.add(m);
  };
  const tilt = 0.22;
  mk(TRAY_W, 0.006, 0, -TRAY_D / 2, -tilt, 'x');
  mk(TRAY_W, 0.006, 0, TRAY_D / 2, tilt, 'x');
  mk(0.006, TRAY_D, -TRAY_W / 2, 0, tilt, 'z');
  mk(0.006, TRAY_D, TRAY_W / 2, 0, -tilt, 'z');
  group.add(tray);

  // ---- glaze that has run through the rack ------------------------------
  const puddle = new PuddleCanvas(low ? 192 : 256);
  const puddleMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(TRAY_W - 0.012, TRAY_D - 0.012),
    new THREE.MeshPhysicalMaterial({
      map: puddle.texture,
      alphaMap: puddle.texture,
      transparent: true,
      depthWrite: false,
      roughness: 0.08,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.2,
    })
  );
  puddleMesh.rotation.x = -Math.PI / 2;
  puddleMesh.position.y = 0.0056;
  puddleMesh.renderOrder = 3;
  group.add(puddleMesh);

  // contact shadow of the rack on the tray
  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(0.33, 0.33),
    new THREE.MeshBasicMaterial({
      color: 0x14100f,
      transparent: true,
      opacity: 0.34,
      alphaMap: radialAlpha(128, 2.4),
      depthWrite: false,
      toneMapped: false,
    })
  );
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = 0.0053;
  shade.renderOrder = 1;
  group.add(shade);

  return { group, rack, tray, puddle };
}
