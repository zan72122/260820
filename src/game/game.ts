import * as THREE from 'three';
import { Engine } from '../core/engine';
import { CameraRig, Framing } from '../core/camera';
import { Input } from '../core/input';
import { GameAudio } from '../core/audio';
import { buildStudioEnv } from '../core/env';
import { UI } from '../ui/ui';
import { clamp, damp, smoothstep } from '../core/util';
import { buildKitchen } from './kitchen';
import { buildRackSet, RACK_TOP, TRAY_W, TRAY_D } from './rack';
import { buildCake, buildMold } from './cake';
import { GlazeField } from './glazeField';
import { makeShellMesh } from './glazeMesh';
import { PourStream } from './stream';
import { DripSystem } from './drips';
import { buildPitchers, Pitcher } from './pitcher';
import { PALETTES, Palette, nextPalette } from './palettes';
import { CAKE_H, CAKE_R, surfaceY, vAtRadius } from './profile';

type Phase = 'title' | 'demold' | 'place' | 'pour' | 'settle' | 'reveal';

const CAKE_TOP_Y = RACK_TOP + CAKE_H;
const BENCH_SPOT = new THREE.Vector3(-0.25, 0, 0.1);
const RACK_SPOT = new THREE.Vector3(0, RACK_TOP, 0);
const PITCHER_Z = 0.252;
const PITCHER_X = [-0.118, 0, 0.118];
const PROBE_COLS = 64;
const ASIDE = [
  new THREE.Vector3(-0.33, 0, 0.2),
  new THREE.Vector3(-0.27, 0, 0.31),
  new THREE.Vector3(0.31, 0, 0.25),
];

const dir = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize();

/** Held jugs face the camera so the beak and the falling glaze stay visible. */
const POUR_QUAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));

export class Game {
  private scene: THREE.Scene;
  private rig: CameraRig;
  private audio = new GameAudio();
  private input: Input;

  private field: GlazeField;
  private shell: THREE.Mesh;
  private shellUniforms!: { uField: { value: THREE.Texture } };
  private cake = buildCake(false);
  private mold = buildMold(false);
  private rack = buildRackSet(false);
  private stream = new PourStream();
  private drips: DripSystem;
  private pitchers: Pitcher[] = [];

  private phase: Phase = 'title';
  private phaseT = 0;
  private idleT = 0;
  private time = 0;

  private palette: Palette = PALETTES[0];
  private held: Pitcher | null = null;
  private pressPitcher: Pitcher | null = null;
  private pourTarget = new THREE.Vector3(0, CAKE_TOP_Y, 0);
  private pourUV = new THREE.Vector2(0, 0);
  private prevUV = new THREE.Vector2(0, 0);
  private uvVel = new THREE.Vector2(0, 0);
  private impact = new THREE.Vector3(0, CAKE_TOP_Y, 0);
  private spout = new THREE.Vector3();
  private moldLift = 0;
  private moldFree = false;
  private cakeWobble = 0;
  private cakeGrabbed = false;
  private cakeTarget = new THREE.Vector3().copy(BENCH_SPOT);
  private pouredAny = false;
  private pourTime = 0;
  private doneShown = false;
  private revealShown = false;
  private plane = new THREE.Plane();
  private ray = new THREE.Raycaster();
  private v2 = new THREE.Vector2();
  private v3 = new THREE.Vector3();
  private tmpColor = new THREE.Color();
  private orbitAngle = 0;
  private simCarry = 0;
  private dbgT = 0;
  private readonly dbg = {
    phase: 'title' as string,
    phaseT: 0,
    cov: 0,
    held: null as string | null,
    cakeY: 0,
    drips: 0,
    fps: 0,
  };

  constructor(private engine: Engine, private ui: UI) {
    this.scene = engine.scene;
    const low = engine.quality.low;

    const env = buildStudioEnv(engine.renderer);
    this.scene.environment = env;
    this.scene.background = new THREE.Color(0x141216);

    buildKitchen(this.scene, low);

    this.cake = buildCake(low);
    this.mold = buildMold(low);
    this.rack = buildRackSet(low);
    this.scene.add(this.rack.group, this.cake.group, this.mold.group);

    this.field = new GlazeField(
      engine.renderer,
      engine.quality.fieldW,
      engine.quality.fieldH
    );
    this.field.setQuality(low);
    this.field.reset((Math.random() * 1e9) | 0);
    this.shell = makeShellMesh(this.field, low);
    this.shellUniforms = (this.shell.material as THREE.MeshPhysicalMaterial).userData
      .uniforms as { uField: { value: THREE.Texture } };
    this.cake.group.add(this.shell);

    this.drips = new DripSystem(PROBE_COLS, low);
    this.cake.group.add(this.drips.group);

    this.scene.add(this.stream.mesh);

    this.pitchers = buildPitchers(this.palette.colors as unknown as number[], low);
    this.pitchers.forEach((p, i) => {
      p.setHome(new THREE.Vector3(PITCHER_X[i], 0, PITCHER_Z), Math.PI * 0.02 * (i - 1));
      this.scene.add(p.group);
    });

    this.cake.group.position.copy(BENCH_SPOT);
    this.mold.group.position.copy(BENCH_SPOT);

    this.rig = new CameraRig(engine.camera, this.framing('title'));
    this.input = new Input(engine.renderer.domElement);

    this.ui.onStart = () => this.begin();
    this.ui.onDone = () => this.finishPour();
    this.ui.onReplay = (same) => this.replay(same);
    this.ui.onReduceMotion = (v) => {
      this.rig.reduceMotion = v;
    };
    this.ui.onMute = (v) => {
      this.audio.muted = v;
      if (v) this.audio.pourOff();
    };

    (window as unknown as Record<string, unknown>).__dbg = this.dbg;
    this.ui.showTitle(true);
    this.ui.hint(null);

    if (import.meta.env.DEV) this.installDevHooks();
  }

  /** Dev-only shortcuts so the look of each beat can be inspected quickly. */
  private installDevHooks() {
    (window as unknown as Record<string, unknown>).__test = {
      phase: (p: Phase) => {
        if (p !== 'title') this.ui.showTitle(false);
        if (p === 'pour' || p === 'settle' || p === 'reveal') {
          this.mold.group.visible = false;
          this.moldFree = true;
          this.cake.group.position.copy(RACK_SPOT);
          this.cakeTarget.copy(RACK_SPOT);
        }
        this.setPhase(p);
        this.rig.snap(this.framing(p === 'reveal' ? 'hero' : p));
      },
      pick: (i: number) => this.selectPitcher(this.pitchers[i]),
      /** Pour a scripted ribbon straight into the field, fast. */
      burst: (steps: number, path: [number, number][], colorIndex: number, rate = 5.2) => {
        const col = new THREE.Color(this.palette.colors[colorIndex]);
        for (let i = 0; i < steps; i++) {
          const t = i / Math.max(1, steps - 1);
          const seg = t * (path.length - 1);
          const i0 = Math.min(path.length - 1, Math.floor(seg));
          const i1 = Math.min(path.length - 1, i0 + 1);
          const f = seg - i0;
          const u = path[i0][0] + (path[i1][0] - path[i0][0]) * f;
          const v = path[i0][1] + (path[i1][1] - path[i0][1]) * f;
          this.field.step(1 / 60, {
            u,
            v,
            radius: 0.0125,
            rate,
            color: col,
            velU: (path[i1][0] - path[i0][0]) * 2,
            velV: (path[i1][1] - path[i0][1]) * 2,
          });
        }
        this.shellUniforms.uField.value = this.field.texture;
        this.field.updateProbe(1, true);
      },
      relax: (steps: number) => {
        for (let i = 0; i < steps; i++) this.field.step(1 / 60, null);
        this.shellUniforms.uField.value = this.field.texture;
        this.field.updateProbe(1, true);
      },
      cov: () => this.field.coverage,
      pitcherScreen: () =>
        this.pitchers.map((p) => {
          const v = new THREE.Vector2();
          p.screenPos(this.engine.camera, window.innerWidth, window.innerHeight, v);
          return [v.x, v.y];
        }),
      clear: () => this.field.reset((Math.random() * 900) | 0),
      set: (n: string, v: number) => this.field.setParam(n, v),
      probe: () => Array.from(this.field.probeBytes),
      rim: () => Array.from(this.field.rim),
    };
  }

  // ---------------------------------------------------------------- framing

  private framing(kind: Phase | 'hero'): Framing {
    const portrait = this.engine.portrait;
    const m = portrait ? 0.94 : 1.05;
    switch (kind) {
      case 'title':
        return {
          center: new THREE.Vector3(-0.045, 0.045, 0.05),
          radius: 0.3,
          dir: dir(0.42, 0.5, 1.0),
          bias: portrait ? -0.06 : -0.02,
          margin: m,
        };
      case 'demold':
        return {
          center: new THREE.Vector3(
            BENCH_SPOT.x,
            0.045,
            BENCH_SPOT.z - 0.01
          ),
          radius: 0.112,
          dir: dir(0.34, 0.48, 1.0),
          bias: -0.02,
          margin: portrait ? 1.0 : 1.08,
        };
      case 'place':
        return {
          center: new THREE.Vector3(-0.115, 0.045, 0.065),
          radius: 0.245,
          dir: dir(0.26, 0.66, 1.0),
          bias: portrait ? -0.05 : 0,
          margin: m,
        };
      case 'pour':
        return {
          center: new THREE.Vector3(0, 0.082, 0.06),
          radius: 0.25,
          dir: dir(0.2, 0.8, 1.0),
          bias: portrait ? -0.08 : -0.03,
          margin: portrait ? 0.9 : 1.0,
        };
      case 'settle':
        return {
          center: new THREE.Vector3(0, 0.062, -0.005),
          radius: 0.145,
          dir: dir(0.28, 0.42, 1.0),
          bias: 0,
          margin: portrait ? 0.92 : 1.02,
        };
      case 'hero': {
        const a = this.orbitAngle;
        return {
          center: new THREE.Vector3(0, 0.05, 0),
          radius: 0.138,
          dir: dir(Math.sin(a) * 0.85, 0.36 + Math.sin(a * 0.7) * 0.1, Math.cos(a) * 1.0),
          bias: this.revealShown ? -0.16 : -0.04,
          margin: portrait ? 0.95 : 1.05,
        };
      }
      default:
        return this.framing('pour');
    }
  }

  resize() {
    this.engine.resize();
    this.rig.reframe();
  }

  // ------------------------------------------------------------- transitions

  private begin() {
    this.audio.start();
    this.ui.showTitle(false);
    this.setPhase('demold');
  }

  private setPhase(p: Phase) {
    this.phase = p;
    this.phaseT = 0;
    this.idleT = 0;
    switch (p) {
      case 'demold':
        this.rig.goTo(this.framing('demold'), 1.3);
        this.ui.hint(null);
        break;
      case 'place':
        this.rig.goTo(this.framing('place'), 1.1);
        break;
      case 'pour':
        this.rig.goTo(this.framing('pour'), 1.2);
        this.pitchers.forEach((p) => p.setSelectable(true));
        break;
      case 'settle':
        this.ui.hint(null);
        this.ui.showDone(false);
        this.rig.goTo(this.framing('settle'), 1.6);
        this.audio.pourOff();
        // clear the hero shot: the jugs step back to the edges of the bench
        this.pitchers.forEach((p, i) => {
          p.setSelectable(false);
          p.moveAside(ASIDE[i]);
          p.tilt = 0;
        });
        this.held = null;
        break;
      case 'reveal':
        this.orbitAngle = 0.36;
        this.rig.goTo(this.framing('hero'), 1.5);
        this.audio.chime();
        break;
    }
    this.ui.showGear(p === 'title' || p === 'demold' || p === 'reveal');
  }

  private finishPour() {
    if (this.phase !== 'pour') return;
    this.ui.showDone(false);
    this.doneShown = false;
    this.setPhase('settle');
  }

  private replay(samePalette: boolean) {
    if (!samePalette) this.palette = nextPalette(this.palette.id);
    this.ui.showFinish(this.palette, nextPalette(this.palette.id), false);
    this.ui.showDone(false);
    this.ui.hint(null);
    const seed = (Math.random() * 1e9) | 0;
    this.field.reset(seed);
    this.drips.reset(seed);
    this.rack.puddle.clear();
    this.stream.reset();
    this.pouredAny = false;
    this.pourTime = 0;
    this.doneShown = false;
    this.revealShown = false;
    this.moldLift = 0;
    this.moldFree = false;
    this.cakeWobble = 0;
    this.cakeGrabbed = false;
    this.cake.group.position.copy(BENCH_SPOT);
    this.cake.group.scale.set(1, 1, 1);
    this.cakeTarget.copy(BENCH_SPOT);
    this.mold.group.position.copy(BENCH_SPOT);
    this.mold.group.rotation.set(0, 0, 0);
    this.mold.group.scale.set(1, 1, 1);
    this.mold.group.visible = true;
    this.mold.setWobble(0);
    this.pitchers.forEach((p, i) => {
      p.held = false;
      p.tilt = 0;
      const c = new THREE.Color(this.palette.colors[i]);
      p.color.copy(c);
      p.setColors(c);
      p.setHome(new THREE.Vector3(PITCHER_X[i], 0, PITCHER_Z), Math.PI * 0.02 * (i - 1));
      p.update(0.016, this.time, true);
    });
    this.held = null;
    this.setPhase('demold');
  }

  // ------------------------------------------------------------------ update

  update(dt: number) {
    this.time += dt;
    this.input.begin(dt);
    this.phaseT += dt;
    const uiBlocked = this.ui.settingsVisible;

    switch (this.phase) {
      case 'title':
        this.updateTitle(dt);
        break;
      case 'demold':
        this.updateDemold(dt, uiBlocked);
        break;
      case 'place':
        this.updatePlace(dt, uiBlocked);
        break;
      case 'pour':
        this.updatePour(dt, uiBlocked);
        break;
      case 'settle':
        this.updateSettle(dt);
        break;
      case 'reveal':
        this.updateReveal(dt);
        break;
    }

    // ---- simulation ------------------------------------------------------
    const simActive =
      this.phase === 'pour' || this.phase === 'settle' || this.phase === 'reveal';
    if (simActive) {
      const fixed = 1 / 60;
      this.simCarry = Math.min(this.simCarry + dt, fixed * 3);
      let steps = 0;
      while (this.simCarry >= fixed && steps < 3) {
        this.field.step(fixed, this.phase === 'pour' ? this.currentSplat() : null);
        this.simCarry -= fixed;
        steps++;
      }
      if (steps === 0 && this.simCarry > fixed * 0.5) {
        this.field.step(this.simCarry, this.phase === 'pour' ? this.currentSplat() : null);
        this.simCarry = 0;
      }
      // the field ping-pongs, so the shell has to follow the live target
      this.shellUniforms.uField.value = this.field.texture;
      this.field.updateProbe(dt);

      const trayLocalY = 0.0062 - this.cake.group.position.y;
      this.drips.update(
        dt,
        this.field.rim,
        this.field.rimColor,
        trayLocalY,
        (x, z, r, c) => {
          const wx = x + this.cake.group.position.x;
          const wz = z + this.cake.group.position.z;
          const u = clamp(0.5 + wx / TRAY_W, 0.02, 0.98);
          const v = clamp(0.5 + wz / TRAY_D, 0.02, 0.98);
          this.rack.puddle.splash(u, v, r, c);
        },
        () => this.audio.drop(),
        this.phase !== 'reveal'
      );
    }

    // ---- objects ---------------------------------------------------------
    this.mold.update(this.time);
    for (const pit of this.pitchers) pit.update(dt, this.time, false);

    if (this.cakeWobble > 0.001) {
      this.cakeWobble = Math.max(0, this.cakeWobble - dt * 1.6);
      const w = this.cakeWobble;
      const s = Math.sin(this.time * 34) * w * 0.055;
      this.cake.group.scale.set(1 - s * 0.5, 1 + s, 1 - s * 0.5);
    } else {
      this.cake.group.scale.set(1, 1, 1);
    }

    this.rig.update(dt);
    this.engine.adapt(dt);
    // lightweight state mirror for debugging on a real device (throttled, and
    // it reuses one object so it costs nothing per frame)
    this.dbgT += dt;
    if (this.dbgT > 0.2) {
      this.dbgT = 0;
      this.dbg.phase = this.phase;
      this.dbg.phaseT = +this.phaseT.toFixed(2);
      this.dbg.cov = +this.field.coverage.toFixed(3);
      this.dbg.held = this.held ? this.held.color.getHexString() : null;
      this.dbg.cakeY = +this.cake.group.position.y.toFixed(3);
      this.dbg.drips = this.drips.activeCount;
      this.dbg.fps = Math.round(1 / Math.max(dt, 1e-3));
    }
  }

  // -------------------------------------------------------------- phase: title

  private updateTitle(dt: number) {
    const f = this.framing('title');
    f.dir.applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.sin(this.time * 0.12) * (this.ui.reduceMotion ? 0.0 : 0.06)
    );
    this.rig.track(f);
    void dt;
  }

  // ------------------------------------------------------------- phase: demold

  private updateDemold(dt: number, blocked: boolean) {
    const p = this.input.p;
    this.idleT += dt;

    if (!this.moldFree) {
      if (!blocked && p.active) {
        this.idleT = 0;
        const h = window.innerHeight;
        const pull = clamp((p.startY - p.y) / (h * 0.24), 0, 1.2);
        this.moldLift = damp(this.moldLift, Math.min(1, pull), 16, dt);
      } else if (!p.active) {
        this.moldLift = damp(this.moldLift, 0, 8, dt);
      }
      if (this.phaseT > 12 && !p.active) this.moldLift = damp(this.moldLift, 1, 1.6, dt);

      this.mold.setWobble(this.moldLift);
      this.mold.group.position.set(
        BENCH_SPOT.x,
        this.moldLift * 0.055,
        BENCH_SPOT.z
      );
      this.mold.group.scale.set(
        1 - this.moldLift * 0.03,
        1 + this.moldLift * 0.1,
        1 - this.moldLift * 0.03
      );

      if (this.moldLift > 0.88) {
        this.moldFree = true;
        this.phaseT = 0;
        this.audio.pop();
        this.cakeWobble = 1;
        this.ui.hint(null);
      }
      if (this.idleT > 2.2) this.ui.hint('うえに ひっぱってね', 'up');
    } else {
      // the mould flies aside and the cake settles
      const t = clamp(this.phaseT / 1.0, 0, 1);
      const e = smoothstep(0, 1, t);
      this.mold.setWobble(1 - e * 0.8);
      this.mold.group.position.set(
        THREE.MathUtils.lerp(BENCH_SPOT.x, BENCH_SPOT.x - 0.115, e),
        0.055 + Math.sin(e * Math.PI) * 0.075 - e * 0.05,
        THREE.MathUtils.lerp(BENCH_SPOT.z, BENCH_SPOT.z + 0.085, e)
      );
      this.mold.group.rotation.set(e * 0.9, e * 0.6, e * 0.5);
      this.mold.group.scale.setScalar(1 - e * 0.02);
      if (t >= 1) {
        this.mold.group.visible = false;
        this.setPhase('place');
      }
    }
  }

  // -------------------------------------------------------------- phase: place

  private updatePlace(dt: number, blocked: boolean) {
    const p = this.input.p;
    this.idleT += dt;
    const cakePos = this.cake.group.position;
    const distToRack = Math.hypot(cakePos.x - RACK_SPOT.x, cakePos.z - RACK_SPOT.z);

    if (!blocked && p.active) {
      this.idleT = 0;
      this.cakeGrabbed = true;
      if (this.rayToPlane(p.x, p.y, 0.02, this.v3)) {
        this.cakeTarget.set(
          clamp(this.v3.x, -0.34, 0.34),
          0,
          clamp(this.v3.z, -0.2, 0.34)
        );
      }
    }

    if (this.cakeGrabbed) {
      // magnetic assist: the rack pulls the cake in as it gets close
      const d = Math.hypot(
        this.cakeTarget.x - RACK_SPOT.x,
        this.cakeTarget.z - RACK_SPOT.z
      );
      const pull = 1 - smoothstep(0.04, 0.16, d);
      const tx = THREE.MathUtils.lerp(this.cakeTarget.x, RACK_SPOT.x, pull);
      const tz = THREE.MathUtils.lerp(this.cakeTarget.z, RACK_SPOT.z, pull);
      const lift = p.active ? 0.045 : 0;
      cakePos.x = damp(cakePos.x, tx, 9, dt);
      cakePos.z = damp(cakePos.z, tz, 9, dt);
      const groundY = pull > 0.5 ? RACK_TOP : 0;
      cakePos.y = damp(cakePos.y, groundY + lift, 11, dt);

      if (!p.active && p.justReleased) {
        if (d < 0.15) {
          this.landOnRack();
        } else {
          this.cakeTarget.copy(BENCH_SPOT);
        }
      }
    }

    if (this.phaseT > 13 && !p.active) {
      this.cakeGrabbed = true;
      this.cakeTarget.copy(RACK_SPOT);
      if (distToRack < 0.02) this.landOnRack();
    }

    if (this.idleT > 2.6) this.ui.hint('ケーキを ラックに はこぼう', 'side');
  }

  private landOnRack() {
    this.cake.group.position.set(RACK_SPOT.x, RACK_TOP, RACK_SPOT.z);
    this.cakeTarget.copy(RACK_SPOT);
    this.cakeGrabbed = false;
    this.cakeWobble = 0.8;
    this.audio.thud();
    this.audio.clink(0.7);
    this.setPhase('pour');
  }

  // --------------------------------------------------------------- phase: pour

  private updatePour(dt: number, blocked: boolean) {
    const p = this.input.p;
    this.idleT += dt;

    if (!blocked && p.justPressed) {
      this.pressPitcher = this.pickPitcher(p.x, p.y);
    }
    // a quick tap on a jug swaps colour; anything longer is a pour, even if the
    // finger happened to start on top of a jug
    if (this.pressPitcher && (p.held > 0.26 || p.moved > 24)) this.pressPitcher = null;
    if (p.justReleased) {
      if (this.pressPitcher && p.moved < 26) this.selectPitcher(this.pressPitcher);
      this.pressPitcher = null;
    }

    const wantPour = !blocked && p.active && !this.pressPitcher && !!this.held;
    if (wantPour) this.idleT = 0;

    if (!this.held) {
      // nothing picked up yet: the middle jug is the obvious first choice
      if (this.idleT > 2.2) this.ui.hint('ピッチャーを えらんでね', 'tap');
      if (this.phaseT > 10) this.selectPitcher(this.pitchers[0]);
      return;
    }

    // --- where the child is aiming ---------------------------------------
    if (p.active && !this.pressPitcher) {
      const h = window.innerHeight;
      const offset = clamp(h * 0.15, 72, 142);
      if (this.rayToPlane(p.x, p.y - offset, CAKE_TOP_Y, this.v3)) {
        const rawR = Math.hypot(this.v3.x, this.v3.z);
        // soft clamp: however wild the finger is, the jet still lands on the cake
        const rr = CAKE_R * Math.tanh((rawR / CAKE_R) * 1.15) * 0.985;
        const a = rawR > 1e-5 ? Math.atan2(this.v3.z, this.v3.x) : 0;
        this.pourTarget.set(
          Math.cos(a) * rr,
          RACK_TOP + surfaceY(rr) + 0.001,
          Math.sin(a) * rr
        );
        this.pourUV.set((Math.atan2(this.v3.z, this.v3.x) / (Math.PI * 2) + 1) % 1, vAtRadius(rr));
      }
    }

    // --- jug follows, tilts while pressed ---------------------------------
    const hold = this.held;
    hold.held = true;
    // above and slightly behind the impact point: on screen the jug sits above
    // the cake, the stream falls towards the viewer, and neither the jug nor the
    // finger ever covers the spot the child is watching
    const hp = this.v3.set(
      this.pourTarget.x,
      CAKE_TOP_Y + 0.115,
      this.pourTarget.z - 0.055
    );
    hold.moveTo(hp, POUR_QUAT);
    hold.tilt = damp(hold.tilt, wantPour ? 1 : 0, wantPour ? 7 : 9, dt);

    hold.spoutWorld(this.spout);
    this.impact.copy(this.pourTarget);
    const emitting = wantPour && hold.tilt > 0.45;
    this.stream.update(dt, emitting, this.spout, this.impact, hold.tilt);

    // --- pour point velocity in field space -------------------------------
    let du = this.pourUV.x - this.prevUV.x;
    if (du > 0.5) du -= 1;
    if (du < -0.5) du += 1;
    const dv = this.pourUV.y - this.prevUV.y;
    this.uvVel.x = damp(this.uvVel.x, clamp(du / Math.max(dt, 1e-3), -3, 3), 10, dt);
    this.uvVel.y = damp(this.uvVel.y, clamp(dv / Math.max(dt, 1e-3), -3, 3), 10, dt);
    this.prevUV.copy(this.pourUV);

    if (this.stream.contact > 0.05) {
      this.pouredAny = true;
      this.audio.pourOn();
      this.audio.pourLevel(this.stream.contact * hold.tilt);
    } else {
      this.audio.pourLevel(0);
      if (!emitting) this.audio.pourOff();
    }

    // --- hints and completion ---------------------------------------------
    if (!this.pouredAny && this.idleT > 2.0) {
      this.ui.hint('ゆびで おして ながそう', 'tap');
    } else if (this.pouredAny) {
      this.ui.hint(null);
    }

    const cov = this.field.coverage;
    if (this.pouredAny) this.pourTime += dt;
    if (!this.doneShown && (cov > 0.32 || this.pourTime > 10)) {
      this.doneShown = true;
      this.ui.showDone(true);
      this.audio.sparkle();
    }
    if (cov > 0.9 && !p.active && this.pourTime > 5) this.finishPour();
    if (this.phaseT > 90) this.finishPour();
  }

  private currentSplat() {
    const c = this.stream.contact;
    if (!this.held || c <= 0.02) return null;
    this.tmpColor.copy(this.held.color);
    return {
      u: this.pourUV.x,
      v: this.pourUV.y,
      radius: 0.0125,
      rate: 15.5 * c,
      color: this.tmpColor,
      velU: this.uvVel.x,
      velV: this.uvVel.y,
    };
  }

  private pickPitcher(x: number, y: number): Pitcher | null {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const lim = Math.max(64, Math.min(w, h) * 0.11);
    let best: Pitcher | null = null;
    let bestD = lim;
    for (const p of this.pitchers) {
      if (p === this.held) continue;
      p.screenPos(this.engine.camera, w, h, this.v2);
      const d = Math.hypot(this.v2.x - x, this.v2.y - y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  private selectPitcher(p: Pitcher) {
    if (this.held === p) return;
    if (this.held) {
      this.held.held = false;
      this.held.tilt = 0;
      this.held.goHome();
    }
    this.held = p;
    p.held = true;
    p.setSelectable(false);
    this.stream.setColor(p.color);
    this.audio.tap();
    this.idleT = 0;
  }

  // ------------------------------------------------------------- phase: settle

  private updateSettle(dt: number) {
    this.stream.update(dt, false, this.spout, this.impact, 0);
    if (this.held) {
      this.held.tilt = damp(this.held.tilt, 0, 8, dt);
      this.held.held = false;
    }
    if (this.phaseT > 4.6) this.setPhase('reveal');
  }

  // ------------------------------------------------------------- phase: reveal

  private updateReveal(dt: number) {
    const speed = this.ui.reduceMotion ? 0.06 : 0.22;
    this.orbitAngle += dt * speed;
    if (this.phaseT > 1.4) this.rig.track(this.framing('hero'));
    if (!this.revealShown && this.phaseT > 2.6) {
      this.revealShown = true;
      this.ui.showFinish(this.palette, nextPalette(this.palette.id), true);
    }
  }

  // ------------------------------------------------------------------ helpers

  private rayToPlane(px: number, py: number, planeY: number, out: THREE.Vector3) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.v2.set((px / w) * 2 - 1, -(py / h) * 2 + 1);
    this.ray.setFromCamera(this.v2, this.engine.camera);
    this.plane.set(new THREE.Vector3(0, 1, 0), -planeY);
    const hit = this.ray.ray.intersectPlane(this.plane, out);
    return !!hit;
  }

  pause() {
    this.audio.suspend();
    this.audio.pourOff();
    this.input.cancel();
  }

  resumeAudio() {
    this.audio.resume();
  }
}
