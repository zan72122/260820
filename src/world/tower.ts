import * as THREE from 'three';
import { MaterialLibrary } from '../core/materials';
import { BRANCHES, BranchId, PumpSim } from '../sim/state';
import {
  BASIN,
  BRANCH_VALVE,
  LIGHT_SHAFT,
  HEADER_Y,
  ROOM,
  SLIDE_HEAD,
  TOWER_X,
  TOWER_Z,
  V,
  branchCurve,
  headerCurve,
  riserCurve,
  returnCurve,
  slideCurve,
} from './layout';
import { GateValveRig, buildGateValve } from './machine';
import { PipeRun } from './piperun';
import { FlowRibbon, Splash, channelShell } from './flow';
import { channelSection } from './parts';

export interface SlideRig {
  id: BranchId;
  group: THREE.Group;
  shellFill?: PipeRun;
  film: FlowRibbon;
  splash: Splash;
  exit: THREE.Vector3;
  headWorld: THREE.Vector3;
  /** where the camera should sit to see this flume whole */
  viewFrom: THREE.Vector3;
}

export interface TowerWorld {
  group: THREE.Group;
  slideCurves: Record<BranchId, THREE.Curve<THREE.Vector3>>;
  riser: PipeRun;
  header: PipeRun;
  branches: Record<BranchId, PipeRun>;
  branchValves: Record<BranchId, GateValveRig>;
  slides: Record<BranchId, SlideRig>;
  sun: THREE.DirectionalLight;
  update(dt: number, t: number, sim: PumpSim): void;
}

function skyDome(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(190, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x5d86ad) },
      mid: { value: new THREE.Color(0xa9c4d8) },
      bottom: { value: new THREE.Color(0xd8dfe2) },
    },
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vPos; uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;
      void main(){
        float h = normalize(vPos).y;
        vec3 c = mix(bottom, mid, smoothstep(-0.12, 0.28, h));
        c = mix(c, top, smoothstep(0.25, 0.85, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = -1;
  return m;
}

export function buildTower(lib: MaterialLibrary): TowerWorld {
  const group = new THREE.Group();
  group.add(skyDome());

  /* ---------------- deck ---------------- */
  const paved = (w: number, d: number) => {
    const m = lib.paving.clone();
    for (const key of ['map', 'roughnessMap', 'normalMap'] as const) {
      const t = lib.paving[key]!.clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(Math.max(1, w / 4), Math.max(1, d / 4));
      t.needsUpdate = true;
      m[key] = t;
    }
    return m;
  };
  // the deck is a real slab with a hole in it, so the climb out of the basement
  // passes through an opening instead of through a one-sided plane
  const sx0 = LIGHT_SHAFT.x - LIGHT_SHAFT.w / 2;
  const sx1 = LIGHT_SHAFT.x + LIGHT_SHAFT.w / 2;
  const sz0 = LIGHT_SHAFT.z - LIGHT_SHAFT.d / 2;
  const sz1 = LIGHT_SHAFT.z + LIGHT_SHAFT.d / 2;
  const deckSlab = (x0: number, x1: number, z0: number, z1: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.34, z1 - z0), paved(x1 - x0, z1 - z0));
    m.position.set((x0 + x1) / 2, -0.17, (z0 + z1) / 2);
    m.receiveShadow = true;
    m.castShadow = true;
    group.add(m);
  };
  deckSlab(-43, sx0, -53, 37);
  deckSlab(sx1, 47, -53, 37);
  deckSlab(sx0, sx1, -53, sz0);
  deckSlab(sx0, sx1, sz1, 37);
  // kerb round the opening
  for (const [x0, x1, z0, z1] of [
    [sx0 - 0.16, sx1 + 0.16, sz0 - 0.16, sz0],
    [sx0 - 0.16, sx1 + 0.16, sz1, sz1 + 0.16],
    [sx0 - 0.16, sx0, sz0, sz1],
    [sx1, sx1 + 0.16, sz0, sz1],
  ]) {
    const k = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.14, z1 - z0), lib.paintedCast(0xb9b3a4, 1, 0.12));
    k.position.set((x0 + x1) / 2, 0.07, (z0 + z1) / 2);
    k.castShadow = true;
    k.receiveShadow = true;
    group.add(k);
  }

  // distant treeline / buildings: silhouettes that let aerial perspective do its work
  // ground carries on past the paved area so the horizon is land, not a cliff
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x8d9481, roughness: 1, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(2, -0.36, -8);
  ground.receiveShadow = false;
  group.add(ground);

  const farMat = new THREE.MeshStandardMaterial({ color: 0x93a3a6, roughness: 1, metalness: 0 });
  for (let i = 0; i < 26; i++) {
    const a = -0.4 + (i / 26) * Math.PI * 1.8;
    const r = 74 + (i % 4) * 13;
    const h = 5 + ((i * 37) % 13);
    const b = new THREE.Mesh(new THREE.BoxGeometry(6 + (i % 3) * 4, h, 6), farMat);
    b.position.set(2 + Math.cos(a) * r, h / 2, -8 + Math.sin(a) * r);
    b.rotation.y = a;
    group.add(b);
  }
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2;
    const r = 52 + ((i * 13) % 16);
    const h = 6 + ((i * 7) % 6);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, h * 0.45, 6), new THREE.MeshStandardMaterial({ color: 0x5c5346, roughness: 1 }));
    const crown = new THREE.Mesh(new THREE.SphereGeometry(h * 0.42, 8, 6), new THREE.MeshStandardMaterial({ color: 0x62805a, roughness: 1 }));
    const x = 2 + Math.cos(a) * r;
    const z = -8 + Math.sin(a) * r;
    trunk.position.set(x, h * 0.22, z);
    crown.position.set(x, h * 0.62, z);
    crown.scale.y = 1.25;
    group.add(trunk, crown);
  }

  /* ---------------- tower structure ---------------- */
  const towerMat = lib.paintedSteel(0xb3b9bd, 0.55, 0.32);
  // long members need their own tiling or the paint smears into vertical streaks
  const towerColumn = lib.retile(towerMat, 2, 18);
  const towerBeam = lib.retile(towerMat, 8, 1);
  const core = new THREE.Mesh(new THREE.BoxGeometry(2.1, HEADER_Y + 1.6, 2.1), lib.retile(lib.concrete, 2, 12));
  core.position.set(TOWER_X - 1.2, (HEADER_Y + 1.6) / 2, TOWER_Z + 3.3);
  core.castShadow = true;
  core.receiveShadow = true;
  group.add(core);

  for (const [ox, oz] of [
    [1.9, -1.9],
    [1.9, 2.4],
    [-2.6, 2.4],
    [-2.6, -1.9],
  ]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, HEADER_Y + 1.2, 12), towerColumn);
    col.position.set(TOWER_X + ox, (HEADER_Y + 1.2) / 2, TOWER_Z + oz);
    col.castShadow = true;
    col.receiveShadow = true;
    group.add(col);
  }
  const CORNERS: [number, number][] = [
    [1.9, -1.9],
    [1.9, 2.4],
    [-2.6, 2.4],
    [-2.6, -1.9],
  ];
  const LEVELS = 5;
  const RISE = HEADER_Y / (LEVELS + 0.4);
  for (let level = 1; level <= LEVELS; level++) {
    const y = level * RISE;
    for (let i = 0; i < CORNERS.length; i++) {
      const [x0, z0] = CORNERS[i];
      const [x1, z1] = CORNERS[(i + 1) % CORNERS.length];
      const len = Math.hypot(x1 - x0, z1 - z0);
      const beam = channelSection(len, 0.09, 0.15, towerBeam);
      beam.position.set(TOWER_X + (x0 + x1) / 2, y, TOWER_Z + (z0 + z1) / 2);
      beam.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      group.add(beam);
      // a single diagonal per bay, alternating hand — how a braced frame is built
      if ((i + level) % 2 === 0) {
        const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, Math.hypot(len, RISE), 8), towerBeam);
        brace.position.set(TOWER_X + (x0 + x1) / 2, y - RISE / 2, TOWER_Z + (z0 + z1) / 2);
        brace.rotation.z = Math.atan2(len, RISE) * (level % 2 ? 1 : -1);
        brace.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
        brace.castShadow = true;
        group.add(brace);
      }
    }
  }

  // stair flights up the tower — human scale against the machine
  const FLIGHTS = 7;
  for (let f = 0; f < FLIGHTS; f++) {
    const flight = new THREE.Group();
    const rise = 1.9;
    const run = 2.3;
    const slope = Math.hypot(rise, run);
    for (let st = 0; st < 9; st++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.045, 0.27), lib.galvanised);
      step.position.set(0, ((st + 1) * rise) / 9, (-st * run) / 9);
      step.castShadow = true;
      step.receiveShadow = true;
      flight.add(step);
    }
    for (const side of [-1, 1]) {
      const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.22, slope), lib.galvanised);
      stringer.position.set(side * 0.6, rise / 2 - 0.08, -run / 2);
      stringer.rotation.x = -Math.atan2(rise, run);
      stringer.castShadow = true;
      flight.add(stringer);
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, slope, 8), lib.galvanised);
      rail.position.set(side * 0.6, rise / 2 + 0.95, -run / 2);
      rail.rotation.x = -Math.atan2(rise, run) + Math.PI / 2;
      rail.castShadow = true;
      flight.add(rail);
      for (let pIdx = 0; pIdx < 3; pIdx++) {
        const u = pIdx / 2;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 6), lib.galvanised);
        post.position.set(side * 0.6, u * rise + 0.46, -u * run);
        flight.add(post);
      }
    }
    const landing = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.05, 1.15), lib.galvanised);
    landing.position.set(0, rise, -run - 0.55);
    landing.castShadow = true;
    landing.receiveShadow = true;
    flight.add(landing);
    // stairs live on the far side of the spine, clear of the climb the camera makes
    flight.position.set(TOWER_X - 2.45, f * rise, TOWER_Z + (f % 2 ? 0.6 : 3.5));
    flight.rotation.y = f % 2 ? Math.PI : 0;
    group.add(flight);
  }

  // top platform
  const platform = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.12, 5.6), lib.galvanised);
  platform.position.set(TOWER_X - 0.3, HEADER_Y - 2.1, TOWER_Z - 2.0);
  platform.castShadow = true;
  platform.receiveShadow = true;
  group.add(platform);
  for (let i = 0; i < 16; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8), lib.galvanised);
    const a = (i / 16) * Math.PI * 2;
    post.position.set(TOWER_X - 0.3 + Math.cos(a) * 2.6, HEADER_Y - 1.5, TOWER_Z - 2.0 + Math.sin(a) * 2.7);
    post.castShadow = true;
    group.add(post);
  }

  /* ---------------- riser, header, branches ---------------- */
  const riser = new PipeRun(lib, riserCurve(), {
    radius: 0.26,
    kind: 'blue',
    cutaways: [
      { t0: 0.1, t1: 0.17 },
      { t0: 0.36, t1: 0.43 },
      { t0: 0.72, t1: 0.79 },
    ],
    windowStyle: 'clear',
    tubular: 150,
  });
  group.add(riser.group);
  // guides fixing the riser to the tower spine
  for (let i = 1; i < 9; i++) {
    const p = riserCurve().getPointAt(i / 9);
    const clamp = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.028, 6, 20), lib.stainlessRough);
    clamp.rotation.x = Math.PI / 2;
    clamp.position.copy(p);
    clamp.castShadow = true;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.06), lib.stainlessRough);
    arm.position.set(p.x - 0.5, p.y, p.z + 0.6);
    arm.rotation.y = -0.9;
    arm.castShadow = true;
    group.add(clamp, arm);
  }

  const header = new PipeRun(lib, headerCurve(), {
    radius: 0.26,
    kind: 'blue',
    cutaways: [{ t0: 0.2, t1: 0.34 }],
    windowStyle: 'clear',
    tubular: 60,
  });
  group.add(header.group);

  const branches = {} as Record<BranchId, PipeRun>;
  const branchValves = {} as Record<BranchId, GateValveRig>;
  const wheelColors: Record<BranchId, number> = { A: 0x2f6fa8, B: 0xb8863a, C: 0x3f7a4a };
  for (const b of BRANCHES) {
    const run = new PipeRun(lib, branchCurve(b), {
      radius: 0.2,
      kind: 'blue',
      cutaways: [{ t0: 0.55, t1: 0.72 }],
      windowStyle: 'clear',
      tubular: 70,
    });
    branches[b] = run;
    group.add(run.group);

    const valve = buildGateValve(lib, {
      bore: 0.2,
      wheelRadius: 0.36,
      wheelColor: wheelColors[b],
      axis: b === 'C' ? 'z' : 'x',
      cutaway: false,
      // leaned towards the platform so each wheel reads as a wheel, not a disc
      incline: 0.5,
    });
    valve.group.position.copy(branchCurve(b).getPointAt(0.2));
    void BRANCH_VALVE;
    branchValves[b] = valve;
    group.add(valve.group);
  }

  /* ---------------- flumes ---------------- */
  const slides = {} as Record<BranchId, SlideRig>;
  const slideCurves = {} as Record<BranchId, THREE.Curve<THREE.Vector3>>;

  const filmMat = () => {
    const m = lib.waterFilm.clone();
    m.normalMap = lib.waterFilm.normalMap!.clone();
    m.normalMap.wrapS = m.normalMap.wrapT = THREE.RepeatWrapping;
    m.normalMap.repeat.set(1.2, 26);
    m.normalMap.needsUpdate = true;
    return m;
  };
  const dropletMat = new THREE.MeshStandardMaterial({
    color: 0xcfe9f5,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.8,
  });

  // A — long blue closed tube with clear inspection sections
  {
    const curve = slideCurve('A');
    const shell = new PipeRun(lib, curve, {
      radius: 0.62,
      kind: 'slide',
      cutaways: [
        { t0: 0.18, t1: 0.26 },
        { t0: 0.52, t1: 0.6 },
        { t0: 0.84, t1: 0.93 },
      ],
      windowStyle: 'clear',
      tubular: 170,
      radialSegments: 20,
    });
    const g = new THREE.Group();
    g.add(shell.group);
    const film = new FlowRibbon(curve, 0.5, filmMat(), 150, 6);
    g.add(film.mesh);
    // supports down to the deck
    for (let i = 1; i < 8; i++) {
      const p = curve.getPointAt(i / 8);
      if (p.y < 1.2) continue;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, p.y, 10), towerColumn);
      leg.position.set(p.x + 0.35, p.y / 2, p.z + 0.35);
      leg.castShadow = true;
      leg.receiveShadow = true;
      g.add(leg);
    }
    const exit = curve.getPointAt(1);
    const splash = new Splash(exit.clone().add(V(0, -0.2, 0)), 26, dropletMat, 1.1);
    g.add(splash.mesh);
    group.add(g);
    slideCurves.A = curve;
    slides.A = {
      id: 'A',
      group: g,
      shellFill: shell,
      film,
      splash,
      exit,
      headWorld: SLIDE_HEAD.A.clone(),
      viewFrom: V(22, 9.5, -19),
    };
  }

  // B — short translucent tube: the water column is simply visible through it
  {
    const curve = slideCurve('B');
    const g = new THREE.Group();
    const shellMat = lib.glassLite.clone();
    shellMat.color = new THREE.Color(0x9ad8e4);
    shellMat.opacity = 0.6;
    shellMat.depthWrite = true;
    const shell = new PipeRun(lib, curve, {
      radius: 0.58,
      kind: 'grey',
      shellMaterial: shellMat,
      tubular: 110,
      radialSegments: 20,
    });
    g.add(shell.group);
    // joint rings every couple of metres give the translucent tube its structure
    for (let i = 0; i <= 10; i++) {
      const p = curve.getPointAt(i / 10);
      const tan = curve.getTangentAt(i / 10);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.045, 8, 24), lib.paintedSteel(0xc9d2d6, 0.45, 0.35));
      ring.position.copy(p);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
      ring.castShadow = true;
      g.add(ring);
    }
    const film = new FlowRibbon(curve, 0.46, filmMat(), 120, 6);
    g.add(film.mesh);
    for (let i = 1; i < 5; i++) {
      const p = curve.getPointAt(i / 5);
      if (p.y < 1.2) continue;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, p.y, 10), towerColumn);
      leg.position.set(p.x - 0.3, p.y / 2, p.z + 0.3);
      leg.castShadow = true;
      g.add(leg);
    }
    const exit = curve.getPointAt(1);
    const splash = new Splash(exit.clone().add(V(0, -0.2, 0)), 22, dropletMat, 1.0);
    g.add(splash.mesh);
    group.add(g);
    slideCurves.B = curve;
    slides.B = {
      id: 'B',
      group: g,
      shellFill: shell,
      film,
      splash,
      exit,
      headWorld: SLIDE_HEAD.B.clone(),
      viewFrom: V(-14, 9.0, -19),
    };
  }

  // C — wide open raft channel
  {
    const curve = slideCurve('C');
    const g = new THREE.Group();
    const flumeMat = lib.flumeShell.clone();
    flumeMat.color = new THREE.Color(0xeef4f5);
    const shell = channelShell(curve, 0.88, 1.6, flumeMat, 130, 14);
    g.add(shell);
    // coping rolled over both rims so the open flume reads as a moulded shell
    const coping = lib.flumeShell.clone();
    coping.color = new THREE.Color(0x2f78a8);
    coping.roughness = 0.28;
    for (const s of [-1, 1]) {
      g.add(channelShell(curve, 0.93, 0.19, coping, 130, 4, s * 1.63));
    }
    const film = new FlowRibbon(curve, 0.84, filmMat(), 130, 8);
    g.add(film.mesh);
    for (let i = 1; i < 6; i++) {
      const p = curve.getPointAt(i / 6);
      if (p.y < 1.4) continue;
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, p.y, 10), towerColumn);
        leg.position.set(p.x + s * 0.7, p.y / 2, p.z);
        leg.castShadow = true;
        leg.receiveShadow = true;
        g.add(leg);
      }
    }
    const exit = curve.getPointAt(1);
    const splash = new Splash(exit.clone().add(V(0, -0.2, 0)), 30, dropletMat, 1.6);
    g.add(splash.mesh);
    group.add(g);
    slideCurves.C = curve;
    slides.C = {
      id: 'C',
      group: g,
      film,
      splash,
      exit,
      headWorld: SLIDE_HEAD.C.clone(),
      viewFrom: V(5.2, 8.5, -31),
    };
  }

  /* ---------------- a little life on the deck ---------------- */
  const parasolPole = lib.retile(lib.stainlessRough, 1, 8);
  const canvasMat = new THREE.MeshStandardMaterial({ color: 0xb5695a, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  const loungeMat = new THREE.MeshStandardMaterial({ color: 0xd8d3c6, roughness: 0.8, metalness: 0 });
  for (const [px, pz, rot] of [
    [-9.5, -18.5, 0.4],
    [16.5, -17.0, -0.5],
  ]) {
    const set = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 2.4, 10), parasolPole);
    pole.position.y = 1.2;
    pole.castShadow = true;
    set.add(pole);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.45, 0.9, 10, 1, true), canvasMat);
    canopy.position.y = 2.35;
    canopy.castShadow = true;
    set.add(canopy);
    for (const dx of [-0.85, 0.85]) {
      const lounger = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.09, 1.85), loungeMat);
      lounger.position.set(dx, 0.36, 0.25);
      lounger.rotation.x = -0.1;
      lounger.castShadow = true;
      lounger.receiveShadow = true;
      set.add(lounger);
      for (const lz of [-0.7, 0.7]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.34, 6), parasolPole);
        leg.position.set(dx, 0.17, 0.25 + lz);
        set.add(leg);
      }
    }
    set.position.set(px, 0, pz);
    set.rotation.y = rot;
    group.add(set);
  }
  // a low boundary rail so the paved area reads as a place, not a plain
  const fenceMat = lib.retile(lib.galvanised, 30, 1);
  for (const [x0, z0, x1, z1] of [
    [-24, -30, 26, -30],
    [26, -30, 26, 10],
    [-24, -30, -24, 10],
  ]) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    for (const hy of [1.05, 0.6]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 6), fenceMat);
      bar.position.set((x0 + x1) / 2, hy, (z0 + z1) / 2);
      bar.rotation.z = Math.PI / 2;
      bar.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      group.add(bar);
    }
    const posts = Math.round(len / 3);
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.15, 6), fenceMat);
      post.position.set(x0 + (x1 - x0) * t, 0.575, z0 + (z1 - z0) * t);
      post.castShadow = true;
      group.add(post);
    }
  }

  /* ---------------- run-out pool and the way home ---------------- */
  const basin = new THREE.Group();
  const bx0 = BASIN.x - BASIN.w / 2;
  const bx1 = BASIN.x + BASIN.w / 2;
  const bz0 = BASIN.z - BASIN.d / 2;
  const bz1 = BASIN.z + BASIN.d / 2;
  const copingMat = lib.retile(lib.paving, 6, 2);
  const tileMat = lib.retile(lib.paintedCast(0x74b3cf, 0.34, 0.06), 12, 6);
  const rim = (x0: number, x1: number, z0: number, z1: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.46, z1 - z0), copingMat);
    m.position.set((x0 + x1) / 2, 0.23, (z0 + z1) / 2);
    m.castShadow = true;
    m.receiveShadow = true;
    basin.add(m);
  };
  rim(bx0 - 0.34, bx0, bz0 - 0.34, bz1 + 0.34);
  rim(bx1, bx1 + 0.34, bz0 - 0.34, bz1 + 0.34);
  rim(bx0, bx1, bz0 - 0.34, bz0);
  rim(bx0, bx1, bz1, bz1 + 0.34);
  const poolFloor = new THREE.Mesh(new THREE.BoxGeometry(BASIN.w, 0.08, BASIN.d), tileMat);
  poolFloor.position.set(BASIN.x, 0.04, BASIN.z);
  poolFloor.receiveShadow = true;
  basin.add(poolFloor);
  const poolWaterMat = lib.waterBody.clone();
  poolWaterMat.normalMap = lib.waterBody.normalMap!.clone();
  poolWaterMat.normalMap.wrapS = poolWaterMat.normalMap.wrapT = THREE.RepeatWrapping;
  poolWaterMat.normalMap.needsUpdate = true;
  poolWaterMat.metalness = 0.12;
  poolWaterMat.roughness = 0.045;
  poolWaterMat.normalScale.set(0.5, 0.5);
  poolWaterMat.envMapIntensity = 1.9;
  const basinWater = new THREE.Mesh(
    new THREE.PlaneGeometry(BASIN.w - 0.04, BASIN.d - 0.04, 26, 14),
    poolWaterMat,
  );
  basinWater.rotation.x = -Math.PI / 2;
  basinWater.position.set(BASIN.x, 0.42, BASIN.z);
  (basinWater.material as THREE.MeshStandardMaterial).normalMap!.repeat.set(11, 5);
  (basinWater.material as THREE.MeshStandardMaterial).opacity = 0.9;
  (basinWater.material as THREE.MeshStandardMaterial).color = new THREE.Color(0x186a92);
  basinWater.visible = false;
  basin.add(basinWater);
  // overflow channel along the pool edge — where the water starts its way home
  const gutter = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, BASIN.d), lib.stainlessRough);
  gutter.position.set(bx0 - 0.72, 0.16, BASIN.z);
  gutter.castShadow = true;
  basin.add(gutter);
  group.add(basin);

  const returnRun = new PipeRun(lib, returnCurve(), {
    radius: 0.34,
    kind: 'green',
    cutaways: [
      { t0: 0.1, t1: 0.17 },
      { t0: 0.42, t1: 0.5 },
    ],
    windowStyle: 'clear',
    supports: [0.06, 0.24, 0.36],
    supportHeight: 0.42,
    tubular: 140,
  });
  group.add(returnRun.group);

  /* ---------------- sun ---------------- */
  const sun = new THREE.DirectionalLight(0xffeacd, 3.9);
  sun.position.set(34, 34, -18);
  sun.target.position.set(TOWER_X + 1, 6, TOWER_Z - 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 4;
  sun.shadow.camera.far = 110;
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 26;
  sun.shadow.camera.bottom = -12;
  sun.shadow.bias = -0.0009;
  sun.shadow.normalBias = 0.03;
  group.add(sun, sun.target);
  group.add(new THREE.HemisphereLight(0xc6dcf0, 0x7c7563, 1.5));

  const basinMat = basinWater.material as THREE.MeshStandardMaterial;

  return {
    group,
    slideCurves,
    riser,
    header,
    branches,
    branchValves,
    slides,
    sun,
    update(_dt, t, sim) {
      riser.setFill(sim.segments.riser.fill, t, sim.riserFlow);
      header.setFill(sim.segments.topHeader.fill, t, sim.riserFlow);
      let returning = 0;
      for (const b of BRANCHES) {
        const seg = sim.segments[`branch${b}`];
        branches[b].setFill(seg.fill, t, sim.branchFlow[b]);
        branchValves[b].setOpen(sim.valves[b].open, sim.valves[b].wheelAngle);
        const slide = sim.slides[b];
        const rig = slides[b];
        rig.film.setState(slide.front, slide.film, t, 0.6 + sim.branchFlow[b] * 2.4);
        if (rig.shellFill) rig.shellFill.setFill(slide.front, t, sim.branchFlow[b]);
        const out = slide.front > 0.985 ? slide.film : 0;
        rig.splash.update(t, out);
        returning += out;
      }
      returnRun.setFill(returning > 0.05 ? 1 : 0, t, returning);
      const agitation = 0.3 + Math.min(1.4, returning * 1.4);
      basinMat.normalMap!.offset.set(Math.sin(t * 0.3) * 0.04, -t * 0.09 * agitation);
      basinMat.normalScale.set(0.4 * agitation, 0.4 * agitation);
      // the pool starts dry: it is filled by the water the child sent up
      basinWater.visible = sim.poolLevel > 0.01;
      basinWater.position.y = 0.09 + sim.poolLevel * 0.3 + Math.sin(t * 1.1) * 0.008 * agitation;
      void ROOM;
    },
  };
}
