import * as THREE from 'three';
import type { AudioEngine } from '../core/audio';
import type { CameraDirector } from '../core/camera';
import type { InputRouter, Touch2D } from '../core/input';
import type { Stage } from '../core/renderer';
import { settings } from '../core/settings';
import { clamp, damp, Rng, smoothstep } from '../core/util';
import type { Hud } from '../ui/hud';
import { WORK_THETA } from '../world/slide';
import { DEFECT_STEPS, defectForRound, seamForRound, type StepId } from './defects';
import { makeShots, type Shots } from './shots';
import { makeStep, toScreen, workPoint, type Step, type StepCtx } from './steps';
import type { World } from './world';

export type Phase =
  | 'title'
  | 'establish'
  | 'introDrop'
  | 'introSnag'
  | 'drive'
  | 'lightSearch'
  | 'discover'
  | 'toolPick'
  | 'treat'
  | 'stepBeat'
  | 'dropTest'
  | 'dropWatch'
  | 'raftTest'
  | 'roundEnd';

const ALL_TOOLS: StepId[] = ['peel', 'brush', 'fill', 'smooth', 'polish'];

/**
 * The run of play.
 *
 * One rule is taught by letting the water fail, never by telling: the droplet
 * stops, the lamp reveals why, and the tools follow as physical consequences.
 * From the third fault the tool tray appears and the player predicts instead of
 * being led.
 */
export class Game {
  phase: Phase = 'title';
  round = 0;
  private timer = 0;
  private shots: Shots;
  private rng: Rng;
  private steps: StepId[] = [];
  private stepIndex = 0;
  private step: Step | null = null;
  private ctx: StepCtx;
  private reveal = 0;
  private revealHold = 0;
  private drivePush = 0;
  private driveTarget = 0;
  private driveDir = new THREE.Vector2(0, -1);
  private driveStarted = false;
  private hintTimer = 0;
  private twitchTimer = 0;
  private pendingTool: StepId | null = null;
  private toolHintTimer = 0;
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private outdoor = 1;
  private waterQuality = 0;
  private respawn = 0;

  constructor(
    private world: World,
    private stage: Stage,
    private director: CameraDirector,
    private hud: Hud,
    private audio: AudioEngine,
    private input: InputRouter,
  ) {
    this.shots = makeShots(world);
    this.rng = new Rng(settings.seed || 20260821);
    this.ctx = {
      world,
      audio,
      camera: stage.camera,
      viewport: stage.viewport,
      liftPx: input.liftPx,
    };

    input.onDown = (t) => this.onDown(t);
    input.onMove = (t) => this.onMove(t);
    input.onUp = (t) => this.onUp(t);

    hud.onKnob = (x, y) => {
      world.crawler.aimX = x;
      world.crawler.aimY = y;
      this.hintTimer = 0;
      this.hud.clearHint();
    };
    hud.onLeverFire = () => this.fireDroplet();
    hud.onTool = (id) => this.pickTool(id);
    hud.onWaterAgain = () => this.replayWater();
    hud.onNextFault = () => this.nextRound();

    world.droplet.onSnag = () => this.onSnag();
    world.droplet.onFinish = () => this.onDropletFinished();
  }

  // ---- lifecycle -------------------------------------------------------

  begin(): void {
    this.round = 0;
    this.prepareRound();
    this.world.crawler.setU(0.002);
    this.world.crawler.setLampEnabled(true, this.stage.tier >= 1);
    if (settings.e2e && settings.jump) {
      this.world.crawler.setU(this.parkingU());
      this.outdoor = 0;
      this.director.snap(this.shots.inspect, this.stage.viewport);
      this.beginLightSearch();
      return;
    }
    this.setPhase('establish');
    this.director.snap(this.shots.establish, this.stage.viewport);
  }

  private prepareRound(): void {
    const kind = defectForRound(this.round, this.rng);
    const seam = seamForRound(this.round, this.world.collars.length);
    for (const c of this.world.collars) {
      if (c.index === seam) continue;
      if (c.defect) c.clearDefect();
    }
    this.world.setActive(seam);
    this.world.active.setDefect(kind);
    this.steps = [...DEFECT_STEPS[kind]];
    this.stepIndex = 0;
    this.world.droplet.obstacleU = this.world.active.u;
    this.world.droplet.obstacleStrength = kind === 'step' || kind === 'oldSealant' ? 1 : 0.72;
  }

  private setPhase(p: Phase): void {
    if (p !== 'drive') this.audio.loop('wheels')?.silence();
    if (p !== 'dropWatch') this.audio.loop('flow')?.silence();
    if (p !== 'raftTest') this.audio.loop('raft')?.silence();
    this.phase = p;
    this.timer = 0;
    this.hintTimer = 0;
    this.hud.clearHint();
  }

  // ---- input routing ---------------------------------------------------

  private onDown(t: Touch2D): void {
    if (this.phase === 'drive') {
      this.driveStarted = true;
      this.hud.clearHint();
      return;
    }
    if (this.phase === 'treat' && this.step) {
      this.hud.clearHint();
      this.step.down(t);
    }
  }

  private onMove(t: Touch2D): void {
    if (this.phase === 'drive') {
      const along = t.dx * this.driveDir.x + t.dy * this.driveDir.y;
      if (along > 0) {
        this.drivePush = clamp(Math.max(this.drivePush, along / t.dt / 780), 0, 1);
      }
      return;
    }
    if (this.phase === 'treat' && this.step) this.step.move(t);
  }

  private onUp(t: Touch2D): void {
    if (this.phase === 'treat' && this.step) this.step.up(t);
  }

  // ---- droplet ---------------------------------------------------------

  private fireDroplet(): void {
    if (this.phase !== 'dropTest') return;
    this.audio.dropRelease();
    this.world.park.setLever(1);
    this.waterQuality = this.world.active.quality();
    this.world.droplet.obstacleU = this.world.active.u;
    this.world.droplet.obstacleStrength = clamp((1 - this.waterQuality) * 0.9, 0, 0.7);
    this.world.droplet.release(0.012);
    this.hud.showLever(false);
    this.hud.showEnd(false);
    this.setPhase('dropWatch');
    this.director.play(this.shots.waterTest, 1.1, 'waterTest');
  }

  private onSnag(): void {
    this.audio.snag();
    if (this.phase === 'introDrop') {
      this.setPhase('introSnag');
      this.director.play(this.shots.snagWatch, 1.6, 'snagWatch');
    }
  }

  private onDropletFinished(): void {
    if (this.phase === 'dropWatch') {
      this.audio.splash();
      void this.startRaftTest();
      return;
    }
    // A fault that only slows the water needs the water to keep coming, or the
    // clue disappears down the pipe and never returns.
    if (this.phase === 'drive' || this.phase === 'lightSearch') this.respawn = 2.4;
  }

  private replayWater(): void {
    this.hud.showEnd(false);
    this.setPhase('dropTest');
    this.director.play(this.shots.waterTest, 1.2, 'waterTest');
    this.hud.showLever(true);
  }

  private async startRaftTest(): Promise<void> {
    await this.world.buildTestRig();
    this.setPhase('raftTest');
    this.director.play(this.shots.raftOutside, 1.8, 'raftOutside');
    this.audio.setOutdoor(1);
    this.world.raft.release(0.02);
    this.world.raft.onFinish = () => {
      this.audio.splash();
      this.audio.loop('raft')?.silence();
      this.endRound();
    };
  }

  private endRound(): void {
    this.setPhase('roundEnd');
    this.audio.roundDone();
    this.director.play(this.shots.finish, 2.4, 'finish');
    this.hud.setBeads(0, 0);
    window.setTimeout(() => {
      if (this.phase === 'roundEnd') this.hud.showEnd(true);
    }, 1200);
  }

  private nextRound(): void {
    this.hud.showEnd(false);
    this.round++;
    const prev = this.world.activeIndex;
    this.prepareRound();
    this.world.collars[prev].markMaps();
    this.driveTarget = this.parkingU();
    // A fault behind the machine means this run is finished: come back out and
    // start a fresh pass from the inspection bench.
    const restart = this.driveTarget <= this.world.crawler.u + 0.002;
    if (restart) {
      this.world.crawler.setU(0.002);
      this.world.crawler.speed = 0;
      this.outdoor = 1;
    }
    this.driveStarted = false;
    this.drivePush = 0;
    this.releaseInspectionDrop(restart);
    this.setPhase('drive');
    this.director.play(
      restart ? this.shots.deck : this.shots.driveFollow,
      2.0,
      restart ? 'deck' : 'driveFollow',
    );
  }

  /** Sends a fresh inspection droplet down ahead of the machine. */
  private releaseInspectionDrop(fromMouth: boolean): void {
    const u = fromMouth
      ? 0.012
      : Math.min(0.9, this.world.crawler.u + this.world.slide.metersToU(0.5));
    this.world.droplet.obstacleU = this.world.active.u;
    this.world.droplet.obstacleStrength =
      this.world.active.defect === 'step' || this.world.active.defect === 'oldSealant' ? 1 : 0.72;
    this.world.droplet.release(u);
    this.respawn = 0;
  }

  /** Where the machine stops: close enough to work, far enough to rake light. */
  private parkingU(): number {
    return Math.max(0.004, this.world.active.u - this.world.slide.metersToU(2.6));
  }

  // ---- tools -----------------------------------------------------------

  private get pickingTools(): boolean {
    return this.round >= 2;
  }

  private beginStep(): void {
    const id = this.steps[this.stepIndex];
    if (this.pickingTools) {
      this.pendingTool = id;
      const options = this.toolOptions(id);
      this.hud.showTray(options, null);
      this.hud.showKnob(false);
      this.toolHintTimer = 0;
      this.setPhase('toolPick');
      return;
    }
    this.startStep(id);
  }

  private toolOptions(correct: StepId): StepId[] {
    const others = ALL_TOOLS.filter((x) => x !== correct);
    const picks: StepId[] = [correct];
    while (picks.length < 3 && others.length) {
      picks.push(others.splice(this.rng.int(others.length), 1)[0]);
    }
    // stable ordering so the answer is not always in the same slot
    return picks.sort(
      (a, b) => ALL_TOOLS.indexOf(a) - ALL_TOOLS.indexOf(b) + (this.rng.next() - 0.5) * 0.01,
    );
  }

  private pickTool(id: StepId): void {
    if (this.phase !== 'toolPick') return;
    if (id !== this.pendingTool) {
      this.audio.nope();
      this.hud.markTool(id, 'wrong', true);
      return;
    }
    this.audio.tap();
    this.hud.clearToolMarks();
    this.hud.markTool(id, 'picked', true);
    this.startStep(id);
  }

  private startStep(id: StepId): void {
    this.ctx.viewport = this.stage.viewport;
    this.ctx.liftPx = this.input.liftPx;
    this.step = makeStep(id, this.ctx);
    this.step.enter();
    this.setPhase('treat');
    this.hud.showKnob(false);
    this.hud.setBeads(this.steps.length, this.stepIndex);
    this.director.play(this.shots.rake, this.director.name === 'rake' ? 0.5 : 1.4, 'rake');
  }

  private finishStep(): void {
    this.step?.exit();
    this.step = null;
    this.stepIndex++;
    this.hud.setBeads(this.steps.length, this.stepIndex);
    this.hud.showTray(null);
    if (this.stepIndex >= this.steps.length) {
      this.setPhase('dropTest');
      this.hud.setBeads(0, 0);
      this.director.play(this.shots.waterTest, 1.6, 'waterTest');
      this.hud.showLever(true);
    } else {
      this.setPhase('stepBeat');
    }
  }

  // ---- reveal ----------------------------------------------------------

  /** How clearly the lamp is currently exposing the fault. */
  private computeReveal(): number {
    const crawler = this.world.crawler;
    const collar = this.world.active;
    const slide = this.world.slide;
    const aim = crawler.aimSlide();
    const du = (aim.u - collar.u) * slide.length;
    const alongOk = 1 - smoothstep(clamp((Math.abs(du) - 0.12) / 0.46, 0, 1));
    const acrossOk = 1 - smoothstep(clamp((Math.abs(aim.theta) - 0.1) / 0.3, 0, 1));
    crawler.lampWorld(this.tmp);
    slide.floorAt(collar.u, 0, this.tmp2);
    this.tmp2.sub(this.tmp).normalize();
    slide.normalAt(collar.u, 0, this.tmp);
    const graze = clamp(1 - Math.abs(this.tmp2.dot(this.tmp)) * 1.9, 0, 1);
    return alongOk * acrossOk * (0.58 + 0.42 * graze);
  }

  // ---- frame -----------------------------------------------------------

  update(dt: number): void {
    this.timer += dt;
    if (this.respawn > 0) {
      this.respawn -= dt;
      if (this.respawn <= 0 && (this.phase === 'drive' || this.phase === 'lightSearch')) {
        this.releaseInspectionDrop(false);
      }
    }
    this.ctx.viewport = this.stage.viewport;
    this.ctx.liftPx = this.input.liftPx;
    this.audio.setOutdoor(this.outdoor);
    const wantWorkLight =
      this.phase === 'treat' || this.phase === 'discover' || this.phase === 'toolPick';
    this.world.workLight.intensity = damp(
      this.world.workLight.intensity,
      wantWorkLight ? 0.75 : 0,
      3,
      dt,
    );

    switch (this.phase) {
      case 'establish':
        this.outdoor = 1;
        if (this.timer > (settings.turbo ? 1.2 : 4.6)) {
          this.setPhase('introDrop');
          this.world.droplet.release(0.012);
          this.audio.dropRelease();
          this.world.park.setLever(1);
          this.director.play(this.shots.dropChase, 2.2, 'dropChase');
        }
        break;

      case 'introDrop':
        this.outdoor = damp(this.outdoor, this.world.droplet.u > 0.02 ? 0 : 1, 2.2, dt);
        break;

      case 'introSnag':
        this.outdoor = 0;
        if (this.timer > (settings.turbo ? 1.2 : 2.9)) {
          this.driveTarget = this.parkingU();
          this.driveStarted = false;
          this.drivePush = 0;
          this.setPhase('drive');
          this.director.play(this.shots.deck, 2.0, 'deck');
        }
        break;

      case 'drive':
        this.updateDrive(dt);
        break;

      case 'lightSearch':
        this.updateLightSearch(dt);
        this.world.crawler.fill.intensity = damp(this.world.crawler.fill.intensity, 0.6, 2, dt);
        break;

      case 'discover':
        this.outdoor = 0;
        if (this.timer > 1.1) this.world.droplet.stopNow();
        if (this.timer > (settings.turbo ? 0.6 : 2.0)) this.beginStep();
        break;

      case 'toolPick':
        this.toolHintTimer += dt;
        if (this.toolHintTimer > 6 && this.pendingTool) {
          this.hud.markTool(this.pendingTool, 'hint', true);
        }
        break;

      case 'treat':
        this.updateTreat(dt);
        break;

      case 'stepBeat':
        if (this.timer > 0.45) this.beginStep();
        break;

      case 'dropTest': {
        this.world.park.setLever(this.hud.leverValue);
        this.hintTimer += dt;
        if (this.hintTimer > 3.2 && !this.hud.hinting) {
          const from = this.hud.leverCentre();
          this.hud.showHint({
            kind: 'swipe',
            from,
            to: { x: from.x, y: from.y + this.hud.leverTravel() },
            period: 1.8,
          });
        }
        break;
      }

      case 'dropWatch': {
        this.world.park.setLever(damp(this.world.park.leverPivot.rotation.x / 0.85, 0, 4, dt));
        this.outdoor = this.world.droplet.u > 0.02 ? 0 : 1;
        const v = clamp(this.world.droplet.speed / 2.6, 0, 1);
        this.audio.loop('flow')?.set(this.world.droplet.running ? 0.02 + v * 0.06 : 0, 1500 + v * 1400, 0.8 + v * 0.5);
        break;
      }

      case 'raftTest':
        this.outdoor = 1;
        this.audio.loop('raft')?.set(0.05 + clamp(this.world.raft.speed / 6, 0, 1) * 0.1, 220, 1);
        break;

      case 'roundEnd':
        this.outdoor = 1;
        break;

      default:
        break;
    }

    if (this.phase !== 'treat' && this.phase !== 'toolPick') this.hud.showTray(null);
    this.world.crawler.setLampEnabled(
      this.phase !== 'establish' && this.phase !== 'raftTest' && this.phase !== 'roundEnd',
      this.stage.tier >= 1,
    );
  }

  private updateDrive(dt: number): void {
    const crawler = this.world.crawler;
    const slide = this.world.slide;
    this.outdoor = damp(this.outdoor, crawler.u * slide.length > 2.2 ? 0 : 1, 1.8, dt);

    const remaining = (this.driveTarget - crawler.u) * slide.length;
    const brake = clamp(remaining / 1.6, 0, 1);
    const target = this.drivePush * 2.6 * brake;
    crawler.speed = damp(crawler.speed, target, 3.4, dt);
    this.drivePush = damp(this.drivePush, 0, 2.6, dt);
    crawler.setU(crawler.u + (crawler.speed * dt) / slide.length);
    this.audio
      .loop('wheels')
      ?.set(clamp(crawler.speed / 2.6, 0, 1) * 0.1, 180 + crawler.speed * 90, 0.7 + crawler.speed * 0.2);

    // aim the beam along the pipe so the machine reads as looking where it goes
    crawler.aimX = damp(crawler.aimX, 0, 2, dt);
    crawler.aimY = damp(crawler.aimY, 0.05, 2, dt);

    if (crawler.u * slide.length > 3.4 && this.director.name === 'deck') {
      this.director.play(this.shots.driveFollow, 1.9, 'driveFollow');
    }

    this.updateDriveDir();

    if (remaining <= 0.06 && crawler.speed < 0.12) {
      this.audio.loop('wheels')?.silence();
      this.audio.latch();
      crawler.speed = 0;
      this.beginLightSearch();
      return;
    }

    this.hintTimer += dt;
    const wait = this.round === 0 ? 2.4 : 4.5;
    if (this.hintTimer > wait && !this.hud.hinting && !this.driveStarted) {
      const cx = this.stage.viewport.width * 0.5;
      const cy = this.stage.viewport.height * (this.stage.viewport.portrait ? 0.66 : 0.6);
      const len = this.stage.viewport.minEdge * 0.32;
      this.hud.showHint({
        kind: 'swipe',
        from: { x: cx - this.driveDir.x * len * 0.5, y: cy - this.driveDir.y * len * 0.5 },
        to: { x: cx + this.driveDir.x * len * 0.5, y: cy + this.driveDir.y * len * 0.5 },
        period: 1.6,
      });
    }
  }

  /** Screen direction that means "further into the pipe" for the current shot. */
  private updateDriveDir(): void {
    const slide = this.world.slide;
    const near = slide.floorAt(clamp(this.world.crawler.u + 0.002, 0, 1), 0.2, this.tmp).clone();
    const far = slide.floorAt(clamp(this.world.crawler.u + 0.05, 0, 1), 0.2, this.tmp2).clone();
    const cam = this.stage.camera;
    near.project(cam);
    far.project(cam);
    const dx = (far.x - near.x) * 0.5 * this.stage.viewport.width;
    const dy = -(far.y - near.y) * 0.5 * this.stage.viewport.height;
    const len = Math.hypot(dx, dy);
    if (len > 4) this.driveDir.set(dx / len, dy / len);
  }

  private beginLightSearch(): void {
    this.setPhase('lightSearch');
    this.reveal = 0;
    this.revealHold = 0;
    this.twitchTimer = 0;
    // Park the beam deliberately short and off to one side: the fault has to be
    // found, not handed over.
    this.world.crawler.aimX = -0.52;
    this.world.crawler.aimY = -0.58;
    this.hud.showKnob(true);
    this.hud.setKnob(this.world.crawler.aimX, this.world.crawler.aimY);
    this.director.play(this.shots.inspect, 1.8, 'inspect');
  }

  private updateLightSearch(dt: number): void {
    this.outdoor = 0;
    const r = this.computeReveal();
    this.reveal = damp(this.reveal, r, 6, dt);
    const collar = this.world.active;
    if (collar.ribbon.peelable) {
      collar.ribbon.lift = damp(collar.ribbon.lift, this.reveal, 4, dt);
      collar.ribbon.rebuild();
    }
    if (r > 0.62) {
      this.revealHold += dt;
      if (this.revealHold > 0.42) {
        this.audio.discovery();
        this.hud.showKnob(false);
        this.setPhase('discover');
        this.director.play(this.shots.rake, 2.0, 'rake');
      }
    } else {
      this.revealHold = Math.max(0, this.revealHold - dt * 0.6);
    }

    this.hintTimer += dt;
    this.twitchTimer += dt;
    const wait = this.round === 0 ? 4.0 : 8.0;
    if (this.twitchTimer > wait) {
      this.twitchTimer = 0;
      if (this.world.droplet.group.visible) {
        this.world.droplet.twitch();
        this.audio.snag();
      } else if (this.respawn <= 0) {
        this.respawn = 0.6;
      }
    }
    if (this.hintTimer > wait * 1.4 && !this.hud.hinting) {
      const kr = this.stage.viewport.minEdge * 0.09;
      const knob = this.hud.landscape
        ? { x: this.stage.viewport.width * 0.86, y: this.stage.viewport.height * 0.78 }
        : { x: this.stage.viewport.width * 0.5, y: this.stage.viewport.height * 0.86 };
      this.hud.showHint({ kind: 'knob', from: knob, radius: kr, period: 2.6 });
    }
  }

  private updateTreat(dt: number): void {
    this.outdoor = 0;
    // keep the lamp on the work while a head is in contact
    this.world.crawler.aimX = damp(this.world.crawler.aimX, 0, 3, dt);
    this.world.crawler.aimY = damp(this.world.crawler.aimY, 0, 3, dt);
    this.world.crawler.fill.intensity = damp(this.world.crawler.fill.intensity, 1.1, 2, dt);
    const step = this.step;
    if (!step) return;
    step.update(dt);
    if (step.done) {
      this.finishStep();
      return;
    }
    if (step.hinting && !this.hud.hinting) {
      this.hud.showHint(step.hint());
    }
  }

  /** Snapshot used by the automated browser pass. */
  snapshot(): Record<string, unknown> {
    const centre = toScreen(this.ctx, workPoint(this.ctx, 0, 0).point);
    return {
      workScreen: { x: Math.round(centre.x), y: Math.round(centre.y) },
      liftPx: Math.round(this.input.liftPx),
      driveDir: { x: Number(this.driveDir.x.toFixed(3)), y: Number(this.driveDir.y.toFixed(3)) },
      phase: this.phase,
      round: this.round,
      seam: this.world.activeIndex,
      defect: this.world.active?.defect ?? null,
      steps: this.steps,
      stepIndex: this.stepIndex,
      stepId: this.step?.id ?? null,
      stepProgress: this.step ? Number(this.step.progress.toFixed(3)) : 0,
      reveal: Number(this.reveal.toFixed(3)),
      crawlerU: Number(this.world.crawler.u.toFixed(4)),
      dropU: Number(this.world.droplet.u.toFixed(4)),
      quality: Number((this.world.active?.quality() ?? 0).toFixed(3)),
      workTheta: WORK_THETA,
    };
  }
}
