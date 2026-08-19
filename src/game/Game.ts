import * as THREE from 'three';
import { Materials } from '../gfx/materials';
import { Field } from '../world/Field';
import { buildSky, followShadow, type SkyRig } from '../world/Sky';
import { Harvester, MACHINE } from '../world/Harvester';
import { CrateUnit, CrateYard } from '../world/Crate';
import { Effects } from '../fx/Effects';
import { buildRootGeometry, buildCutFaceGeometry, buildLeafClumpGeometry } from '../world/DaikonModel';
import { Daikon } from './Daikon';
import { CameraDirector } from './CameraDirector';
import { Input } from './Input';
import { UI } from './UI';
import { GameAudio } from './Audio';
import { CFG, rowX, rowEndZ, bedTopY } from './config';

type Phase = 'ready' | 'lowering' | 'running' | 'rowend';

const POOL = 16;

export class Game {
  readonly scene = new THREE.Scene();
  readonly renderer: THREE.WebGLRenderer;
  readonly director: CameraDirector;
  readonly audio = new GameAudio();

  private mats: Materials;
  private field: Field;
  private sky: SkyRig;
  private harvester: Harvester;
  private crate: CrateUnit;
  private yard: CrateYard;
  private effects: Effects;
  private ui: UI;
  private input: Input;

  private pool: Daikon[] = [];
  private assigned = new Map<number, Daikon>();
  private armCursor: number[] = [];
  private droppedSeen = new WeakSet<Daikon>();

  phase: Phase = 'ready';
  collected = 0;
  row = 0;
  rowGrabs = 0;
  private dropCount = 0;
  private phaseT = 0;
  private headT = 0;
  private speed = 0;
  private lateralV = 0;
  private windowAmount = 0;
  private windowTarget = 0;
  private heroDaikon: Daikon | null = null;
  private wantHero = false;
  private wantConveyor = false;
  private wantCrate = false;
  private heroCandidate: Daikon | null = null;
  private firstRow = true;
  private swipeHintT = 0;
  private running = true;
  private last = 0;
  private frames = 0;
  private perfAcc = 0;
  private perfN = 0;
  private quality = 1;
  private dpr = 1;

  private tmp = new THREE.Vector3();
  private opts!: { adapt: boolean; shadows: boolean };

  constructor(canvas: HTMLCanvasElement, mats: Materials, uiRoot: HTMLElement) {
    this.mats = mats;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.dpr < 1.8,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    const q = new URLSearchParams(location.search);
    this.opts = {
      adapt: !q.has('noadapt'),
      shadows: !q.has('noshadow'),
    };
    this.renderer.shadowMap.enabled = this.opts.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0xc3cfd1);

    this.sky = buildSky(this.scene);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    this.scene.environment = pmrem.fromScene(this.sky.envScene, 0, 1, 40).texture;
    this.scene.environmentIntensity = 0.85;
    pmrem.dispose();
    this.field = new Field(mats);
    this.scene.add(this.field.group);

    this.harvester = new Harvester(mats);
    this.scene.add(this.harvester.root);

    const rootGeo = buildRootGeometry(18);
    const rootGeoLow = buildRootGeometry(10);
    const cutGeo = buildCutFaceGeometry();
    const leafGeo = buildLeafClumpGeometry('high', 424242);

    this.crate = new CrateUnit(mats, rootGeoLow);
    this.crate.group.position.copy(MACHINE.crateCentre);
    this.harvester.root.add(this.crate.group);

    this.yard = new CrateYard(mats, rootGeoLow);
    this.scene.add(this.yard.group);

    this.effects = new Effects(mats);
    this.scene.add(this.effects.group);

    const hooks = {
      harvester: this.harvester,
      effects: this.effects,
      crate: () => this.crate,
      onGrab: () => this.audio.grip(),
      onPop: (d: Daikon) => this.onPop(d),
      onCut: () => this.audio.cut(),
      onCollected: () => {
        this.collected++;
        this.audio.thud();
        this.ui.setCount(this.collected);
      },
    };
    for (let i = 0; i < POOL; i++) {
      const d = new Daikon(mats, rootGeo, cutGeo, leafGeo, hooks);
      this.pool.push(d);
      this.scene.add(d.group);
    }

    this.director = new CameraDirector(this.harvester);
    this.ui = new UI(uiRoot);
    this.input = new Input(canvas);
    this.ui.onSound((m) => this.audio.setMuted(m));

    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 220));
    document.addEventListener('visibilitychange', () => {
      this.running = !document.hidden;
      this.last = performance.now();
      this.audio.setEngine(document.hidden ? 0 : 1);
    });

    this.beginRow(0);
  }

  /* ----------------------------------------------------------------- */

  resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.renderer.setPixelRatio(this.dpr * this.quality);
    this.renderer.setSize(w, h, false);
    this.director.setAspect(w / h);
    this.input.resize();
  }

  start() {
    this.last = performance.now();
    requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    requestAnimationFrame(this.tick);
    if (!this.running) {
      this.last = now;
      return;
    }
    const real = Math.min(0.05, Math.max(0.0005, (now - this.last) / 1000));
    this.last = now;
    this.frames++;

    this.director.update(real);
    const dt = real * this.director.timeScale;

    this.step(dt, real);

    this.renderer.render(this.scene, this.director.camera);

    // keep the frame budget honest on weaker phones
    if (!this.opts.adapt) return;
    this.perfAcc += real;
    this.perfN++;
    if (this.perfN >= 90) {
      const avg = this.perfAcc / this.perfN;
      this.perfAcc = 0;
      this.perfN = 0;
      if (avg > 0.026 && this.quality > 0.62) {
        this.quality = Math.max(0.62, this.quality - 0.2);
        this.resize();
      } else if (avg > 0.038 && this.renderer.shadowMap.enabled) {
        this.renderer.shadowMap.enabled = false;
        this.scene.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | undefined;
          if (m) (m as THREE.Material).needsUpdate = true;
        });
      }
    }
  };

  /* ----------------------------------------------------------------- */

  private beginRow(row: number) {
    this.row = row;
    this.rowGrabs = 0;
    this.phase = 'ready';
    this.phaseT = 0;
    this.headT = 0;
    this.speed = 0;
    this.lateralV = 0;
    this.harvester.setHead(0);
    this.harvester.root.position.set(rowX(row), 0, CFG.approachZ);
    this.harvester.root.rotation.set(0, 0, 0);
    this.armCursor = new Array(CFG.rowCount).fill(0);
    this.wantHero = false;
    this.wantConveyor = false;
    this.wantCrate = false;
    this.heroCandidate = null;
    for (const d of this.pool) if (d.active) this.retire(d, true);
    this.effects.reset();
    this.director.play('establish', 3.0, true);
    this.ui.showTapHint(true);
    this.ui.showNext(false);
    this.audio.setEngine(0.45);
  }

  private lowerHead() {
    if (this.phase !== 'ready') return;
    this.phase = 'lowering';
    this.phaseT = 0;
    this.ui.showTapHint(false);
    this.audio.clunk();
    this.audio.setEngine(1);
    this.director.play('work', 1e9, false);
    if (this.firstRow) this.swipeHintT = 4.2;
  }

  private endRow() {
    this.phase = 'rowend';
    this.phaseT = 0;
    this.speed = 0;
    this.audio.setEngine(0.4);
    this.audio.chime();
    this.director.play('rowEnd', 3.6, true);
    this.ui.showNext(true);
  }

  private nextRow() {
    const worked = this.nearestRow();
    if (this.crate.count > 0) {
      this.yard.park(worked, this.crate.count);
      this.crate.reset();
    }
    // the ridge just cleared stays bare as proof of the run; every other ridge
    // comes back, so wherever the player steers next there is work to do
    this.field.regrowExcept([worked]);
    const next = (worked + 1) % CFG.rowCount;
    this.firstRow = false;
    this.beginRow(next);
  }

  /* ----------------------------------------------------------------- */

  private step(dt: number, real: number) {
    this.phaseT += real;
    const H = this.harvester;

    if (this.input.takeTap()) {
      this.audio.start();
      if (this.phase === 'ready') this.lowerHead();
      else if (this.phase === 'rowend' && this.phaseT > 0.7) this.nextRow();
    }

    if (this.phase === 'ready' && this.phaseT > 4.6) this.lowerHead();

    if (this.phase === 'lowering') {
      this.headT = Math.min(1, this.headT + dt / 0.85);
      H.setHead(this.headT * this.headT * (3 - 2 * this.headT));
      if (this.headT >= 1) {
        this.phase = 'running';
        this.phaseT = 0;
      }
    }

    // drive
    const wantSpeed = this.phase === 'lowering' || this.phase === 'running' ? CFG.driveSpeed : 0;
    this.speed += (wantSpeed - this.speed) * (1 - Math.pow(0.03, dt));
    if (this.phase !== 'rowend' && this.phase !== 'ready') H.root.position.z += this.speed * dt;

    // steer: the player nudges, the machine takes care of the rest
    const steer = this.input.takeSteer(dt);
    if (this.phase === 'running' || this.phase === 'lowering') {
      const prevX = H.root.position.x;
      H.root.position.x = THREE.MathUtils.clamp(
        H.root.position.x + steer,
        rowX(0) - 0.5,
        rowX(CFG.rowCount - 1) + 0.5,
      );
      // magnetic snap onto the nearest ridge, softened while the finger is down
      const target = rowX(this.nearestRow());
      const pull = this.input.active ? 0.9 : 3.4;
      H.root.position.x += (target - H.root.position.x) * (1 - Math.pow(Math.exp(-pull), dt));
      this.lateralV = (H.root.position.x - prevX) / Math.max(dt, 1e-4);
    } else {
      this.lateralV *= 0.9;
    }
    H.root.rotation.y = THREE.MathUtils.clamp(-this.lateralV * 0.16, -0.11, 0.11);
    H.root.rotation.x = Math.sin(H.root.position.z * 0.8) * 0.012;
    H.root.rotation.z = Math.sin(H.root.position.z * 1.1 + 1) * 0.014 - this.lateralV * 0.03;
    H.update(dt, H.root.position.z, this.phase === 'running' || this.phase === 'lowering');

    if (this.phase === 'running') this.armAndGrab();

    for (const d of this.pool) {
      if (!d.active) continue;
      d.update(dt, this.speed);
      if (d.state === 'drop' && !this.droppedSeen.has(d)) {
        this.droppedSeen.add(d);
        this.dropCount++;
        if (this.dropCount % 5 === 3) this.wantCrate = true;
      }
    }

    // the share keeps working the ridge just in front of the mouth
    if (this.phase === 'running' && Math.random() < dt * 9) {
      H.pinchWorld(MACHINE.entryU - 0.12, this.tmp);
      this.tmp.y = bedTopY;
      this.effects.soilTrickle(this.tmp, bedTopY - 0.03);
    }

    this.tryScheduledShots();
    this.effects.update(dt);
    this.field.update(dt);
    this.updateShots(real);
    this.updateSoilWindow(real);

    followShadow(this.sky, H.root.position);
    this.ui.update(real);
    if (this.swipeHintT > 0) {
      this.swipeHintT -= real;
      this.ui.showSwipeHint(this.phase === 'running' && this.swipeHintT > 0);
      if (this.swipeHintT <= 0) this.ui.showSwipeHint(false);
    }

    if (this.phase === 'running' && H.root.position.z > rowEndZ + CFG.runoutZ) {
      const busy = this.pool.some((d) => d.active && d.state !== 'standing');
      if (!busy || this.phaseT > 12) this.endRow();
    }
    if (this.phase === 'rowend' && this.phaseT > 4.6) this.nextRow();
  }

  private nearestRow(): number {
    const x = this.harvester.root.position.x;
    let best = 0;
    let bd = 1e9;
    for (let r = 0; r < CFG.rowCount; r++) {
      const d = Math.abs(rowX(r) - x);
      if (d < bd) {
        bd = d;
        best = r;
      }
    }
    return best;
  }

  /** Swap instanced crop for a real, animatable daikon just before it is reached. */
  private armAndGrab() {
    const H = this.harvester;
    const z = H.root.position.z;
    const r = this.nearestRow();
    if (Math.abs(rowX(r) - H.root.position.x) < 0.95) {
      const slots = this.field.slots[r];
      while (this.armCursor[r] < slots.length) {
        const s = slots[this.armCursor[r]];
        if (s.z > z + 2.3) break;
        this.armCursor[r]++;
        if (!s.visible) continue;
        const free = this.pool.find((d) => !d.active);
        if (!free) break;
        const key = r * 1000 + s.index;
        this.field.setCropVisible(r, s.index, false);
        free.arm(s, s.index + r * 7);
        this.assigned.set(key, free);
      }
    }

    const mouth = H.mouthWorld(this.tmp);
    for (const d of this.pool) {
      if (d.state !== 'standing' || !d.slot) continue;
      const s = d.slot;
      const lateral = Math.abs(H.root.position.x - s.x);
      if (mouth.z >= s.z && lateral <= CFG.grabTolerance) {
        d.grab();
        this.rowGrabs++;
        if (this.rowGrabs % 6 === 1) this.wantHero = true;
        if (this.rowGrabs % 6 === 4) this.wantConveyor = true;
        if (this.wantHero) this.heroCandidate = d;
      } else if (z > s.z + 0.55) {
        // missed: hand it straight back to the field, no penalty, no gap in the row
        this.retire(d, true);
      }
    }
  }

  private retire(d: Daikon, restore: boolean) {
    if (d.slot) {
      const key = d.slot.row * 1000 + d.slot.index;
      this.assigned.delete(key);
      if (restore && d.state === 'standing') this.field.setCropVisible(d.slot.row, d.slot.index, true);
    }
    d.release();
  }

  private onPop(d: Daikon) {
    this.audio.pop(this.rowGrabs);
    this.director.shake(0.011);
    if (d.slot) {
      this.field.addHole(d.slot.row, d.slot.x, d.slot.z, d.slot.index * 37 + d.slot.row * 13 + 1);
      const key = d.slot.row * 1000 + d.slot.index;
      this.assigned.delete(key);
    }
  }

  /**
   * A shot that could not cut in (another one was running) stays queued rather
   * than being dropped, so every row shows the close-up, the machine interior
   * and the crate at least once.
   */
  private tryScheduledShots() {
    if (this.phase !== 'running') return;
    if (!this.director.canInterrupt()) return;
    if (this.harvester.root.position.z > rowEndZ - 0.9) return;

    if (this.wantHero && this.heroCandidate) {
      const d = this.heroCandidate;
      if (d.active && (d.state === 'grab' || d.state === 'strain')) {
        this.heroDaikon = d;
        this.director.setFocus(new THREE.Vector3(d.slot?.x ?? 0, bedTopY, d.slot?.z ?? 0));
        this.director.setAim(d.crownWorld(new THREE.Vector3()));
        this.director.play('heroPull', 2.0, true);
        this.windowTarget = 1;
        this.wantHero = false;
        this.heroCandidate = null;
        return;
      }
      // the moment has passed; the next plant grabbed becomes the subject, and
      // meanwhile the other shots are free to take their turn
      this.heroCandidate = null;
    }
    if (this.wantConveyor && this.pool.some((d) => d.state === 'ride')) {
      this.director.play('conveyor', 1.7, true);
      this.wantConveyor = false;
      return;
    }
    if (this.wantCrate && this.pool.some((d) => d.state === 'drop' || d.state === 'convey')) {
      this.director.play('crateDrop', 1.5, true);
      this.wantCrate = false;
    }
  }

  private updateShots(real: number) {
    void real;
    const D = this.director;
    if (D.shot === 'heroPull' && this.heroDaikon) {
      const p = this.heroDaikon.crownWorld(this.tmp);
      D.setAim(p);
      this.mats.soilWindow.uCutCenter.value.set(
        this.heroDaikon.slot?.x ?? p.x,
        bedTopY,
        this.heroDaikon.slot?.z ?? p.z,
      );
    }
    if (D.isSpecial() && D.finished()) {
      if (D.shot === 'heroPull') {
        this.windowTarget = 0;
        this.heroDaikon = null;
      }
      D.play('work', 1e9, true);
      D.endSpecial(1.15);
    }
    if (this.phase === 'running' && !D.isSpecial() && D.shot !== 'work' && D.finished()) {
      D.play('work', 1e9, false);
    }
  }

  private updateSoilWindow(real: number) {
    const u = this.mats.soilWindow;
    const speed = this.windowTarget > this.windowAmount ? 6.5 : 4.5;
    this.windowAmount += (this.windowTarget - this.windowAmount) * Math.min(1, speed * real);
    if (this.windowAmount < 0.004 && this.windowTarget === 0) this.windowAmount = 0;
    u.uCutAmount.value = this.windowAmount;
    this.mats.setWindowOpen(this.windowAmount > 0.001);
    u.uCutSide.value = this.director.camera.position.x > u.uCutCenter.value.x ? -1 : 1;
    u.uCutRadius.value.set(0.36, 0.58);
    this.mats.daikon.emissiveIntensity = 0.05 + this.windowAmount * 0.28;
  }

  /* ----------------------------------------------------------------- */

  /** Snapshot used by the smoke tests. */
  debug() {
    return {
      phase: this.phase,
      shot: this.director.shot,
      collected: this.collected,
      row: this.row,
      rowGrabs: this.rowGrabs,
      machine: {
        x: +this.harvester.root.position.x.toFixed(3),
        z: +this.harvester.root.position.z.toFixed(3),
      },
      crate: this.crate.count,
      parked: this.yard.parked,
      frames: this.frames,
      quality: this.quality,
      states: this.pool.filter((d) => d.active).map((d) => d.state),
      standing: this.field.slots.map((r) => r.filter((s) => s.visible).length),
      timeScale: +this.director.timeScale.toFixed(2),
      windowAmount: +this.windowAmount.toFixed(2),
    };
  }

  /**
   * Advance the simulation by a fixed timestep without waiting on the display.
   * Software-rendered CI cannot produce real frames fast enough to reach an
   * interesting moment, so tests drive logical time directly.
   */
  simulate(seconds: number) {
    const h = 1 / 60;
    for (let t = 0; t < seconds; t += h) {
      this.director.update(h);
      this.step(h * this.director.timeScale, h);
      this.frames++;
    }
  }

  /** Test-only helpers. */
  testTap() {
    this.input.tapped = true;
  }

  testSteer(metres: number) {
    this.input.steer += metres;
  }
}
