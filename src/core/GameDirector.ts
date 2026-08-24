import * as THREE from 'three';
import { clamp01, damp, lerp, smoothstep } from '../util/math';
import type { SceneRoot } from '../scene/SceneRoot';
import { CHESTPIECE_REST } from '../scene/Stethoscope';
import { LAYOUT } from '../scene/layout';
import { AudioSession } from './AudioSession';
import { CameraDirector } from './CameraDirector';
import {
  CuffPressureModel,
  PRESSURE_READY,
  PRESSURE_WINDOW_BOTTOM,
} from './CuffPressureModel';
import { BulbPumpController } from './BulbPumpController';
import { ValveController } from './ValveController';
import { HeartModel } from './HeartModel';
import { KorotkoffAudioModel, voicingFor } from './KorotkoffAudioModel';
import { MechanicalAudio } from './MechanicalAudio';
import { StethoscopeContact } from './StethoscopeContact';
import { TrainingArmReveal } from './TrainingArmReveal';
import { ChildGuidance, type Beat } from './ChildGuidance';
import { ReplayVariation, type RunConfig } from './ReplayVariation';
import type { PointerRouter } from './PointerRouter';
import type { Overlay } from '../ui/Overlay';

const SEATED = new THREE.Vector3(LAYOUT.fossa.x, LAYOUT.fossa.y + 0.005, LAYOUT.fossa.z);
const CARRY_HEIGHT = 0.8;

/**
 * Runs the whole exercise: what the child can do, what the room does back, and
 * which shot the camera is on. Nothing here reads or reports a blood pressure
 * value; the only causal chain is tight cuff → silence, easing → tapping,
 * loose → silence again.
 */
export class GameDirector {
  readonly pressure = new CuffPressureModel();
  readonly valve = new ValveController();
  readonly bulb = new BulbPumpController();
  readonly heart = new HeartModel();
  readonly contact = new StethoscopeContact();
  readonly reveal = new TrainingArmReveal();
  readonly guidance = new ChildGuidance();
  readonly replay = new ReplayVariation();
  readonly korotkoff: KorotkoffAudioModel;
  readonly mechanical: MechanicalAudio;

  private beat: Beat = 'awaitStethoscope';
  private beatTime = 0;
  private config: RunConfig;
  private soundsThisRun = 0;
  private revealDone = false;
  private autoPumping = false;
  private autoPumpTimer = 0;
  private comparisonPhase = 0;
  private scripted: number | null = null;
  private scriptTarget = 0;
  private cuffDumped = false;
  private introTimer = 0;
  private introDone = false;
  private time = 0;
  private unlockRequested = false;

  private chestPos = CHESTPIECE_REST.clone();
  private chestTarget = CHESTPIECE_REST.clone();
  private carrying = false;
  private lastPulseGain = 0;
  private risingHold = 0;
  private overPressureHold = 0;
  /** Simulated seconds per second of audio-clock time; 1 on a healthy frame rate. */
  private simRate = 1;
  private lastSimSample = { audio: 0, sim: 0 };
  private simClock = 0;

  constructor(
    private scene: SceneRoot,
    private audio: AudioSession,
    private camera: CameraDirector,
    private router: PointerRouter,
    private overlay: Overlay,
  ) {
    this.korotkoff = new KorotkoffAudioModel(this.audio, this.heart);
    this.mechanical = new MechanicalAudio(this.audio);
    this.config = this.replay.config();
    this.guidance.setStrength(this.config.guidance);
    this.wire();
  }

  /* ------------------------------------------------------------- wiring -- */

  private wire(): void {
    this.router.dragHeight = CARRY_HEIGHT;

    this.router.onAnyPointer.on(() => {
        this.guidance.noteActivity();
      // The child's first touch is what starts the audio. There is no
      // separate "enable sound" screen anywhere in this game.
      if (!this.audio.unlocked && !this.unlockRequested) {
        this.unlockRequested = true;
        void this.audio.unlock();
      }
    });

    this.audio.onUnlocked.on(() => {
      this.mechanical.start();
      this.korotkoff.start((t) => this.pressureAt(t));
      this.heart.setBpm(this.config.bpm, this.audio.now);
    });

    this.router.onGrab.on((target) => {
      if (target === 'chestpiece') {
        this.carrying = true;
        this.contact.dragging = true;
        this.contact.lift();
        if (!this.introDone) this.finishIntro();
      } else if (target === null) {
        this.carrying = false;
        this.contact.dragging = false;
      }
      if (target === 'bulb' && this.beat === 'ready') this.startRun(false);
      if (target === 'bulb' || target === 'valve') {
        if (!this.introDone) this.finishIntro();
      }
    });

    this.router.onChestpieceMove.on((p) => {
      if (!this.carrying) return;
      const flat = new THREE.Vector3(p.x, CARRY_HEIGHT, p.z);
      // Assisted capture: the instructor's hand closes the last few
      // millimetres, so an approximate drop still lands correctly.
      const d = Math.hypot(flat.x - SEATED.x, flat.z - SEATED.z);
      const pull = 1 - smoothstep(0.04, 0.17, d);
      this.chestTarget.set(
        lerp(flat.x, SEATED.x, pull),
        lerp(CARRY_HEIGHT, SEATED.y + 0.012, pull),
        lerp(flat.z, SEATED.z, pull),
      );
    });

    this.router.onChestpieceDrop.on(() => {
      this.carrying = false;
      this.contact.dragging = false;
      const d = Math.hypot(this.chestTarget.x - SEATED.x, this.chestTarget.z - SEATED.z);
      const accept = this.contact.evaluate(d);
      if (accept > 0.2) {
        this.chestTarget.copy(SEATED);
        this.contact.seat();
        this.mechanical.chestpieceContact();
      } else {
        this.chestTarget.copy(CHESTPIECE_REST);
      }
    });

    this.router.onBulbPress.on((bias) => this.bulb.press(bias));
    this.router.onBulbStroke.on((bias) => this.bulb.restroke(bias));
    this.router.onBulbRelease.on(() => this.bulb.release());
    this.router.onValveArc.on((d) => {
      if (this.scripted === null) this.valve.applyArc(d);
    });
    this.router.onTapEmptySpace.on(() => {
      if (this.beat === 'comparison') this.endComparison();
    });

    this.bulb.onStroke.on((strength) => {
      if (this.scripted !== null) return;
      const before = this.pressure.pressure;
      this.pressure.pump(strength);
      this.risingHold = 0.5;
      this.mechanical.pumpStroke(strength, this.pressure.pressure);
      if (this.pressure.pressure - before > 0.01) {
        this.mechanical.fabricTension(clamp01(this.pressure.pressure));
      }
    });
    this.bulb.onRelease.on(() => this.mechanical.bulbRelease());

    this.pressure.onOverPressure.on(() => {
      // Past a firm cuff the bulb simply pushes back and the instructor's hand
      // settles on it. There is no way to over-inflate anything here.
      this.overPressureHold = 1.2;
    });

    this.contact.onSeated.on(() => {
      if (this.beat === 'awaitStethoscope') this.setBeat('awaitInflation');
    });

    this.korotkoff.onSoundBeat.on(() => {
      this.soundsThisRun += 1;
      if (this.beat === 'awaitValve' || this.beat === 'holdAndNotice') {
        this.setBeat('listening');
      }
    });

    this.overlay.onReplay.on(() => this.startRun(true));
  }

  /* -------------------------------------------------------------- runs --- */

  private startRun(autoInflate: boolean): void {
    this.config = this.replay.next();
    this.guidance.setStrength(this.config.guidance);
    this.guidance.freeze(false);
    this.guidance.reset();
    this.heart.setBpm(this.config.bpm, this.audio.now);
    this.pressure.reset();
    this.valve.reset();
    this.bulb.reset();
    this.reveal.reset();
    this.korotkoff.resetRun();
    this.soundsThisRun = 0;
    this.revealDone = false;
    this.cuffDumped = false;
    this.scripted = null;
    this.overlay.showReplay(false);
    this.camera.release();

    // The stethoscope stays where the child put it, so the tapping is only
    // ever one action away on a repeat.
    if (this.contact.placed) {
      this.chestTarget.copy(SEATED);
      this.contact.seat();
    }

    if (autoInflate && this.contact.placed) {
      this.autoPumping = true;
      this.autoPumpTimer = 0;
      this.setBeat('awaitInflation');
      this.camera.cut('threeQuarter');
    } else {
      this.autoPumping = false;
      this.setBeat(this.contact.placed ? 'awaitInflation' : 'awaitStethoscope');
      this.camera.cut('closeControls');
    }
  }

  private setBeat(beat: Beat): void {
    if (this.beat === beat) return;
    this.beat = beat;
    this.beatTime = 0;
    this.onBeatEnter(beat);
  }

  private onBeatEnter(beat: Beat): void {
    switch (beat) {
      case 'awaitInflation':
        this.camera.cut('closeControls');
        break;
      case 'holdAndNotice':
        // Pressurised and silent. This is the puzzle; hold on the cuff.
        this.camera.cut('threeQuarter');
        break;
      case 'awaitValve':
        // The valve and the cuff have to share the frame: the child must see
        // the cuff slacken the instant their finger moves.
        this.camera.cut('threeQuarter');
        break;
      case 'listening':
        // No flash, no star, no label. The camera simply stops moving and the
        // room gets quieter, so the tapping is the only thing left to notice.
        this.camera.cut('listen');
        this.guidance.freeze(true);
        window.setTimeout(() => {
          if (this.beat === 'listening') this.camera.hold();
        }, 900);
        break;
      case 'reveal':
        this.camera.release();
        this.camera.cut('reveal');
        this.reveal.open();
        break;
      case 'fading':
        this.camera.release();
        this.camera.cut('threeQuarter');
        this.guidance.freeze(false);
        break;
      case 'comparison':
        this.camera.release();
        this.camera.cut('compare');
        this.comparisonPhase = 0;
        this.scripted = this.pressure.pressure;
        this.scriptTarget = 0.82;
        break;
      case 'ready':
        this.camera.release();
        this.camera.cut('mid');
        this.scripted = null;
        this.overlay.showReplay(true);
        break;
      default:
        break;
    }
  }

  private endComparison(): void {
    this.scripted = null;
    this.setBeat('ready');
  }

  private finishIntro(): void {
    this.introDone = true;
    if (this.camera.shot === 'establish') this.camera.cut('mid');
  }

  /* ------------------------------------------------------------ predict -- */

  /**
   * Predicted cuff pressure at a future audio-clock time.
   *
   * Beats are scheduled a fraction of a second ahead on the audio clock, but
   * the simulation clamps its timestep, so on a device that drops frames a
   * second of audio is less than a second of simulation. Scaling the
   * extrapolation by the measured ratio keeps the first tap landing at the
   * same cuff pressure whatever the frame rate — otherwise a struggling device
   * hears it slightly early, which is exactly the moment this game is about.
   */
  private pressureAt(t: number): number {
    if (this.scripted !== null) return this.pressure.pressure;
    const dt = Math.max(0, t - this.audio.now) * this.simRate;
    const rate = Math.pow(this.valve.openness, 1.5) * 0.34 + 0.004;
    return clamp01(this.pressure.pressure - rate * dt);
  }

  /** Track how much simulation a second of audio-clock time actually buys. */
  private measureSimRate(dt: number): void {
    this.simClock += dt;
    if (!this.audio.unlocked) {
      this.lastSimSample = { audio: this.audio.now, sim: this.simClock };
      return;
    }
    const dAudio = this.audio.now - this.lastSimSample.audio;
    if (dAudio < 0.5) return;
    const dSim = this.simClock - this.lastSimSample.sim;
    this.lastSimSample = { audio: this.audio.now, sim: this.simClock };
    this.simRate = damp(this.simRate, clamp01(dSim / dAudio), 4, dAudio);
  }

  /* ------------------------------------------------------------- update -- */

  update(dt: number): void {
    this.time += dt;
    this.measureSimRate(dt);
    const grabbing = this.router.grabbing !== null;

    if (!this.introDone) {
      this.introTimer += dt;
      if (this.introTimer > 3.4) this.finishIntro();
    }

    this.stepBeat(dt);

    this.bulb.applyBackPressure(this.pressure.pressure);
    this.bulb.update(dt);
    this.valve.update(dt);

    if (this.scripted === null) {
      // While the cutaway is on screen the instructor steadies the valve, so
      // the cuff barely moves. Without this the whole sound window drains away
      // behind the reveal and the child comes back to silence — the opposite
      // of the point, which is to see the vessel opening for the tapping they
      // can still hear.
      const bleedScale = this.beat === 'reveal' ? 0.12 : 1;
      this.pressure.bleed(dt, this.valve.openness * bleedScale);
      if (this.beat === 'fading' && this.cuffDumped) this.pressure.release(dt);
    } else {
      this.scripted = damp(this.scripted, this.scriptTarget, 2.6, dt);
      this.pressure.pressure = this.scripted;
    }
    this.pressure.update(dt);
    this.contact.update(dt);
    this.reveal.update(dt);
    this.overPressureHold = Math.max(0, this.overPressureHold - dt);
    this.guidance.freeze(
      this.beat === 'listening' ||
        this.beat === 'reveal' ||
        this.beat === 'comparison' ||
        this.overPressureHold > 0,
    );
    this.guidance.update(this.beat, dt, grabbing);

    this.risingHold = Math.max(0, this.risingHold - dt);
    this.korotkoff.setContact(this.contact.contact);
    this.korotkoff.setAllowed(this.risingHold <= 0);
    this.mechanical.updateBleed(this.valve.openness, this.pressure.pressure);
    this.updateAudioLevels();
    this.pushToScene(dt);
  }

  private stepBeat(dt: number): void {
    this.beatTime += dt;
    switch (this.beat) {
      case 'awaitStethoscope':
        break;

      case 'awaitInflation': {
        if (this.autoPumping) {
          this.autoPumpTimer += dt;
          // The instructor re-inflates so a repeat reaches the moment fast.
          if (this.autoPumpTimer > 0.16 && this.pressure.pressure < PRESSURE_READY + 0.06) {
            this.autoPumpTimer = 0;
            this.pressure.pump(0.9);
            this.risingHold = 0.5;
            this.mechanical.pumpStroke(0.9, this.pressure.pressure);
          }
        }
        if (this.pressure.pressure >= PRESSURE_READY) {
          this.autoPumping = false;
          this.setBeat('holdAndNotice');
        }
        break;
      }

      case 'holdAndNotice':
        // Two or three beats of "it is running, and I hear nothing".
        if (this.beatTime > this.heart.period * 2.6) this.setBeat('awaitValve');
        break;

      case 'awaitValve':
        if (this.pressure.pressure <= PRESSURE_WINDOW_BOTTOM) this.setBeat('fading');
        break;

      case 'listening':
        if (
          !this.revealDone &&
          this.config.autoReveal &&
          this.soundsThisRun >= 3 &&
          this.pressure.inWindow
        ) {
          this.revealDone = true;
          this.setBeat('reveal');
        } else if (this.pressure.pressure <= PRESSURE_WINDOW_BOTTOM) {
          this.setBeat('fading');
        }
        break;

      case 'reveal':
        if (this.beatTime > 6.6) {
          this.reveal.close();
          // Straight back to the outside view: listening is the main event.
          this.setBeat(this.pressure.inWindow ? 'listening' : 'fading');
        }
        break;

      case 'fading':
        if (!this.cuffDumped && this.beatTime > 1.6) {
          this.cuffDumped = true;
          this.mechanical.cuffRelease();
        }
        if (this.pressure.pressure < 0.02) {
          this.setBeat(this.config.comparison ? 'comparison' : 'ready');
        }
        break;

      case 'comparison': {
        // Same arm, same camera, same module tempo: only the cuff changes.
        const dwell = 3.4;
        const phase = Math.min(2, Math.floor(this.beatTime / dwell));
        if (phase !== this.comparisonPhase) {
          this.comparisonPhase = phase;
          this.scriptTarget = phase === 0 ? 0.82 : phase === 1 ? 0.48 : 0.1;
        }
        if (this.beatTime > dwell * 3 + 0.8) this.endComparison();
        break;
      }

      case 'ready':
        break;
    }
  }

  private updateAudioLevels(): void {
    if (!this.audio.unlocked) return;
    let room = 1;
    if (this.contact.contact > 0.4) room = 0.62;
    if (this.beat === 'listening' || this.beat === 'comparison') room = 0.42;
    if (this.beat === 'reveal') room = 0.34;
    this.audio.setRoomLevel(room);
    this.audio.setBodyLevel(this.contact.contact);
  }

  private pushToScene(dt: number): void {
    const s = this.scene;
    const audioNow = this.audio.unlocked ? this.audio.now : null;
    const pulse = this.heart.pulseEnvelope(audioNow);
    const phase = this.heart.phase(audioNow);

    // Chestpiece follows the finger, then settles onto the skin.
    this.chestPos.x = damp(this.chestPos.x, this.chestTarget.x, this.carrying ? 22 : 10, dt);
    this.chestPos.y = damp(this.chestPos.y, this.chestTarget.y, this.carrying ? 22 : 10, dt);
    this.chestPos.z = damp(this.chestPos.z, this.chestTarget.z, this.carrying ? 22 : 10, dt);

    s.cuff.apply(this.pressure.tension);
    s.cuff.setSlotOpen(this.reveal.exposure);

    s.manikin.update(
      {
        cuffTension: this.pressure.tension,
        cuffPressure: this.pressure.pressure,
        chestpiecePos: this.contact.contact > 0.05 ? this.chestPos : null,
        contact: this.contact.contact,
        exposure: this.reveal.exposure,
        beatPhase: phase,
        pulse,
        lowQuality: !s.renderer.shadowMap.enabled,
      },
      dt,
    );

    s.equipment.update({
      squeeze: this.bulb.squeeze,
      dentBias: this.bulb.dentBias,
      valveAngle: this.valve.angle,
      needle: this.pressure.needle,
      bulbHint: this.guidance.bulbHint,
      valveHint: this.guidance.valveHint + this.pressure.pressure * 0.25,
      time: this.time,
    });

    s.stethoscope.setPosition(this.chestPos, this.contact.contact, 0);
    // The diaphragm moves with the tapping, and only with the tapping.
    const gain = voicingFor(this.pressure.pressure).gain * this.contact.contact;
    this.lastPulseGain = damp(this.lastPulseGain, gain, 8, dt);
    s.stethoscope.setDiaphragmPulse(pulse * this.lastPulseGain);
    s.stethoscope.update(dt, this.carrying);

    s.instructor.setTarget(this.guidance.assist);
    s.instructor.setStillness(this.guidance.stillness);
    s.instructor.update(dt, this.time);

    this.router.preferred =
      this.beat === 'awaitStethoscope'
        ? 'chestpiece'
        : this.beat === 'awaitInflation' || this.beat === 'ready'
          ? 'bulb'
          : 'valve';
    this.router.anchors.chestpiece.world.copy(this.chestPos);
    this.router.anchors.bulb.world.copy(s.equipment.bulbAnchor);
    this.router.anchors.valve.world.copy(s.equipment.valveAnchor);
  }

  get currentBeat(): Beat {
    return this.beat;
  }
}
