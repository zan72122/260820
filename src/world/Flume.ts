import { Group, Matrix4, Mesh, Object3D, Vector2, Vector3 } from 'three';
import type { MaterialLibrary } from '../materials/Materials';
import type { QualitySettings } from '../core/Quality';
import { DIM, FLUME_POINTS } from './dims';
import {
  FlumePath,
  arcBar,
  beam,
  buildBedSurface,
  buildPlate,
  buildRib,
  buildShell,
  revolve,
} from './geo';

export interface FlumeBuild {
  group: Group;
  path: FlumePath;
  bed: Mesh;
  sStart: number;
  sEnd: number;
  /** local frame of the test port, +Y along the port normal */
  portRoot: Object3D;
  windowThetaHalf: number;
}

/**
 * The short, full-size test flume: a cut-away length of production shell on
 * steel cradles, with one machined test port on the upper far quadrant.
 */
export function buildFlume(mats: MaterialLibrary, q: QualitySettings): FlumeBuild {
  const group = new Group();
  const path = new FlumePath(FLUME_POINTS.map((p) => new Vector3(...p)));
  const Ri = DIM.innerR;
  const Ro = Ri + DIM.wall;
  const sStart = 3.0;
  const sEnd = path.length - 1.6;

  const thetaHalf = Math.asin(DIM.windowHalf / Ri);
  const win = {
    s0: DIM.portS - DIM.windowHalf,
    s1: DIM.portS + DIM.windowHalf,
    th0: DIM.portTheta - thetaHalf,
    th1: DIM.portTheta + thetaHalf,
  };

  const shellArgs = {
    path,
    innerR: Ri,
    thickness: DIM.wall,
    thetaStart: DIM.thetaStart,
    thetaLength: DIM.thetaLength,
    sMin: sStart,
    sMax: sEnd,
    segsAlong: q.tubeSegmentsAlong,
    segsAround: q.tubeSegmentsAround,
    window: win,
  } as const;

  const outer = new Mesh(buildShell({ ...shellArgs, side: 'outer' }), mats.frpOuter);
  const inner = new Mesh(buildShell({ ...shellArgs, side: 'inner' }), mats.frpInner);
  const edges = new Mesh(buildShell({ ...shellArgs, side: 'edges' }), mats.frpCut);
  outer.castShadow = true;
  outer.receiveShadow = true;
  inner.receiveShadow = true;
  group.add(outer, inner, edges);

  // moulded joint flanges where production sections would bolt together
  const ribProfile = [
    new Vector2(-0.16, Ro),
    new Vector2(-0.1, Ro + 0.035),
    new Vector2(-0.05, Ro + 0.052),
    new Vector2(0.05, Ro + 0.052),
    new Vector2(0.1, Ro + 0.035),
    new Vector2(0.16, Ro),
  ];
  for (const sr of [sStart + 7.5, sEnd - 3.4]) {
    const rib = new Mesh(
      buildRib(path, sr, ribProfile, DIM.thetaStart, DIM.thetaLength, Math.max(24, q.tubeSegmentsAround >> 1)),
      mats.frpRib,
    );
    rib.castShadow = true;
    group.add(rib);
  }

  // mouth trims: a thicker moulded lip at each open end
  for (const [se, dir] of [
    [sStart, 1],
    [sEnd, -1],
  ] as Array<[number, number]>) {
    const lip = [
      new Vector2(0, Ro),
      new Vector2(dir * 0.05, Ro + 0.028),
      new Vector2(dir * 0.14, Ro + 0.03),
      new Vector2(dir * 0.16, Ri - 0.01),
      new Vector2(dir * 0.02, Ri - 0.012),
    ];
    const trim = new Mesh(
      buildRib(path, se, lip, DIM.thetaStart, DIM.thetaLength, Math.max(24, q.tubeSegmentsAround >> 1)),
      mats.frpRib,
    );
    group.add(trim);
  }

  // the wetted bed
  const bedGeo = buildBedSurface(
    path,
    Ri - DIM.filmDepth,
    Math.PI,
    DIM.bedHalfAngle,
    1.0,
    sEnd - 0.1,
    q.waterSegments,
    Math.max(10, q.tubeSegmentsAround >> 2),
  );
  const bed = new Mesh(bedGeo, mats.water);
  bed.renderOrder = 3;
  bed.visible = false;
  group.add(bed);

  group.add(buildCradles(path, mats, sStart, sEnd));

  // ---- test port frame -------------------------------------------------
  const portRoot = new Object3D();
  const p = path.surfacePoint(DIM.portS, DIM.portTheta, Ro);
  const n = path.radialDir(DIM.portS, DIM.portTheta);
  const f = path.frameAt(DIM.portS);
  const xAxis = f.t.clone().normalize();
  const yAxis = n.clone().normalize();
  const zAxis = new Vector3().crossVectors(xAxis, yAxis).normalize();
  xAxis.crossVectors(yAxis, zAxis).normalize();
  portRoot.position.copy(p);
  portRoot.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(xAxis, yAxis, zAxis));
  group.add(portRoot);

  return { group, path, bed, sStart, sEnd, portRoot, windowThetaHalf: thetaHalf };
}

/** Steel cradles: vertical legs, base plates, a padded saddle strap. */
function buildCradles(path: FlumePath, mats: MaterialLibrary, sStart: number, sEnd: number): Group {
  const g = new Group();
  const count = 4;
  const Ro = DIM.innerR + DIM.wall;
  for (let i = 0; i < count; i++) {
    const s = sStart + 1.1 + ((sEnd - sStart - 2.2) * i) / (count - 1);
    const f = path.frameAt(s);
    const cradle = new Group();
    cradle.position.set(f.p.x, 0, f.p.z);
    cradle.rotation.y = Math.atan2(f.t.x, f.t.z);
    const axisY = f.p.y;

    for (const side of [-1, 1]) {
      const legH = axisY - Ro * 0.55;
      const leg = new Mesh(beam(0.12, legH, 0.12), mats.steelDark);
      leg.position.set(side * 0.78, legH * 0.5, 0);
      leg.castShadow = true;
      cradle.add(leg);

      const foot = new Mesh(buildPlate({ half: 0.17, thickness: 0.026, corner: 0.03 }), mats.steel);
      foot.position.set(side * 0.78, 0.014, 0);
      foot.receiveShadow = true;
      cradle.add(foot);
      for (const bx of [-1, 1]) {
        for (const bz of [-1, 1]) {
          const bolt = new Mesh(BOLT_GEO, mats.steel);
          bolt.position.set(side * 0.78 + bx * 0.11, 0.026, bz * 0.11);
          cradle.add(bolt);
        }
      }
      // gusset where the leg meets the saddle beam
      const gusset = new Mesh(buildPlate({ half: 0.16, thickness: 0.012, corner: 0.05 }), mats.steelDark);
      gusset.rotation.z = Math.PI * 0.5;
      gusset.position.set(side * 0.78, legH - 0.09, 0);
      cradle.add(gusset);
    }

    const brace = new Mesh(beam(1.62, 0.09, 0.09), mats.steelDark);
    brace.position.set(0, axisY * 0.42, 0);
    cradle.add(brace);

    const strap = new Mesh(arcBar(Ro + 0.008, 0.05, 0.17, Math.PI, 1.05, 28), mats.steelDark);
    strap.position.set(0, axisY, 0);
    strap.castShadow = true;
    cradle.add(strap);
    const pad = new Mesh(arcBar(Ro + 0.001, 0.008, 0.19, Math.PI, 1.06, 28), mats.epdm);
    pad.position.set(0, axisY, 0);
    cradle.add(pad);
    g.add(cradle);
  }
  return g;
}

const BOLT_GEO = revolve(
  [
    new Vector2(0, 0),
    new Vector2(0.019, 0),
    new Vector2(0.019, 0.014),
    new Vector2(0.014, 0.02),
  ],
  10,
  true,
);
