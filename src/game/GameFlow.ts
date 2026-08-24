import { Mesh, Raycaster, Scene, Vector2, Vector3 } from 'three';
import { AuscultationChannel } from '../audio/AuscultationChannel';
import { AudioSession } from '../audio/AudioSession';
import { BodySoundField, type ChestCoord, type WindowId } from '../audio/BodySoundField';
import { HeartScheduler, HeartSoundSource, type ScheduledChannel } from '../audio/HeartSoundSource';
import { RoomNoiseMixer } from '../audio/RoomNoiseMixer';
import { CardiacClock } from '../core/CardiacClock';
import { clamp01, damp, lerp } from '../core/mathutil';
import { ChestpieceDrag } from '../interaction/ChestpieceDrag';
import { PointerInput } from '../interaction/PointerInput';
import { StethoscopeContact } from '../interaction/StethoscopeContact';
import { AdaptiveQuality } from '../render/AdaptiveQuality';
import { createRenderer } from '../render/Renderer';
import type { AnatomyModel } from '../scene/AnatomyModel';
import { chestSurfacePoint } from '../scene/ChestSurface';
import { InstructorHand } from '../scene/InstructorHand';
import { Lighting } from '../scene/Lighting';
import { Manikin } from '../scene/Manikin';
import { RecordTiles } from '../scene/RecordTiles';
import { Room } from '../scene/Room';
import { Stethoscope } from '../scene/Stethoscope';
import { createMaterials } from '../scene/materials';
import { Hud } from '../ui/Hud';
import { CameraDirector } from './CameraDirector';
import { ChildGuidance } from './ChildGuidance';
import { ComparisonRecorder } from './ComparisonRecorder';
import { DelayedAnatomyReveal } from './DelayedAnatomyReveal';
import { WindowDiscovery } from './WindowDiscovery';

type Stage =
  | 'eartips'
  | 'centre'
  | 'seekFirst'
  | 'reveal'
  | 'seekSecond'
  | 'compareTwo'
  | 'fourWindows'
  | 'findFirstSound'
  | 'findSecondSound'
  | 'freePlay';

const NEUTRAL: ChestCoord = { lat: 0.0, sup: 0.3 };

/** Where the chestpiece waits before the instructor picks it up. */
const STAND_REST = new Vector3(0.1, 0.828, 0.09);

export class GameFlow {
  private scene = new Scene();
  private renderer = createRenderer(document.getElementById('app') as HTMLElement);
  private director = new CameraDirector();
  private lighting: Lighting;
  private quality: AdaptiveQuality;

  private mats = createMaterials();
  private room: Room;
  private manikin: Manikin;
  private steth: Stethoscope;
  private hand: InstructorHand;
  private tiles: RecordTiles;
  private anatomy: AnatomyModel | null = null;
  private anatomyLoading = false;

  private clock = new CardiacClock();
  private field = new BodySoundField();
  private audio = new AudioSession();
  private heart: HeartSoundSource | null = null;
  private scheduler: HeartScheduler | null = null;
  private live: AuscultationChannel | null = null;
  private roomNoise: RoomNoiseMixer | null = null;

  private pointer: PointerInput;
  private drag: ChestpieceDrag;
  private contact = new StethoscopeContact();
  private discovery: WindowDiscovery;
  private recorder: ComparisonRecorder;
  private reveal: DelayedAnatomyReveal | null = null;
  private guidance: ChildGuidance;
  private hud: Hud;

  private raycaster = new Raycaster();
  private ndc = new Vector2();
  private stage: Stage = 'eartips';
  private stageTime = 0;
  private earTipsSeated = 0;
  private chestpieceMode: 'stand' | 'placing' | 'chest' = 'stand';
  private placingT = 0;
  private placeFrom = new Vector3();
  private roundListens = new Set<WindowId>();
  private lastListened: WindowId | null = null;
  private alternations = 0;
  private lateralRoll = 0;
  private handleDrag: { active: boolean; startY: number } = { active: false, startY: 0 };
  private lastFrame = performance.now();
  private tremorEnergy = 0;
  private standTarget = new Vector3();
  private tmpV = new Vector3();
  private tmpN = new Vector3();
  private running = false;

  constructor() {
    const container = document.getElementById('app') as HTMLElement;
    this.lighting = new Lighting(this.scene, this.renderer);
    this.quality = new AdaptiveQuality(this.renderer, this.lighting);

    this.room = new Room(this.mats);
    this.manikin = new Manikin(this.mats);
    this.steth = new Stethoscope(this.mats);
    this.hand = new InstructorHand(this.mats);
    this.tiles = new RecordTiles(this.mats);

    this.scene.add(this.lighting.root);
    this.scene.add(this.room.root);
    this.scene.add(this.manikin.root);
    this.scene.add(this.steth.root);
    this.scene.add(this.hand.root);
    this.room.tileAnchor.add(this.tiles.root);

    this.pointer = new PointerInput(this.renderer.domElement);
    this.drag = new ChestpieceDrag(this.pointer, this.director, this.field);
    this.drag.place(NEUTRAL);
    this.discovery = new WindowDiscovery(this.field, this.clock);
    this.recorder = new ComparisonRecorder(this.field, this.clock, this.tiles);
    this.guidance = new ChildGuidance(this.hand, this.clock);
    this.hud = new Hud(container, this.audio);

    this.discovery.onDiscover((e) => this.handleDiscovery(e.id, e.coord, e.firstTime));
    this.recorder.setOnPlay((id) => this.noteListen(id));

    this.pointer.setHandlers({
      press: (x, y) => this.handlePress(x, y),
      release: () => this.handleRelease(),
      tap: (x, y) => this.handleTap(x, y),
    });

    window.addEventListener('resize', () => this.layout());
    window.addEventListener('orientationchange', () => setTimeout(() => this.layout(), 260));
    document.addEventListener('visibilitychange', () => this.handleVisibility());
    this.layout();
    this.enterStage('eartips');
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---------------------------------------------------------------- layout

  private layout(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.director.setViewport(w, h);

    // Portrait puts the stand down towards the foot of the table so the chest
    // can be explored from the clavicles to the costal margin; landscape puts
    // it out to the side so the chest and the tiles sit left and right.
    if (this.director.isPortrait()) {
      this.standTarget.set(0.44, 0, 0.66);
      this.room.instrumentStand.rotation.y = -0.75;
      this.drag.fingerOffsetPx = 44;
    } else {
      this.standTarget.set(0.66, 0, 0.2);
      this.room.instrumentStand.rotation.y = -0.42;
      this.drag.fingerOffsetPx = 50;
    }
  }

  private handleVisibility(): void {
    if (document.hidden) {
      this.audio.suspendForBackground();
    } else {
      void this.audio.resumeFromBackground();
      this.clock.resync();
      this.lastFrame = performance.now();
    }
  }

  // ----------------------------------------------------------------- input

  private pick(x: number, y: number, targets: Mesh[]): Mesh | null {
    if (!targets.length) return null;
    this.pointer.toNdc(x, y, this.ndc);
    this.raycaster.setFromCamera(this.ndc, this.director.camera);
    const hits = this.raycaster.intersectObjects(targets, true);
    return hits.length ? (hits[0].object as Mesh) : null;
  }

  private handlePress(x: number, y: number): void {
    if (this.stage === 'eartips') {
      void this.seatEarTips();
      return;
    }
    // The rail is a big, obvious handle, so it is checked before the chest.
    const railHit = this.pick(x, y, this.room.bedHandle.children as Mesh[]);
    if (railHit && this.stage !== 'centre' && this.stage !== 'seekFirst') {
      this.handleDrag.active = true;
      this.handleDrag.startY = y;
      return;
    }
    if (this.pick(x, y, this.tiles.pickables())) return;
    if (this.chestpieceMode === 'chest') {
      this.contact.setPressed(true);
      this.roomNoise?.contact();
    }
  }

  private handleRelease(): void {
    this.handleDrag.active = false;
    this.contact.setPressed(false);
  }

  private handleTap(x: number, y: number): void {
    const tile = this.pick(x, y, this.tiles.pickables());
    if (tile && tile.userData.tileId) {
      const id = tile.userData.tileId as WindowId;
      this.recorder.play(id);
      this.refreshScheduler();
    }
  }

  private async seatEarTips(): Promise<void> {
    if (this.earTipsSeated > 0) return;
    this.earTipsSeated = 0.001;
    const ok = await this.audio.unlock();
    if (ok && this.audio.ctx) this.buildAudioGraph();
    this.enterStage('centre');
  }

  // ----------------------------------------------------------------- audio

  private buildAudioGraph(): void {
    const ctx = this.audio.ctx;
    if (!ctx || this.heart) return;
    this.clock.rebase(() => ctx.currentTime);
    this.heart = new HeartSoundSource(ctx);
    this.live = new AuscultationChannel(ctx, this.audio.auscultationBus);
    this.roomNoise = new RoomNoiseMixer(ctx, this.audio.ambientBus);
    this.recorder.attachAudio(ctx, this.audio.auscultationBus);
    this.scheduler = new HeartScheduler(this.clock, this.heart);
    this.refreshScheduler();
    this.scheduler.start();
  }

  private liveTarget(): ScheduledChannel {
    return {
      channel: this.live!,
      profileFor: () => this.field.sample(this.drag.coord),
    };
  }

  private refreshScheduler(): void {
    if (!this.scheduler || !this.live) return;
    this.recorder.refreshScheduler(this.scheduler, this.liveTarget());
  }

  // ---------------------------------------------------------------- stages

  private enterStage(stage: Stage): void {
    this.stage = stage;
    this.stageTime = 0;
    this.roundListens.clear();
    this.discovery.resetRoundVisits();
    this.guidance.markSound(null);

    switch (stage) {
      case 'eartips':
        this.guidance.setLevel('full');
        this.guidance.setPose('offstage');
        this.drag.setEnabled(false);
        break;

      case 'centre':
        // The instructor sets the chestpiece down in the middle of the chest.
        this.beginPlacement();
        this.guidance.setPose('placing');
        this.guidance.say('ゆびで おさえて きいてみよう', 8);
        this.director.setShot('chestThreeQuarter');
        this.drag.setEnabled(false);
        void this.loadAnatomy();
        break;

      case 'seekFirst':
        // Slack comes out of the tubing, and the chestpiece can now be slid.
        this.guidance.setPose('loosenTube');
        this.guidance.say('ゆびを すべらせてみよう', 8);
        this.drag.setEnabled(true);
        this.director.setShot('listening');
        this.director.setLocked(true);
        break;

      case 'reveal':
        this.guidance.setPose('resting');
        this.guidance.clearCaption();
        this.director.setLocked(false);
        break;

      case 'seekSecond':
        this.guidance.setLevel('light');
        this.guidance.setPose('resting');
        this.guidance.say('うえの ほうも きいてみよう', 8);
        this.drag.setEnabled(true);
        this.director.setShot('compare');
        this.director.setLocked(true);
        break;

      case 'compareTwo':
        this.alternations = 0;
        this.lastListened = null;
        this.guidance.say('ふたつを きき くらべよう', 8);
        this.director.setShot('compare');
        break;

      case 'fourWindows':
        this.guidance.setLevel('light');
        this.guidance.startHalvesSweep();
        this.guidance.clearCaption();
        this.director.setShot('play');
        this.director.setLocked(true);
        break;

      case 'findFirstSound':
        // No sentence, no marker: the instructor knocks once on the rail at
        // the moment of the first sound, and the child goes looking.
        this.guidance.setLevel('gesture');
        this.guidance.setPose('tapRail');
        this.guidance.clearCaption();
        this.guidance.markSound(1);
        break;

      case 'findSecondSound':
        this.guidance.setLevel('gesture');
        this.guidance.setPose('tapRail');
        this.guidance.clearCaption();
        this.guidance.markSound(2);
        break;

      case 'freePlay':
        this.guidance.setLevel('none');
        this.guidance.clearCaption();
        this.director.setShot('play');
        this.director.setLocked(true);
        break;
    }
  }

  private beginPlacement(): void {
    this.chestpieceMode = 'placing';
    this.placingT = 0;
    this.placeFrom.copy(this.steth.chestpiece.position);
    this.drag.place(NEUTRAL);
  }

  private async loadAnatomy(): Promise<void> {
    if (this.anatomy || this.anatomyLoading) return;
    this.anatomyLoading = true;
    // The detailed interior is only needed once something has been heard, so
    // it is fetched while the child is listening to the first few cycles.
    const mod = await import('../scene/AnatomyModel');
    this.anatomy = new mod.AnatomyModel(this.mats);
    this.scene.add(this.anatomy.root);
    this.reveal = new DelayedAnatomyReveal(this.director, this.anatomy);
    this.anatomyLoading = false;
  }

  private noteListen(id: WindowId): void {
    if (this.lastListened && this.lastListened !== id) this.alternations++;
    this.lastListened = id;
    this.roundListens.add(id);
  }

  private handleDiscovery(id: WindowId, coord: ChestCoord, firstTime: boolean): void {
    this.noteListen(id);

    if (this.stage === 'seekFirst' && firstTime) {
      this.recorder.record(id, coord);
      this.refreshScheduler();
      this.startReveal();
      return;
    }
    if (this.stage === 'seekSecond') {
      if (!this.recorder.has(id)) {
        this.recorder.record(id, coord);
        this.refreshScheduler();
      }
      if (this.recorder.count >= 2) this.enterStage('compareTwo');
      return;
    }
    if (this.stage === 'fourWindows' || this.stage === 'compareTwo') {
      if (!this.recorder.has(id)) {
        this.recorder.record(id, coord);
        this.refreshScheduler();
      }
    }
  }

  private startReveal(): void {
    if (!this.reveal || !this.anatomy) {
      // The interior has not arrived yet: keep listening, try again shortly.
      window.setTimeout(() => {
        if (this.stage === 'seekFirst') this.startReveal();
      }, 400);
      return;
    }
    this.enterStage('reveal');
    const s = chestSurfacePoint(this.drag.coord);
    this.reveal.start(s.position, s.normal, () => this.enterStage('seekSecond'));
  }

  private advanceStages(dt: number): void {
    this.stageTime += dt;
    switch (this.stage) {
      case 'centre':
        // A few complete cycles at the neutral spot, then the tubing is freed.
        if (this.chestpieceMode === 'chest' && this.contact.value > 0.45 && this.stageTime > 5.5) {
          this.enterStage('seekFirst');
        }
        break;
      case 'compareTwo':
        if (this.alternations >= 2) this.enterStage('fourWindows');
        break;
      case 'fourWindows':
        if (this.recorder.count >= 4) this.enterStage('findFirstSound');
        break;
      case 'findFirstSound':
        if (this.roundListens.size >= 3) this.enterStage('findSecondSound');
        break;
      case 'findSecondSound':
        if (this.roundListens.size >= 3) this.enterStage('freePlay');
        break;
      default:
        break;
    }
  }

  // ------------------------------------------------------------------ loop

  private frame(): void {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    this.pointer.update(dt);
    this.quality.update(dt);

    // Instrument stand rolls to wherever this orientation wants it.
    const stand = this.room.instrumentStand.position;
    stand.x = damp(stand.x, this.standTarget.x, 3.4, dt);
    stand.z = damp(stand.z, this.standTarget.z, 3.4, dt);

    this.updateHandle(dt);
    this.updateChestpiece(dt);
    this.updateAudio(dt);

    this.discovery.update(this.drag.coord, this.contact.value);
    this.recorder.update();
    this.tiles.update(dt);
    this.guidance.update(dt, this.roomNoise);
    this.manikin.update(dt, this.clock);
    this.reveal?.update(dt);
    this.anatomy?.update(dt, this.clock);
    this.updateSkinFade();
    this.advanceStages(dt);

    if (this.stage === 'eartips') this.frameEarTips(dt);

    this.hand.update(dt, this.chestpieceMode === 'chest' ? this.steth.chestpiece.position : null);
    this.steth.updateTube(now / 1000);
    this.director.update(dt);
    this.hud.setCaption(this.guidance.getCaption());

    this.renderer.render(this.scene, this.director.camera);
  }

  private frameEarTips(dt: number): void {
    // Frame the training listening head on the stand and wait for the eartips
    // to be pushed in. This is the first touch, and it is what starts audio.
    this.room.listeningHead.updateWorldMatrix(true, false);
    const head = this.tmpV.setFromMatrixPosition(this.room.listeningHead.matrixWorld);
    const target = head.clone();
    target.y += 0.13;
    this.director.setDynamic((out) => {
      out.position.set(target.x + 0.2, target.y + 0.14, target.z + 0.34);
      out.target.copy(target);
      out.fov = this.director.isPortrait() ? 34 : 30;
    }, 1.5);
    if (this.stageTime > 0.2) this.guidance.say('みみに つけてね', 30);
    this.stageTime += dt;
  }

  private updateHandle(dt: number): void {
    if (this.handleDrag.active) {
      const dy = this.handleDrag.startY - this.pointer.state.y;
      if (Math.abs(dy) > 34) {
        this.lateralRoll = dy > 0 ? 1 : 0;
        this.handleDrag.active = false;
      }
    }
    this.manikin.setLateralRoll(this.lateralRoll);
    this.field.setLateralRoll(this.manikin.getLateralRoll());
    // The rail lifts slightly when the manikin is turned, as a real one does.
    this.room.bedHandle.position.y = damp(
      this.room.bedHandle.position.y,
      0.89 + this.manikin.getLateralRoll() * 0.03,
      4,
      dt,
    );
  }

  private updateChestpiece(dt: number): void {
    // The binaural stays plugged into the training listening head on the stand.
    this.room.listeningHead.updateWorldMatrix(true, false);
    const head = this.tmpV.setFromMatrixPosition(this.room.listeningHead.matrixWorld);
    this.steth.binaural.position.set(head.x, head.y + 0.03, head.z + 0.012);
    this.steth.binaural.rotation.y = this.room.instrumentStand.rotation.y;
    const seat = clamp01(this.earTipsSeated);
    for (let i = 0; i < this.steth.earTips.length; i++) {
      const sx = i === 0 ? -1 : 1;
      this.steth.earTips[i].position.x = lerp(sx * 0.098, sx * 0.079, seat);
    }
    if (this.earTipsSeated > 0 && this.earTipsSeated < 1) {
      this.earTipsSeated = Math.min(1, this.earTipsSeated + dt * 2.6);
    }

    if (this.chestpieceMode === 'stand') {
      this.room.instrumentStand.updateWorldMatrix(true, false);
      const p = STAND_REST.clone().applyMatrix4(this.room.instrumentStand.matrixWorld);
      this.steth.setPose(p, this.tmpN.set(0, 1, 0), 0, dt);
      return;
    }

    const s = chestSurfacePoint(this.drag.coord);
    if (this.chestpieceMode === 'placing') {
      this.placingT = Math.min(1, this.placingT + dt / 1.35);
      const k = this.placingT * this.placingT * (3 - 2 * this.placingT);
      const p = this.placeFrom.clone().lerp(s.position, k);
      p.y += Math.sin(k * Math.PI) * 0.055;
      this.steth.setPose(p, this.tmpN.copy(s.normal), 0, dt);
      if (this.placingT >= 1) {
        this.chestpieceMode = 'chest';
        this.guidance.setPose('steadying');
      }
      return;
    }

    const wasOver = this.drag.update(dt, this.manikin.torsoMesh);
    const press = this.contact.value;
    this.steth.setPose(s.position, s.normal, press, dt);
    this.steth.setTubeTension(this.stage === 'centre' ? 1 : 0.25, dt);
    this.steth.applyTremor(this.tremorEnergy, 1, dt);
    if (wasOver && this.stage === 'seekFirst' && this.guidance.getLevel() === 'full') {
      // Once the child is driving, the instructor's hand stops moving.
      this.guidance.setPose('resting');
    }
  }

  private updateAudio(dt: number): void {
    const sample = this.field.sample(this.drag.coord);
    const contact = this.contact.update(dt, this.drag.coord, this.drag.dragSpeed());

    // Visible tremor follows the sound arriving here, not the position.
    const beat = Math.max(this.clock.soundEnvelope(1), this.clock.soundEnvelope(2) * 0.8);
    this.tremorEnergy = damp(this.tremorEnergy, sample.tremor * contact * beat, 22, dt);

    if (this.live) {
      this.live.applyProfile(sample);
      if (this.contact.isPressed()) this.live.setLevel(contact);
      else if (contact > 0.004) this.live.setLevel(contact, 0.14);
      else if (this.live.getLevel() > 0) this.live.release(0.45);
    }
    if (this.roomNoise) {
      this.roomNoise.setDuck(contact);
      this.roomNoise.setFriction(this.contact.isPressed() ? this.drag.dragSpeed() : 0);
    }
  }

  private updateSkinFade(): void {
    const inside = this.reveal?.insideAmount ?? 0;
    const mat = this.mats.skin;
    const wanted = 1 - inside * 0.88;
    if (Math.abs(mat.opacity - wanted) > 0.002) {
      mat.opacity = wanted;
      mat.transparent = wanted < 0.995;
      mat.depthWrite = wanted > 0.6;
      mat.needsUpdate = false;
    }
  }
}
