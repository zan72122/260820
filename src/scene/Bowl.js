// Pressed-glass kakigori bowl. One lathe profile, then the flutes are pushed in
// by hand so the rim scallops the way cheap moulded glass actually does.

import {
  Mesh, LatheGeometry, Vector2, MeshPhysicalMaterial, Color, FrontSide,
} from 'three';
import { M } from './Machine.js';

export const BOWL = {
  center: { x: 0, y: 0.0, z: 0.050 },
  innerR: 0.0775,
  floorY: 0.0136,   // world height of the inside of the bowl
  rimY: 0.0534,
};

export function makeBowl(scene, quality) {
  const P = (r, y) => new Vector2(r, y);
  const profile = [
    // inside: wide and shallow, the way a kakigori bowl actually is
    P(0.0000, 0.0140), P(0.0180, 0.0136), P(0.0360, 0.0156), P(0.0520, 0.0216),
    P(0.0660, 0.0316), P(0.0745, 0.0430), P(0.0775, 0.0508),
    // over the rim
    P(0.0806, 0.0534), P(0.0830, 0.0512),
    // outside, back down to the foot
    P(0.0822, 0.0428), P(0.0776, 0.0318), P(0.0682, 0.0204), P(0.0532, 0.0110),
    P(0.0402, 0.0060), P(0.0380, 0.0030),
    // foot ring and underside
    P(0.0376, 0.0000), P(0.0326, 0.0000), P(0.0322, 0.0050), P(0.0200, 0.0072),
    P(0.0000, 0.0076),
  ];
  const geo = new LatheGeometry(profile, quality.bowlSegments);

  // press 18 shallow flutes into the outside, fading out at the floor
  const pos = geo.attributes.position;
  const v = new Vector2();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    v.set(x, z);
    const r = v.length();
    if (r < 1e-5) continue;
    const th = Math.atan2(z, x);
    const up = Math.min(1, Math.max(0, (y - 0.008) / 0.042));
    const amp = 0.0013 * up * up;
    const k = 1 + (Math.cos(th * 18) * 0.5 + 0.5) * (amp / r);
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
  }
  geo.computeVertexNormals();

  const mat = new MeshPhysicalMaterial({
    color: new Color(0.94, 0.98, 0.99),
    metalness: 0.0,
    roughness: 0.045,
    transmission: quality.transmission ? 1.0 : 0.0,
    transparent: !quality.transmission,
    opacity: quality.transmission ? 1.0 : 0.42,
    thickness: 0.0060,
    ior: 1.52,
    attenuationColor: new Color(0.80, 0.94, 0.92),
    attenuationDistance: 0.22,
    clearcoat: 0.35,
    clearcoatRoughness: 0.05,
    side: FrontSide,
    envMapIntensity: 1.15,
  });

  const mesh = new Mesh(geo, mat);
  mesh.position.set(BOWL.center.x, BOWL.center.y, BOWL.center.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.renderOrder = 2;
  scene.add(mesh);
  return { mesh, mat };
}
