import { Group, Scene, Vector3 } from 'three/webgpu';
import { CHILD_EYE_Y, LAYOUT, type RuntimeFlags } from '../core/config';
import { Rng, clamp, clamp01, damp, lerp, smootherstep, smoothstep } from '../core/mathx';
import type { AudioEngine } from '../core/audio';
import type { Input, SwipeInfo } from '../core/input';
import type { Materials } from '../art/materials';
import type { Lighting } from '../world/lighting';
import { GrandCurtain, LegCurtain } from '../world/curtain';
import { PreviousAct, Teacher, WaitingChildren, makeChild } from '../chars/cast';
import type { Puppet } from '../chars/puppet';
import type { CameraRig } from './cameraRig';
import type { Overlay } from '../ui/overlay';
import { WalkPath } from './path';

export type Phase =
  | 'boot'
  | 'wait'
  | 'notYet'
  | 'actEnding'
  | 'hush'
  | 'cue'
  | 'walk'
  | 'bow'
  | 'again';

/**
 * The route out. Two constraints shape it: it has to pass between the parted
 * legs at z = 1.2, and once through it must stay downstage of them, because the
 * camera walks this same line and cloth in the lens is not a reveal.
 */
const PATH_POINTS: [number, number][] = [
  [6.3, 4.2],
  [6.02, 3.5],
  [5.62, 2.75],
  [5.1, 1.95],
  [4.66, 1.22],
  [4.2, 0.82],
  [3.2, 0.7],
  [2.1, 0.64],
  [1.25, 0.58],
  [0.85, 0.5],
  [0.7, 0.42],
];

/**
 * The whole game, as one chain of physical events:
 *
 *   dark wing -> peek -> "not yet" -> the act before yours ends -> "now" ->
 *   the house curtain goes out -> you walk -> the room appears.
 *
 * Nothing in here ever prints an instruction. Every piece of information the
 * player needs arrives as light, sound, a teacher's hand or a gap in some cloth.
 */
export class Director {
  phase: Phase = 'boot';
  round = 0;
  /** Set once the player has been shown "not yet" in this round. */
  private warned = false;
  private t = 0;
  private time = 0;

  /** 0..1 of the allowed peek. */
  private peek = 0;
  private peekTarget = 0;
  private gestureSign = 0;
  private gestureAccum = 0;
  private everPeeked = false;
  private handHintUsed = { drag: false, out: false };
  private hintStage = 0;
  /** Test-only: pins the peek so framing can be photographed. */
  private debugHold: number | null = null;

  private walkS = 0;
  private walkSpeed = 0;
  private speedBoost = 0;
  private revealT = 0;
  private revealed = false;
  private bowStage = 0;
  /** Runs across bow and 'again' so the pull-back never snaps back. */
  private outroT = 0;
  private grandOpened = false;

  private path = new WalkPath(PATH_POINTS);
  private player!: Puppet;
  private playerGroup = new Group();
  private teacher!: Teacher;
  private mates!: WaitingChildren;
  private prevAct!: PreviousAct;

  private legCurtain: LegCurtain;
  private grand: GrandCurtain;
  private rig: CameraRig;
  private lighting: Lighting;
  private audio: AudioEngine;
  private overlay: Overlay;
  private mats: Materials;
  private input: Input;
  private flags: RuntimeFlags;
  private scene: Scene;
  private rng: Rng;

  private gapPoint = new Vector3(LAYOUT.legCurtain.seamX, LAYOUT.stageY + 1.35, LAYOUT.legCurtain.z);
  private playerHead = new Vector3();
  private tmpA: [number, number] = [0, 0];
  private tmpB: [number, number] = [0, 0];
  private eye = new Vector3();
  private look = new Vector3();

  constructor(opts: {
    scene: Scene;
    mats: Materials;
    lighting: Lighting;
    legCurtain: LegCurtain;
    grand: GrandCurtain;
    rig: CameraRig;
    audio: AudioEngine;
    overlay: Overlay;
    input: Input;
    flags: RuntimeFlags;
    rng: Rng;
  }) {
    this.scene = opts.scene;
    this.mats = opts.mats;
    this.lighting = opts.lighting;
    this.legCurtain = opts.legCurtain;
    this.grand = opts.grand;
    this.rig = opts.rig;
    this.audio = opts.audio;
    this.overlay = opts.overlay;
    this.input = opts.input;
    this.flags = opts.flags;
    this.rng = opts.rng;

    this.scene.add(this.playerGroup);
    this.buildCast();
    this.bindInput();
  }

  // ------------------------------------------------------------------ setup

  private buildCast(): void {
    this.teacher = new Teacher(this.mats, this.rng);
    this.mates = new WaitingChildren(this.mats, this.rng, this.round);
    this.prevAct = new PreviousAct(this.mats, this.rng, this.round);
    this.scene.add(this.teacher.puppet.root, this.mates.group, this.prevAct.group);
    this.spawnPlayer();
  }

  private spawnPlayer(): void {
    if (this.player) this.playerGroup.remove(this.player.root);
    this.player = makeChild(this.mats, this.rng, this.round);
    this.player.root.position.set(LAYOUT.playerMark.x, LAYOUT.stageY, LAYOUT.playerMark.z);
    this.path.at(0.9, this.tmpA);
    this.player.faceDirection(
      this.tmpA[0] - LAYOUT.playerMark.x,
      this.tmpA[1] - LAYOUT.playerMark.z,
      1,
      0,
    );
    this.player.root.rotation.y = Math.atan2(
      this.tmpA[0] - LAYOUT.playerMark.x,
      this.tmpA[1] - LAYOUT.playerMark.z,
    );
    this.player.setVisible(false);
    this.player.onFootfall = (s) => this.audio.footstep(s);
    this.playerGroup.add(this.player.root);
  }

  private bindInput(): void {
    this.input.onDown = () => {
      this.gestureSign = 0;
      this.gestureAccum = 0;
      this.overlay.hideHand();
      if (this.phase === 'again') this.restart();
    };

    this.input.onDrag = (dx, _dy, _nx, ny) => {
      if (this.phase === 'walk' || this.phase === 'bow' || this.phase === 'again') {
        // While walking, holding the finger down just nudges the pace.
        this.speedBoost = clamp01(this.speedBoost + Math.abs(dx) * 2.2);
        return;
      }
      if (this.phase === 'notYet') return;

      // Whichever way the player first pulls IS "open". A four-year-old should
      // not have to guess a direction convention.
      this.gestureAccum += dx;
      if (this.gestureSign === 0 && Math.abs(this.gestureAccum) > 0.012) {
        this.gestureSign = Math.sign(this.gestureAccum);
      }
      if (this.gestureSign === 0) return;

      const gain = this.phase === 'cue' ? 2.6 : 2.15;
      this.peekTarget = clamp01(this.peekTarget + dx * this.gestureSign * gain);
      // The cloth deforms under the finger at the height the finger is at.
      this.legCurtain.setBulge(0.055 * this.gestureSign, clamp01(ny));

      if (this.phase === 'cue' && this.peekTarget > 0.72) this.beginWalk(0.4);
    };

    this.input.onFlick = (s: SwipeInfo) => {
      if (this.phase === 'cue') {
        // Any decisive flick that is not a downward flick means "go".
        if (s.dy < 0.55) this.beginWalk(clamp01(s.speed / 3));
      }
    };

    this.input.onUp = () => {
      this.gestureSign = 0;
      this.legCurtain.setBulge(0, 0.5);
    };

    this.input.onTap = (_nx, ny) => {
      if (this.phase === 'again') {
        this.restart();
      } else if (this.phase === 'cue' && ny < 0.8) {
        this.beginWalk(0.35);
      }
    };
  }

  // ---------------------------------------------------------------- control

  start(): void {
    this.phase = 'wait';
    this.t = 0;
    this.lighting.setMood('prevAct');
    this.audio.startPrevAct(1 + this.round * 17);
    this.audio.setOpenness(0);
    this.grand.setOpen(1); // the act before yours is already on
    this.grand.openSpring.set(1);
    this.teacher.setMode('watch');
    this.updateCamera(0, true);
    this.rig.snap();
  }

  private restart(): void {
    this.round++;
    this.warned = false;
    this.everPeeked = false;
    this.hintStage = 0;
    this.peek = 0;
    this.peekTarget = 0;
    this.walkS = 0;
    this.walkSpeed = 0;
    this.revealT = 0;
    this.revealed = false;
    this.lighting.revealBoost = 0;
    this.bowStage = 0;
    this.outroT = 0;
    this.grandOpened = false;
    this.speedBoost = 0;
    this.overlay.showAgain(false);
    this.overlay.setVignette(1);
    this.overlay.hideHand();
    this.legCurtain.gapSpring.set(0.028);
    this.legCurtain.setTargetGap(0.028);
    this.legCurtain.exitSpring.set(0);
    this.legCurtain.setExit(0);
    this.legCurtain.flySpring.set(0);
    this.legCurtain.setFly(0);
    this.grand.setOpen(1);
    this.grand.openSpring.set(1);
    this.prevAct.reset();
    this.spawnPlayer();
    this.audio.fadeApplause(0.8);
    this.audio.setOpenness(0);
    this.audio.startPrevAct(1 + this.round * 17);
    this.lighting.setMood('prevAct');
    this.teacher.variant = this.round;
    // Each run re-dresses itself a little: a different tune, a slightly warmer
    // or cooler house, a different signal. The chain never changes.
    this.lighting.roundBias = ((this.round * 7) % 5) / 4;
    this.teacher.setMode('watch');
    // Small round-to-round changes: a warmer house, a different tune, a
    // different cue. The chain stays the same; the world is never identical.
    this.phase = 'wait';
    this.t = 0;
    this.updateCamera(0, true);
  }

  private beginWalk(strength: number): void {
    if (this.phase !== 'cue') return;
    this.phase = 'walk';
    this.t = 0;
    this.walkS = 0;
    this.speedBoost = clamp01(strength);
    this.player.setVisible(false);
    this.teacher.setMode('sendOff');
    this.audio.teacherVoice('hum');
    this.lighting.setMood('ourAct');
    this.rig.posSmoothing = 0.0022;
    this.rig.lookSmoothing = 0.0016;
  }

  // ----------------------------------------------------------------- update

  update(dt: number): void {
    this.time += dt;
    this.t += dt;

    switch (this.phase) {
      case 'wait':
        this.updateWait(dt);
        break;
      case 'notYet':
        this.updateNotYet();
        break;
      case 'actEnding':
        this.updateActEnding();
        break;
      case 'hush':
        this.updateHush();
        break;
      case 'cue':
        this.updateCue(dt);
        break;
      case 'walk':
        this.updateWalk(dt);
        break;
      case 'bow':
        this.outroT += dt;
        this.updateBow(dt);
        break;
      case 'again':
        this.outroT += dt;
        break;
      default:
        break;
    }

    if (this.debugHold !== null) this.peekTarget = this.debugHold;
    // Peek relaxes on its own: cloth this heavy does not stay where you put it.
    else if (!this.input.isDown && this.phase !== 'walk' && this.phase !== 'bow') {
      this.peekTarget = damp(this.peekTarget, 0, 0.22, dt);
    }
    this.peek = damp(this.peek, this.peekTarget, 0.0006, dt);

    if (this.phase !== 'walk' && this.phase !== 'bow' && this.phase !== 'again') {
      const maxGap =
        this.phase === 'cue' ? LAYOUT.legCurtain.peekMaxGap * 2.6 : LAYOUT.legCurtain.peekMaxGap;
      this.legCurtain.setTargetGap(0.028 + this.peek * maxGap);
      this.audio.setOpenness(this.peek * 0.32);
    }

    this.audio.setClothSpeed(this.legCurtain.gapVelocity);

    this.playerHead.set(
      this.player.root.position.x,
      LAYOUT.stageY + CHILD_EYE_Y,
      this.player.root.position.z,
    );
    this.teacher.update(dt, this.time, this.playerHead, this.gapPoint);
    this.mates.update(dt, this.time, this.gapPoint, this.playerHead);
    this.prevAct.update(dt, this.time);
    this.player.update(dt, this.time);

    this.updateCamera(dt, false);
  }

  // ------------------------------------------------------------ phase logic

  private updateWait(dt: number): void {
    void dt;
    if (!this.everPeeked && this.peek > 0.02) this.everPeeked = true;

    // A real peek - not a twitch - gets the teacher's answer.
    if (!this.warned && this.peek > 0.42) {
      this.phase = 'notYet';
      this.t = 0;
      this.warned = true;
      this.teacher.setMode('wait');
      this.audio.teacherVoice('wait');
      this.peekTarget = 0;
      return;
    }

    this.escalateHints(['drag']);

    // The act before yours ends once the player has understood the "not yet",
    // or on its own if they are happy just watching.
    const patience = this.warned ? 2.6 : 24;
    if (this.t > patience) {
      this.phase = 'actEnding';
      this.t = 0;
      this.audio.endPrevAct();
      this.prevAct.finish();
      this.audio.applause(0.5, 0.8, 2.6, 2.2);
      this.hintStage = 0;
      this.input.resetIdle();
    }
  }

  private updateNotYet(): void {
    // Held closed while she answers - gently, never as a failure.
    this.peekTarget = 0;
    if (this.t > 2.4) {
      this.phase = 'wait';
      this.t = 0;
      this.teacher.setMode('watch');
      this.input.resetIdle();
    }
  }

  private updateActEnding(): void {
    if (this.t > 2.9 && this.grand.openSpring.target > 0.5) {
      this.grand.setOpen(0);
      this.audio.curtainMotor(3.4);
    }
    if (this.t > 5.4) {
      this.phase = 'hush';
      this.t = 0;
      this.lighting.setMood('between');
      this.audio.fadeApplause(1.4);
    }
  }

  private updateHush(): void {
    // A held breath. This silence is what makes the cue land.
    if (this.t > 1.5) {
      this.phase = 'cue';
      this.t = 0;
      this.teacher.setMode('cue');
      this.audio.teacherVoice('now');
      this.audio.chime(this.round % 2 ? 88 : 84, 0.05);
      this.grandOpened = false;
      this.input.resetIdle();
      this.hintStage = 0;
    }
  }

  private updateCue(dt: number): void {
    void dt;
    // 緞帳が開く - the house curtain goes out for us, a beat after her signal.
    if (!this.grandOpened && this.t > 0.7) {
      this.grandOpened = true;
      this.grand.setOpen(1);
      this.audio.curtainMotor(3.6);
      this.rig.bump(0.012);
    }
    this.escalateHints(['out']);
  }

  private updateWalk(dt: number): void {
    // A nervous start, then a proper walk. The player's input only ever makes
    // it a bit brisker - they never have to hold anything to keep going.
    const u = clamp01(this.walkS / this.path.length);
    const base = lerp(0.55, 1.24, smoothstep(0, 0.28, u)) * (1 - smoothstep(0.88, 1, u) * 0.72);
    this.walkSpeed = damp(this.walkSpeed, base * (0.86 + this.speedBoost * 0.5), 0.0004, dt);
    this.speedBoost = damp(this.speedBoost, 0, 0.35, dt);
    this.walkS = Math.min(this.path.length, this.walkS + this.walkSpeed * dt);

    this.path.at(this.walkS, this.tmpA);
    this.path.tangent(this.walkS, this.tmpB);
    this.player.root.position.set(this.tmpA[0], LAYOUT.stageY, this.tmpA[1]);
    this.player.faceDirection(this.tmpB[0], this.tmpB[1], dt, 0.00008);
    this.player.walkSpeed = this.walkSpeed;
    this.player.ctl.headYaw = 0;
    this.player.ctl.headPitch = -0.06;

    // The legs run out on their track as the child pushes through.
    this.legCurtain.setTargetGap(0.028 + this.peek * 0.45);
    this.legCurtain.setExit(1);

    // The reveal is geometric, not scripted: it happens because the child has
    // physically cleared the proscenium jamb and the room is simply there.
    const clear = smoothstep(4.75, 3.4, this.tmpA[0]);
    this.revealT = Math.max(this.revealT, clear);
    // Once the room is open the legs are behind us; run the near one off so the
    // pull-back has clear air.
    if (this.revealT > 0.45) this.legCurtain.setFly(1);
    if (!this.revealed && this.revealT > 0.25) {
      this.revealed = true;
      this.audio.applauseHold(0.42, 1.6);
      this.audio.chime(91, 0.03);
    }
    this.audio.setOpenness(0.2 + this.revealT * 0.8);
    this.lighting.revealBoost = this.revealT;
    this.overlay.setVignette(1 - this.revealT * 0.55);

    // Keep the one shadow-casting light on the child.
    this.lighting.aimKey(
      new Vector3(this.tmpA[0] * 0.6, LAYOUT.stageY, this.tmpA[1] * 0.6 + 0.4),
      new Vector3(this.tmpA[0] * 0.35, 5.1, this.tmpA[1] * 0.4 + 2.2),
    );

    if (this.walkS >= this.path.length - 0.02) {
      this.phase = 'bow';
      this.t = 0;
      this.outroT = 0;
      this.bowStage = 0;
      this.rig.posSmoothing = 0.0009;
      this.rig.lookSmoothing = 0.0007;
    }
  }

  private updateBow(dt: number): void {
    void dt;
    this.player.walkSpeed = 0;
    // Turn the last few degrees to the house.
    this.player.faceDirection(0, -1, dt, 0.00002);

    if (this.t > 0.9 && this.bowStage === 0) {
      this.bowStage = 1;
      this.audio.applauseHold(0.72, 1.1);
    }
    // A small, slightly wobbly four-year-old bow.
    const bow = smoothstep(1.5, 2.1, this.t) * (1 - smoothstep(3.0, 3.6, this.t));
    this.player.ctl.torsoLean = bow * 1.0;
    this.player.ctl.headPitch = bow * 0.35;
    this.player.ctl.left = { pitch: -0.05, spread: 0.1 + bow * 0.1, twist: 0, elbow: 0.2, wrist: 0 };
    this.player.ctl.right = { pitch: -0.05, spread: 0.1 + bow * 0.1, twist: 0, elbow: 0.2, wrist: 0 };

    if (this.t > 3.2 && this.phase === 'bow') {
      this.lighting.setMood('bow');
    }
    if (this.t > 4.4) {
      this.phase = 'again';
      this.t = 0;
      this.overlay.showAgain(true);
      this.audio.fadeApplause(4);
    }
  }

  // ------------------------------------------------------------------ hints

  /**
   * Three stages, in this order and no other: the teacher's eyes, then a
   * classmate doing it, then - once per session, as a last resort - a hand on
   * the glass. Never an arrow, never a sentence.
   */
  private escalateHints(kinds: ('drag' | 'out')[]): void {
    const idle = this.input.idleTime;
    const kind = kinds[0];

    if (this.hintStage < 1 && idle > 4.5) {
      this.hintStage = 1;
      // Stage 1: she looks straight at the player and holds it.
      this.teacher.puppet.ctl.headYaw *= 0.4;
      this.audio.teacherVoice('hum');
    } else if (this.hintStage < 2 && idle > 9) {
      this.hintStage = 2;
      // Stage 2: somebody else shows you.
      this.mates.playPeekDemo(kind === 'drag' ? 'peek' : 'go');
      if (kind === 'out') this.audio.teacherVoice('now');
    } else if (this.hintStage < 3 && idle > 15 && !this.handHintUsed[kind]) {
      this.hintStage = 3;
      this.handHintUsed[kind] = true;
      // Stage 3, once ever: a hand mimes the gesture, offset from the target so
      // it never sits on top of the thing it is pointing at.
      const y = 0.62 + this.rig.portrait * 0.06;
      this.overlay.showHand(kind === 'drag' ? 'drag' : 'out', 0.5, y);
    }
  }

  // ----------------------------------------------------------------- camera

  private updateCamera(dt: number, snap: boolean): void {
    void dt;
    const P = LAYOUT.playerMark;
    const eyeY = LAYOUT.stageY + CHILD_EYE_Y;

    if (this.phase === 'walk' || this.phase === 'bow' || this.phase === 'again') {
      const u = clamp01(this.walkS / this.path.length);
      // Follow the child along the very same line they are walking, so the
      // parted panels sweep the foreground instead of clipping the lens.
      const dist = lerp(0.5, 1.9, smoothstep(0, 0.55, u)) * (1 - smoothstep(0.8, 1, u) * 0.12);
      const height = lerp(1.02, 1.62, smoothstep(0.05, 0.85, u));
      this.path.at(this.walkS - dist, this.tmpA);
      this.eye.set(this.tmpA[0], LAYOUT.stageY + height, this.tmpA[1]);

      this.path.at(this.walkS, this.tmpB);
      const child = new Vector3(this.tmpB[0], LAYOUT.stageY, this.tmpB[1]);
      this.path.tangent(this.walkS, this.tmpA);
      // Half on the child, half on where they are going - the lens leads them
      // without ever letting them slide out of frame on the curve - then eases
      // toward the room itself as it opens up.
      const lead = 0.5;
      const aimX = lerp(child.x, child.x + this.tmpA[0] * 2.2, lead);
      const aimZ = lerp(child.z, child.z + this.tmpA[1] * 2.2, lead);
      const r = this.revealT * 0.45;
      this.look.set(
        lerp(aimX, child.x * 0.3, r),
        LAYOUT.stageY + lerp(0.74, 1.3, r),
        lerp(aimZ, -4.0, r),
      );

      if (this.phase === 'bow' || this.phase === 'again') {
        // The pull-back. Slow, straight, no rotation: the room gets bigger
        // because we are further from it, not because the lens changed.
        const k = smootherstep(0, 3.4, this.outroT);
        const ds = this.rig.distanceScale;
        // Stage A keeps us downstage of the leg curtain, then we rise and drift.
        const ax = lerp(this.eye.x, child.x + 0.35, smoothstep(0, 1.1, this.outroT));
        const az = lerp(this.eye.z, child.z + 0.75, smoothstep(0, 1.1, this.outroT));
        this.eye.set(
          lerp(ax, child.x + 0.25, k),
          LAYOUT.stageY + lerp(1.6, 1.88, k),
          lerp(az, child.z + 3.3 * ds, k),
        );
        this.look.set(
          lerp(child.x, child.x - 0.05, k),
          LAYOUT.stageY + lerp(0.95, 1.12 + this.rig.portrait * 0.32, k),
          lerp(child.z - 2.0, child.z - 6.4, k),
        );
      }

      // The child appears as soon as the lens is far enough back not to be
      // inside their head. The move is fast enough that nobody sees a pop.
      const away = this.eye.distanceTo(
        new Vector3(this.player.root.position.x, eyeY, this.player.root.position.z),
      );
      this.player.setVisible(away > 0.42);
    } else {
      // In the wing. A 3/4 composition: cloth in the near field, the teacher
      // and the other children in the middle, stage light in the distance.
      const toGapX = this.gapPoint.x - P.x;
      const toGapZ = this.gapPoint.z - P.z;
      const l = Math.hypot(toGapX, toGapZ);
      const nx = toGapX / l;
      const nz = toGapZ / l;
      const lean = smoothstep(0, 1, this.peek) * 1.25;
      // Sidestep a few centimetres to line an eye up with the gap, exactly as
      // far as the cloth has actually opened.
      const side = this.peek * 0.1;
      this.eye.set(
        P.x + nx * lean + nz * side,
        eyeY + this.peek * 0.02 - this.rig.portrait * 0.02,
        P.z + nz * lean - nx * side,
      );

      // As the cloth opens, the look target slides along the eye-to-gap ray and
      // dips a little. That keeps the slit dead centre however far the child has
      // leaned in - so what widens is the view through it, never the aim - and
      // the eye travels deck, then lights, then house.
      const through = smoothstep(0.04, 0.9, this.peek);
      const gx = this.gapPoint.x - this.eye.x;
      const gy = this.gapPoint.y - this.eye.y;
      const gz = this.gapPoint.z - this.eye.z;
      const gl = Math.hypot(gx, gy, gz) || 1;
      const reach = gl + through * 4.2;
      // A wide landscape frame would otherwise see straight past the leg's far
      // edge, so the resting aim sits further into the wing there and comes
      // back to the gap as the child leans in.
      const bias = (1 - through) * lerp(0.9, 0.28, this.rig.portrait);
      // A short landscape frame needs to be tipped down or the deck, the tape
      // marks and the children's feet all fall out of shot.
      const tipDown = (1 - through) * lerp(0.5, 0.12, this.rig.portrait);
      this.look.set(
        this.eye.x + (gx / gl) * reach + bias,
        this.eye.y + (gy / gl) * reach - through * 0.62 - tipDown,
        this.eye.z + (gz / gl) * reach + bias * 0.72,
      );
      this.player.setVisible(false);
      this.lighting.aimKey(
        new Vector3(0, LAYOUT.stageY, 2.4),
        new Vector3(0, 5.1, 3.1),
      );
    }

    this.rig.setShot(this.eye, this.look);
    if (snap) this.rig.snap();
  }

  // -------------------------------------------------------------- debug/e2e

  /** Exposed for automated checks: fast-forwards to a phase. */
  debugState(): Record<string, unknown> {
    return {
      phase: this.phase,
      round: this.round,
      peek: Number(this.peek.toFixed(3)),
      gap: Number(this.legCurtain.gap.toFixed(3)),
      walkS: Number(this.walkS.toFixed(2)),
      revealT: Number(this.revealT.toFixed(3)),
      warned: this.warned,
      hintStage: this.hintStage,
    };
  }

  /** Test-only helpers, active with ?fast=1. */
  debugPeek(v: number): void {
    if (!this.flags.fast) return;
    this.debugHold = v < 0 ? null : clamp(v, 0, 1);
    if (this.debugHold !== null) {
      this.peekTarget = this.debugHold;
      // Skip the one-off "not yet" so a held peek can be photographed.
      this.warned = true;
    }
  }

  debugAdvance(): void {
    if (!this.flags.fast) return;
    if (this.phase === 'wait') this.t = 100;
    else if (this.phase === 'cue') this.beginWalk(1);
  }
}
