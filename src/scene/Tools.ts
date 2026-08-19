import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MaterialLibrary } from './materials';
import { Config } from '../engine/config';
import { clamp, damp } from '../util/math';

/**
 * Petal tip: a stainless cone whose opening flattens into a teardrop slit,
 * which is what gives a piped petal its thick root and shaved edge.
 */
function petalTipGeometry(): THREE.BufferGeometry {
  const rings = 10;
  const seg = 26;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= rings; j++) {
    const t = j / rings;
    const r = 0.0102 - 0.0042 * t;
    const flat = 1 - 0.72 * t * t;
    const y = -0.018 * t;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const teardrop = 1 + 0.5 * t * Math.max(0, Math.sin(a));
      pos.push(Math.cos(a) * r * flat, y, Math.sin(a) * r * teardrop);
    }
  }
  for (let j = 0; j < rings; j++)
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i;
      idx.push(a, a + seg + 1, a + 1, a + 1, a + seg + 1, a + seg + 2);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Piping bag, tip and the pastry chef's hand. Origin sits at the tip opening. */
export class PipingBag {
  readonly group = new THREE.Group();
  private bag: THREE.Mesh;
  private bead: THREE.Mesh;
  private press = 0;
  private wobble = 0;

  constructor(mats: MaterialLibrary, scene: THREE.Scene, creamColor: THREE.Color) {
    scene.add(this.group);

    const tip = new THREE.Mesh(petalTipGeometry(), mats.steel);
    tip.position.y = 0.018;
    tip.castShadow = !Config.fast;
    this.group.add(tip);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.0118, 0.0108, 0.006, 24), mats.steelDark);
    collar.position.y = 0.0195;
    this.group.add(collar);

    // soft filled bag: lathe with a twisted, pinched top
    const profile: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const y = 0.021 + t * 0.15;
      let r = 0.011 + Math.pow(t, 0.85) * 0.037;
      if (t > 0.78) r *= 1 - (t - 0.78) / 0.22 * 0.82;
      r *= 1 + 0.05 * Math.sin(t * 9);
      profile.push(new THREE.Vector2(Math.max(0.0006, r), y));
    }
    profile.push(new THREE.Vector2(0.006, 0.183));
    profile.push(new THREE.Vector2(0.0035, 0.196));
    const bagGeo = new THREE.LatheGeometry(profile, Config.fast ? 20 : 34);
    // twist the top so it reads as a bag wrung shut
    const bp = bagGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < bp.count; i++) {
      const y = bp.getY(i);
      const tw = clamp((y - 0.12) / 0.08, 0, 1) * 1.5;
      const c = Math.cos(tw);
      const s = Math.sin(tw);
      const x = bp.getX(i);
      const z = bp.getZ(i);
      bp.setXYZ(i, x * c - z * s, y, x * s + z * c);
    }
    bagGeo.computeVertexNormals();
    this.bag = new THREE.Mesh(bagGeo, mats.bagMat);
    this.bag.castShadow = !Config.fast;
    this.group.add(this.bag);

    // cream visible through the bag opening / at the nozzle
    this.bead = new THREE.Mesh(
      new THREE.SphereGeometry(0.0055, 14, 10),
      new THREE.MeshPhysicalMaterial({
        color: creamColor,
        roughness: 0.42,
        clearcoat: 0.2,
        sheen: 0.4,
      }),
    );
    this.bead.scale.set(1, 0.7, 1.25);
    this.bead.position.y = 0.0022;
    this.bead.visible = false;
    this.group.add(this.bead);

    this.group.add(this.buildHand(mats));

    // hold angle: bag leans back and to the right, tip pointing down at the work
    this.group.rotation.set(-0.34, 0.5, 0.42, 'YXZ');
  }

  private buildHand(mats: MaterialLibrary): THREE.Mesh {
    const parts: THREE.BufferGeometry[] = [];
    const palm = new THREE.SphereGeometry(0.042, 18, 14);
    palm.scale(1.05, 0.72, 0.85);
    palm.translate(0.024, 0.115, 0.006);
    parts.push(palm);
    for (let i = 0; i < 4; i++) {
      const len = 0.062 - i * 0.006;
      const f = new THREE.CapsuleGeometry(0.0092 - i * 0.0004, len, 4, 10);
      f.rotateZ(Math.PI / 2);
      f.rotateY(-0.25 + i * 0.06);
      f.translate(-0.006, 0.148 - i * 0.021, 0.012 + i * 0.002);
      parts.push(f);
    }
    const thumb = new THREE.CapsuleGeometry(0.011, 0.05, 4, 10);
    thumb.rotateZ(0.9);
    thumb.rotateX(-0.5);
    thumb.translate(0.03, 0.106, -0.03);
    parts.push(thumb);
    const wrist = new THREE.CapsuleGeometry(0.032, 0.09, 4, 12);
    wrist.rotateZ(0.35);
    wrist.translate(0.062, 0.175, 0.01);
    parts.push(wrist);
    const mesh = new THREE.Mesh(mergeGeometries(parts, false)!, mats.skinMat);
    mesh.castShadow = !Config.fast;
    return mesh;
  }

  setCreamColor(c: THREE.Color) {
    (this.bead.material as THREE.MeshPhysicalMaterial).color.copy(c);
  }

  setPressing(on: boolean) {
    this.press = on ? 1 : 0;
  }

  update(dt: number, extruding: boolean) {
    // the bag squashes a little under the hand while cream is flowing
    this.wobble = damp(this.wobble, this.press, 9, dt);
    const s = 1 - this.wobble * 0.055;
    this.bag.scale.set(s, 1 + this.wobble * 0.02, s);
    this.bead.visible = extruding;
    if (extruding) {
      const k = 0.85 + Math.sin(performance.now() * 0.02) * 0.1;
      this.bead.scale.set(k, 0.7 * k, 1.25 * k);
    }
  }
}

/** Thin stainless flower lifter used to carry the finished flower to the cake. */
export class Lifter {
  readonly group = new THREE.Group();
  readonly cradle = new THREE.Group();

  constructor(mats: MaterialLibrary, scene: THREE.Scene) {
    scene.add(this.group);

    const shape = new THREE.Shape();
    shape.moveTo(-0.02, 0);
    shape.quadraticCurveTo(-0.026, 0.03, 0, 0.036);
    shape.quadraticCurveTo(0.026, 0.03, 0.02, 0);
    shape.quadraticCurveTo(0.012, -0.006, 0, -0.006);
    shape.quadraticCurveTo(-0.012, -0.006, -0.02, 0);
    const blade = new THREE.ExtrudeGeometry(shape, { depth: 0.0008, bevelEnabled: false });
    blade.rotateX(-Math.PI / 2);
    blade.translate(0, 0, 0.006);
    const bladeMesh = new THREE.Mesh(blade, mats.steel);
    bladeMesh.castShadow = !Config.fast;
    bladeMesh.receiveShadow = true;
    this.group.add(bladeMesh);

    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.0012, 0.05), mats.steel);
    neck.position.set(0, 0.0004, -0.03);
    this.group.add(neck);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.075, 18), mats.steelDark);
    handle.rotation.x = Math.PI / 2;
    handle.rotation.z = 0.0;
    handle.position.set(0, 0.004, -0.09);
    handle.castShadow = !Config.fast;
    this.group.add(handle);

    this.cradle.position.set(0, 0.0012, 0.006);
    this.group.add(this.cradle);
    this.group.visible = false;
  }
}
