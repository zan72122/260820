import { Group, Matrix4, Mesh, PointLight, Vector2, Vector3 } from 'three';
import type { MaterialLibrary } from '../materials/Materials';
import { DIM } from './dims';
import { FlumePath, arcBar, buildPlate, hitProxy, revolve } from './geo';

export interface RaftBuild {
  group: Group;
  hull: Group;
  light: PointLight;
  body: Mesh;
}

function torusProfile(major: number, minor: number, steps: number): Vector2[] {
  const pts: Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI * 0.5 + (Math.PI * 2 * i) / steps;
    pts.push(new Vector2(major + Math.cos(a) * minor, Math.sin(a) * minor));
  }
  return pts;
}

/** Two-seat test raft: welded tube, ribbed floor, and a white dummy load. */
export function buildRaft(mats: MaterialLibrary): RaftBuild {
  const group = new Group();
  const hull = new Group();
  group.add(hull);

  const tube = new Mesh(revolve(torusProfile(DIM.raftRadius - 0.2, 0.2, 20), 40), mats.raft);
  tube.castShadow = true;
  tube.receiveShadow = true;
  hull.add(tube);

  // welded seam around the equator
  const seam = new Mesh(revolve(torusProfile(DIM.raftRadius - 0.2, 0.206, 8), 40), mats.epdm);
  seam.scale.set(1, 0.16, 1);
  hull.add(seam);

  const floor = new Mesh(
    revolve(
      [
        new Vector2(0.0, -0.09),
        new Vector2(0.18, -0.1),
        new Vector2(0.34, -0.085),
        new Vector2(0.44, -0.05),
        new Vector2(0.46, 0.0),
      ],
      36,
    ),
    mats.raft,
  );
  floor.receiveShadow = true;
  hull.add(floor);

  for (let i = 0; i < 2; i++) {
    const handle = new Mesh(arcBar(0.1, 0.028, 0.05, 0, 1.5, 12), mats.epdm);
    handle.rotation.z = Math.PI * (i === 0 ? 0.5 : 1.5);
    handle.position.set(Math.cos(i * Math.PI) * (DIM.raftRadius - 0.24), 0.16, 0);
    hull.add(handle);
  }

  const inflation = new Mesh(
    revolve([new Vector2(0, 0), new Vector2(0.03, 0.005), new Vector2(0.03, 0.03), new Vector2(0.02, 0.038)], 12, true),
    mats.epdm,
  );
  inflation.position.set(0, 0.11, DIM.raftRadius - 0.22);
  inflation.rotation.x = -0.5;
  hull.add(inflation);

  // white instrumented test body in place of a rider
  const body = new Mesh(
    buildPlate({ half: 0.19, halfY: 0.19, thickness: 0.46, corner: 0.07, bevel: 0.02, curveSegments: 8 }),
    mats.testBody,
  );
  body.position.y = 0.19;
  body.castShadow = true;
  hull.add(body);
  for (const z of [-0.1, 0.1]) {
    const strap = new Mesh(buildPlate({ half: 0.26, halfY: 0.03, thickness: 0.012, corner: 0.01 }), mats.epdm);
    strap.rotation.x = Math.PI * 0.5;
    strap.position.set(0, 0.2, z);
    hull.add(strap);
  }

  const proxy = new Mesh(hitProxy(0.78), mats.testBody);
  proxy.visible = false;
  proxy.position.y = 0.2;
  group.add(proxy);

  // the colour the raft picks up off the light pattern
  const light = new PointLight(0xffffff, 0, 3.4, 2);
  light.position.set(0, 0.55, 0);
  group.add(light);

  hull.scale.set(1, 0.94, 1);
  return { group, hull, light, body };
}

const _p = new Vector3();
const _f = new Vector3();
const _m = new Matrix4();

/** Rides the bed on rails: no free camera, no free physics. */
export function placeRaft(
  raft: RaftBuild,
  path: FlumePath,
  s: number,
  bank: number,
  sink: number,
): void {
  const theta = Math.PI + bank;
  path.surfacePoint(s, theta, DIM.innerR - 0.30 + sink, _p);
  raft.group.position.copy(_p);
  const f = path.frameAt(s);
  _f.copy(f.t).normalize();
  const up = path.radialDir(s, theta).multiplyScalar(-1);
  const right = new Vector3().crossVectors(_f, up).normalize();
  const trueUp = new Vector3().crossVectors(right, _f).normalize();
  raft.group.quaternion.setFromRotationMatrix(
    _m.makeBasis(right, trueUp, _f.clone().negate()),
  );
}
