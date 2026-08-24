import * as THREE from 'three';
import { MaterialKit } from '../world/materials';
import { SwitchAssembly, contactShadow } from '../world/switchAssembly';
import { Environment } from '../world/environment';
import { Train } from '../world/train';
import { ControlPanel } from '../world/controlPanel';
import { AudioEngine } from '../core/audio';
import { routePath, makeSampler, RouteSide, PathSampler, BEAM_TOP_Y } from './switchModel';

/**
 * Game director: the causal sequence, the interlocking, the trains, the
 * staged hints and the single continuous camera. There is no free camera —
 * every swipe is work input.
 */

export type Phase =
  | 'idle'        // lever live, hints may run
  | 'command'     // control in detent -> relays -> unlock -> motor start
  | 'traverse'    // girders travelling
  | 'locking'     // lock cylinders descending
  | 'signal'      // lamps + signal sequence
  | 'train';      // a train is taking the completed route

interface TrainAgent {
  train: Train;
  route: RouteSide;
  state: 'waiting' | 'departing' | 'running' | 'gone' | 'arriving';
  respawnT: number;
  waitT: number;
}

const PANEL_POS = new THREE.Vector3(-5.35, 0, -4.9);
const PANEL_YAW = Math.PI + 0.62; // desk faces the walkway camera (south-west)

const easeQuintic = (u: number): number => {
  const x = THREE.MathUtils.clamp(u, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

export class Game {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1600);

  readonly sw: SwitchAssembly;
  readonly env: Environment;
  readonly panel: ControlPanel;
  private agents: TrainAgent[] = [];
  private samplers: Record<RouteSide, PathSampler>;

  phase: Phase = 'idle';
  lockedSide: RouteSide = 'curve';   // game starts set to the curved route
  private targetSide: RouteSide = 'curve';
  private phaseT = 0;
  firstRunDone = false;
  private firstPassDone = false;
  runCount = 0;

  // lever
  private leverAnim: { from: number; to: number; t: number; dur: number } | null = null;
  private dragging = false;
  private resistCooldown = 0;

  // hints
  private idleT = 0;
  private hintStage = 0;
  hintActive = 0; // exposed for tests: which hint is currently playing
  private hintT = 0;

  // camera
  private camPos = new THREE.Vector3();
  private camTarget = new THREE.Vector3();
  private camFov = 60;
  private portrait = true;
  private shot: string = 'wide';
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();

  timeScale = 1;

  constructor(private mats: MaterialKit, private audio: AudioEngine) {
    this.sw = new SwitchAssembly(mats);
    this.env = new Environment(mats);
    this.panel = new ControlPanel(mats);
    this.panel.group.position.copy(PANEL_POS);
    this.panel.group.rotation.y = PANEL_YAW;

    this.scene.add(this.env.group, this.sw.group, this.panel.group);
    // the hint hand is animated in world space
    this.scene.add(this.panel.hand.group);
    const panelShadow = contactShadow(1.5, 1.2);
    panelShadow.position.set(PANEL_POS.x, 0.008, PANEL_POS.z);
    this.scene.add(panelShadow);
    this.scene.fog = new THREE.Fog(0xcdd9e0, 90, 780);

    // lighting: one warm key sun + cool sky fill, soft day
    const sun = new THREE.DirectionalLight(0xfff2df, 2.6);
    sun.position.set(-42, 58, -30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -20; sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -16;
    sun.shadow.camera.near = 8; sun.shadow.camera.far = 160;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.target.position.set(2, 0, 12);
    this.scene.add(sun, sun.target);
    const sky = new THREE.HemisphereLight(0xbcd2e4, 0x8a887e, 0.72);
    this.scene.add(sky);

    // ride paths from the same model as the visuals
    this.samplers = {
      straight: makeSampler(routePath('straight'), BEAM_TOP_Y),
      curve: makeSampler(routePath('curve'), BEAM_TOP_Y),
    };

    // two trainsets, one per far route. Only the straight-route train is
    // present at the opening — its broken route is the whole question. The
    // second train arrives on the other side after the first pass.
    for (const route of ['straight', 'curve'] as RouteSide[]) {
      const train = new Train(mats);
      this.scene.add(train.group);
      const waiting = route === 'straight';
      const agent: TrainAgent = {
        train, route,
        state: waiting ? 'waiting' : 'gone',
        respawnT: waiting ? 0 : Infinity,
        waitT: 0,
      };
      if (waiting) train.place(this.samplers[route], this.waitS(route), -1);
      else train.hide();
      this.agents.push(agent);
    }

    // initial signals: route is locked to curve, but hold trains at stop
    // until the player acts — the waiting train is the opening question.
    this.env.signals.set('straight', 'stop');
    this.env.signals.set('curve', 'stop');
    this.env.signals.setIndicator('curve');
    this.panel.setLamp('curve');
    this.panel.setLever(1);

    this.camPos.copy(this.shotDef('wide').pos);
    this.camTarget.copy(this.shotDef('wide').target);
  }

  /** arclength where a train waits at its route signal (just past the tip) */
  private waitS(route: RouteSide): number {
    // approach length is 78; switch is ~22 long; signals stand just past the
    // tip. The train on the curved branch waits a little further out.
    return 78 + 22 + 10 + (route === 'curve' ? 9 : 0);
  }
  private switchZone(): [number, number] { return [72, 104]; }

  // ------------------------------------------------------------------ input
  onAnyPointer(): void {
    this.audio.unlock();
    this.idleT = 0;
    this.hintStage = Math.min(this.hintStage, 0);
    this.stopHint();
  }

  onDragStart(): void {
    this.dragging = true;
    this.leverAnim = null;
    if (this.phase === 'idle' && !this.firstRunDone) this.shot = 'panel';
  }

  onDragMove(dx: number): void {
    if (!this.dragging) return;
    if (this.phase === 'idle' && !this.switchOccupied) {
      const v = this.panel.leverValue + dx * 5.2;
      this.panel.setLever(v);
      const opposite = this.lockedSide === 'curve' ? -1 : 1;
      if (v * opposite > 0.9) this.command(opposite === 1 ? 'curve' : 'straight');
    } else {
      // interlocked: the handle resists with a few mm of mechanical slack
      const detent = this.detent();
      this.panel.setLever(THREE.MathUtils.clamp(
        this.panel.leverValue + dx * 0.4, detent - 0.07, detent + 0.07));
      if (this.resistCooldown <= 0) {
        this.audio.leverResist();
        this.resistCooldown = 0.35;
      }
    }
  }

  /** where the handle rests right now */
  private detent(): number {
    const side = this.phase === 'idle' ? this.lockedSide : this.targetSide;
    return side === 'curve' ? 1 : -1;
  }

  onDragEnd(): void {
    this.dragging = false;
    // released short of the detent (or mid-sequence): spring back safely
    this.springLever(this.detent(), 0.3);
    if (this.shot === 'panel' && this.phase === 'idle') this.shot = 'wide';
  }

  onTap(): void {
    // taps do nothing but a gentle acknowledgement near the panel
    if (this.phase === 'idle') this.audio.buttonClick();
  }

  private springLever(to: number, dur: number): void {
    this.leverAnim = { from: this.panel.leverValue, to, t: 0, dur };
  }

  // -------------------------------------------------------------- sequence
  private command(side: RouteSide): void {
    if (this.phase !== 'idle' || side === this.lockedSide || this.switchOccupied) {
      if (side === this.lockedSide) this.springLever(side === 'curve' ? 1 : -1, 0.2);
      return;
    }
    this.targetSide = side;
    this.phase = 'command';
    this.phaseT = 0;
    this.sfxMark = 0;
    this.dragging = false;
    this.springLever(side === 'curve' ? 1 : -1, 0.15);
    this.audio.leverDetent();
    // route is now released: lamps off, signals to stop
    this.env.signals.setIndicator(null);
    this.panel.setLamp(null);
    this.env.signals.set('straight', 'stop');
    this.env.signals.set('curve', 'stop');
    this.stopHint();
    if (!this.firstRunDone) this.shot = 'panel';
  }

  private sfxMark = 0;
  private update_command(dt: number): void {
    const t = this.phaseT;
    if (this.sfxMark < 1 && t >= 0.25) { this.audio.relayClick(); this.sfxMark = 1; }
    if (this.sfxMark < 2 && t >= 0.6) { this.audio.contactor(); this.sfxMark = 2; }
    if (this.sfxMark < 3 && t >= 0.85) { this.audio.unlockHiss(); this.sfxMark = 3; }
    // lock cylinders rise 0.85s..1.45s
    if (t >= 0.85) {
      this.sw.lockExt = THREE.MathUtils.clamp(1 - (t - 0.85) / 0.6, 0, 1);
    }
    if (this.sfxMark < 4 && t >= 1.3) {
      this.audio.setMotor(0.4); // motor spins up before anything moves
      this.sfxMark = 4;
    }
    if (!this.firstRunDone && t > 1.0) this.shot = 'drive';
    if (t >= 1.7) {
      this.phase = 'traverse';
      this.phaseT = 0;
      this.audio.setMotor(1);
    }
  }

  private static TRAVERSE_DUR = 7.6;
  private update_traverse(dt: number): void {
    const dur = Game.TRAVERSE_DUR;
    const u = THREE.MathUtils.clamp(this.phaseT / dur, 0, 1);
    const p = easeQuintic(u);
    const from = this.targetSide === 'curve' ? 0 : 1;
    const to = this.targetSide === 'curve' ? 1 : 0;
    const t = from + (to - from) * p;
    this.sw.update(t, dt);
    // motor + rolling sound follow actual girder speed
    const speed = Math.abs(easeQuintic(Math.min(1, u + 0.01)) - easeQuintic(Math.max(0, u - 0.01))) * 50;
    this.audio.setMotor(0.35 + Math.min(0.65, speed * 1.4));
    this.audio.setRoll(Math.min(1, speed * 2.2));

    if (!this.firstRunDone) {
      this.shot = u < 0.22 ? 'drive' : 'overhead';
    } else {
      this.shot = 'overhead';
    }

    if (u >= 1) {
      this.phase = 'locking';
      this.phaseT = 0;
      this.sfxMark = 0;
      this.audio.setMotor(0);
      this.audio.setRoll(0);
      this.shot = 'lock';
    }
  }

  private update_locking(dt: number): void {
    const t = this.phaseT;
    // brief pause, then the cylinders drop onto the bed plates
    if (t >= 0.5) {
      this.sw.lockExt = THREE.MathUtils.clamp((t - 0.5) / 0.55, 0, 1);
    }
    if (this.sfxMark < 1 && t >= 1.02) {
      this.audio.lockSeat();
      this.sfxMark = 1;
    }
    if (t >= 1.55) {
      this.lockedSide = this.targetSide;
      this.phase = 'signal';
      this.phaseT = 0;
      this.sfxMark = 0;
    }
  }

  private update_signal(dt: number): void {
    const t = this.phaseT;
    if (this.sfxMark < 1 && t >= 0.5) {
      this.audio.signalClick();
      this.env.signals.setIndicator(this.lockedSide);
      this.panel.setLamp(this.lockedSide);
      this.sfxMark = 1;
    }
    if (this.sfxMark < 2 && t >= 1.1) {
      const waiting = this.agents.find(a => a.route === this.lockedSide && a.state === 'waiting');
      if (waiting) {
        this.env.signals.set(this.lockedSide, 'proceed');
        this.audio.signalClick();
      }
      this.sfxMark = 2;
    }
    if (t >= 1.4) this.shot = 'wide';
    if (t >= 2.2) {
      const waiting = this.agents.find(a => a.route === this.lockedSide && a.state === 'waiting');
      this.firstRunDone = true;
      this.runCount++;
      if (waiting) {
        waiting.state = 'departing';
        this.phase = 'train';
        this.phaseT = 0;
        this.shot = 'train';
        // the opposite-side train comes into view for the next discovery
        const other = this.agents.find(a => a.route !== this.lockedSide);
        if (other && other.state === 'gone' && !Number.isFinite(other.respawnT)) {
          other.respawnT = 5;
        }
      } else {
        this.phase = 'idle';
        this.phaseT = 0;
        this.idleT = 0;
        this.hintStage = 0; // gentle stage-1 nudge only, much later
      }
    }
  }

  // ---------------------------------------------------------------- trains
  private updateTrains(dt: number): void {
    const [zoneA, zoneB] = this.switchZone();
    for (const a of this.agents) {
      const tr = a.train;
      switch (a.state) {
        case 'waiting': {
          // an open, locked route lets a standing train proceed on its own
          // after a short pause — trains keep quietly using the path you set
          a.waitT += dt;
          if (a.waitT > 2.2 && this.phase === 'idle' && this.lockedSide === a.route) {
            this.stopHint();
            this.env.signals.set(a.route, 'proceed');
            this.audio.signalClick();
            a.state = 'departing';
            a.waitT = 0;
            this.phase = 'train';
            this.phaseT = 0;
            this.shot = 'train';
          }
          break;
        }
        case 'departing': {
          tr.speed = Math.min(9.5, tr.speed + 1.35 * dt);
          tr.advance(tr.speed * dt);
          if (tr.s < 40) a.state = 'running';
          break;
        }
        case 'running': {
          tr.speed = Math.min(13, tr.speed + 1.6 * dt);
          tr.advance(tr.speed * dt);
          if (tr.s <= 4) {
            a.state = 'gone';
            a.respawnT = 16 + (a.route === 'curve' ? 5 : 0);
            tr.hide();
            // passed the signal: back to stop until re-cleared
            this.env.signals.set(a.route, 'stop');
            if (this.phase === 'train') {
              this.phase = 'idle';
              this.phaseT = 0;
              this.idleT = 0;
              this.hintStage = 0;
              this.shot = 'wide';
              if (!this.firstPassDone) {
                this.firstPassDone = true;
                this.audio.afterglow();
              }
            }
          }
          break;
        }
        case 'gone': {
          a.respawnT -= dt;
          if (a.respawnT <= 0) {
            a.state = 'arriving';
            a.train.place(this.samplers[a.route], this.samplers[a.route].length - 30, -1);
            a.train.speed = 11;
          }
          break;
        }
        case 'arriving': {
          const stopAt = this.waitS(a.route) + (a.route === 'curve' ? -8 : 0);
          const remain = tr.s - stopAt;
          const vAllow = Math.sqrt(Math.max(0, 2 * 0.9 * remain));
          tr.speed = Math.min(11, vAllow);
          tr.advance(Math.max(0.02, tr.speed) * dt);
          if (remain <= 0.3) {
            tr.speed = 0;
            a.state = 'waiting';
            a.waitT = 0;
          }
          break;
        }
      }
      // audio: nearest running train drives the rumble
    }
    // train sound: use the loudest
    let level = 0, pan = 0, speed = 0;
    for (const a of this.agents) {
      if (a.state === 'gone' || !a.train.sampler) continue;
      const p = a.train.headPos(this.tmpV);
      const d = p.distanceTo(this.camPos);
      const l = (a.train.speed / 13) * THREE.MathUtils.clamp(1 - d / 130, 0, 1);
      if (l > level) {
        level = l;
        speed = a.train.speed / 13;
        const local = this.tmpV2.copy(p).sub(this.camPos);
        pan = THREE.MathUtils.clamp(local.x / 40, -0.8, 0.8);
      }
    }
    this.audio.trainRumble(level, pan, speed);
  }

  /** is any train inside the switch zone (movement is interlocked out) */
  get switchOccupied(): boolean {
    const [a, b] = this.switchZone();
    for (const ag of this.agents) {
      if (ag.state === 'gone') continue;
      const head = ag.train.s;
      const tail = ag.train.s + 30;
      if (head < b && tail > a) return true;
    }
    return false;
  }

  // ----------------------------------------------------------------- hints
  private updateHints(dt: number): void {
    if (this.phase !== 'idle' || this.dragging) { this.idleT = 0; return; }
    this.idleT += dt;
    const first = !this.firstRunDone;
    const t1 = first ? 8 : 45;
    const t2 = first ? 17 : 9999;
    const t3 = first ? 27 : 9999;
    if (this.hintActive) {
      this.hintT += dt;
      this.runHint(this.hintT);
      return;
    }
    if (this.idleT > t3 && this.hintStage <= 2) { this.startHint(3); this.hintStage = 3; }
    else if (this.idleT > t2 && this.hintStage <= 1) { this.startHint(2); this.hintStage = 2; }
    else if (this.idleT > t1 && this.hintStage <= 0) { this.startHint(1); this.hintStage = 1; }
    // cycle again later
    if (this.hintStage >= 3 && this.idleT > t3 + 16) { this.idleT = t1 - 2; this.hintStage = 0; }
  }

  private startHint(stage: number): void {
    this.hintActive = stage;
    this.hintT = 0;
    if (stage === 1) {
      this.audio.hintTap();
      // the waiting train asks quietly: a distant horn + headlight pulse
      this.audio.horn();
    }
  }

  private stopHint(): void {
    if (this.hintActive === 1) this.mats.headlight.emissiveIntensity = 0.7;
    if (this.hintActive === 2) {
      this.panel.hand.setOpacity(0);
      if (this.shot === 'panelhint') this.shot = 'wide';
    }
    if (this.hintActive === 3) this.sw.update(this.lockedSide === 'curve' ? 1 : 0, 0);
    this.hintActive = 0;
    this.hintT = 0;
  }

  private runHint(t: number): void {
    const detent = this.lockedSide === 'curve' ? 1 : -1;
    if (this.hintActive === 1) {
      // the handle stirs a few millimetres — a machine asking quietly —
      // while the waiting train pulses its headlights
      this.mats.headlight.emissiveIntensity = 0.7 + Math.max(0, Math.sin(t * 7)) * 1.6;
      if (t < 1.8) {
        this.panel.setLever(detent + Math.sin(t * 26) * 0.05 * Math.exp(-t * 2.2));
      } else {
        this.panel.setLever(detent);
        this.mats.headlight.emissiveIntensity = 0.7;
        this.stopHint();
      }
    } else if (this.hintActive === 2) {
      this.shot = 'panelhint';
      // a gloved hand drifts in near the handle, makes a small pushing
      // gesture towards the other detent, and withdraws
      const grip = this.panel.gripWorld(this.tmpV);
      const dir = -detent; // push towards the opposite route
      const h = this.panel.hand.group;
      const inT = THREE.MathUtils.clamp(t / 1.1, 0, 1);
      const outT = THREE.MathUtils.clamp((t - 3.4) / 0.8, 0, 1);
      const gesture = t > 1.2 && t < 3.3 ? Math.sin((t - 1.2) * 3.6) * 0.5 + 0.5 : 0;
      const start = this.tmpV2.set(grip.x - 0.55 * dir - 0.25, grip.y + 0.34, grip.z - 0.5);
      const hover = new THREE.Vector3(grip.x + dir * (0.02 + gesture * 0.13), grip.y + 0.13, grip.z - 0.06);
      h.position.lerpVectors(start, hover, easeQuintic(inT));
      h.rotation.set(0.35, PANEL_YAW - Math.PI, dir * 0.2);
      this.panel.hand.setOpacity(Math.min(easeQuintic(inT), 1 - easeQuintic(outT)) * 0.96);
      if (t > 4.4) this.stopHint();
    } else if (this.hintActive === 3) {
      // the briefest track whisper: girders lean a few centimetres and settle back
      const base = this.lockedSide === 'curve' ? 1 : 0;
      const dirT = this.lockedSide === 'curve' ? -1 : 1;
      const amp = Math.sin(Math.min(t / 1.7, 1) * Math.PI) * 0.045;
      this.sw.update(base + dirT * amp, 0);
      this.audio.setRoll(amp * 3);
      if (t > 1.75) { this.audio.setRoll(0); this.stopHint(); }
    }
  }

  // ---------------------------------------------------------------- camera
  private shotDef(name: string): { pos: THREE.Vector3; target: THREE.Vector3; fov: number } {
    const P = this.portrait;
    switch (name) {
      case 'panel': {
        const grip = this.panel.gripWorld(new THREE.Vector3());
        // stand where the operator stands: on the desk's front side, so the
        // mimic diagram and its lamps stay in frame above the handle
        const fx = Math.sin(PANEL_YAW), fz = Math.cos(PANEL_YAW);
        return {
          pos: new THREE.Vector3(grip.x + fx * 1.05, grip.y + 0.66, grip.z + fz * 1.05),
          target: new THREE.Vector3(grip.x - fx * 0.4, grip.y - 0.08, grip.z - fz * 0.4),
          fov: P ? 52 : 46,
        };
      }
      case 'panelhint': {
        // halfway push-in towards the control desk: the gaze leads the hand
        const w = this.shotDef('wide');
        const p = this.shotDef('panel');
        w.pos.lerp(p.pos, 0.55);
        w.target.lerp(p.target, 0.7);
        w.fov = w.fov * 0.45 + p.fov * 0.55;
        return w;
      }
      case 'drive':
        return {
          pos: P ? new THREE.Vector3(-4.4, 2.5, 5.0) : new THREE.Vector3(-5.2, 2.6, 4.6),
          target: new THREE.Vector3(0.5, 0.55, 10.1),
          fov: P ? 52 : 47,
        };
      case 'overhead':
        return P
          ? { pos: new THREE.Vector3(-3.4, 10.5, -8.0), target: new THREE.Vector3(1.5, 0.5, 13), fov: 56 }
          : { pos: new THREE.Vector3(-11.5, 9.0, -1.0), target: new THREE.Vector3(1.8, 0.4, 12.5), fov: 47 };
      case 'lock': {
        const f = this.sw.focus.tipLock;
        // from the sunlit south-east quarter, looking down at the cylinder
        // seating on its bed plate
        return {
          pos: new THREE.Vector3(f.x + 1.5, f.y + 1.5, f.z - 2.7),
          target: new THREE.Vector3(f.x - 0.15, f.y - 0.15, f.z + 0.1),
          fov: 44,
        };
      }
      case 'train': {
        const w = this.shotDef('wide');
        let head: THREE.Vector3 | null = null;
        for (const a of this.agents) {
          if (a.state === 'departing' || a.state === 'running') {
            head = a.train.headPos(new THREE.Vector3());
            break;
          }
        }
        if (head) {
          head.z = THREE.MathUtils.clamp(head.z, -2, 40);
          w.target.lerp(head, 0.55);
        }
        return w;
      }
      case 'wide':
      default:
        return P
          ? { pos: new THREE.Vector3(-6.3, 3.4, -10.2), target: new THREE.Vector3(0.9, 1.15, 14), fov: 57 }
          : { pos: new THREE.Vector3(-10.2, 4.1, -7.9), target: new THREE.Vector3(1.6, 1.0, 12.5), fov: 47 };
    }
  }

  private updateCamera(dt: number, time: number): void {
    const def = this.shotDef(this.shot);
    // idle breathing
    if (this.phase === 'idle' && (this.shot === 'wide')) {
      def.pos.x += Math.sin(time * 0.24) * 0.16;
      def.pos.y += Math.sin(time * 0.31) * 0.09;
      def.target.x += Math.sin(time * 0.2) * 0.1;
    }
    const k = this.shot === 'lock' ? 2.6 : 1.9;
    const f = 1 - Math.exp(-k * dt);
    this.camPos.lerp(def.pos, f);
    this.camTarget.lerp(def.target, f);
    this.camFov += (def.fov - this.camFov) * f;
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
    this.camera.fov = this.camFov;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- update
  update(rawDt: number, time: number): void {
    const dt = Math.min(rawDt, 0.1) * this.timeScale;
    this.phaseT += dt;
    this.resistCooldown -= dt;

    if (this.leverAnim) {
      const a = this.leverAnim;
      a.t += dt;
      const u = easeQuintic(Math.min(1, a.t / a.dur));
      this.panel.setLever(a.from + (a.to - a.from) * u);
      if (a.t >= a.dur) this.leverAnim = null;
    }

    switch (this.phase) {
      case 'command': this.update_command(dt); break;
      case 'traverse': this.update_traverse(dt); break;
      case 'locking': this.update_locking(dt); break;
      case 'signal': this.update_signal(dt); break;
      default: break;
    }
    if (this.phase !== 'traverse') {
      // keep transforms (incl. lock rods) refreshed without moving t
      this.sw.update(this.sw.t, 0);
    }

    this.updateTrains(dt);
    this.updateHints(dt);
    this.updateCamera(dt, time);
    this.audio.update(dt, this.phase === 'traverse');
  }

  resize(width: number, height: number): void {
    this.portrait = height >= width;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

}
