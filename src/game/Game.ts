import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { makeMaterials, MaterialSet } from '../render/materials';
import { buildEnvironment } from '../render/Environment';
import { DoorRig } from '../render/DoorRig';
import { ActorMesh } from '../render/ActorMeshes';
import { DiagnosticOverlay } from '../render/DiagnosticOverlay';
import { CameraDirector } from '../render/CameraDirector';
import { PathRibbon } from '../render/PathRibbon';
import { PredictionMarker, Prediction } from '../render/PredictionMarker';
import { DoorSystem } from '../sim/DoorSystem';
import { TrafficActor } from '../sim/TrafficActor';
import { PathPlanner } from '../sim/PathPlanner';
import { enterPath, makeProfile, TrialDef, TRIALS } from '../sim/scenarios';
import { Vec2 } from '../sim/types';
import { UI } from '../ui/ui';
import { SoundManager } from './SoundManager';
import { AdaptiveQuality } from './AdaptiveQuality';

export type GamePhase =
  | 'title'
  | 'intro'
  | 'lensPrompt'
  | 'diagnostic'
  | 'calibrate'
  | 'lensClose'
  | 'retestCross'
  | 'retestEnter'
  | 'curtainLesson'
  | 'trialDraw'
  | 'actorPlace'
  | 'trialPredict'
  | 'trialReady'
  | 'trialRun'
  | 'trialResult'
  | 'free';

type SeqItem = { wait: number } | { until: () => boolean; timeout?: number };

interface TrialActorEntry {
  actor: TrafficActor;
  mesh: ActorMesh;
  ribbon: PathRibbon;
  path: Vec2[] | null;
  placed: boolean;
  spawn: Vec2;
}

const RIBBON_COLORS = [0xd9a066, 0x7ca6c4];
// 描画カメラ(drawTop)の画角内に収まる待機位置
const DOCK_POS: Vec2 = { x: 1.05, z: 4.75 };

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  director: CameraDirector;
  mats: MaterialSet;
  doorRig: DoorRig;
  overlay: DiagnosticOverlay;
  marker: PredictionMarker;
  doorSys = new DoorSystem();
  ui: UI;
  sound = new SoundManager();
  quality: AdaptiveQuality;

  phase: GamePhase = 'title';
  lensOpen = false;
  simTime = 0;
  /** e2e=1 のとき RAF では時間を進めない(手動 step のみ) */
  manualStep: boolean;

  private dirLight: THREE.DirectionalLight;
  private entries: TrialActorEntry[] = [];
  private drawRibbon = new PathRibbon(0xe8d9a8);
  private raycaster = new THREE.Raycaster();
  private floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // 進行フラグ(UI→台本)
  private flags = {
    started: false,
    lever: false,
    retry: false,
    next: false,
  };
  private drawIndex = 0;
  trialIndex = 0; // TRIALS の添字(1..)
  lastResult: { opened: boolean; predicted: Prediction | null; correct: boolean | null } | null =
    null;
  private runOpened = false;

  private seq: Generator<SeqItem, void, void> | null = null;
  private seqItem: SeqItem | null = null;
  private seqElapsed = 0;

  constructor(container: HTMLElement, opts: { fast: boolean; manualStep: boolean }) {
    this.manualStep = opts.manualStep;
    this.renderer = new THREE.WebGLRenderer({
      antialias: !opts.fast,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    this.scene.background = new THREE.Color(0xdfe3e2);
    this.scene.fog = new THREE.Fog(0xdfe3e2, 18, 34);

    this.mats = makeMaterials(null);
    this.scene.add(buildEnvironment(this.mats));

    this.doorRig = new DoorRig(this.mats);
    this.scene.add(this.doorRig.group);

    this.overlay = new DiagnosticOverlay(this.doorSys.activation, this.doorSys.curtain);
    this.scene.add(this.overlay.group);

    this.marker = new PredictionMarker(this.mats);
    this.scene.add(this.marker.group);
    this.scene.add(this.drawRibbon.mesh);

    // 光: 窓からの外光 + 天井の柔らかい光
    const hemi = new THREE.HemisphereLight(0xe8ecef, 0xa8a094, 0.95);
    this.scene.add(hemi);
    this.dirLight = new THREE.DirectionalLight(0xfff2df, 1.6);
    this.dirLight.position.set(9, 6.5, 6);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.camera.left = -7;
    this.dirLight.shadow.camera.right = 7;
    this.dirLight.shadow.camera.top = 8;
    this.dirLight.shadow.camera.bottom = -6;
    this.dirLight.shadow.bias = -0.0015;
    this.scene.add(this.dirLight);
    const fill = new THREE.DirectionalLight(0xe6ecf2, 0.35);
    fill.position.set(-6, 5, -6);
    this.scene.add(fill);

    this.director = new CameraDirector(window.innerWidth / window.innerHeight);
    this.quality = new AdaptiveQuality(this.renderer, this.dirLight, opts.fast);

    this.ui = new UI({
      onStart: () => this.start(),
      onWidthSlider: (t) => this.setFarWidth(1.6 + t * 3.4),
      onLever: () => this.pullLever(),
      onMarkerDrop: (k) => this.placeMarker(k),
      onRetry: () => {
        this.flags.retry = true;
      },
      onNext: () => {
        this.flags.next = true;
      },
      onLensButton: () => this.toggleLens(),
    });

    this.bindPointer();
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('orientationchange', () => this.onResize());
  }

  // ============ 公開操作(UI/テスト両方から使う) ============

  start(): void {
    if (this.flags.started) return;
    this.flags.started = true;
    this.sound.init();
    this.seq = this.script();
  }

  openLens(): void {
    if (this.lensOpen) return;
    this.lensOpen = true;
    this.doorRig.openHatch(true);
    this.overlay.setVisible(true);
  }

  closeLens(): void {
    if (!this.lensOpen) return;
    this.lensOpen = false;
    this.doorRig.openHatch(false);
    this.overlay.setVisible(false);
  }

  toggleLens(): void {
    if (this.lensOpen) this.closeLens();
    else this.openLens();
    this.ui.setLensLabel(this.lensOpen ? 'レンズを とじる' : 'レンズで みる');
  }

  /** 角度リング: 回した角度[rad]ぶん奥行きが変わる */
  turnRing(deltaAngle: number): void {
    if (this.phase !== 'calibrate') return;
    this.doorRig.ringAngle += deltaAngle;
    const d = this.doorSys.activation.params.depth - deltaAngle * 0.55;
    this.doorSys.activation.setDepth(d);
  }

  setDepth(d: number): void {
    this.doorSys.activation.setDepth(d);
  }

  setFarWidth(w: number): void {
    this.doorSys.activation.setFarWidth(w);
  }

  pullLever(): void {
    if (this.phase !== 'trialReady') return; // 連打・二重発車の防止
    this.flags.lever = true;
  }

  placeMarker(k: Prediction): void {
    if (this.phase !== 'trialPredict' && this.phase !== 'trialReady') return;
    this.marker.place(k);
    this.sound.chime(true);
  }

  /** 経路をプログラムから与える(テスト用・UIと同じ処理を通る) */
  submitPath(index: number, raw: Vec2[]): boolean {
    const e = this.entries[index];
    if (!e) return false;
    const built = PathPlanner.build(raw);
    if (PathPlanner.length(built) < 1.2) return false;
    e.path = built;
    e.ribbon.setPath(built);
    e.actor.setPath(built);
    e.mesh.sync(e.actor);
    e.placed = true;
    return true;
  }

  // ============ ポインタ操作 ============

  private pointerDown = false;
  private rawPoints: Vec2[] = [];
  private ringPrevAngle: number | null = null;
  private draggingActor: TrialActorEntry | null = null;
  private lensGestureStart: { x: number; y: number } | null = null;

  private bindPointer(): void {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    el.addEventListener('pointermove', (e) => this.onPointerMove(e));
    el.addEventListener('pointerup', (e) => this.onPointerUp(e));
    el.addEventListener('pointercancel', (e) => this.onPointerUp(e));
  }

  private screenToFloor(x: number, y: number): Vec2 | null {
    const ndc = new THREE.Vector2(
      (x / window.innerWidth) * 2 - 1,
      -(y / window.innerHeight) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.director.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.floorPlane, hit)) return null;
    if (Math.abs(hit.x) > 8.4 || hit.z < -2 || hit.z > 9) return null;
    return { x: hit.x, z: hit.z };
  }

  /** 床上の点のスクリーン座標(テスト・ヒント用) */
  screenOfFloor(x: number, z: number): { x: number; y: number } {
    return this.worldToScreen(new THREE.Vector3(x, 0, z));
  }

  /** 角度リング中心のスクリーン座標(テスト用) */
  screenOfRing(): { x: number; y: number } {
    return this.worldToScreen(this.doorRig.ringWorldPos());
  }

  worldToScreen(v: THREE.Vector3): { x: number; y: number } {
    const p = v.clone().project(this.director.camera);
    return {
      x: ((p.x + 1) / 2) * window.innerWidth,
      y: ((1 - p.y) / 2) * window.innerHeight,
    };
  }

  private lensScreenPos(): { x: number; y: number } {
    const v = new THREE.Vector3();
    this.doorRig.hatch.getWorldPosition(v);
    return this.worldToScreen(v);
  }

  private onPointerDown(e: PointerEvent): void {
    this.pointerDown = true;
    this.sound.init();
    const x = e.clientX;
    const y = e.clientY;

    // レンズスワイプ開始判定(レンズ付近から)
    if (this.phase === 'lensPrompt' || this.phase === 'lensClose') {
      this.lensGestureStart = { x, y };
      return;
    }

    if (this.phase === 'calibrate') {
      this.ringPrevAngle = this.angleAroundRing(x, y);
      return;
    }

    if (this.phase === 'trialDraw') {
      const p = this.screenToFloor(x, y);
      if (p) {
        this.rawPoints = [p];
        this.drawRibbon.setPath([p, p]);
      }
      return;
    }

    if (this.phase === 'actorPlace') {
      const entry = this.entries[this.drawIndex];
      if (entry) {
        const sp = this.worldToScreen(
          new THREE.Vector3(entry.actor.pos.x, 0.4, entry.actor.pos.z),
        );
        if (Math.hypot(sp.x - x, sp.y - y) < 110) {
          this.draggingActor = entry;
        }
      }
      return;
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.pointerDown) return;
    const x = e.clientX;
    const y = e.clientY;

    if (this.lensGestureStart) {
      const dy = y - this.lensGestureStart.y;
      if (this.phase === 'lensPrompt' && dy > 60) {
        this.openLens();
        this.lensGestureStart = null;
      } else if (this.phase === 'lensClose' && dy < -60) {
        this.closeLens();
        this.lensGestureStart = null;
      }
      return;
    }

    if (this.phase === 'calibrate' && this.ringPrevAngle !== null) {
      const a = this.angleAroundRing(x, y);
      let d = a - this.ringPrevAngle;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      this.ringPrevAngle = a;
      // 不完全な円運動でも意図(回転方向)を拾う
      if (Math.abs(d) < 0.5) this.turnRing(d);
      return;
    }

    if (this.phase === 'trialDraw' && this.rawPoints.length > 0) {
      const p = this.screenToFloor(x, y);
      if (p) {
        const last = this.rawPoints[this.rawPoints.length - 1];
        if (Math.hypot(p.x - last.x, p.z - last.z) > 0.08) {
          this.rawPoints.push(p);
          this.drawRibbon.setPath(this.rawPoints);
        }
      }
      return;
    }

    if (this.draggingActor) {
      const p = this.screenToFloor(x, y);
      if (p) {
        this.draggingActor.actor.pos = p;
        this.draggingActor.mesh.group.position.set(p.x, 0, p.z);
      }
    }
  }

  private onPointerUp(_e: PointerEvent): void {
    this.pointerDown = false;
    this.lensGestureStart = null;
    this.ringPrevAngle = null;

    if (this.phase === 'trialDraw' && this.rawPoints.length > 0) {
      const built = PathPlanner.build(this.rawPoints);
      this.rawPoints = [];
      this.drawRibbon.clear();
      // 途中で指を離しても壊れない: 短すぎる線はやり直しを促すだけ
      if (PathPlanner.length(built) < 1.2) {
        this.ui.say('もうすこし ながく かいてね');
        return;
      }
      const entry = this.entries[this.drawIndex];
      if (entry) {
        entry.path = built;
        entry.ribbon.setPath(built);
        this.phase = 'actorPlace';
        const kindName = entry.actor.profile.kind === 'deliveryRobot' ? 'ロボット' : 'テストだい';
        this.ui.say(`${kindName}を みちの はじめまで はこんでね`);
      }
      return;
    }

    if (this.draggingActor) {
      const entry = this.draggingActor;
      this.draggingActor = null;
      const startP = entry.path?.[0];
      if (startP && Math.hypot(entry.actor.pos.x - startP.x, entry.actor.pos.z - startP.z) < 1.3) {
        entry.actor.setPath(entry.path!);
        entry.mesh.sync(entry.actor);
        entry.placed = true;
        this.sound.chime(true);
      } else {
        // 届かなかったら発車位置ゾーンへ戻す
        entry.actor.pos = { ...entry.spawn };
        entry.mesh.group.position.set(entry.spawn.x, 0, entry.spawn.z);
      }
    }
  }

  private angleAroundRing(x: number, y: number): number {
    const c = this.worldToScreen(this.doorRig.ringWorldPos());
    return Math.atan2(y - c.y, x - c.x);
  }

  // ============ アクター管理 ============

  private clearActors(): void {
    for (const e of this.entries) {
      this.scene.remove(e.mesh.group);
      this.scene.remove(e.ribbon.mesh);
    }
    this.entries = [];
    this.overlay.clearTrails();
  }

  private spawnTrialActors(def: TrialDef, useDefaultPaths: boolean): void {
    this.clearActors();
    def.actors.forEach((ad, i) => {
      const actor = new TrafficActor(`t${def.id}a${i}`, makeProfile(ad));
      const mesh = new ActorMesh(ad.kind, this.mats);
      const ribbon = new PathRibbon(RIBBON_COLORS[i % RIBBON_COLORS.length]);
      this.scene.add(mesh.group);
      this.scene.add(ribbon.mesh);
      const entry: TrialActorEntry = {
        actor,
        mesh,
        ribbon,
        path: null,
        placed: false,
        spawn: ad.spawn,
      };
      if (useDefaultPaths) {
        const built = PathPlanner.build(ad.defaultPath);
        entry.path = built;
        actor.setPath(built);
        entry.placed = true;
      } else {
        // 発車位置ゾーンの脇(ドック)に待機
        actor.pos = { x: DOCK_POS.x - i * 1.1, z: DOCK_POS.z };
      }
      mesh.sync(actor);
      this.entries.push(entry);
    });
  }

  private startAll(): void {
    this.doorSys.door.openedOnce = false;
    this.runOpened = false;
    for (const e of this.entries) e.actor.start();
  }

  private allFinished(): boolean {
    return this.entries.every((e) => e.actor.finished);
  }

  // ============ 進行台本 ============

  private *wait(s: number): Generator<SeqItem, void, void> {
    yield { wait: s };
  }

  private *until(fn: () => boolean, timeout = 60): Generator<SeqItem, void, void> {
    yield { until: fn, timeout };
  }

  private *script(): Generator<SeqItem, void, void> {
    const say = (t: string, hold = 0): void => this.ui.say(t, hold);
    const door = this.doorSys.door;

    // ---- 第一場: 謎 ----
    this.phase = 'intro';
    this.director.goTo('wide', 0.01);
    yield* this.wait(0.6);
    say('ここは じどうドアの テストしつ。しろい ロボットが くるよ');
    this.spawnTrialActors(TRIALS[0], true);
    yield* this.wait(1.6);
    this.startAll();
    yield* this.until(() => door.openedOnce, 25);
    this.director.goTo('crossFocus', 1.4);
    say('あれ? はいらないのに、どうして あいたのだろう?');
    yield* this.until(() => this.allFinished(), 25);
    yield* this.until(() => door.state === 'CLOSED', 15);
    yield* this.wait(0.8);

    // ---- 点検レンズ ----
    this.phase = 'lensPrompt';
    this.doorRig.openHatch(true);
    this.director.goTo('sensorRise', 1.8);
    say('センサーの したに ちいさな レンズが ひらいた! したへ スワイプ してみよう');
    yield* this.until(() => this.lensOpen, 9999);
    this.ui.hideSwipeHint();

    // ---- 診断モード ----
    this.phase = 'diagnostic';
    this.director.goTo('diagTop', 1.8);
    say('これが ドアの「みている ばしょ」だよ');
    yield* this.wait(2.4);
    this.spawnTrialActors(TRIALS[0], true);
    this.startAll();
    say('もういちど ロボットが とおるよ。よく みてて');
    yield* this.until(() => this.doorSys.activation.triggered, 25);
    say('みて! みている ばしょが よこの みちまで はみだしてる!');
    yield* this.until(() => this.allFinished(), 25);
    yield* this.until(() => door.state === 'CLOSED', 15);

    // ---- 調律 ----
    this.phase = 'calibrate';
    this.director.goTo('calibrate', 1.8);
    say('したの リングを ゆびで くるくる まわして、ひかる ばしょを ちいさく しよう');
    this.ui.showWidthSlider(
      (this.doorSys.activation.params.farWidth - 1.6) / 3.4,
    );
    yield* this.until(() => this.doorSys.calibrated, 9999);
    this.sound.chime(true);
    say('できた! よこの みちに とどかなくなったね。うえへ スワイプして レンズを とじよう');
    this.phase = 'lensClose';
    yield* this.until(() => !this.lensOpen, 9999);
    this.ui.hideWidthSlider();
    this.ui.hideRingHint();
    this.ui.hideSwipeHint();

    // ---- 再試験1: 横切り ----
    this.phase = 'retestCross';
    this.director.goTo('wide', 1.6);
    say('おなじ みちを もういちど よこぎるよ。こんどは どうかな?');
    yield* this.wait(1.2);
    this.spawnTrialActors(TRIALS[0], true);
    this.startAll();
    yield* this.until(() => this.allFinished(), 25);
    say(door.openedOnce ? 'まだ あいちゃった…' : 'こんどは あかなかった!');
    yield* this.wait(1.6);

    // ---- 再試験2: 90度まがって入口へ ----
    this.phase = 'retestEnter';
    say('こんどは ロボットが 90ど まがって、いりぐちへ むかうよ');
    this.clearActors();
    const enterDef = {
      ...TRIALS[0],
      actors: [{ ...TRIALS[0].actors[0], defaultPath: enterPath() }],
    };
    this.spawnTrialActors(enterDef, true);
    yield* this.wait(1.0);
    this.startAll();
    yield* this.until(() => door.openedOnce, 25);
    say('いま ひらいた! むきと みちが かわると、ドアの へんじも かわるんだ');
    yield* this.until(() => this.allFinished(), 25);
    yield* this.until(() => door.state === 'CLOSED', 15);
    yield* this.wait(0.6);

    // ---- 第二の目: 戸口保護カーテン ----
    yield* this.curtainLesson();

    // ---- 試験2〜5 ----
    for (let i = 1; i < TRIALS.length; ) {
      const res = yield* this.trialFlow(TRIALS[i], false);
      if (res === 'next') i++;
    }

    // ---- 自由あそび ----
    say('ぜんぶ できた! すきな みちを かいて ためして みよう', 6);
    for (;;) {
      yield* this.trialFlow(TRIALS[0], true);
    }
  }

  private *curtainLesson(): Generator<SeqItem, void, void> {
    const say = (t: string, hold = 0): void => this.ui.say(t, hold);
    const door = this.doorSys.door;
    this.phase = 'curtainLesson';
    this.director.goTo('wide', 1.4);
    say('つぎは やわらかい テストボディの ばん。とおりぬけて…');
    this.clearActors();
    const body = new TrafficActor('foam', {
      ...makeProfile({
        kind: 'foamBody',
        behavior: { type: 'pass' },
        defaultPath: [],
        spawn: { x: 0, z: 4.4 },
      }),
    });
    const mesh = new ActorMesh('foamBody', this.mats);
    this.scene.add(mesh.group);
    this.entries = [
      { actor: body, mesh, ribbon: new PathRibbon(), path: null, placed: true, spawn: { x: 0, z: 4.4 } },
    ];
    body.setPath(PathPlanner.build([{ x: 0.2, z: 4.4 }, { x: 0, z: 1.2 }, { x: 0, z: -1.3 }]));
    this.startAll();
    yield* this.until(() => body.finished, 25);
    yield* this.until(() => door.state === 'CLOSING', 15);
    this.director.goTo('curtainLow', 1.2);
    say('あ、とじはじめた。でも テストボディが もどってきた!');
    body.setPath(PathPlanner.build([{ x: 0, z: -1.3 }, { x: 0, z: 0.0 }]));
    body.start();
    yield* this.until(
      () => door.state === 'OBSTRUCTION' || door.state === 'REVERSING',
      20,
    );
    say('とじるのを やめて、ひらきなおした!');
    yield* this.until(() => body.finished, 15);
    yield* this.wait(1.6);
    this.openLens();
    say('とびらの まんなかには、ゆかを まもる べつの めが ならんでいるよ');
    yield* this.wait(3.4);
    say('くる ひとを みる めと、まんなかを まもる めは、ちがうんだ');
    yield* this.wait(3.2);
    this.closeLens();
    body.setPath(PathPlanner.build([{ x: 0, z: 0.0 }, { x: 0, z: -2.4 }]));
    body.start();
    yield* this.until(() => body.finished, 15);
    yield* this.until(() => door.state === 'CLOSED', 15);
    say('だれも いなくなったら、ちゃんと とじたね');
    yield* this.wait(1.6);
  }

  private *trialFlow(def: TrialDef, freePlay: boolean): Generator<SeqItem, 'retry' | 'next', void> {
    const say = (t: string, hold = 0): void => this.ui.say(t, hold);
    this.trialIndex = freePlay ? 0 : def.id;
    this.flags.lever = false;
    this.flags.retry = false;
    this.flags.next = false;
    this.marker.clear();
    this.marker.showPedestal(false);
    this.ui.hideButtons();
    this.drawRibbon.clear();
    this.doorSys.reset();
    this.overlay.clearTrails();

    // --- 経路を描く ---
    this.spawnTrialActors(def, false);
    this.director.goTo('drawTop', 1.6);
    for (this.drawIndex = 0; this.drawIndex < this.entries.length; this.drawIndex++) {
      this.phase = 'trialDraw';
      const label = def.actors[this.drawIndex].kind === 'deliveryRobot' ? 'ロボット' : 'テストだい';
      if (freePlay) {
        say('ゆびで ゆかに ふとい みちを かいてね。どこを とおる?');
      } else {
        say(
          this.entries.length > 1
            ? `${this.drawIndex + 1}だいめ: ${label}の みちを ゆびで かいてね`
            : `だい${def.id}かい「${def.title}」。${label}の みちを ゆびで かいてね`,
        );
      }
      yield* this.until(() => this.entries[this.drawIndex]?.placed === true, 9999);
      this.sound.chime(true);
    }

    // --- 予想マーカー ---
    if (!freePlay) {
      this.phase = 'trialPredict';
      this.marker.showPedestal(true);
      this.ui.showMarkers();
      say('とびらは あく? あかない? もけいを だいのうえに おいて よそうしよう');
      yield* this.until(() => this.marker.choice !== null, 9999);
      this.ui.hideMarkers();
    }

    // --- レバーで発車 ---
    this.phase = 'trialReady';
    this.ui.showLever();
    say('ゆびを はなして、レバーを したへ たおすと スタート!');
    yield* this.until(() => this.flags.lever, 9999);
    this.ui.hideLever();

    // --- 走行 ---
    this.phase = 'trialRun';
    this.director.goTo('wide', 1.4);
    say('');
    this.startAll();
    let obstructionShown = false;
    yield {
      until: () => {
        const d = this.doorSys.door;
        if (!obstructionShown && (d.state === 'OBSTRUCTION' || d.state === 'REVERSING')) {
          obstructionShown = true;
          this.director.goTo('curtainLow', 1.0);
        }
        if (d.openedOnce) this.runOpened = true;
        return this.allFinished() && (d.state === 'CLOSED' || d.state === 'OPEN');
      },
      timeout: 60,
    };
    yield* this.until(() => this.doorSys.door.state === 'CLOSED', 20);

    // --- 結果 ---
    this.phase = 'trialResult';
    this.director.goTo('wide', 1.2);
    const opened = this.runOpened;
    const predicted = this.marker.choice;
    const correct = freePlay ? null : predicted === (opened ? 'open' : 'closed');
    this.lastResult = { opened, predicted, correct };
    if (freePlay) {
      say(opened ? 'ひらいた! べつの みちも かいてみる?' : 'あかなかった! どうしてかな?');
    } else if (correct) {
      this.sound.chime(true);
      say(opened ? 'よそう どおり、ひらいた!' : 'よそう どおり、あかなかった!');
    } else {
      this.sound.chime(false);
      say(
        opened
          ? 'ひらいたね。どうしてかな? レンズで みてみよう'
          : 'あかなかったね。どうしてかな? レンズで みてみよう',
      );
    }
    this.ui.setLensLabel('レンズで みる');
    this.ui.setNextLabel('つぎへ');
    this.ui.showButtons(true);
    yield* this.until(() => this.flags.next || this.flags.retry, 9999);
    this.ui.hideButtons();
    this.closeLens();
    return this.flags.next ? 'next' : 'retry';
  }

  // ============ ループ ============

  /** シミュレーションを1ステップ進める(固定 dt 推奨) */
  stepSim(dt: number): void {
    this.simTime += dt;

    // 台本の進行
    if (this.seq) {
      if (!this.seqItem) this.advanceSeq();
      if (this.seqItem) {
        this.seqElapsed += dt;
        let guard = 0;
        while (this.seqItem && this.itemSatisfied(this.seqItem) && guard++ < 30) {
          this.advanceSeq();
        }
      }
    }

    // 対象と扉
    for (const e of this.entries) {
      e.actor.update(dt);
      e.mesh.sync(e.actor);
    }
    this.doorSys.update(dt, this.entries.map((e) => e.actor));
    if (this.doorSys.door.openedOnce) this.runOpened = true;

    // 手動ステップ(E2E)では視覚もシミュレーション時間で進め、決定的にする
    if (this.manualStep) this.updateVisuals(dt);
  }

  private updateVisuals(dt: number): void {
    this.doorRig.update(dt, this.doorSys.door.position, this.doorSys.activation.params.depth);
    this.overlay.update(dt, this.entries.map((e) => e.actor));
    this.director.update(dt);
  }

  private advanceSeq(): void {
    if (!this.seq) return;
    const r = this.seq.next();
    if (r.done) {
      this.seq = null;
      this.seqItem = null;
      return;
    }
    this.seqItem = r.value;
    this.seqElapsed = 0;
  }

  private itemSatisfied(item: SeqItem): boolean {
    if ('wait' in item) return this.seqElapsed >= item.wait;
    return item.until() || this.seqElapsed >= (item.timeout ?? 60);
  }

  private static readonly SIM_DT = 1 / 60;
  private accumulator = 0;

  /** 描画フレーム(壁時計 dt)。シミュレーションは固定タイムステップで進める */
  frame(wallDt: number): void {
    if (!this.manualStep) {
      this.accumulator += Math.min(0.25, wallDt);
      let steps = 0;
      while (this.accumulator >= Game.SIM_DT && steps < 8) {
        this.stepSim(Game.SIM_DT);
        this.accumulator -= Game.SIM_DT;
        steps++;
      }
      // 遅い端末では追いつきを打ち切る(スパイラル防止)
      if (steps >= 8) this.accumulator = 0;
      this.updateVisuals(Math.min(0.05, wallDt));
    }
    this.quality.frame(wallDt);
    this.sound.update(this.doorSys.door.state, this.doorSys.door.position);
    this.updateHints();
    this.renderer.render(this.scene, this.director.camera);
  }

  private updateHints(): void {
    if (this.phase === 'lensPrompt' || this.phase === 'lensClose') {
      const p = this.lensScreenPos();
      this.ui.showSwipeHint(p.x, p.y + (this.phase === 'lensPrompt' ? 10 : -60), this.phase === 'lensPrompt' ? 'down' : 'up');
    } else {
      this.ui.hideSwipeHint();
    }
    if (this.phase === 'calibrate') {
      const p = this.worldToScreen(this.doorRig.ringWorldPos());
      this.ui.showRingHint(p.x, p.y);
    } else {
      this.ui.hideRingHint();
    }
  }

  private onResize(): void {
    // 画面回転中も扉とセンサーの状態は一切触らない(描画だけ追従)
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.director.setAspect(window.innerWidth / window.innerHeight);
  }
}
