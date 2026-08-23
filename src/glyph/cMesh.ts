/**
 * Glyph C as hardware: a curved wall standing on the plate, built from
 * telescoping overlap segments on X linear guides. The wall geometry has
 * fixed topology; positions are rewritten only while the width handle
 * moves. Seam strips and terminal blocks are rigid parts re-posed per
 * update — the overlap-plate construction the child sees.
 */
import * as THREE from 'three';
import {
  C_SPEC,
  cApertureHalfAngle,
  cCenterline,
  cRx,
  cStrokeAt,
} from './spec';
import type { LabMaterials } from '../core/materials';
import { SweepWall, type SweepFrame } from '../geo/dynamic';

export const C_MESH = {
  frames: 49,
  seams: 8,
};

/** Wall frames for a given width — shared by mesh + tests. */
export function cFrames(width: number): SweepFrame[] {
  const th = cApertureHalfAngle(width);
  const rx = cRx(width);
  const ry = C_SPEC.ry;
  const out: SweepFrame[] = [];
  for (let i = 0; i < C_MESH.frames; i++) {
    const a = th + ((Math.PI * 2 - 2 * th) * i) / (C_MESH.frames - 1);
    const p = cCenterline(width, a);
    // outward normal of the ellipse
    let nx = p.x / (rx * rx);
    let nz = p.z / (ry * ry);
    const len = Math.hypot(nx, nz) || 1;
    nx /= len;
    nz /= len;
    out.push({ x: p.x, z: p.z, nx, nz, halfW: cStrokeAt(width, a) / 2 });
  }
  return out;
}

export interface CGlyph {
  group: THREE.Group;
  setWidth(w: number): void;
}

export function makeCGlyph(mats: LabMaterials): CGlyph {
  const group = new THREE.Group();
  const H = C_SPEC.wallHeight;

  const wall = new SweepWall(C_MESH.frames, 0, H);
  const wallMesh = new THREE.Mesh(wall.geometry, mats.blackSteel);
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  group.add(wallMesh);

  // visible overlap seams: thin brushed strips riding the outer face
  const seamGeo = new THREE.BoxGeometry(0.012, H * 0.94, 0.05);
  const seams: THREE.Mesh[] = [];
  for (let i = 0; i < C_MESH.seams; i++) {
    const seam = new THREE.Mesh(seamGeo, mats.blackSteelSlide);
    seam.castShadow = true;
    seams.push(seam);
    group.add(seam);
  }

  // terminal blocks: machined caps on both stroke ends
  const termGeo = new THREE.BoxGeometry(0.09, H + 0.02, 0.13);
  const terminals: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const t = new THREE.Mesh(termGeo, mats.blackSteelSlide);
    t.castShadow = true;
    terminals.push(t);
    group.add(t);
  }

  // linear guides under the terminals (X direction) + sync screw
  const railGeo = new THREE.BoxGeometry(0.5, 0.025, 0.06);
  for (const sz of [-1, 1]) {
    const rail = new THREE.Mesh(railGeo, mats.aluminum);
    rail.position.set(0.22, 0.0125, sz * 0.36);
    rail.receiveShadow = true;
    group.add(rail);
  }
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 10), mats.blackSteelSlide);
  screw.rotation.z = Math.PI / 2;
  screw.position.set(0.24, 0.05, 0.5);
  group.add(screw);

  const setWidth = (w: number) => {
    const frames = cFrames(w);
    wall.update(frames);
    // pose seams at fixed parameter fractions
    for (let i = 0; i < C_MESH.seams; i++) {
      const fi = Math.round(((i + 1) * (C_MESH.frames - 1)) / (C_MESH.seams + 1));
      const f = frames[fi];
      seams[i].position.set(f.x + f.nx * (f.halfW + 0.004), H * 0.47, f.z + f.nz * (f.halfW + 0.004));
      seams[i].rotation.y = Math.atan2(f.nx, f.nz);
    }
    // pose terminal blocks just behind the wall's flat end caps
    for (const [idx, f] of [frames[0], frames[frames.length - 1]].entries()) {
      const t = terminals[idx];
      // tangent along the wall at the end
      const f2 = idx === 0 ? cFrames(w)[1] : cFrames(w)[C_MESH.frames - 2];
      let tx = f.x - f2.x;
      let tz = f.z - f2.z;
      const l = Math.hypot(tx, tz) || 1;
      tx /= l;
      tz /= l;
      t.position.set(f.x - tx * 0.03, H / 2, f.z - tz * 0.03);
      t.rotation.y = Math.atan2(tx, tz);
    }
    screw.rotation.x = w * 16;
  };
  setWidth(0);

  return { group, setWidth };
}
