import { Group, Mesh, Object3D, Vector2 } from 'three';
import type { MaterialLibrary } from '../materials/Materials';
import { beam, buildPlate, hitProxy, revolve } from './geo';

export interface ValveBuild {
  group: Group;
  /** pull-down lever; rotation.z +0.95 = shut, -0.45 = wide open */
  lever: Group;
  needle: Group;
  gripWorld: Group;
  nozzle: Object3D;
}

/** Supply header and the quarter-turn lever that lets the water in. */
export function buildValve(mats: MaterialLibrary): ValveBuild {
  const group = new Group();

  const basePlate = new Mesh(buildPlate({ half: 0.24, thickness: 0.03, corner: 0.04 }), mats.steel);
  basePlate.position.y = 0.015;
  basePlate.receiveShadow = true;
  group.add(basePlate);

  const riser = new Mesh(
    revolve(
      [
        new Vector2(0.09, 0.03),
        new Vector2(0.09, 0.08),
        new Vector2(0.072, 0.1),
        new Vector2(0.072, 0.92),
        new Vector2(0.086, 0.95),
        new Vector2(0.086, 1.02),
      ],
      28,
    ),
    mats.steel,
  );
  riser.castShadow = true;
  group.add(riser);

  const body = new Mesh(
    revolve(
      [
        new Vector2(0.086, 1.02),
        new Vector2(0.13, 1.06),
        new Vector2(0.135, 1.2),
        new Vector2(0.12, 1.26),
        new Vector2(0.086, 1.3),
        new Vector2(0.086, 1.42),
      ],
      28,
    ),
    mats.paint,
  );
  body.castShadow = true;
  group.add(body);

  const bonnet = new Mesh(
    revolve(
      [
        new Vector2(0.0, 1.42),
        new Vector2(0.062, 1.42),
        new Vector2(0.062, 1.47),
        new Vector2(0.03, 1.5),
        new Vector2(0.03, 1.55),
      ],
      20,
    ),
    mats.steel,
  );
  group.add(bonnet);

  // lever: a long stainless bar with a moulded grip
  const lever = new Group();
  lever.position.y = 1.52;
  const arm = new Mesh(beam(0.5, 0.03, 0.07), mats.steel);
  arm.position.set(0.2, 0, 0);
  arm.castShadow = true;
  lever.add(arm);
  const grip = new Mesh(
    revolve(
      [
        new Vector2(0.0, -0.02),
        new Vector2(0.042, 0.0),
        new Vector2(0.05, 0.05),
        new Vector2(0.042, 0.1),
        new Vector2(0.0, 0.115),
      ],
      18,
    ),
    mats.epdm,
  );
  grip.position.set(0.44, -0.05, 0);
  lever.add(grip);
  const boss = new Mesh(
    revolve([new Vector2(0, -0.045), new Vector2(0.055, -0.045), new Vector2(0.055, 0.045), new Vector2(0, 0.045)], 16),
    mats.steel,
  );
  boss.rotation.x = Math.PI * 0.5;
  lever.add(boss);
  lever.rotation.z = 0.95;
  group.add(lever);

  // pressure gauge — the physical read-out for how hard the water is running
  const gaugeMount = new Mesh(
    revolve([new Vector2(0, 0), new Vector2(0.022, 0), new Vector2(0.022, 0.1), new Vector2(0, 0.1)], 12),
    mats.steel,
  );
  gaugeMount.position.set(0.1, 1.12, 0);
  gaugeMount.rotation.z = -0.9;
  group.add(gaugeMount);
  const dial = new Mesh(
    revolve(
      [
        new Vector2(0, 0.0),
        new Vector2(0.075, 0.0),
        new Vector2(0.082, 0.012),
        new Vector2(0.078, 0.03),
        new Vector2(0.0, 0.032),
      ],
      24,
      true,
    ),
    mats.steel,
  );
  dial.position.set(0.175, 1.19, 0);
  dial.rotation.z = -0.9;
  group.add(dial);
  const face = new Mesh(buildPlate({ half: 0.066, thickness: 0.004, corner: 0.066 }), mats.testBody);
  face.position.set(0.184, 1.2, 0);
  face.rotation.z = -0.9 + Math.PI * 0.5;
  face.rotation.order = 'ZYX';
  group.add(face);
  const needleMount = new Group();
  needleMount.position.set(0.186, 1.203, 0);
  needleMount.rotation.z = -0.9;
  const needle = new Group();
  needleMount.add(needle);
  const needleBar = new Mesh(beam(0.052, 0.0035, 0.007), mats.paint);
  needleBar.position.set(0.021, 0.006, 0);
  needle.add(needleBar);
  const hubMesh = new Mesh(
    revolve([new Vector2(0, 0), new Vector2(0.009, 0), new Vector2(0.009, 0.008), new Vector2(0, 0.009)], 10, true),
    mats.steelDark,
  );
  needle.add(hubMesh);
  group.add(needleMount);
  for (let i = 0; i <= 8; i++) {
    const a = -2.3 + (i / 8) * 2.7;
    const tick = new Mesh(beam(0.012, 0.002, 0.004), mats.darkTrim);
    tick.position.set(Math.cos(a) * 0.05, 0.005, Math.sin(a) * 0.05);
    needleMount.add(tick);
  }

  // spreader header over the flume mouth
  const header = new Group();
  header.position.set(0, 1.42, 0);
  const cross = new Mesh(
    revolve([new Vector2(0.086, 0), new Vector2(0.086, 1.46), new Vector2(0.07, 1.5)], 20),
    mats.steel,
  );
  cross.rotation.z = -Math.PI * 0.5;
  header.add(cross);
  const spread = new Mesh(beam(0.9, 0.14, 0.2), mats.steel);
  spread.position.set(1.36, -0.06, 0);
  spread.castShadow = true;
  header.add(spread);
  const lipPad = new Mesh(beam(0.86, 0.03, 0.05), mats.epdm);
  lipPad.position.set(1.36, -0.14, 0.09);
  header.add(lipPad);
  group.add(header);

  const nozzle = new Object3D();
  nozzle.position.set(1.36, 1.29, 0.06);
  group.add(nozzle);

  const leverProxy = new Mesh(hitProxy(0.34), mats.steel);
  leverProxy.visible = false;
  leverProxy.position.set(0.4, 0, 0);
  lever.add(leverProxy);

  const gripWorld = new Group();
  grip.getWorldPosition(gripWorld.position);
  lever.add(gripWorld);
  gripWorld.position.set(0.44, 0, 0);

  return { group, lever, needle, nozzle, gripWorld };
}
