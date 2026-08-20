import { Color, Object3D, Scene, Vector3 } from 'three';
import { AudioEngine, type MaterialVoice, type SurfaceMix } from '../core/audio';
import { clamp, damp } from '../core/math';
import { hashString, Rng } from '../core/rng';
import { Particles } from '../render/particles';
import { MaterialLibrary } from '../render/materials';
import { Prop } from '../objects/prop';
import { OBJECT_ORDER, PROFILES, type ObjectId } from '../objects/profiles';
import {
  createBody,
  groundKindAt,
  predict,
  stepBody,
  type BodyState,
  type Prediction,
  type SimWorld,
} from '../sim/simulate';
import { SlideRig } from '../world/slide';
import { SlideSurface } from '../world/surface';
import { Wagon, type ToolId } from '../world/wagon';
import { ControlStand } from '../world/controlStand';
import { LandingMat } from '../world/landingMat';
import {
  SLIDE_LENGTH,
  START_ZONES,
  restArc,
  slideNormal,
  slideSurface,
  zoneById,
  type StartZoneId,
} from '../world/slideCurve';
import { CameraRig, type ShotContext } from './camera';
import type { PlayHooks } from './interaction';
import { Telemetry } from './telemetry';

export type Stage = 'intro' | 'firstRun' | 'contrastOffer' | 'contrastRun' | 'free';
type RunState = 'idle' | 'armed' | 'running' | 'settling';

const VOICE: Record<ObjectId, MaterialVoice> = {
  steel: 'steel',
  rubberball: 'rubber',
  woodcyl: 'wood',
  feltbag: 'felt',
  minicar: 'tyre',
  icedisc: 'ice',
  leaf: 'leaf',
  sponge: 'sponge',
};

const FIRST_OBJECT: ObjectId = 'steel';
const CONTRAST_OBJECT: ObjectId = 'feltbag';

const DRY_MIX: SurfaceMix = { dry: 1, wet: 0, sand: 0, rubber: 0 };

/**
 * The teaching order lives here. Only one variable is available at a time
 * until the child has actually seen the causal difference: first the object,
 * then the height, then the state of the bed.
 */
export class Director implements PlayHooks {
  stage: Stage = 'intro';
  layer = 0;
  readonly telemetry = new Telemetry();
  readonly world: SimWorld;

  private props = new Map<ObjectId, Prop>();
  private activeProp: Prop | null = null;
  private carryProp: Prop | null = null;
  private carryFrom: ObjectId | null = null;
  private body: BodyState | null = null;
  private currentId: ObjectId = FIRST_OBJECT;
  private currentZone: StartZoneId = 'top';
  private runState: RunState = 'idle';
  private attempt = 0;
  private baseArc = 0;
  private baseLateral = 0;
  private prediction: Prediction | null = null;
  private predictTimer = 0;
  private settleTimer = 0;
  private movedFromGate = false;
  /** Guarantees the release and the first movement share one frame. */
  private gateShotHold = 0;
  /** How far the lever is currently asking the boom to open, 0..1. */
  private gateCommand = 0;
  private resetPull = 0;
  private gateReturnTimer = 0;
  private held = true;

  private idle = 0;
  private hintTimer = 0;
  private hintPhase = 0;
  private nudge = 0;
  private touched = false;
  private offerTimer = 0;
  private rng = new Rng(20260820);
  private lastToolSound = 0;
  private lastToolTime = -1;
  private time = 0;
  private frameCov: SurfaceMix = { ...DRY_MIX };

  readonly handRoot = new Object3D();

  constructor(
    private scene: Scene,
    private lib: MaterialLibrary,
    private slide: SlideRig,
    private surface: SlideSurface,
    private wagon: Wagon,
    private stand: ControlStand,
    private mat: LandingMat,
    private rig: CameraRig,
    private audio: AudioEngine,
    private particles: Particles,
    private propOptions: { transmission: boolean; shadows: boolean },
  ) {
    this.world = { surface, mat: mat.state };
    this.scene.add(this.handRoot);
    this.scene.add(this.stand.linkage);

    for (const z of START_ZONES) this.slide.setGateAvailable(z.id, z.id === 'top');
    for (const id of OBJECT_ORDER) this.wagon.setAvailable(id, false);
    this.wagon.setToolsAvailable(false);
    this.stand.resetGrab.visible = false;
    this.mat.setPresent(false);

    this.armObject(FIRST_OBJECT, 'top');
    this.rig.setShot('gate');
  }

  // ---------------------------------------------------------------- objects

  private prop(id: ObjectId): Prop {
    let p = this.props.get(id);
    if (!p) {
      p = new Prop(id, this.lib, this.propOptions);
      this.props.set(id, p);
    }
    return p;
  }

  private armObject(id: ObjectId, zone: StartZoneId): void {
    if (this.activeProp && this.currentId !== id) {
      this.activeProp.root.removeFromParent();
      this.wagon.setInUse(this.currentId, false);
    }
    this.currentId = id;
    this.currentZone = zone;
    this.attempt++;

    const profile = PROFILES[id];
    const gateArc = zoneById(zone).center;
    this.baseArc = restArc(gateArc, profile.gateGap);

    // Repeats are alike but not identical: a hair of initial pose and friction
    // varies, which is enough to keep the same test slightly alive.
    this.rng.reseed(hashString(`${id}:${zone}:${this.attempt}`));
    this.baseLateral = this.rng.jitter(0.012);
    const bias = 1 + this.rng.jitter(0.012);

    this.body = createBody(this.baseArc, this.baseLateral, this.rng.next() * 1000, bias);
    this.activeProp = this.prop(id);
    this.scene.add(this.activeProp.root);
    this.activeProp.sync(this.body, 0.016);
    this.wagon.setInUse(id, true);

    for (const g of this.slide.gates) g.target = 0;
    this.stand.setLinkTarget(this.slide.gateLinkPoint(zone));
    this.runState = 'armed';
    this.movedFromGate = false;
    this.held = true;
    this.prediction = null;
    this.gateCommand = 0;
    this.gateReturnTimer = 0;
    this.stand.gatePull = 0;
    // Snap every boom shut so a freshly placed object is genuinely held.
    for (const g of this.slide.gates) {
      g.target = 0;
      g.open = 0;
      g.arm.rotation.x = 0;
    }
    this.rig.setShot('gate');
    this.audio.gateClick(0.8);
    // Available immediately so `?debug=1` can show where this test should end
    // up before it is run.
    this.prediction = predict(this.body, profile, this.world, 9);
  }

  private surfaceSignature(): string {
    let w = 0;
    let s = 0;
    let r = 0;
    for (let i = 0; i < this.surface.wet.length; i++) {
      w += this.surface.wet[i];
      s += this.surface.sand[i];
      r += this.surface.rubber[i];
    }
    const q = (v: number): number => Math.round(v / 4);
    return `${q(w)}/${q(s)}/${q(r)}`;
  }

  // ----------------------------------------------------------------- hooks

  zoneUnlocked(id: StartZoneId): boolean {
    if (id === 'top') return true;
    return this.layer >= 2;
  }

  beginCarry(id: ObjectId): Prop | null {
    if (this.runState === 'running') return null;
    const slot = this.wagon.slots.find((s) => s.id === id);
    if (!slot?.available) return null;
    this.touched = true;
    this.idle = 0;
    const p = this.prop(id);
    if (p === this.activeProp) {
      // Picking up the thing that is already out simply ends that experiment.
      this.activeProp = null;
      this.body = null;
      this.runState = 'idle';
    }
    this.carryProp = p;
    this.carryFrom = id;
    this.wagon.setInUse(id, true);
    this.scene.add(p.root);
    return p;
  }

  endCarry(id: ObjectId, zone: StartZoneId | null): void {
    if (!this.carryProp) return;
    if (zone && this.zoneUnlocked(zone)) {
      this.armObject(id, zone);
    } else {
      this.carryProp.root.removeFromParent();
      this.wagon.setInUse(id, false);
      this.audio.gateClick(0.4);
      if (!this.body) this.rig.setShot('overview');
    }
    this.carryProp = null;
    this.carryFrom = null;
  }

  setGatePull(pull: number): void {
    this.touched = true;
    this.idle = 0;
    this.telemetry.noteGateTouch();
    this.gateCommand = clamp(pull, 0, 1);
    this.gateReturnTimer = 0;
    this.stand.gatePull = this.gateCommand;
  }

  commitGate(pull: number): void {
    const p = clamp(pull, 0, 1);
    this.gateCommand = p;
    this.stand.gatePull = p;
    if (p < 0.42) {
      // Not far enough: the boom drops straight back with a click.
      this.gateCommand = 0;
      this.stand.gatePull = 0;
      this.audio.leverCreak();
      this.audio.gateClick(0.5);
    } else {
      // Held open just long enough for the object to be clear, then the lever
      // springs back and the boom follows it down.
      this.gateReturnTimer = 0.85;
    }
  }

  setResetPull(pull: number): void {
    this.touched = true;
    this.idle = 0;
    this.resetPull = clamp(pull, 0, 1);
    this.stand.resetPull = this.resetPull;
  }

  commitReset(pull: number): void {
    this.stand.resetPull = 0;
    this.resetPull = 0;
    if (pull > 0.5 && this.runState !== 'running') {
      this.audio.leverCreak();
      this.armObject(this.currentId, this.currentZone);
    }
  }

  useTool(tool: ToolId, arc: number, point: Vector3): void {
    this.touched = true;
    this.idle = 0;
    if (this.layer < 3) return;
    const now = this.time;
    // Rate is per second of contact, not per pointer event, so a slow phone
    // does not make wiping the slide slower work.
    const dt = this.lastToolTime < 0 ? 1 / 60 : clamp(now - this.lastToolTime, 0.004, 0.12);
    this.lastToolTime = now;
    switch (tool) {
      case 'cloth':
        this.surface.wipe(arc, 0.3, 7.0 * dt);
        if (now - this.lastToolSound > 0.22) {
          this.audio.wipe();
          this.lastToolSound = now;
        }
        break;
      case 'dropper':
        this.surface.addWater(arc, 0.24, 4.5 * dt);
        if (now - this.lastToolSound > 0.3) {
          this.audio.waterDrop();
          this.lastToolSound = now;
          this.particles.spawn(point.clone().addScaledVector(slideNormal(arc), 0.02), 3, {
            speed: 0.5,
            spread: 0.6,
            size: 3.2,
            color: new Color(0.68, 0.85, 0.95),
            gravity: 4.2,
          });
        }
        break;
      case 'sand':
        this.surface.addSand(arc, 0.26, 4.2 * dt);
        if (now - this.lastToolSound > 0.26) {
          this.audio.sandPour();
          this.lastToolSound = now;
          this.particles.spawn(point.clone().addScaledVector(slideNormal(arc), 0.03), 5, {
            speed: 0.35,
            spread: 0.8,
            size: 2.4,
            color: new Color(0.82, 0.72, 0.5),
            gravity: 3.4,
          });
        }
        break;
      case 'strip':
        this.surface.setRubberStrip(arc, 0.28, true);
        if (now - this.lastToolSound > 0.4) {
          this.audio.gateClick(0.4);
          this.lastToolSound = now;
        }
        break;
    }
  }

  toolReleased(tool: ToolId, arc: number | null): void {
    this.lastToolTime = -1;
    if (tool === 'strip' && arc === null) this.surface.clearRubber();
  }

  matMoved(): void {
    this.touched = true;
    this.idle = 0;
    this.telemetry.noteMatMoved();
  }

  noteTouch(): void {
    this.touched = true;
    this.idle = 0;
  }

  // ------------------------------------------------------------------ loop

  update(dt: number): void {
    this.time += dt;
    this.idle += dt;

    this.updateGateRelease(dt);
    this.updateRun(dt);
    this.updateHints(dt);
    this.updateOffer(dt);

    this.slide.update(dt);
    this.stand.setLinkTarget(this.slide.gateLinkPoint(this.currentZone));
    this.stand.update(dt);
    this.wagon.update(dt);
    const b = this.body;
    const onMat =
      !!b &&
      !b.onSlide &&
      b.grounded &&
      groundKindAt(this.world, b.px, b.pz) === 'mat';
    this.mat.update(dt, onMat);
  }

  private updateGateRelease(dt: number): void {
    if (this.gateReturnTimer > 0) {
      this.gateReturnTimer -= dt;
      if (this.gateReturnTimer <= 0) {
        this.gateCommand = 0;
        this.stand.gatePull = 0;
      }
    }
    // The boom is mechanically the lever: it never moves on its own.
    for (const g of this.slide.gates) g.target = g.id === this.currentZone ? this.gateCommand : 0;

    if (this.runState !== 'armed' || !this.body) return;
    const gate = this.slide.gate(this.currentZone);
    if (this.held && gate.open >= 0.44) {
      this.held = false;
      this.body.phase = 'slide';
      this.runState = 'running';
      this.audio.gateOpen();
      this.audio.useVoice(VOICE[this.currentId]);
      this.gateShotHold = 0.62;
      this.prediction = predict(this.body, PROFILES[this.currentId], this.world);
    }
  }

  private updateRun(dt: number): void {
    const b = this.body;
    const prop = this.activeProp;
    if (!b || !prop) return;
    const profile = PROFILES[this.currentId];

    if (this.runState === 'armed') {
      // Held against the boom, leaning on it, very slightly alive.
      const t = this.time;
      // Leaning on the boom under its own weight, never quite still.
      b.s = this.baseArc + (Math.sin(t * 2.35) * 0.5 + 0.5) * 0.0042 + this.nudge;
      b.lateral = this.baseLateral + Math.sin(t * 1.63) * 0.0022;
      if (PROFILES[this.currentId].motion === 'roll') b.spin = Math.sin(t * 2.35) * 0.07;
      prop.sync(b, dt);
      this.nudge = damp(this.nudge, 0, 0.2, dt);
      return;
    }

    if (this.runState === 'running' || this.runState === 'settling') {
      stepBody(b, profile, this.world, dt);
      prop.sync(b, dt);

      this.gateShotHold = Math.max(0, this.gateShotHold - dt);
      if (!this.movedFromGate && b.s - this.baseArc > 0.4 && this.gateShotHold <= 0) {
        this.movedFromGate = true;
      }

      const speed = b.onSlide ? b.v : Math.hypot(b.vx, b.vz);
      if (b.onSlide) {
        this.frameCov.dry = b.cov.dry;
        this.frameCov.wet = b.cov.wet;
        this.frameCov.sand = b.cov.sand;
        this.frameCov.rubber = b.cov.rubber;
        this.audio.driveVoice(speed, this.frameCov);
      } else {
        this.audio.driveVoice(speed * 0.7, DRY_MIX);
      }

      if (b.impact > 0) this.onImpact(b, profile);

      this.predictTimer -= dt;
      if (this.predictTimer <= 0) {
        this.predictTimer = 0.3;
        if (b.phase !== 'rest') this.prediction = predict(b, profile, this.world, 9);
      }

      if (b.phase === 'rest' && this.runState === 'running') {
        this.runState = 'settling';
        this.settleTimer = 1.5;
        this.audio.silenceVoice();
        this.telemetry.noteResult();
      }
      if (this.runState === 'settling') {
        this.settleTimer -= dt;
        if (this.settleTimer <= 0) this.finishRun();
      }
    }

    this.updateShot(b);
  }

  private onImpact(b: BodyState, profile: (typeof PROFILES)[ObjectId]): void {
    const strength = clamp(b.impact / 3.2, 0, 1) * profile.impactGain;
    this.audio.impact(VOICE[this.currentId], strength, b.impactKind === 'mat');
    if (b.impactKind === 'mat') {
      this.mat.press(b.px, b.pz, clamp(b.impact / 2.4, 0.15, 1));
    }
    if (b.impact > 0.6) {
      const col =
        b.impactKind === 'soil'
          ? new Color(0.5, 0.4, 0.28)
          : b.impactKind === 'mat'
            ? new Color(0.75, 0.62, 0.42)
            : new Color(0.42, 0.46, 0.44);
      this.particles.spawn(new Vector3(b.px, 0.02, b.pz), 6, {
        speed: 0.5 * strength + 0.2,
        spread: 1,
        size: 3,
        color: col,
        gravity: 5,
      });
    }
  }

  private updateShot(b: BodyState): void {
    if (this.runState === 'armed') {
      this.rig.setShot('gate');
      return;
    }
    if (this.runState === 'idle') {
      this.rig.setShot('overview');
      return;
    }
    if (!this.movedFromGate || this.gateShotHold > 0) {
      // The pulling hand and the first movement stay in one frame.
      this.rig.setShot('gate');
      return;
    }
    if (this.runState === 'settling' && this.settleTimer < 0.75) {
      this.rig.setShot('overview');
      return;
    }
    const willLeave = this.prediction ? !this.prediction.onSlide : true;
    if (!b.onSlide || (willLeave && b.s > SLIDE_LENGTH - 1.05)) {
      // Started well before the touchdown, so nothing cuts at the impact.
      this.rig.setShot('landing');
      return;
    }
    this.rig.setShot('follow');
  }

  private finishRun(): void {
    const b = this.body;
    if (!b) return;
    this.telemetry.record({
      id: this.currentId,
      zone: this.currentZone,
      surface: this.surfaceSignature(),
      stoppedOnSlide: b.onSlide,
      stopX: b.onSlide ? b.s : b.px,
      at: this.time,
    });
    this.runState = 'idle';
    this.gateCommand = 0;
    this.stand.gatePull = 0;
    this.audio.useVoice(null);
    this.stand.resetGrab.visible = true;
    this.advanceStage();
  }

  private advanceStage(): void {
    const runs = this.telemetry.runs.length;
    if (this.stage === 'intro' || this.stage === 'firstRun') {
      // One object down. Offer exactly one clearly different second object at
      // the same height, so the only thing that changed is the material.
      this.stage = 'contrastOffer';
      this.wagon.setAvailable(CONTRAST_OBJECT, true);
      this.offerTimer = 11;
      this.audio.reveal();
      return;
    }
    if (this.stage === 'contrastOffer' || this.stage === 'contrastRun') {
      if (runs >= 2 && this.telemetry.comparedFirstTwo) {
        this.stage = 'free';
        this.layer = 1;
        for (const id of OBJECT_ORDER) this.wagon.setAvailable(id, true);
        this.mat.setPresent(true);
        this.audio.reveal();
      }
      return;
    }
    // Free play: open the next variable only once the current one has been used.
    if (this.layer === 1 && runs >= 4 && this.telemetry.distinctObjects >= 3) {
      this.layer = 2;
      for (const z of START_ZONES) this.slide.setGateAvailable(z.id, true);
      this.audio.reveal();
      return;
    }
    if (this.layer === 2 && (this.telemetry.sameObjectDifferentZones || runs >= 7)) {
      this.layer = 3;
      this.wagon.setToolsAvailable(true);
      this.audio.reveal();
    }
  }

  private updateOffer(dt: number): void {
    if (this.stage !== 'contrastOffer' || this.runState !== 'idle') return;
    this.offerTimer -= dt;
    if (this.offerTimer <= 0) {
      // The second object makes its own way to the gate if nobody moves it.
      this.stage = 'contrastRun';
      this.armObject(CONTRAST_OBJECT, 'top');
    }
  }

  private updateHints(dt: number): void {
    if (this.runState !== 'armed') {
      this.hintTimer = 0;
      return;
    }
    if (this.touched && this.telemetry.firstGateTouch !== null) {
      this.telemetry.hintStage = 0;
      return;
    }
    this.hintTimer += dt;
    const t = this.idle;

    if (t < 6) {
      this.hintPhase = 0;
      // Nothing but the object leaning on the gate, plus the latch ticking.
      if (this.hintTimer > 3.4) {
        this.hintTimer = 0;
        this.audio.gateClick(0.55);
      }
    } else if (t < 13.5) {
      this.hintPhase = 1;
      if (this.hintTimer > 4) {
        this.hintTimer = 0;
        // The lever moves a couple of millimetres and the object moves with it.
        this.stand.nudge(0.07);
        this.nudge = 0.007;
        this.gateCommand = 0.06;
        window.setTimeout(() => {
          if (this.runState === 'armed') this.gateCommand = 0;
        }, 420);
        this.audio.gateClick(0.35);
      }
    } else {
      this.hintPhase = 2;
      if (this.hintTimer > 9) {
        this.hintTimer = 0;
        this.audio.whoosh();
        this.ghostPull();
      }
    }
    this.telemetry.hintStage = this.hintPhase;
  }

  /** Shows only the direction of the pull, never the outcome. */
  private ghostPull(): void {
    let step = 0;
    const tick = (): void => {
      if (this.runState !== 'armed' || this.touched) return;
      step++;
      const amt = step % 2 === 1 ? 0.34 : 0;
      // Only the lever moves: the boom stays shut so the outcome is not shown.
      this.stand.nudge(amt);
      this.nudge = amt * 0.02;
      if (step < 4) window.setTimeout(tick, 380);
    };
    tick();
  }

  // ------------------------------------------------------------- accessors

  get shotContext(): ShotContext {
    const frame: Vector3[] = [];
    const focus = new Vector3();
    const b = this.body;
    if (b && this.activeProp) focus.copy(this.activeProp.root.position);
    else focus.copy(slideSurface(this.baseArc, 0, 0.05));

    if (this.rig.currentShot === 'gate') {
      // Hand, gate and enough of the bed for the object to have somewhere to go.
      // Only the hand and the held object: this is the mid shot that has to
      // carry the whole cause-and-effect moment.
      frame.push(this.stand.gateKnobWorld(new Vector3()));
      frame.push(slideSurface(zoneById(this.currentZone).center, 0, 0.16, new Vector3()));
    } else if (this.rig.currentShot === 'overview') {
      frame.push(this.stand.gateKnobWorld(new Vector3()));
      frame.push(new Vector3(6.4, 0, 0));
      if (this.wagon.hasAvailable) {
        // Both ends of the trolley, so it is never half out of frame.
        const w = this.wagon.root.position;
        frame.push(new Vector3(w.x - 0.62, 0.62, w.z + 0.3));
        frame.push(new Vector3(w.x + 0.62, 0.1, w.z - 0.3));
      }
      if (b && !b.onSlide) frame.push(new Vector3(b.px, 0, b.pz));
      if (this.mat.state.present) frame.push(this.mat.worldPosition(new Vector3()));
    }

    const beyond = b && !b.onSlide ? Math.max(0, b.px - 3.4) : 0;
    const landing = this.prediction
      ? new Vector3(this.prediction.landingX, 0.06, this.prediction.landingZ)
      : null;
    return {
      focus,
      frame,
      arc: b?.onSlide ? b.s : null,
      beyond,
      landing,
      grounded: !!b && !b.onSlide && b.grounded,
    };
  }

  get debugState(): {
    body: BodyState | null;
    prediction: Prediction | null;
    id: ObjectId;
    zone: StartZoneId;
    stage: Stage;
    layer: number;
    runState: RunState;
  } {
    return {
      body: this.body,
      prediction: this.prediction,
      id: this.currentId,
      zone: this.currentZone,
      stage: this.stage,
      layer: this.layer,
      runState: this.runState,
    };
  }

  /** Which object is currently in the child's hand, if any. */
  get carryingId(): ObjectId | null {
    return this.carryFrom;
  }

  /** Coarse totals of what is on the bed, for the debug/e2e surface. */
  surfaceTotals(): { wet: number; sand: number; rubber: number; states: number } {
    let wet = 0;
    let sand = 0;
    let rubber = 0;
    for (let i = 0; i < this.surface.wet.length; i++) {
      wet += this.surface.wet[i];
      sand += this.surface.sand[i];
      rubber += this.surface.rubber[i];
    }
    return { wet, sand, rubber, states: this.surface.distinctStates() };
  }

  /** Drag the landing pad, exactly as the finger does. */
  placeMat(x: number, z: number): void {
    this.mat.setPresent(true);
    this.mat.moveTo(x, z);
    this.matMoved();
  }
}
