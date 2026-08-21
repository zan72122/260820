import { Group, Mesh, PlaneGeometry, Vector2 } from 'three';
import type { MaterialLibrary } from '../materials/Materials';
import { beam, buildPlate, revolve } from './geo';
import type { FlumePath } from './geo';

/** The test apron: poured concrete, a drain line, cable ducts. */
export function buildGround(mats: MaterialLibrary, path: FlumePath): Group {
  const g = new Group();

  const apron = new Mesh(new PlaneGeometry(86, 86), mats.concrete);
  apron.rotation.x = -Math.PI * 0.5;
  apron.receiveShadow = true;
  g.add(apron);

  const field = new Mesh(new PlaneGeometry(600, 600), mats.grass);
  field.rotation.x = -Math.PI * 0.5;
  field.position.y = -0.06;
  g.add(field);

  // drain channel running beside the flume, with a grating
  const startF = path.frameAt(2.0);
  const endF = path.frameAt(path.length - 2.0);
  const len = startF.p.distanceTo(endF.p);
  const mid = startF.p.clone().add(endF.p).multiplyScalar(0.5);
  const yaw = Math.atan2(endF.p.x - startF.p.x, endF.p.z - startF.p.z);

  const channel = new Group();
  channel.position.set(mid.x + Math.cos(yaw) * 1.9, 0, mid.z - Math.sin(yaw) * 1.9);
  channel.rotation.y = yaw;
  const trough = new Mesh(beam(0.42, 0.16, len), mats.darkTrim);
  trough.position.y = -0.06;
  channel.add(trough);
  for (let i = 0; i < Math.floor(len / 0.22); i++) {
    const bar = new Mesh(beam(0.4, 0.02, 0.05), mats.steel);
    bar.position.set(0, 0.015, -len * 0.5 + 0.16 + i * 0.22);
    channel.add(bar);
  }
  g.add(channel);

  // cable duct + junction box, the small stuff that gives scale
  const duct = new Mesh(beam(0.26, 0.12, len * 0.6), mats.darkTrim);
  duct.position.set(mid.x - Math.cos(yaw) * 2.6, 0.06, mid.z + Math.sin(yaw) * 2.6);
  duct.rotation.y = yaw;
  g.add(duct);

  for (let i = 0; i < 3; i++) {
    const bollard = new Mesh(
      revolve(
        [
          new Vector2(0.07, 0),
          new Vector2(0.07, 0.62),
          new Vector2(0.055, 0.68),
          new Vector2(0.0, 0.7),
        ],
        14,
        true,
      ),
      mats.paint,
    );
    bollard.position.set(mid.x - Math.cos(yaw) * 3.6 + i * 0.2, 0, mid.z + Math.sin(yaw) * 3.6 + (i - 1) * 3.4);
    bollard.castShadow = true;
    g.add(bollard);
  }

  const pallet = new Mesh(buildPlate({ half: 0.62, halfY: 0.5, thickness: 0.11, corner: 0.03 }), mats.darkTrim);
  pallet.position.set(mid.x + Math.cos(yaw) * 4.6, 0.055, mid.z - Math.sin(yaw) * 4.6);
  pallet.rotation.y = yaw + 0.3;
  pallet.receiveShadow = true;
  g.add(pallet);

  return g;
}
