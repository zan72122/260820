import * as THREE from 'three';
import { Station } from './station';
import { CameraRig } from './camera';
import { InputController } from './input';
import { AudioBus } from './audio';
import { MatLib } from './materials';
import { LetterSpec, STATION_SPACING } from './const';

type GameState = 'intro' | 'operate' | 'solveSeq' | 'awaitSwipe' | 'transit';

export class Game {
  stations: Station[] = [];
  stationIndex = 0;
  state: GameState = 'intro';
  input: InputController;
  private idleTime = 0;
  private hintCooldown = 0;
  private lettersLoaded = 1;
  private loadingMore = false;
  private wheelCenterTmp = new THREE.Vector3();
  private beamTmp = new THREE.Vector3();
  private beamLampPos = new THREE.Vector3();

  constructor(
    public scene: THREE.Scene,
    public rig: CameraRig,
    public audio: AudioBus,
    M: MatLib,
    specA: LetterSpec,
    canvas: HTMLCanvasElement,
    skipIntro = false,
  ) {
    for (let i = 0; i < 3; i++) {
      const st = new Station(i, M, audio);
      st.group.position.x = i * STATION_SPACING;
      scene.add(st.group);
      this.stations.push(st);
    }
    this.stations[0].loadSpec(specA);
    this.wireStation(this.stations[0]);
    this.stations[0].setActive(true);

    this.input = new InputController(canvas, rig.camera, {
      onWheel: (d) => {
        if (this.state !== 'operate') return;
        this.active.dragging = this.input.dragging;
        this.active.applyWheelDelta(d);
        this.idleTime = 0;
      },
      onLever: (d) => {
        if (this.state !== 'operate') return;
        this.active.leverDragging = this.input.leverDragging;
        this.active.applyLeverDelta(d);
        this.idleTime = 0;
      },
      onSwipe: () => this.advance(),
      onAnyTouch: () => {
        audio.resume();
        if (this.state === 'intro') this.rig.skipIntro();
        this.idleTime = 0;
      },
      wheelProxy: () => (this.state === 'operate' ? this.active.wheelProxy : null),
      leverProxy: () => (this.state === 'operate' ? this.active.leverProxy : null),
      wheelCenterWorld: () => this.active.getWheelCenterWorld(this.wheelCenterTmp),
      swipeEnabled: () => this.state === 'awaitSwipe',
    });

    if (skipIntro) {
      this.state = 'operate';
      this.rig.snapToOperate(0);
    } else {
      this.rig.playIntro(0, () => {
        this.state = 'operate';
      });
    }
    // fetch the next machines once the first is on screen
    window.setTimeout(() => void this.loadMoreLetters(), 6000);
  }

  get active(): Station {
    return this.stations[this.stationIndex];
  }

  private wireStation(st: Station): void {
    st.onSolved = () => {
      if (st !== this.active) return;
      this.state = 'solveSeq';
      void this.loadMoreLetters();
      window.setTimeout(() => {
        this.rig.playSolveSequence(st.group.position.x, () => {
          this.state = 'awaitSwipe';
        });
      }, 1400); // linger on the operating view: the child watches the A lock in
    };
    st.onSolvedTable = () => {
      // stage 1 of H done — stay in operate for the lever stage
    };
  }

  private async loadMoreLetters(): Promise<void> {
    if (this.loadingMore || this.lettersLoaded >= 3) return;
    this.loadingMore = true;
    try {
      const [{ letterQ }, { letterH }] = await Promise.all([
        import('./letters/q'),
        import('./letters/h'),
      ]);
      if (!this.stations[1].spec) {
        this.stations[1].loadSpec(letterQ);
        this.wireStation(this.stations[1]);
      }
      if (!this.stations[2].spec) {
        this.stations[2].loadSpec(letterH);
        this.wireStation(this.stations[2]);
      }
      this.lettersLoaded = 3;
    } finally {
      this.loadingMore = false;
    }
  }

  /** test/debug helper: jump straight to a station in operating state */
  async gotoStation(i: number): Promise<void> {
    await this.loadMoreLetters();
    if (!this.stations[i].spec) return;
    this.active.setActive(false);
    this.stationIndex = i;
    this.active.setActive(true);
    this.state = 'operate';
    this.rig.snapToOperate(this.active.group.position.x);
  }

  advance(): void {
    if (this.state !== 'awaitSwipe') return;
    const next = (this.stationIndex + 1) % 3;
    if (next === 0) {
      // full replay: rebuild the mystery on every machine
      for (const st of this.stations) st.reset();
    }
    const from = this.active;
    this.state = 'transit';
    this.audio.travel();
    this.stationIndex = next;
    const to = this.active;
    if (!to.spec) {
      // async letters not ready yet (very slow network): load then go
      void this.loadMoreLetters().then(() => {
        if (!to.spec) this.stationIndex = 0;
      });
    }
    to.setActive(true);
    this.rig.playTransit(from.group.position.x, to.group.position.x, () => {
      from.setActive(false);
      this.state = 'operate';
      this.idleTime = 0;
    });
  }

  update(dt: number): void {
    // lights: active station's lamp on; during transit both softly on
    const camPos = this.rig.camera.position;
    for (const st of this.stations) {
      if (!st.spec) continue;
      const want = st === this.active || (this.state === 'transit' && st.solved) ? 6.5 : 0;
      // haze cone fades out when the camera looks straight down the beam
      const toCam = this.beamTmp.copy(camPos);
      toCam.x -= st.group.position.x;
      toCam.sub(this.beamLampPos.set(0, st.lightY, 5.2)).normalize();
      const onAxis = Math.abs(toCam.z);
      st.beamViewFactor = THREE.MathUtils.clamp((1 - onAxis) * 1.8, 0, 1);
      st.update(dt, st.active ? want : 0);
    }

    // physical hints when the child stalls
    if (this.state === 'operate') {
      this.idleTime += dt;
      this.hintCooldown -= dt;
      const delay = this.active.spec?.hintDelay ?? 8;
      if (this.idleTime > delay && this.hintCooldown <= 0 && !this.active.solved) {
        this.hintCooldown = 9;
        this.audio.creak();
        this.active.hintNudge();
      }
    } else if (this.state === 'awaitSwipe') {
      this.idleTime += dt;
      if (this.idleTime > 6) {
        this.idleTime = 0;
        this.active.wiggleFlag();
        this.audio.leverTick();
      }
    }

    this.rig.update(dt, this.active.group.position.x, this.active.closeness());
  }
}
