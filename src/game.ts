import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BoatSway } from './sys/sway';
import { CameraRail } from './sys/camera';
import { InputSystem } from './sys/input';
import { GameAudio } from './sys/audio';
import { DomeBoat, HOLE_RADIUS } from './world/boat';
import { Exterior } from './world/exterior';
import { HoleWater, Underwater, WATER_Y } from './world/underwater';
import { Rod } from './world/rod';
import { Reel } from './world/reel';
import { FishingLine } from './world/line';
import {
  FishSchool,
  Wakasagi,
  makeWakasagiBodyGeometry,
  makeWakasagiBodyMaterial
} from './world/fish';
import { clamp, damp, lerp } from './util/math';

type GameState =
  | 'TITLE'
  | 'ENTER'
  | 'IDLE'
  | 'JIG'
  | 'STILL'
  | 'BITE'
  | 'HOOKSET'
  | 'REELING'
  | 'REVEAL'
  | 'CAUGHT'
  | 'RESET';

interface RoundCfg {
  fishDepth: number;
  cutaway: 'full' | 'half' | 'none';
  preferredJigs: number;
  stillBase: number;
  swayAmp: number;
}

/** 一度に一つだけ条件を変えるラウンド構成 */
function roundCfg(i: number): RoundCfg {
  if (i === 0) return { fishDepth: 1.05, cutaway: 'full', preferredJigs: 2, stillBase: 2.2, swayAmp: 1 };
  if (i === 1) return { fishDepth: 1.05, cutaway: 'half', preferredJigs: 2, stillBase: 2.4, swayAmp: 1 };
  const v = (i - 2) % 5;
  switch (v) {
    case 0:
      return { fishDepth: 1.6, cutaway: 'none', preferredJigs: 1, stillBase: 2.2, swayAmp: 1 };
    case 1:
      return { fishDepth: 1.7, cutaway: 'none', preferredJigs: 3, stillBase: 2.3, swayAmp: 1 };
    case 2:
      return { fishDepth: 1.5, cutaway: 'none', preferredJigs: 2, stillBase: 3.4, swayAmp: 1 };
    case 3:
      return { fishDepth: 0.95, cutaway: 'none', preferredJigs: 2, stillBase: 2.2, swayAmp: 1 };
    default:
      return { fishDepth: 1.6, cutaway: 'none', preferredJigs: 2, stillBase: 2.4, swayAmp: 1.7 };
  }
}

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  rail: CameraRail;
  sway = new BoatSway();
  audio = new GameAudio();
  input: InputSystem;

  boat = new DomeBoat();
  exterior = new Exterior();
  holeWater = new HoleWater(HOLE_RADIUS + 0.03);
  underwater = new Underwater();
  rod = new Rod();
  reel = new Reel();
  line = new FishingLine();
  school = new FishSchool();
  actorFish: Wakasagi;
  companionFish: Wakasagi;

  state: GameState = 'TITLE';
  private stateTime = 0;
  catches = 0;
  private cfg = roundCfg(0);

  /** カットアウェイの切断面（x < c を残す） */
  private clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 100);
  private clipTarget = 100;

  // 誘い・アタリの進行
  private jigStrokes = 0;
  private lastJigCount = 1;
  private biteTimer = 0;
  private biteDelay = 0;
  private biteFlicks = 0;
  private missedOnce = false;
  private jigDrive = 0;
  private jigDriveTarget = 0;
  private stillness = 0;
  private idleHintTimer = 0;
  private reelHintTimer = 0;

  // 魚の行動
  private fishMode: 'HIDDEN' | 'APPROACH' | 'NIBBLE' | 'HOOKED' | 'LANDED' | 'TO_BUCKET' = 'HIDDEN';
  private fishAnimT = 0;
  private fishFrom = new THREE.Vector3();
  private silverFlashDone = false;
  private catchArcFrom = new THREE.Vector3();

  private bucketFish: { mesh: THREE.Mesh; phase: number; r: number; speed: number }[] = [];
  private bucketFishGeo = makeWakasagiBodyGeometry(10, 6);
  private bucketFishMat = new THREE.MeshLambertMaterial({ vertexColors: true });

  private elapsed = 0;
  private e2e: boolean;
  private replayBtn: HTMLButtonElement;

  // 動的解像度
  private baseDpr: number;
  private dprScale = 1;
  private frameAcc = 0;
  private frameCount = 0;
  private qualityTimer = 0;

  private tmpV1 = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private cutLight!: THREE.PointLight;

  constructor(container: HTMLElement) {
    const params = new URLSearchParams(location.search);
    this.e2e = params.get('e2e') === '1';

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.baseDpr = Math.min(window.devicePixelRatio || 1, this.e2e ? 1 : 2);
    this.renderer.setPixelRatio(this.baseDpr);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.localClippingEnabled = true;
    container.appendChild(this.renderer.domElement);

    this.rail = new CameraRail(container.clientWidth / container.clientHeight);

    // 環境反射（穏やかな室内環境を一度だけ焼く）
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = envTex;
    this.scene.environmentIntensity = 0.32;
    pmrem.dispose();

    this.scene.fog = new THREE.Fog(0x93a4b0, 26, 110);

    // ---- ライティング ----
    const hemi = new THREE.HemisphereLight(0xa8b8c4, 0x4a3b2c, 0.85);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xdfe8ee, 2.0);
    sun.position.set(2.6, 3.2, -2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -1.4;
    sun.shadow.camera.right = 1.4;
    sun.shadow.camera.top = 1.4;
    sun.shadow.camera.bottom = -1.4;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 10;
    sun.shadow.bias = -0.0015;
    sun.target.position.set(0, 0.2, 0.3);
    this.scene.add(sun);
    this.scene.add(sun.target);

    // ---- シーン構築 ----
    this.scene.add(this.exterior.root);
    this.scene.add(this.boat.root);
    this.scene.add(this.holeWater.mesh);
    this.scene.add(this.underwater.root);
    this.scene.add(this.school.mesh);
    this.scene.add(this.line.root);

    // リールと穂先は叩き台に載る
    this.reel.root.position.set(0, 0.374, 0.02);
    this.boat.table.add(this.reel.root);
    this.rod.root.position.set(0, 0.428, -0.05);
    this.rod.root.rotation.x = -0.135;
    this.boat.table.add(this.rod.root);

    // カットアウェイの断面付近を淡く起こす補助光（開いている間だけ点く）
    this.cutLight = new THREE.PointLight(0xcfe0ea, 0, 2.0, 2);
    this.cutLight.position.set(0.6, -0.2, 0.3);
    this.scene.add(this.cutLight);

    const fishMat = makeWakasagiBodyMaterial(envTex);
    this.actorFish = new Wakasagi(fishMat);
    this.companionFish = new Wakasagi(fishMat);
    this.actorFish.group.visible = false;
    this.companionFish.group.visible = false;
    this.scene.add(this.actorFish.group);
    this.scene.add(this.companionFish.group);

    // カットアウェイの切断面を船体と水中の材質へ
    for (const m of this.boat.clippable) m.clippingPlanes = [this.clipPlane];
    for (const m of this.underwater.clippable) m.clippingPlanes = [this.clipPlane];
    (this.school.mesh.material as THREE.Material).clippingPlanes = [this.clipPlane];
    fishMat.clippingPlanes = [this.clipPlane];

    this.line.baitDepth = this.cfg.fishDepth;
    this.school.setDepth(WATER_Y - this.cfg.fishDepth - 0.55);

    // ---- 入力 ----
    this.input = new InputSystem(this.renderer.domElement, {
      onFirstTouch: () => {
        this.audio.unlock();
      },
      onTap: () => {
        if (this.state === 'TITLE') this.enterBoat();
      },
      onJigStart: () => {
        if (this.state === 'IDLE' || this.state === 'STILL') {
          this.setState('JIG');
          this.jigStrokes = 0;
          if (this.rail.current !== 'PLAY') this.rail.goTo('PLAY', 1.6);
          this.clipTarget = 100;
          this.fishRetreatSoft();
        }
        if (this.state === 'REELING' || this.state === 'REVEAL') this.setReeling(true);
      },
      onJigDrive: (offset) => {
        if (this.state === 'JIG') this.jigDriveTarget = offset;
      },
      onJigStroke: () => {
        if (this.state === 'JIG') {
          this.jigStrokes++;
          this.audio.jig();
          this.holeWater.triggerRipple();
        }
      },
      onRelease: (strokes) => {
        if (this.state === 'TITLE') this.enterBoat();
        if (this.state === 'JIG') {
          this.jigDriveTarget = 0;
          if (strokes > 0) {
            this.lastJigCount = Math.max(1, Math.round(strokes / 2));
            this.beginStill();
          } else {
            this.setState('IDLE');
          }
        }
        if (this.state === 'REELING') this.setReeling(false);
      },
      onSwipeUp: () => {
        if (this.state === 'BITE') this.hookset();
        else if (this.state === 'STILL') {
          // 早合わせ：何も掛からず、誘いへ戻る
          this.rod.lift = 0.16;
          this.audio.hookset();
          this.setState('IDLE');
          this.fishRetreat();
        }
      },
      onHold: (down) => {
        if (this.state === 'REELING' || this.state === 'REVEAL') this.setReeling(down);
      }
    });

    // ---- 再プレイの大きな絵ボタン ----
    this.replayBtn = document.getElementById('replay') as HTMLButtonElement;
    this.replayBtn.addEventListener('click', () => {
      if (this.state === 'CAUGHT') this.resetRound();
    });

    // ---- 画面回転・リサイズ ----
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      this.renderer.setSize(w, h);
      this.rail.onResize(w / h);
      this.line.setResolution(w, h);
    };
    window.addEventListener('resize', onResize);
    onResize();

    // ---- バックグラウンド復帰 ----
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.audio.suspend();
      else this.audio.resume();
    });

    // ---- 検証フック ----
    (window as unknown as Record<string, unknown>).__game = {
      state: () => this.state,
      catches: () => this.catches,
      pose: () => this.rail.current,
      fishMode: () => this.fishMode,
      baitDepth: () => this.line.baitDepth,
      forceBite: () => {
        if (this.state === 'STILL') this.biteTimer = this.biteDelay;
      },
      settled: () => this.rail.settled,
      start: () => {
        if (this.state === 'TITLE') this.enterBoat();
      }
    };
  }

  private setState(s: GameState) {
    this.state = s;
    this.stateTime = 0;
  }

  private enterPhase = 0;

  private enterBoat() {
    this.setState('ENTER');
    this.enterPhase = 0;
    this.rail.goTo('SEAT', 2.4);
  }

  private beginStill() {
    this.setState('STILL');
    this.stillness = 0;
    this.biteTimer = 0;
    this.biteDelay = this.computeBiteDelay();
    // 一回目だけ、水面を連続的なカットアウェイへ
    if (this.cfg.cutaway === 'full') {
      this.rail.goTo('CUTAWAY', 2.2);
      this.clipTarget = 0.45;
    } else if (this.cfg.cutaway === 'half') {
      this.rail.goTo('CUTAWAY_HALF', 2.0);
      this.clipTarget = 0.45;
    } else {
      // 穂先のマクロへゆっくり寄る
      this.rail.goTo('TIP_MACRO', 2.4);
    }
    // 魚が餌へ近づき始める
    this.fishMode = 'APPROACH';
    this.fishAnimT = 0;
    this.actorFish.group.visible = true;
    this.companionFish.group.visible = true;
    const d = this.line.baitDepth;
    this.fishFrom.set(0.65, WATER_Y - d - 0.18, -0.4);
    this.actorFish.group.position.copy(this.fishFrom);
    this.companionFish.group.position.set(-0.7, WATER_Y - d - 0.3, 0.35);
  }

  private computeBiteDelay(): number {
    if (this.e2e) return 3.0;
    if (this.catches === 0) return 2.6 + Math.random() * 0.9;
    const matched = this.lastJigCount === this.cfg.preferredJigs;
    let d = matched
      ? this.cfg.stillBase + Math.random() * 0.7
      : this.cfg.stillBase + 1.2 + Math.random() * 1.2;
    if (this.missedOnce) d *= 0.72;
    return Math.min(5, d);
  }

  private triggerBite() {
    this.setState('BITE');
    this.biteFlicks = 0;
    this.fishMode = 'NIBBLE';
    this.fishAnimT = 0;
    this.flick(1.35);
  }

  private flick(strength: number) {
    // ピクッ：穂先先端だけの短い動き。船の揺れとは別の、速い信号
    this.rod.impulse(strength);
    this.audio.bite();
    this.biteFlicks++;
    this.line.drift.set((Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.03);
  }

  private hookset() {
    this.setState('HOOKSET');
    this.audio.hookset();
    this.clipTarget = 100;
    this.rod.lift = 0.3;
    this.line.tension = 0.95;
    this.fishMode = 'HOOKED';
    this.missedOnce = false;
    this.holeWater.triggerRipple();
    this.silverFlashDone = false;
  }

  private setReeling(on: boolean) {
    this.reel.pressed = on;
    if (on) {
      this.audio.motorStart();
      this.reel.spinSpeed = 14;
      this.line.dropsActive = true;
    } else {
      this.audio.motorStop();
      this.reel.spinSpeed = 0;
      this.line.dropsActive = false;
    }
  }

  private fishRetreatSoft() {
    if (this.fishMode === 'APPROACH' || this.fishMode === 'NIBBLE') {
      this.fishMode = 'HIDDEN';
      this.actorFish.group.visible = false;
      this.companionFish.group.visible = false;
    }
  }

  private fishRetreat() {
    this.fishRetreatSoft();
    this.clipTarget = 100;
    if (this.rail.current !== 'PLAY') this.rail.goTo('PLAY', 1.8);
  }

  private missBite() {
    this.missedOnce = true;
    this.fishRetreat();
    this.line.drift.set(0, 0);
    this.setState('IDLE');
  }

  private landFish() {
    this.setState('REVEAL');
    this.audio.splash(1);
    this.holeWater.triggerRipple();
    this.rail.goTo('REVEAL', 1.5);
    this.fishMode = 'LANDED';
  }

  private catchFish() {
    this.setState('CAUGHT');
    this.setReeling(false);
    this.audio.catchChime();
    this.rail.goTo('BUCKET', 1.8);
    this.fishMode = 'TO_BUCKET';
    this.fishAnimT = 0;
    this.actorFish.group.getWorldPosition(this.catchArcFrom);
  }

  private addBucketFish() {
    const mesh = new THREE.Mesh(this.bucketFishGeo, this.bucketFishMat);
    mesh.scale.set(1.25, 1.8, 1.35);
    this.boat.bucket.add(mesh);
    this.bucketFish.push({
      mesh,
      phase: Math.random() * Math.PI * 2,
      r: 0.04 + Math.random() * 0.035,
      speed: 1.2 + Math.random() * 1.2
    });
  }

  private resetRound() {
    this.replayBtn.classList.remove('shown');
    this.setState('RESET');
    this.cfg = roundCfg(this.catches);
    this.sway.amplitude = this.cfg.swayAmp;
    this.school.setDepth(WATER_Y - this.cfg.fishDepth - 0.55);
    this.rail.goTo('PLAY', 1.6);
    this.line.tension = 0.25;
    this.line.drift.set(0, 0);
    this.holeWater.triggerRipple();
    this.audio.plop();
  }

  /** 毎フレーム更新 */
  update(dt: number) {
    this.elapsed += dt;
    this.stateTime += dt;
    const t = this.elapsed;

    this.sway.update(dt);
    this.exterior.update(t);
    this.underwater.update(t);
    this.holeWater.update(dt);
    this.boat.update(dt, t, this.sway.rollZ);
    this.school.update(t);

    // 船体の揺れを船グループへ
    this.boat.root.position.y = this.sway.heave;
    this.boat.root.rotation.x = this.sway.rollX;
    this.boat.root.rotation.z = this.sway.rollZ;

    // カットアウェイ切断面のなめらかな開閉
    this.clipPlane.constant = damp(this.clipPlane.constant, this.clipTarget, 6, dt);
    this.cutLight.intensity = damp(this.cutLight.intensity, this.clipTarget < 50 ? 2.4 : 0, 3, dt);

    // ---- 状態別ロジック ----
    this.updateStateLogic(dt);

    // ---- 穂先 ----
    this.jigDrive = damp(this.jigDrive, this.jigDriveTarget, 18, dt);
    const restBend = 0.06 + (this.state === 'REELING' || this.state === 'HOOKSET' ? 0.16 : 0);
    this.rod.target = restBend - this.jigDrive * 0.32;
    if (this.state === 'JIG') this.rod.lift = this.jigDrive * 0.055;
    else if (this.state !== 'HOOKSET') this.rod.lift = damp(this.rod.lift, 0, 5, dt);
    else this.rod.lift = damp(this.rod.lift, 0.08, 6, dt);
    this.rod.lateral = this.sway.rollX * 1.6;
    this.rod.update(dt);
    this.reel.update(dt, t);

    // ---- 糸 ----
    const exit = this.reel.lineExit.getWorldPosition(this.tmpV1).clone();
    const guides = this.rod.getGuideWorlds();
    const tip = this.rod.getTipWorld(this.tmpV2).clone();
    const holeCenter = new THREE.Vector3(0, 0, 0);
    this.line.update(dt, t, exit, guides, tip, holeCenter, WATER_Y);
    this.holeWater.setEntry(this.line.waterEntryWorld.x, this.line.waterEntryWorld.z, HOLE_RADIUS + 0.03);
    const lineActive = this.state === 'JIG' || this.state === 'REELING' || this.state === 'RESET';
    this.holeWater.entryActivity = damp(this.holeWater.entryActivity ?? 0, lineActive ? 1 : 0.18, 3, dt);
    this.holeWater.fishGlow = Math.max(0, this.holeWater.fishGlow - dt * 1.6);

    // ---- 魚 ----
    this.updateFish(dt, t);

    // ---- 音の静けさ ----
    const stillTarget = this.state === 'STILL' || this.state === 'BITE' ? 1 : 0;
    this.stillness = damp(this.stillness, stillTarget, 3, dt);
    this.audio.setStillness(this.stillness);

    // ---- カメラ ----
    this.rail.update(dt, this.sway);

    this.renderer.render(this.scene, this.rail.camera);
    this.updateQuality(dt);
  }

  private updateStateLogic(dt: number) {
    switch (this.state) {
      case 'ENTER': {
        // カメラ到着に合わせて進む（低フレームレートでも破綻しない）
        if (this.enterPhase === 0 && this.stateTime > 2.6) {
          this.enterPhase = 1;
          this.rail.goTo('PLAY', 2.0);
        } else if (this.enterPhase === 1 && this.stateTime > 4.7) {
          this.setState('IDLE');
        }
        break;
      }
      case 'IDLE': {
        this.idleHintTimer += dt;
        if (this.idleHintTimer > 4.5) {
          this.idleHintTimer = 0;
          this.boat.hintNudge();
          this.rod.impulse(0.35);
        }
        break;
      }
      case 'JIG':
        this.idleHintTimer = 0;
        break;
      case 'STILL': {
        this.biteTimer += dt;
        // カットアウェイのカメラが着いてから「ピクッ」を見せる
        if (this.biteTimer >= this.biteDelay && this.rail.settled) this.triggerBite();
        break;
      }
      case 'HOOKSET': {
        if (this.stateTime > 0.42) {
          this.setState('REELING');
          this.rail.goTo('LINE_LOW', 1.6);
          this.reelHintTimer = 0;
          if (this.input.holding) this.setReeling(true);
        }
        break;
      }
      case 'RESET': {
        if (this.stateTime > 1.4) this.setState('IDLE');
        break;
      }
      case 'BITE': {
        if (this.stateTime > 1.6 && this.biteFlicks === 1) this.flick(0.85);
        if (this.stateTime > 3.8) this.missBite();
        break;
      }
      case 'REELING': {
        if (this.reel.pressed) {
          this.reelHintTimer = 0;
          const speed = 0.34;
          this.line.baitDepth -= speed * dt;
          this.line.tension = 0.9;
          this.audio.setMotorLoad(0.4 + Math.sin(this.elapsed * 2.2) * 0.2);
          // 魚の抵抗が穂先に伝わる
          if (Math.random() < dt * 1.4) this.rod.impulse(0.55 + Math.random() * 0.5);
          // 細い銀色の反射（一度だけ）
          if (!this.silverFlashDone && this.line.baitDepth < 0.5) {
            this.silverFlashDone = true;
            this.holeWater.fishGlow = 1;
          }
          if (this.line.baitDepth <= 0.04) this.landFish();
        } else {
          this.reelHintTimer += dt;
          this.line.tension = damp(this.line.tension, 0.6, 2, dt);
          if (this.reelHintTimer > 3.2) {
            this.reelHintTimer = 0;
            this.reel.hintNudge();
          }
        }
        break;
      }
      case 'REVEAL': {
        if (this.reel.pressed && this.stateTime > 0.8) {
          this.line.baitDepth = Math.max(this.line.baitDepth - 0.16 * dt, -0.3);
          if (this.line.baitDepth <= -0.3) this.catchFish();
        }
        // 押していなくても、魚が上がっていれば少し待って取り込み
        if (this.stateTime > 8 && this.line.baitDepth < -0.1) this.catchFish();
        break;
      }
      case 'CAUGHT':
        break;
      default:
        break;
    }
  }

  private updateFish(dt: number, t: number) {
    const bait = this.line.baitWorld;
    switch (this.fishMode) {
      case 'APPROACH': {
        // 群れの中から一匹が餌へゆっくり近づく
        this.fishAnimT += dt;
        const k = clamp(this.fishAnimT / Math.max(this.biteDelay, 0.8), 0, 1);
        const target = this.tmpV1.set(bait.x + 0.1, bait.y + 0.015, bait.z + 0.02);
        this.actorFish.group.position.lerpVectors(this.fishFrom, target, k * k * (3 - 2 * k));
        this.faceTowards(this.actorFish.group, target, dt, 4);
        this.actorFish.swimAmp = 1;
        this.actorFish.swimSpeed = 6;
        // 連れの一匹は少し離れて漂う
        const c = this.companionFish.group.position;
        c.x = damp(c.x, bait.x - 0.28 + Math.sin(t * 0.7) * 0.06, 0.7, dt);
        c.y = damp(c.y, bait.y - 0.12, 0.7, dt);
        c.z = damp(c.z, bait.z + 0.22, 0.7, dt);
        this.faceTowards(this.companionFish.group, bait, dt, 2);
        break;
      }
      case 'NIBBLE': {
        // ついばみ：餌の前で小刻みに突く
        this.fishAnimT += dt;
        const peck = Math.sin(this.fishAnimT * 9) * 0.5 + 0.5;
        const px = bait.x + 0.05 + peck * -0.03;
        this.actorFish.group.position.set(px, bait.y + 0.012 + Math.sin(this.fishAnimT * 3) * 0.006, bait.z + 0.01);
        // 頭（+z）を餌のある-x方向へ向ける
        this.actorFish.group.rotation.y = -Math.PI / 2 + Math.sin(this.fishAnimT * 1.6) * 0.12;
        this.actorFish.swimAmp = 0.55;
        this.actorFish.swimSpeed = 9;
        break;
      }
      case 'HOOKED': {
        // 穏やかに掛かった状態：餌の位置に付いて泳ぐ
        this.actorFish.group.position.set(
          bait.x + Math.sin(t * 3.1) * 0.02,
          bait.y + 0.01,
          bait.z + Math.cos(t * 2.7) * 0.02
        );
        this.actorFish.group.rotation.y = Math.PI / 2 + Math.sin(t * 2.2) * 0.5;
        this.actorFish.group.rotation.z = Math.sin(t * 3.7) * 0.4;
        this.actorFish.swimAmp = 1.4;
        this.actorFish.swimSpeed = 11;
        // 仲間は離れていく
        this.companionFish.group.position.y -= dt * 0.15;
        this.companionFish.group.position.x -= dt * 0.2;
        if (this.companionFish.group.position.y < WATER_Y - 3) this.companionFish.group.visible = false;
        break;
      }
      case 'LANDED': {
        // 水面から上：糸にぶら下がって時々跳ねる
        this.actorFish.group.position.set(bait.x, bait.y + 0.005, bait.z);
        const flap = Math.max(0, Math.sin(t * 5.2)) * Math.max(0, Math.sin(t * 0.9));
        // 頭を上（糸の方向）へ向けてぶら下がる
        this.actorFish.group.rotation.set(-Math.PI / 2 + 0.25 + flap * 0.3, Math.sin(t * 1.3) * 0.6, 0);
        this.actorFish.swimAmp = 0.5 + flap * 1.6;
        this.actorFish.swimSpeed = 12;
        break;
      }
      case 'TO_BUCKET': {
        // 係員側の安全な取り込み：そっとバケツへ
        this.fishAnimT += dt / 1.6;
        const k = clamp(this.fishAnimT, 0, 1);
        const bucketTop = this.boat.bucket.getWorldPosition(this.tmpV1).clone();
        bucketTop.y += 0.13;
        const p = this.actorFish.group.position;
        p.lerpVectors(this.catchArcFrom, bucketTop, k * k * (3 - 2 * k));
        p.y += Math.sin(k * Math.PI) * 0.22;
        // 頭上向きのまま弧を描いて、着水時に水平へ
        this.actorFish.group.rotation.set(-Math.PI / 2 + k * (Math.PI / 2), Math.sin(k * 6) * 0.2, 0);
        if (k >= 1) {
          this.fishMode = 'HIDDEN';
          this.actorFish.group.visible = false;
          this.audio.plop();
          this.addBucketFish();
          this.catches++;
          this.line.baitDepth = -0.18;
          this.replayBtn.classList.add('shown');
        }
        break;
      }
      case 'HIDDEN':
        break;
    }
    if (this.actorFish.group.visible) this.actorFish.updateSwim(dt, t);
    if (this.companionFish.group.visible) this.companionFish.updateSwim(dt, t);

    // 巻き上げ中は魚が付いてくる
    if (this.state === 'RESET') {
      // 餌がゆっくり沈んで元の棚へ
      this.line.baitDepth = Math.min(this.line.baitDepth + dt * 1.5, this.cfg.fishDepth);
    }

    // バケツの魚
    for (const f of this.bucketFish) {
      f.phase += dt * f.speed;
      f.mesh.position.set(
        Math.cos(f.phase) * f.r,
        this.boat.bucketWaterY - 0.028 + Math.sin(f.phase * 0.7) * 0.012,
        Math.sin(f.phase) * f.r
      );
      // 少し体を傾けて銀色の体側が上から見えるように
      f.mesh.rotation.set(0, -f.phase + Math.PI / 2, 0.9 + Math.sin(f.phase * 1.3) * 0.15);
    }
  }

  private faceTowards(obj: THREE.Object3D, target: THREE.Vector3, dt: number, rate: number) {
    const dir = this.tmpV2.subVectors(target, obj.position);
    if (dir.lengthSq() < 1e-6) return;
    const yaw = Math.atan2(dir.x, dir.z);
    obj.rotation.y = damp(obj.rotation.y, yaw, rate, dt);
  }

  private updateQuality(dt: number) {
    this.frameAcc += dt;
    this.frameCount++;
    this.qualityTimer += dt;
    if (this.qualityTimer >= 2) {
      const avg = this.frameAcc / Math.max(this.frameCount, 1);
      if (avg > 0.04 && this.dprScale > 0.55) {
        this.dprScale = Math.max(0.55, this.dprScale - 0.15);
        this.renderer.setPixelRatio(this.baseDpr * this.dprScale);
      } else if (avg < 0.02 && this.dprScale < 1) {
        this.dprScale = Math.min(1, this.dprScale + 0.15);
        this.renderer.setPixelRatio(this.baseDpr * this.dprScale);
      }
      this.qualityTimer = 0;
      this.frameAcc = 0;
      this.frameCount = 0;
    }
  }
}
