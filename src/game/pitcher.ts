import * as THREE from 'three';
import { radialAlpha } from '../core/tex';
import { damp } from '../core/util';

const HEIGHT = 0.098;

function jugGeometry(low: boolean) {
  const pts: THREE.Vector2[] = [];
  const prof: [number, number][] = [
    [0.0, 0.0],
    [0.0265, 0.0],
    [0.029, 0.0035],
    [0.0315, 0.016],
    [0.0355, 0.04],
    [0.0378, 0.066],
    [0.0372, 0.085],
    [0.0388, 0.092],
    [0.0362, 0.0935],
    [0.0342, 0.0905],
    [0.0335, 0.06],
    [0.0295, 0.02],
    [0.0, 0.0125],
  ];
  for (const [r, y] of prof) pts.push(new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, low ? 32 : 56);

  // pull a pouring beak out of the rim on the -Z side
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ang = Math.atan2(x, -z); // 0 when pointing towards -Z
    const w = Math.max(0, 1 - Math.abs(ang) / 0.85);
    const t = THREE.MathUtils.clamp((y - 0.062) / 0.032, 0, 1);
    const k = w * w * t;
    if (k > 0) {
      pos.setZ(i, z - k * 0.017);
      pos.setY(i, y + k * 0.007);
      pos.setX(i, x * (1 - k * 0.12));
    }
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

export class Pitcher {
  readonly group = new THREE.Group();
  readonly home = new THREE.Vector3();
  readonly homeQuat = new THREE.Quaternion();
  readonly color: THREE.Color;
  /** 0 = upright, 1 = fully tipped */
  tilt = 0;
  held = false;
  private body: THREE.Mesh;
  private liquid: THREE.Mesh;
  private ring: THREE.Mesh;
  private ringT = 0;
  private target = new THREE.Vector3();
  private targetQuat = new THREE.Quaternion();
  private tiltNode = new THREE.Group();

  constructor(color: THREE.ColorRepresentation, low: boolean, geo: THREE.BufferGeometry) {
    this.color = new THREE.Color(color);
    const shell = this.color.clone().lerp(new THREE.Color(0xffffff), 0.32);
    const mat = new THREE.MeshPhysicalMaterial({
      color: shell,
      roughness: 0.16,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.0,
    });
    this.body = new THREE.Mesh(geo, mat);
    this.body.castShadow = true;
    this.body.receiveShadow = true;

    this.liquid = new THREE.Mesh(
      new THREE.CircleGeometry(0.0335, low ? 20 : 32),
      new THREE.MeshPhysicalMaterial({
        color: this.color,
        roughness: 0.05,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        envMapIntensity: 1.5,
      })
    );
    this.liquid.rotation.x = -Math.PI / 2;
    this.liquid.position.y = 0.072;

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.086, 0.034),
      new THREE.Vector3(0, 0.079, 0.056),
      new THREE.Vector3(0, 0.055, 0.064),
      new THREE.Vector3(0, 0.034, 0.05),
      new THREE.Vector3(0, 0.029, 0.031),
    ]);
    const handle = new THREE.Mesh(
      new THREE.TubeGeometry(curve, low ? 12 : 20, 0.0048, low ? 5 : 8, false),
      mat
    );
    handle.castShadow = true;

    this.tiltNode.add(this.body, this.liquid, handle);
    this.group.add(this.tiltNode);

    this.ring = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 0.12),
      new THREE.MeshBasicMaterial({
        color: 0xfff0f4,
        transparent: true,
        opacity: 0,
        alphaMap: radialAlpha(64, 1.4),
        depthWrite: false,
        toneMapped: false,
      })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.0022;
    this.group.add(this.ring);

    const shade = new THREE.Mesh(
      new THREE.PlaneGeometry(0.1, 0.1),
      new THREE.MeshBasicMaterial({
        color: 0x100c0e,
        transparent: true,
        opacity: 0.4,
        alphaMap: radialAlpha(64, 2.4),
        depthWrite: false,
        toneMapped: false,
      })
    );
    shade.rotation.x = -Math.PI / 2;
    shade.position.y = 0.0014;
    this.group.add(shade);
  }

  /** Re-tint for a new palette. */
  setColors(c: THREE.ColorRepresentation) {
    this.color.set(c);
    const shell = this.color.clone().lerp(new THREE.Color(0xffffff), 0.32);
    (this.body.material as THREE.MeshPhysicalMaterial).color.copy(shell);
    (this.liquid.material as THREE.MeshPhysicalMaterial).color.copy(this.color);
  }

  setHome(p: THREE.Vector3, yaw: number) {
    this.home.copy(p);
    this.homeQuat.setFromEuler(new THREE.Euler(0, yaw, 0));
    this.group.position.copy(p);
    this.group.quaternion.copy(this.homeQuat);
    this.target.copy(p);
    this.targetQuat.copy(this.homeQuat);
  }

  moveTo(p: THREE.Vector3, q: THREE.Quaternion) {
    this.target.copy(p);
    this.targetQuat.copy(q);
  }

  /** Step out of the hero shot without leaving the world. */
  moveAside(p: THREE.Vector3) {
    this.held = false;
    this.target.copy(p);
    this.targetQuat.copy(this.homeQuat);
  }

  goHome() {
    this.held = false;
    this.target.copy(this.home);
    this.targetQuat.copy(this.homeQuat);
  }

  /** World position of the beak tip. */
  spoutWorld(out: THREE.Vector3) {
    out.set(0, HEIGHT * 0.96, -0.052);
    this.tiltNode.localToWorld(out);
    return out;
  }

  setSelectable(on: boolean) {
    this.ringT = on ? this.ringT : 0;
    (this.ring.material as THREE.MeshBasicMaterial).opacity = on
      ? (this.ring.material as THREE.MeshBasicMaterial).opacity
      : 0;
    this.ring.visible = on;
  }

  update(dt: number, t: number, snap = false) {
    const k = snap ? 60 : this.held ? 18 : 9;
    this.group.position.x = damp(this.group.position.x, this.target.x, k, dt);
    this.group.position.y = damp(this.group.position.y, this.target.y, k, dt);
    this.group.position.z = damp(this.group.position.z, this.target.z, k, dt);
    this.group.quaternion.slerp(this.targetQuat, 1 - Math.exp(-k * dt));
    this.tiltNode.rotation.x = damp(this.tiltNode.rotation.x, -this.tilt * 1.05, 14, dt);
    if (this.ring.visible) {
      const m = this.ring.material as THREE.MeshBasicMaterial;
      m.opacity = 0.18 + 0.16 * (0.5 + 0.5 * Math.sin(t * 3.4));
    }
    // the liquid surface stays level while the jug tips, and drops as it pours
    this.liquid.rotation.x = -Math.PI / 2 - this.tiltNode.rotation.x;
    this.liquid.position.set(0, 0.07 - this.tilt * 0.026, -this.tilt * 0.016);
    const shrink = 1 - this.tilt * 0.42;
    this.liquid.scale.set(shrink, shrink, shrink);
  }

  /** distance in screen pixels from a point to this pitcher */
  screenPos(camera: THREE.Camera, w: number, h: number, out: THREE.Vector2) {
    const v = new THREE.Vector3(0, 0.05, 0);
    this.group.localToWorld(v);
    v.project(camera);
    out.set(((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h);
    return out;
  }
}

export function buildPitchers(colors: THREE.ColorRepresentation[], low: boolean) {
  const geo = jugGeometry(low);
  return colors.map((c) => new Pitcher(c, low, geo));
}

export const PITCHER_HEIGHT = HEIGHT;
