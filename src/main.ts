import * as THREE from 'three';
import { Engine } from './core/engine';
import { MaterialLibrary } from './core/materials';
import { PumpSim, BRANCHES, BranchId } from './sim/state';
import { buildPumpRoom } from './world/pumpRoom';
import { buildTower, TowerWorld } from './world/tower';
import { Director, Shot } from './camera/director';
import { TouchRouter } from './interact/input';
import { Hud } from './ui/hud';
import { GameAudio } from './audio/audio';
import {
  BASIN,
  HEADER_Y,
  LIGHT_SHAFT,
  MAIN_VALVE,
  PRIME_PUMP,
  PUMP,
  ROOM,
  START_STAND,
  TOWER_X,
  TOWER_Z,
  V,
} from './world/layout';

const view = document.getElementById('view') as HTMLCanvasElement;
const overlay = document.getElementById('overlay') as HTMLCanvasElement;
const boot = document.getElementById('boot') as HTMLDivElement;
const bootbar = document.getElementById('bootbar') as HTMLElement;

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const progress = async (p: number) => {
  bootbar.style.width = `${Math.round(p * 100)}%`;
  await nextFrame();
};

async function main() {
  const engine = new Engine(view);
  await progress(0.08);

  const lib = new MaterialLibrary();
  await progress(0.42);

  const env = engine.buildEnvironment();
  engine.scene.environment = env;
  lib.setEnvironment(env);
  await progress(0.56);

  const sim = new PumpSim();
  const room = buildPumpRoom(lib);
  engine.scene.add(room.group);
  await progress(0.9);

  const director = new Director(engine.camera);
  const router = new TouchRouter(view, engine.camera);
  const hud = new Hud(overlay);
  const audio = new GameAudio();

  let tower: TowerWorld | null = null;
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();

  /* ------------------------------------------------------------------ */
  /* shots                                                               */
  /* ------------------------------------------------------------------ */
  const SHOT = {
    towerWide: {
      name: 'towerWide',
      pos: V(24, 9.5, -28),
      look: V(4.6, 7.4, -8.0),
      portraitBack: 6,
      portraitLift: 2.4,
    },
    aboveShaft: {
      name: 'aboveShaft',
      pos: V(LIGHT_SHAFT.x + 1.8, 5.4, LIGHT_SHAFT.z + 3.2),
      look: V(LIGHT_SHAFT.x, -1.2, LIGHT_SHAFT.z - 0.4),
      portraitBack: 1.6,
    },
    // between the shaft and the room the camera must stay inside the opening,
    // then get fully below the slab before it moves sideways
    underSlab: {
      name: 'underSlab',
      pos: V(LIGHT_SHAFT.x - 0.5, ROOM.ceiling - 0.9, LIGHT_SHAFT.z + 0.2),
      look: V(0.6, -10.2, 0.6),
    },
    inShaft: {
      name: 'inShaft',
      pos: V(LIGHT_SHAFT.x - 0.8, -3.2, LIGHT_SHAFT.z + 0.3),
      look: V(LIGHT_SHAFT.x + 0.4, -8.2, LIGHT_SHAFT.z - 0.9),
    },
    roomWide: {
      name: 'roomWide',
      pos: V(-3.0, -8.1, 6.2),
      look: V(0.4, -10.7, 0.2),
      portraitBack: 1.4,
      portraitLift: 0.5,
    },
    tankPeek: {
      name: 'tankPeek',
      pos: V(-5.4, -6.5, 1.7),
      look: V(-6.4, -9.7, -0.6),
      portraitBack: 0.8,
      portraitLift: 0.3,
    },
    valve: {
      name: 'valve',
      // wheel low-left, sight glass upper-right: the finger never covers the glass
      pos: V(-1.4, -9.42, 4.95),
      look: V(-2.5, -10.42, 1.1),
      portraitBack: 0.55,
      portraitLift: 0.2,
    },
    prime: {
      name: 'prime',
      pos: V(-0.42, -9.72, 3.42),
      look: V(-0.85, -10.24, 1.6),
      portraitBack: 0.6,
    },
    starter: {
      name: 'starter',
      pos: V(1.85, -9.82, 4.5),
      look: V(2.78, -10.42, 2.5),
      portraitBack: 0.8,
    },
    impeller: {
      name: 'impeller',
      pos: V(0.66, -10.5, 3.9),
      look: V(0.24, -11.02, 1.36),
      portraitBack: 0.5,
    },
    manifold: {
      name: 'manifold',
      pos: V(10.2, 16.4, 3.0),
      look: V(4.7, 13.1, -4.1),
      portraitBack: 3.4,
      portraitLift: 1.2,
    },
    homeShaft: {
      name: 'homeShaft',
      pos: V(LIGHT_SHAFT.x + 1.6, 4.6, LIGHT_SHAFT.z + 2.6),
      look: V(LIGHT_SHAFT.x - 0.4, -2.4, LIGHT_SHAFT.z - 0.6),
      portraitBack: 1.4,
    },
    homeTank: {
      name: 'homeTank',
      // the water arrives back where it started
      pos: V(-2.4, -6.6, 3.8),
      look: V(-6.4, -9.5, -0.5),
      portraitBack: 1.2,
      portraitLift: 0.4,
    },
    reveal: {
      name: 'reveal',
      pos: V(28, 13.5, -31),
      look: V(4.4, 5.6, -11.5),
      portraitBack: 9,
      portraitLift: 3.5,
    },
  } satisfies Record<string, Shot>;

  /** Follows the leading edge of the water, swinging round as it leaves the ground. */
  const chaseFront = (): THREE.Vector3 => {
    const d = sim.segments.discharge;
    if (!tower || d.fill < 0.999) return room.discharge.pointAt(Math.max(0.02, d.fill));
    return tower.riser.pointAt(Math.max(0.02, sim.segments.riser.fill));
  };
  const chaseShot: Shot = {
    name: 'chase',
    life: 0.6,
    look: () => chaseFront(),
    pos: () => {
      const f = chaseFront();
      const inRoom = V(-3.2, 1.0, 4.4);
      const inShaft = V(-1.15, 0.45, 0.95);
      const outside = V(6.2, 1.6, 4.8);
      const a = THREE.MathUtils.smoothstep(f.y, -8.6, -6.0);
      const b = THREE.MathUtils.smoothstep(f.y, -0.6, 4.0);
      const off = inRoom.clone().lerp(inShaft, a).lerp(outside, b);
      return f.clone().add(off);
    },
  };

  let focusSlide: BranchId = 'A';
  const slideShot: Shot = {
    name: 'slide',
    life: 0.5,
    look: () => {
      const t = tower;
      if (!t) return V(TOWER_X, 8, TOWER_Z - 6);
      const s = sim.slides[focusSlide];
      return t.slideCurves[focusSlide].getPointAt(THREE.MathUtils.clamp(s.front, 0.02, 0.98));
    },
    pos: () => (tower ? tower.slides[focusSlide].viewFrom : V(20, 10, -20)),
    portraitBack: 4,
    portraitLift: 1.5,
  };

  /* ------------------------------------------------------------------ */
  /* touch targets                                                       */
  /* ------------------------------------------------------------------ */
  const wheelPos = (o: THREE.Object3D) => () => o.getWorldPosition(tmp).clone();
  let tickAccum = 0;
  const tick = (turns: number, pos: THREE.Vector3, strength = 1) => {
    tickAccum += Math.abs(turns);
    if (tickAccum > 0.055) {
      tickAccum = 0;
      audio.valveTick(pos, strength);
    }
  };

  router.add({
    id: 'mainWheel',
    kind: 'wheel',
    world: wheelPos(room.mainValve.wheel),
    worldRadius: 0.62,
    enabled: () => true,
    onWheel: (turns) => {
      sim.turnValve('main', turns);
      tick(turns, room.mainValve.wheel.getWorldPosition(tmp2));
    },
    onTap: () => {
      sim.turnValve('main', 0.24);
      audio.valveTick(room.mainValve.wheel.getWorldPosition(tmp2));
    },
  });

  router.add({
    id: 'bypassWheel',
    kind: 'wheel',
    world: wheelPos(room.bypassValve.wheel),
    worldRadius: 0.4,
    enabled: () => true,
    onWheel: (turns) => {
      sim.turnValve('bypass', turns);
      tick(turns, room.bypassValve.wheel.getWorldPosition(tmp2), 0.7);
    },
    onTap: () => {
      sim.turnValve('bypass', 0.4);
      audio.valveTick(room.bypassValve.wheel.getWorldPosition(tmp2), 0.7);
    },
  });

  let primeVisual = 0;
  router.add({
    id: 'prime',
    kind: 'swipe',
    world: () => room.prime.group.localToWorld(V(0.48, 0.3, 0)),
    worldRadius: 0.5,
    enabled: () => true,
    onStroke: () => sim.primeStroke(),
    onPress: (v) => (primeVisual = v),
    onRelease: () => (primeVisual = 0),
  });

  let coverOpen = 0;
  let leverPress = 0;
  router.add({
    id: 'start',
    kind: 'press',
    world: () => room.starter.group.localToWorld(V(0, 1.71, 0.24)),
    worldRadius: 0.42,
    enabled: () => true,
    onTap: () => {
      if (coverOpen < 0.5) {
        coverOpen = 1;
        audio.valveTick(room.starter.group.localToWorld(V(0, 1.5, 0.2)), 0.6);
      } else {
        leverPress = 1;
        sim.startMotor();
      }
    },
    onPress: (v) => {
      if (coverOpen < 0.5) {
        coverOpen = Math.max(coverOpen, v);
        return;
      }
      leverPress = v;
      if (v > 0.55) sim.startMotor();
    },
    onRelease: () => {
      if (!sim.motorOn) leverPress = 0;
    },
  });

  // a touch anywhere during the opening move skips straight to the machine room —
  // eleven seconds of camera is a long time for a small child who wants to touch something
  router.add({
    id: 'skipIntro',
    kind: 'tap',
    world: () => V(0, 0, 0),
    screen: (w, h) => ({ x: w / 2, y: h / 2, r: Math.max(w, h) }),
    worldRadius: 1,
    enabled: () => sim.phase === 'intro' || sim.phase === 'descend',
    onTap: () => {
      if (sim.phase === 'intro') {
        sim.setPhase('descend');
        descentStep = 0;
      } else {
        sim.setPhase('discover');
      }
    },
  });

  // screen-fixed picture buttons: machine room / top of the tower
  let focus: 'auto' | 'room' | 'tower' = 'auto';
  let focusHold = 0;
  router.add({
    id: 'btnRoom',
    kind: 'tap',
    world: () => V(0, 0, 0),
    screen: (w, h) => {
      void w;
      void h;
      const r = hud.buttonRect('room');
      return { x: r.x, y: r.y, r: r.r * 1.25 };
    },
    worldRadius: 1,
    enabled: () => hud.buttonsVisible,
    onTap: () => {
      focus = 'room';
      focusHold = 0;
      hud.activeButton = 'room';
    },
  });
  router.add({
    id: 'btnTower',
    kind: 'tap',
    world: () => V(0, 0, 0),
    screen: (w, h) => {
      void w;
      void h;
      const r = hud.buttonRect('tower');
      return { x: r.x, y: r.y, r: r.r * 1.25 };
    },
    worldRadius: 1,
    enabled: () => hud.buttonsVisible,
    onTap: () => {
      focus = 'tower';
      focusHold = 0;
      hud.activeButton = 'tower';
    },
  });

  function registerBranchTargets(t: TowerWorld) {
    for (const b of BRANCHES) {
      router.add({
        id: `branch${b}`,
        kind: 'wheel',
        world: wheelPos(t.branchValves[b].wheel),
        worldRadius: 0.5,
        enabled: () => sim.valves[b].enabled,
        onWheel: (turns) => {
          sim.turnValve(b, turns);
          tick(turns, t.branchValves[b].wheel.getWorldPosition(tmp2), 0.8);
        },
        onTap: () => {
          sim.turnValve(b, 1.45);
          audio.valveTick(t.branchValves[b].wheel.getWorldPosition(tmp2), 0.9);
          focusSlide = b;
        },
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* sound wiring — every cue comes from a simulation event               */
  /* ------------------------------------------------------------------ */
  const sightPos = () => room.sightGlass.group.getWorldPosition(new THREE.Vector3());
  sim.on((e, payload) => {
    switch (e) {
      case 'waterEntersSight':
        audio.waterIn(sightPos());
        break;
      case 'airEscapes':
        audio.airHiss(sightPos());
        break;
      case 'primeStroke': {
        const p = payload as { dry: boolean };
        audio.primeStroke(room.prime.group.getWorldPosition(new THREE.Vector3()), !p.dry);
        break;
      }
      case 'primed':
        audio.primedChime(room.prime.group.getWorldPosition(new THREE.Vector3()));
        break;
      case 'motorStart':
        audio.contactorClunk(room.starter.group.getWorldPosition(new THREE.Vector3()));
        break;
      case 'slideWet': {
        const b = payload as BranchId;
        focusSlide = b;
        if (tower) audio.splash(tower.slides[b].exit);
        break;
      }
      case 'bypassOpened':
        audio.airHiss(room.bypassValve.group.getWorldPosition(new THREE.Vector3()), 0.5);
        break;
      default:
        break;
    }
  });

  /* ------------------------------------------------------------------ */
  /* opening beat + progression                                          */
  /* ------------------------------------------------------------------ */
  director.snap(SHOT.towerWide);
  sim.setPhase('intro');

  let revealTimer = 0;
  let slideHold = 0;
  let groanPlayed = false;
  let descentStep = 0;

  function updatePhase(dt: number) {
    const p = sim.phase;
    if (p === 'intro') {
      if (sim.phaseTime > 3.4) sim.setPhase('descend');
      director.cut(SHOT.towerWide, 1);
    } else if (p === 'descend') {
      // one unbroken move: over the opening, down the shaft, into the room
      if (descentStep === 0) {
        director.cut(SHOT.aboveShaft, 3.0);
        descentStep = 1;
      } else if (descentStep === 1 && sim.phaseTime > 2.6) {
        director.cut(SHOT.inShaft, 2.6);
        descentStep = 2;
      } else if (descentStep === 2 && sim.phaseTime > 4.8) {
        director.cut(SHOT.underSlab, 2.2);
        descentStep = 3;
      } else if (descentStep === 3 && sim.phaseTime > 6.8) {
        director.cut(SHOT.roomWide, 2.4);
        descentStep = 4;
      } else if (descentStep === 4 && sim.phaseTime > 9.0) {
        sim.setPhase('discover');
      }
    } else if (p === 'discover') {
      if (!groanPlayed && sim.phaseTime > 0.8) {
        // one low complaint from a machine that is not going to move on its own
        groanPlayed = true;
        audio.contactorClunk(PUMP.clone());
      }
      if (sim.phaseTime < 2.4) director.cut(SHOT.tankPeek, 2.4);
      else director.cut(SHOT.valve, 2.6);
    } else if (p === 'valveTurning') {
      const primingWanted = sim.segments.sight.fill > 0.85 && sim.phaseTime > 2.4 && sim.primeAir > 0.02;
      if (primingWanted) sim.setPhase('priming');
      else director.cut(SHOT.valve, 1.4);
    } else if (p === 'priming') {
      director.cut(SHOT.prime, 1.8);
      if (sim.primed) sim.setPhase('ready');
    } else if (p === 'ready') {
      director.cut(SHOT.starter, 1.8);
      if (sim.motorOn) sim.setPhase('starting');
    } else if (p === 'starting') {
      // motor, shaft, impeller in that order — then straight to the glass port
      if (sim.phaseTime < 1.5) director.cut(SHOT.starter, 1.0);
      else director.cut(SHOT.impeller, 1.6);
    } else if (p === 'chasing') {
      if (sim.phaseTime < 1.6) director.cut(SHOT.impeller, 1.2);
      else director.cut(chaseShot, 2.0);
    } else if (p === 'branching') {
      director.cut(SHOT.manifold, 2.2);
    } else if (p === 'sliding') {
      director.cut(slideShot, 2.0);
    } else if (p === 'reveal') {
      // the whole circuit, then follow the water home the way the camera came
      revealTimer += dt;
      if (revealTimer < 4.6) director.cut(SHOT.reveal, 3.2);
      else if (revealTimer < 7.4) director.cut(SHOT.homeShaft, 2.6);
      else if (revealTimer < 10.0) director.cut(SHOT.inShaft, 2.4);
      else if (revealTimer < 12.4) director.cut(SHOT.underSlab, 2.2);
      else if (revealTimer < 16.2) director.cut(SHOT.homeTank, 2.8);
      else {
        sim.beginFreeplay();
        hud.buttonsVisible = true;
        focus = 'tower';
      }
    } else if (p === 'freeplay') {
      focusHold += dt;
      if (slideHold > 0) {
        slideHold -= dt;
        director.cut(slideShot, 1.8);
      } else if (focus === 'room') {
        director.cut(SHOT.valve, 2.2);
      } else {
        director.cut(SHOT.manifold, 2.2);
      }
    }
  }

  // in free play, follow a newly wetted flume for a few seconds, then come back
  sim.on((e) => {
    if (e === 'slideWet' && sim.phase === 'freeplay') {
      slideHold = 5.5;
    }
  });

  /* ------------------------------------------------------------------ */
  /* hints                                                               */
  /* ------------------------------------------------------------------ */
  function hintTargetId(): string | null {
    if (sim.phase === 'discover' || sim.phase === 'valveTurning') {
      if (sim.segments.sight.fill > 0.85 && sim.primeAir > 0.02) return 'prime';
      return 'mainWheel';
    }
    if (sim.phase === 'priming') return sim.primed ? 'start' : 'prime';
    if (sim.phase === 'ready' || (sim.phase === 'starting' && !sim.motorOn)) return 'start';
    if (sim.phase === 'branching') {
      for (const b of BRANCHES) if (sim.valves[b].enabled && sim.valves[b].open < 0.05) return `branch${b}`;
    }
    if (sim.phase === 'freeplay' && slideHold <= 0) {
      const weak = sim.openBranchCount >= 2 && BRANCHES.some((b) => sim.valves[b].open > 0.08 && sim.slides[b].film < 0.55);
      if (weak && sim.valves.main.open < 0.98) {
        hud.attention = focus === 'room' ? null : 'room';
        return focus === 'room' ? 'mainWheel' : null;
      }
      hud.attention = null;
      for (const b of BRANCHES) if (sim.valves[b].enabled && sim.valves[b].open < 0.05) return `branch${b}`;
    }
    return null;
  }

  const KIND: Record<string, 'wheel' | 'swipe' | 'press' | 'tap'> = {
    mainWheel: 'wheel',
    bypassWheel: 'wheel',
    prime: 'swipe',
    start: 'press',
    branchA: 'tap',
    branchB: 'tap',
    branchC: 'tap',
  };

  /* ------------------------------------------------------------------ */
  /* async: the world above ground                                       */
  /* ------------------------------------------------------------------ */
  let towerRequested = false;
  function requestTower() {
    if (towerRequested) return;
    towerRequested = true;
    setTimeout(() => {
      tower = buildTower(lib);
      engine.scene.add(tower.group);
      registerBranchTargets(tower);
    }, 30);
  }

  engine.onQuality((q) => {
    room.daylight.castShadow = q.shadows;
    room.daylight.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
    if (tower) {
      tower.sun.castShadow = q.shadows;
      tower.sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
    }
    lib.glass.transmission = q.transmission ? 0.96 : 0.0;
    lib.glass.opacity = q.transmission ? 1 : 0.42;
    lib.glass.transparent = true;
    lib.glass.needsUpdate = true;
  });

  /* ------------------------------------------------------------------ */
  /* loop                                                                */
  /* ------------------------------------------------------------------ */
  let now = 0;
  let autoRender = true;
  let unlocked = false;
  const unlock = async () => {
    if (unlocked) return;
    unlocked = true;
    await audio.start();
  };
  view.addEventListener('pointerdown', unlock, { once: false });
  window.addEventListener('touchstart', unlock, { once: true });

  const onResize = () => {
    engine.resize();
    hud.resize();
    director.setPortrait(window.innerHeight >= window.innerWidth);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 120));
  onResize();

  boot.classList.add('hidden');
  setTimeout(() => boot.remove(), 900);

  engine.clock.start();

  /** One simulation + presentation step. Rendering is optional so tests can
   *  advance logical time without paying for frames. */
  function step(dt: number, doRender: boolean) {
    now += dt;

    sim.update(dt);
    updatePhase(dt);
    director.update(dt);

    // visual state that is driven by touch rather than by the simulation
    room.prime.setStroke(primeVisual);
    room.starter.setCover(coverOpen);
    room.starter.setLever(sim.motorOn ? 1 : leverPress);

    room.update(dt, now, sim);
    if (tower) tower.update(dt, now, sim);

    // only one shadow-casting sun is ever needed: the shaft light below, the
    // real sun above. Halves the shadow cost on phones.
    const below = engine.camera.position.y < -2.5;
    const shadowsOn = engine.quality.shadows;
    room.daylight.castShadow = shadowsOn && below;
    if (tower) tower.sun.castShadow = shadowsOn && !below;

    engine.camera.updateMatrixWorld();
    router.project(window.innerWidth, window.innerHeight, now);

    // hint appears only when the player has gone quiet
    const idle = now - router.state.lastActivity;
    const wantId = hintTargetId();
    const s = wantId ? router.screenPos(wantId) : null;
    hud.hint = s && idle > 3.2 && !director.travelling ? { x: s.x, y: s.y, r: s.r * 0.92, kind: KIND[wantId!] ?? 'tap' } : null;
    if (focus !== 'room') hud.activeButton = focus === 'tower' ? 'tower' : null;
    hud.draw(dt);

    // audio follows the same numbers the visuals do
    if (audio.ready) {
      audio.updateListener(engine.camera);
      const riserPoint = tower ? tower.riser.pointAt(Math.max(0.02, sim.segments.riser.fill)) : PUMP.clone();
      const gushLevel = tower ? BRANCHES.reduce((a, b) => a + sim.slides[b].film * 0.6, 0) : 0;
      const basinLevel = tower
        ? BRANCHES.reduce((a, b) => a + (sim.slides[b].front > 0.98 ? sim.slides[b].film : 0), 0)
        : 0;
      audio.updateContinuous({
        motorPos: PUMP.clone(),
        rpm: sim.rpm,
        flow: sim.flow,
        dry: sim.motorOn && sim.flow < 0.06,
        riserPos: riserPoint,
        riserFill: sim.segments.riser.fill,
        riserFlow: sim.riserFlow,
        gushPos: V(TOWER_X, HEADER_Y - 1, TOWER_Z - 3.8),
        gush: Math.min(1, gushLevel),
        basinPos: V(BASIN.x, 0, BASIN.z),
        basin: Math.min(1, basinLevel),
        underground: engine.camera.position.y < ROOM.ceiling,
      });
    }

    // the surface world is only needed once the water is on its way up
    if (sim.segments.discharge.fill > 0.15 || sim.phase === 'intro' || sim.phase === 'descend') requestTower();

    if (doRender) engine.renderer.render(engine.scene, engine.camera);
    engine.sampleFrame(dt, now);
  }

  function frame() {
    const dt = Math.min(0.05, engine.clock.getDelta());
    if (autoRender) step(dt, true);
    requestAnimationFrame(frame);
  }

  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__game = {
      sim,
      router,
      hud,
      engine,
      director,
      audio,
      /** advance logical time without rendering — used by the playtest harness */
      advance(seconds: number) {
        const dt = 1 / 30;
        for (let i = 0; i < Math.round(seconds / dt); i++) step(dt, false);
      },
      get tower() {
        return tower;
      },
      /** render one frame at a chosen pixel ratio, for readable test captures */
      snap(pixelRatio: number) {
        engine.renderer.setPixelRatio(pixelRatio);
        step(1 / 60, true);
      },
      setAutoRender(v: boolean) {
        autoRender = v;
      },
    };
  }

  await progress(1);
  requestAnimationFrame(frame);

  void MAIN_VALVE;
  void PRIME_PUMP;
  void START_STAND;
}

main().catch((err) => {
  console.error(err);
  boot.innerHTML = '<div style="color:#cfe3f2;font:14px system-ui;padding:24px;text-align:center">読み込みに失敗しました</div>';
});
