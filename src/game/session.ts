import * as THREE from 'three';
import { clamp01, damp, lerp, smoothstep } from '../core/math';
import type { Stage } from '../core/stage';
import { Basket, Field, Worker } from '../world/environment';
import { LEVER } from '../world/lifter';
import { FIELD_SOIL, PLOT_SPACING, Plot, ROCKS_REQUIRED, VARIATIONS } from '../world/plot';
import { SoundField } from './audio';
import { CameraDirector, SHOTS, type Extent, type ShotName } from './camera';
import { HintDirector } from './hints';
import { DragAxis, Pointer, RockGesture } from './input';

/**
 * The sequence, in the order the player discovers it.
 *
 * The whole design rests on withholding: the roots are not shown, then a
 * shoulder of one root is shown, then their directions one at a time, and only
 * then the whole cluster. Nothing here counts anything or scores anything —
 * once a plant is out, the next stem is simply there, with a different plant
 * under it.
 */
export type Phase =
  | 'approach'
  | 'seating'
  | 'leverFirst'
  | 'shoulder'
  | 'section'
  | 'rocking'
  | 'leverFull'
  | 'breakFree'
  | 'reveal'
  | 'shakeOff'
  | 'carry'
  | 'handoff';

const FIRST_STAGE_LIFT_SHARE =
  (LEVER.restPhi - LEVER.firstPhi) / (LEVER.restPhi - LEVER.fullPhi);

/** Extra travel once the lever has bottomed out and the plant tears free. */
const FREE_LIFT = 0.19;

export interface DebugState {
  phase: Phase;
  plotIndex: number;
  clampAttached: boolean;
  /** Horizontal distance from the clamp jaws to the stem base, metres. */
  clampGap: number;
  toolX: number;
  toolZ: number;
  leverStage1: number;
  leverStage2: number;
  rocks: number;
  shakes: number;
  lift: number;
  cracksOpen: number;
  /** Widest crack currently open, 0..1. */
  crackOpen: number;
  /** Height of the thickest root's shoulder relative to the soil line, metres. */
  shoulderY: number;
  rootCount: number;
  archetype: string;
  soil: string;
  fps: number;
  tier: string;
  /** Whether the audio graph has started (it may only do so after a touch). */
  audio: boolean;
  reducedMotion: boolean;
}

export class Session {
  private plots: Plot[] = [];
  private field: Field;
  private worker: Worker;
  private basket: Basket;
  private hints = new HintDirector();
  private director: CameraDirector;
  private pointer: Pointer;
  private sound = new SoundField();

  private leverA = new DragAxis(3.4, true);
  private leverB = new DragAxis(3.0, true);
  private stemRock = new RockGesture(0.05, 2.4);
  private clusterRock = new RockGesture(0.05, 2.4);

  private phase: Phase = 'approach';
  private phaseTime = 0;
  private plotIndex = 0;
  private clampAttached = false;
  private seatProgress = 0;
  private rocks = 0;
  private freeLift = 0;
  private carryPos = new THREE.Vector3();
  private carryVel = new THREE.Vector3();
  private carrying = false;
  private liftAtCarryStart = 0;
  private toolDrag = new THREE.Vector3();
  private toolVel = new THREE.Vector3();
  private clipPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  private sectionShown = false;
  private grainTimer = 0;
  private driveCooldown = 0;
  private fps = 60;
  private reducedMotion = false;

  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private sphere = new THREE.Sphere();

  constructor(private stage: Stage) {
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    this.director = new CameraDirector(stage);
    this.director.reducedMotion = this.reducedMotion;
    this.pointer = new Pointer(stage.renderer.domElement);

    const q = stage.quality;
    const plotXs = VARIATIONS.map((_, i) => i * PLOT_SPACING);

    this.field = new Field(q, FIELD_SOIL, plotXs);
    stage.scene.add(this.field.group);

    for (let i = 0; i < VARIATIONS.length; i++) {
      const plot = new Plot(i, VARIATIONS[i]!, q);
      plot.group.position.set(plotXs[i]!, 0, 0);
      stage.scene.add(plot.group);
      this.plots.push(plot);
    }

    this.worker = new Worker(q, FIELD_SOIL);
    stage.scene.add(this.worker.group);

    this.basket = new Basket(q);
    stage.scene.add(this.basket.group);

    stage.scene.add(this.hints.group);

    // Local clipping is used exactly once, for the short section cutaway.
    stage.renderer.localClippingEnabled = true;

    this.placeSupportingCast();
    this.enterPhase('approach');
    this.director.cut();
  }

  get plot(): Plot {
    return this.plots[Math.min(this.plotIndex, this.plots.length - 1)]!;
  }

  private placeSupportingCast(): void {
    const x = this.plot.group.position.x;
    // Off the row, far enough back that a person never blocks the work, and
    // close enough that boot, tool and stem share a frame for scale.
    // Both sit well off the axis the establishing shot looks down, so a
    // person or a basket never stands between the player and the plant.
    this.worker.group.position.set(x + 2.15, 0, -1.45);
    // Turned to face the plant being worked.
    this.worker.group.rotation.y = -0.98;
    // Ahead along the row and off to the near side, where it is reachable
    // for the carry without ever standing between the eye and the plant.
    this.basket.group.position.set(x + 1.10, 0, 0.92);
  }

  /* ---------------------------------------------------------------- */
  /* phases                                                            */
  /* ---------------------------------------------------------------- */

  private enterPhase(next: Phase): void {
    this.phase = next;
    this.phaseTime = 0;
    this.driveCooldown = -1;
    this.hints.notifyActivity();

    switch (next) {
      case 'approach':
        this.plot.showTool();
        this.clampAttached = false;
        this.seatProgress = 0;
        this.rocks = 0;
        this.freeLift = 0;
        this.carrying = false;
        this.leverA.reset();
        this.leverB.reset();
        this.stemRock.reset();
        this.clusterRock.reset();
        this.toolDrag.set(0, 0, 0);
        this.toolVel.set(0, 0, 0);
        this.aim('establish');
        break;
      case 'seating':
        this.sound.clampBite();
        this.director.impulse(0.010);
        this.aim('clampWork');
        this.director.move(0.7);
        break;
      case 'leverFirst':
        this.aim('leverSide');
        this.director.move(1.0);
        break;
      case 'shoulder':
        // The ground has just opened. Get down to it.
        this.aim('crackGrazing');
        this.director.move(0.85);
        this.sound.soilCrack(1);
        this.director.impulse(0.011);
        break;
      case 'section':
        this.aim('section');
        this.director.cut();
        this.applyClipping(true);
        break;
      case 'rocking':
        this.applyClipping(false);
        this.aim('rockFollow');
        this.director.move(0.9);
        break;
      case 'leverFull':
        this.aim('rise');
        this.director.move(1.0);
        break;
      case 'breakFree':
        this.sound.rootPull(1);
        break;
      case 'reveal':
        // No cut here: the camera has been easing back through the whole lift.
        this.aim('reveal');
        this.director.move(this.reducedMotion ? 1.0 : 1.9);
        break;
      case 'shakeOff':
        this.aim('reveal');
        break;
      case 'carry':
        // The jaws let go; from here the plant is carried by hand.
        this.plot.lifter.setJaw(0.3);
        this.clampAttached = false;
        this.carrying = false;
        this.carryPos.set(0, 0, 0);
        this.carryVel.set(0, 0, 0);
        this.liftAtCarryStart = this.plot.currentLift;
        this.aim('nextRow');
        this.director.move(1.2);
        break;
      case 'handoff':
        this.sound.basketDrop();
        this.aim('nextRow');
        this.director.move(1.1);
        break;
    }
  }

  private applyClipping(on: boolean): void {
    const planes = on ? [this.clipPlane] : [];
    // The section looks in from -X, and the half of the ground between the eye
    // and the plant is the half that goes. Three keeps the positive side of
    // the plane, so this normal points away from the camera.
    this.clipPlane.set(new THREE.Vector3(1, 0, 0), -this.plot.group.position.x + 0.001);
    this.plot.patch.sectionWall.visible = on;
    // The basket and the worker are not part of the diagram, and on this axis
    // they would stand between the eye and the cut.
    this.basket.group.visible = !on;
    this.worker.group.visible = !on;
    for (const m of this.field.soilMaterials) {
      m.clippingPlanes = planes;
      m.needsUpdate = true;
    }
    for (const m of this.plot.patch.soilMaterials) {
      m.clippingPlanes = planes;
      m.needsUpdate = true;
    }
  }

  /* ---------------------------------------------------------------- */
  /* camera aiming                                                     */
  /* ---------------------------------------------------------------- */

  private aim(shot: ShotName): void {
    this.director.aim(
      shot,
      this.cameraSubject(shot, this.tmpA),
      this.cameraExtent(shot),
      this.cameraAzimuth(shot),
    );
  }

  /**
   * The grazing shot has to look straight down a crack, from a side the tool
   * is not standing on. Which crack that is depends on the plant, so the
   * angle is solved per plot rather than fixed in the shot table.
   */
  private cameraAzimuth(shot: ShotName): number | null {
    if (shot !== 'crackGrazing') return null;
    const a = this.plot.patch.firstCrackAzimuth();
    // Looking straight down the split foreshortens it into a line. Standing
    // off it by half a radian shows the wedge opening, with the pale root
    // shoulder inside it, and still keeps the tool out of the way.
    const along = Math.atan2(Math.cos(a), Math.sin(a));
    return along + (Math.sin(a) < 0 ? 0.55 : -0.55);
  }

  private cameraSubject(shot: ShotName, out: THREE.Vector3): THREE.Vector3 {
    const plot = this.plot;
    const origin = plot.group.position;
    switch (shot) {
      case 'establish':
        // Stem and tool together, so the pairing is the first thing read.
        out.set(origin.x + 0.02, 0.19, origin.z + 0.20);
        return out;
      case 'clampWork':
        return plot.gripWorldPoint(out).add(new THREE.Vector3(0, 0.02, 0));
      case 'leverSide':
        return out.set(origin.x, 0.24, origin.z + LEVER.fulcrumZ * 0.55);
      case 'crackGrazing':
        // Straight at the pale shoulder of the thickest root, lifted a little
        // so the split above it is in frame too.
        plot.cluster.shoulderWorld(out);
        out.y += 0.03;
        return out;
      case 'section':
        return out.set(origin.x, -0.04, origin.z);
      case 'rockFollow':
        return plot.gripWorldPoint(out).add(new THREE.Vector3(0, 0.08, 0));
      case 'rise': {
        plot.cluster.getFramingSphere(this.sphere);
        return out.copy(this.sphere.center);
      }
      case 'reveal': {
        // Halfway between the hanging cluster and the open hole, so both are
        // held in the same frame.
        plot.cluster.getFramingSphere(this.sphere);
        out.copy(this.sphere.center);
        out.y = (out.y + (origin.y - plot.cluster.maxDepth * 0.5)) * 0.5;
        return out;
      }
      case 'nextRow': {
        if (this.phase === 'carry') {
          plot.cluster.getFramingSphere(this.sphere);
          out.copy(this.sphere.center).add(this.basket.group.position).multiplyScalar(0.5);
          out.y = 0.34;
          return out;
        }
        const ahead = this.plots[(this.plotIndex + 2) % this.plots.length]!;
        out.copy(origin).lerp(ahead.group.position, 0.45);
        out.x = lerp(out.x, this.basket.group.position.x, 0.22);
        out.y = 0.30;
        return out;
      }
    }
  }

  /**
   * Camera basis for a shot, from its fixed azimuth and elevation. The
   * direction of a shot never depends on how far away it ends up, so this is
   * exact even before the distance has been solved.
   */
  private shotBasis(shot: ShotName): { right: THREE.Vector3; up: THREE.Vector3; forward: THREE.Vector3 } {
    const def = SHOTS[shot];
    const azimuth = this.cameraAzimuth(shot) ?? def.azimuth;
    const elevation = def.elevation + (this.stage.isPortrait ? 0.03 : 0);
    const cosE = Math.cos(elevation);
    // Unit vector from the subject toward the eye.
    const toEye = new THREE.Vector3(
      Math.sin(azimuth) * cosE,
      Math.sin(elevation),
      Math.cos(azimuth) * cosE,
    ).normalize();
    const forward = toEye.clone().negate();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    return { right, up, forward };
  }

  /**
   * Measure the extent a set of world points actually needs on screen.
   *
   * Rather than guessing from a bounding radius — which either crops a wide
   * fan of roots or holds the camera uselessly far back — this projects the
   * real extremities onto the shot's own screen axes. The second pass
   * accounts for perspective: points nearer the eye than the subject take up
   * proportionally more of the frame.
   */
  private frameAround(
    shot: ShotName,
    subject: THREE.Vector3,
    points: THREE.Vector3[],
    margin: number,
  ): Extent {
    const { right, up, forward } = this.shotBasis(shot);
    const rel = new THREE.Vector3();
    let halfW = margin;
    let halfH = margin;
    let nearest = 0;
    for (const p of points) {
      rel.copy(p).sub(subject);
      halfW = Math.max(halfW, Math.abs(rel.dot(right)) + margin);
      halfH = Math.max(halfH, Math.abs(rel.dot(up)) + margin);
      // Positive means closer to the eye than the subject plane.
      nearest = Math.max(nearest, -rel.dot(forward));
    }
    let extent: Extent = { width: halfW * 2, height: halfH * 2 };
    const distance = this.director.distanceFor(shot, extent);
    if (nearest > 0 && distance > nearest + 0.05) {
      const blowUp = distance / (distance - nearest);
      extent = { width: extent.width * blowUp, height: extent.height * blowUp };
    }
    return extent;
  }

  private cameraExtent(shot: ShotName): Extent | null {
    const plot = this.plot;
    if (shot === 'nextRow' && this.phase === 'carry') {
      // Carrying: the plant, the basket it is going into, and the hole it came
      // out of, all in one frame the whole way across.
      const subject = this.cameraSubject('nextRow', this.tmpB).clone();
      const points = plot.cluster.extremities([]);
      points.push(this.basket.group.position.clone().setY(this.basket.mouth.y));
      points.push(plot.group.position.clone());
      return this.frameAround('nextRow', subject, points, 0.16);
    }
    if (shot !== 'rise' && shot !== 'reveal') return null;

    const subject = this.cameraSubject(shot, this.tmpB).clone();
    const points = plot.cluster.extremities([]);
    if (shot === 'rise') {
      // The player's hand is on the lever grip through this whole shot, so the
      // grip has to stay in frame — otherwise there is nothing under the
      // finger to explain what the drag is doing.
      points.push(plot.lifter.grip.getWorldPosition(new THREE.Vector3()));
    } else {
      // Reveal also has to hold the open hole, since the whole point is that
      // its shape matches what just came out of it.
      const hole = plot.group.position;
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        points.push(
          new THREE.Vector3(
            hole.x + Math.cos(a) * plot.patch.radius,
            hole.y - plot.cluster.maxDepth * 0.5,
            hole.z + Math.sin(a) * plot.patch.radius,
          ),
        );
      }
    }
    return this.frameAround(shot, subject, points, shot === 'rise' ? 0.09 : 0.07);
  }

  /* ---------------------------------------------------------------- */
  /* frame                                                             */
  /* ---------------------------------------------------------------- */

  update(dt: number, now: number): void {
    this.pointer.beginFrame(dt);
    this.phaseTime += dt;
    this.fps = damp(this.fps, 1 / Math.max(dt, 1e-4), 3, dt);

    if (this.pointer.justPressed) {
      this.sound.unlock();
      this.hints.notifyActivity();
    }

    const plot = this.plot;
    const base = Math.max(1, Math.min(window.innerWidth, window.innerHeight));
    const dx = this.pointer.delta.x / base;
    const dy = this.pointer.delta.y / base;

    switch (this.phase) {
      case 'approach':
        this.updateApproach(dt, dx, dy);
        break;
      case 'seating':
        this.updateSeating(dt);
        break;
      case 'leverFirst':
        this.updateLever(dt, dy, this.leverA, FIRST_STAGE_LIFT_SHARE, 0);
        break;
      case 'shoulder':
        if (this.phaseTime > 1.9) {
          this.enterPhase(this.plotIndex === 0 && !this.sectionShown ? 'section' : 'rocking');
        }
        break;
      case 'section':
        this.sectionShown = true;
        if (this.phaseTime > 1.2) this.enterPhase('rocking');
        break;
      case 'rocking':
        this.updateRocking(dt, dx);
        break;
      case 'leverFull':
        this.updateLever(dt, dy, this.leverB, 1, FIRST_STAGE_LIFT_SHARE);
        break;
      case 'breakFree':
        this.updateBreakFree(dt);
        break;
      case 'reveal':
        if (this.director.settled && this.phaseTime > 2.4) this.enterPhase('shakeOff');
        break;
      case 'shakeOff':
        this.updateShakeOff(dt, dx);
        break;
      case 'carry':
        this.updateCarry(dt, dx, dy);
        break;
      case 'handoff':
        this.updateHandoff();
        break;
    }

    // Keep the shot pointed at a subject that may be moving this frame.
    this.aim(this.director.activeShot);

    this.stemRock.update(dt);
    this.clusterRock.update(dt);
    this.leverA.update(dt);
    this.leverB.update(dt);

    const rock = this.phase === 'rocking' ? this.stemRock.offset : 0;
    const clusterRock = this.phase === 'shakeOff' ? this.clusterRock.offset : 0;

    plot.cluster.setHang(
      clamp01((plot.currentLift - plot.cluster.maxDepth * 0.6) / 0.30),
    );
    for (const p of this.plots) p.update(dt, p === plot ? rock + clusterRock : 0);

    this.updateClampPlacement(dt);
    plot.lifter.updateChain(now * 1.7 + this.hints.stir * 2);

    this.sound.setCreak(
      this.phase === 'leverFirst' || this.phase === 'leverFull'
        ? clamp01((LEVER.restPhi - plot.lifter.currentPhi) / (LEVER.restPhi - LEVER.fullPhi)) *
            (this.pointer.active ? 1 : 0.25)
        : 0,
    );
    this.sound.update(dt);

    // Belt and braces: the section wall is a double-sided slab of earth, and
    // a camera that ended up behind it would fill the screen with flat brown.
    // It exists for exactly one phase, so it is only ever visible in that one.
    plot.patch.sectionWall.visible = this.phase === 'section';

    this.hints.update(dt, this.stage.camera, this.worker);
    if (this.hints.idleTime < 6) this.workerWatchesWork();
    this.worker.update(dt);

    this.director.update(dt);
    this.stage.focusShadows(plot.group.position);

    this.pointer.endFrame();
  }

  /**
   * Turn a screen-space drag into movement across the ground in front of the
   * camera, so a swipe always moves things the way it looks like it should —
   * including immediately after a device rotation, since it is solved from
   * the live camera rather than from stored screen coordinates.
   */
  private screenToGround(dx: number, dy: number, gain: number, out: THREE.Vector3): THREE.Vector3 {
    const forward = new THREE.Vector3();
    this.stage.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    // forward x up is the camera's right in a right-handed frame, so a swipe
    // to the right moves the tool to the right on screen.
    const right = new THREE.Vector3()
      .crossVectors(forward, new THREE.Vector3(0, 1, 0))
      .normalize();
    out.set(0, 0, 0);
    out.addScaledVector(right, dx * gain);
    out.addScaledVector(forward, -dy * gain);
    return out;
  }

  private workerWatchesWork(): void {
    this.plot.gripWorldPoint(this.tmpB);
    this.tmpB.y += 0.1;
    this.worker.lookAt(this.tmpB);
  }

  /* ---- 1: carry the clamp to the stem ---- */

  private updateApproach(dt: number, dx: number, dy: number): void {
    const plot = this.plot;
    plot.gripWorldPoint(this.tmpB);

    // Hint ladder: from the clamp to the base of the stem.
    plot.lifter.clamp.getWorldPosition(this.tmpA);
    this.hints.arm(this.tmpA, this.tmpB);

    if (this.pointer.active) {
      // Drag maps into the camera's ground plane, so a swipe always moves the
      // tool the way it looks like it should, whatever shot is live.
      // Generous gain: a short child-sized swipe still crosses the gap.
      this.screenToGround(dx, dy, 1.15, this.toolDrag);
      plot.lifter.group.position.x += this.toolDrag.x;
      plot.lifter.group.position.z += this.toolDrag.z;
      // Remember the speed, so letting go mid-swipe still carries it on.
      const inv = 1 / Math.max(dt, 1e-3);
      this.toolVel.set(this.toolDrag.x * inv, 0, this.toolDrag.z * inv);
    } else {
      // Inertia, then a gentle settle — releasing never strands the tool.
      plot.lifter.group.position.x += this.toolVel.x * dt;
      plot.lifter.group.position.z += this.toolVel.z * dt;
      this.toolVel.multiplyScalar(Math.exp(-5.5 * dt));
    }

    // Soft attraction once it is close, so an imprecise drag still lands.
    plot.lifter.clamp.getWorldPosition(this.tmpA);
    const flatDist = Math.hypot(this.tmpA.x - this.tmpB.x, this.tmpA.z - this.tmpB.z);
    if (flatDist < 0.26) {
      const pull = (1 - flatDist / 0.26) * dt * 3.2;
      plot.lifter.group.position.x += (this.tmpB.x - this.tmpA.x) * pull;
      plot.lifter.group.position.z += (this.tmpB.z - this.tmpA.z) * pull;
    }
    // Square up to the row as it arrives.
    plot.lifter.group.rotation.y = damp(
      plot.lifter.group.rotation.y,
      lerp(-0.30, 0, clamp01(1 - flatDist / 0.5)),
      3.5,
      dt,
    );

    // Keep the tool on the worked strip. These bounds are in the plot's own
    // space — the tool group is a child of the plot, so clamping it against
    // world coordinates would pin it out of reach on every plot but the first.
    plot.lifter.group.position.x = THREE.MathUtils.clamp(plot.lifter.group.position.x, -0.55, 0.55);
    plot.lifter.group.position.z = THREE.MathUtils.clamp(plot.lifter.group.position.z, -0.45, 0.5);

    if (this.pointer.active && this.pointer.travel > 30 && Math.random() < dt * 2.2) {
      this.sound.clampKnock();
    }

    if (flatDist < 0.075) {
      this.clampAttached = true;
      this.enterPhase('seating');
    }
  }

  /* ---- 2: the tool settles and the jaws bite ---- */

  private updateSeating(dt: number): void {
    this.seatProgress = damp(this.seatProgress, 1, 4.5, dt);
    this.plot.seatTool(this.seatProgress);
    this.plot.lifter.setJaw(smoothstep(this.seatProgress * 1.4));
    if (this.phaseTime > 0.35 && this.phaseTime - dt <= 0.35) this.sound.toolSeat();
    if (this.seatProgress > 0.985) {
      this.plot.seatTool(1);
      this.plot.lifter.setJaw(1);
      this.enterPhase('leverFirst');
    }
  }

  /* ---- 3 and 6: the lever ---- */

  private updateLever(
    dt: number,
    dy: number,
    axis: DragAxis,
    endShare: number,
    startShare: number,
  ): void {
    const plot = this.plot;
    plot.lifter.grip.getWorldPosition(this.tmpA);
    this.tmpB.copy(this.tmpA);
    this.tmpB.y = 0.06;
    this.hints.arm(this.tmpA, this.tmpB);

    if (this.pointer.justPressed) axis.begin();
    if (this.pointer.active) axis.drive(dy, dt);
    if (this.pointer.justReleased) axis.release();

    // Idle stir: the loaded handle settles a little on its own.
    const stir = this.hints.stir * 0.012;
    const share = lerp(startShare, endShare, axis.value);
    const phi = lerp(LEVER.restPhi, LEVER.fullPhi, clamp01(share + stir * 0.4));
    plot.lifter.setPhi(phi);
    plot.setLift(Math.max(0, plot.lifter.lift));

    if (this.phase === 'leverFirst') {
      // Only the ground moves yet: three cracks and one pale shoulder.
      plot.patch.setSplit(1, axis.value * 0.30);
      if (axis.value > 0.06 && Math.random() < dt * 8) {
        plot.spill(new THREE.Vector3(0, 0.01, 0), 2, plot.patch.radius * 0.9);
      }
      if (axis.value >= 0.985) {
        plot.patch.setSplit(1, 0.32);
        this.enterPhase('shoulder');
      }
    } else {
      // Now the whole patch gives way and the cluster comes with it.
      plot.patch.setSplit(2, 0.35 + axis.value * 0.65);
      this.grainTimer -= dt;
      if (axis.value > 0.02 && this.grainTimer <= 0) {
        this.grainTimer = 0.06;
        plot.spill(new THREE.Vector3(0, plot.currentLift * 0.4, 0), 4, plot.patch.radius);
        if (Math.random() < 0.25) this.sound.grainFall(0.6);
      }
      if (axis.value >= 0.985) this.enterPhase('breakFree');
    }
  }

  /* ---- 4: rock the stem side to side ---- */

  private updateRocking(dt: number, dx: number): void {
    const plot = this.plot;
    plot.gripWorldPoint(this.tmpA);
    this.tmpA.y += 0.06;
    this.tmpB.copy(this.tmpA).add(new THREE.Vector3(0.16, 0.01, 0));
    this.hints.arm(this.tmpA, this.tmpB);

    if (this.pointer.justPressed) this.stemRock.begin();
    if (this.pointer.justReleased) this.stemRock.release();
    if (this.pointer.active && this.stemRock.drive(dx, dt)) {
      this.rocks++;
      // Each rock strips a little more soil and gives up exactly one more
      // root direction.
      plot.patch.setSplit(1, 0.32 + this.rocks * 0.14);
      plot.patch.openNextCrack(0.30);
      plot.spill(new THREE.Vector3(0, 0.01, 0), 10, plot.patch.radius * 1.1);
      this.sound.soilCrack(0.65);
      this.sound.dryLeaves(0.5);
      this.director.impulse(0.006);
    }
    if (this.rocks >= ROCKS_REQUIRED && !this.pointer.active) {
      this.enterPhase('leverFull');
    }
  }

  /* ---- 7: the plant tears free ---- */

  private updateBreakFree(dt: number): void {
    const plot = this.plot;
    const target = FREE_LIFT;
    this.freeLift = damp(this.freeLift, target, this.reducedMotion ? 4 : 2.1, dt);
    plot.setLift(plot.lifter.lift + this.freeLift);
    plot.patch.setSplit(2, 1);

    this.grainTimer -= dt;
    if (this.grainTimer <= 0) {
      this.grainTimer = 0.05;
      plot.spill(new THREE.Vector3(0, plot.currentLift * 0.5, 0), 5, plot.patch.radius * 0.9);
    }
    if (plot.clearsHole) plot.cluster.markFreed();
    if (this.freeLift > target * 0.94) {
      this.sound.grainFall(1);
      this.enterPhase('reveal');
    }
  }

  /* ---- 8: shake the soil off ---- */

  private updateShakeOff(dt: number, dx: number): void {
    const plot = this.plot;
    plot.cluster.getFramingSphere(this.sphere);
    this.tmpA.copy(this.sphere.center);
    this.tmpB.copy(this.tmpA).add(new THREE.Vector3(0.18, 0, 0));
    this.hints.arm(this.tmpA, this.tmpB);

    if (this.pointer.justPressed) this.clusterRock.begin();
    if (this.pointer.justReleased) this.clusterRock.release();
    if (this.pointer.active && this.clusterRock.drive(dx, dt)) {
      const dropped = plot.cluster.shake();
      plot.spill(new THREE.Vector3(0, plot.currentLift * 0.6, 0), 14, plot.patch.radius * 0.8);
      this.sound.soilCrack(0.5);
      if (dropped > 0) this.sound.grainFall(0.8);
      this.director.impulse(0.005);
    }
    // Only move on when the soil has actually finished falling.
    if (plot.cluster.shakesDone >= 3 && plot.cluster.allClodsGone && !this.pointer.active) {
      this.enterPhase('carry');
    }
  }

  /* ---- 9: carry it to the basket ---- */

  private updateCarry(dt: number, dx: number, dy: number): void {
    const plot = this.plot;
    plot.cluster.getFramingSphere(this.sphere);
    const basketMouth = this.tmpB
      .copy(this.basket.group.position)
      .add(new THREE.Vector3(0, this.basket.mouth.y + 0.12, 0));
    this.hints.arm(this.sphere.center, basketMouth);

    // Target is tracked in plot space; only the plant moves, so the open hole
    // stays put beside it for comparison.
    const home = plot.group.position;
    const targetX = basketMouth.x - home.x;
    const targetZ = basketMouth.z - home.z;

    if (this.pointer.active) {
      this.carrying = true;
      this.screenToGround(dx, dy, 2.0, this.toolDrag);
      this.carryPos.x += this.toolDrag.x;
      this.carryPos.z += this.toolDrag.z;
      const inv = 1 / Math.max(dt, 1e-3);
      this.carryVel.set(this.toolDrag.x * inv, 0, this.toolDrag.z * inv);
    } else {
      this.carryPos.x += this.carryVel.x * dt;
      this.carryPos.z += this.carryVel.z * dt;
      this.carryVel.multiplyScalar(Math.exp(-5.0 * dt));
    }

    // Gentle guidance toward the basket, so a short imprecise drag still lands.
    const gap = Math.hypot(targetX - this.carryPos.x, targetZ - this.carryPos.z);
    if (this.carrying && gap < 1.1) {
      const pull = (1 - gap / 1.1) * dt * 3.0;
      this.carryPos.x += (targetX - this.carryPos.x) * pull;
      this.carryPos.z += (targetZ - this.carryPos.z) * pull;
    }

    plot.setCarry(this.carryPos.x, this.carryPos.z);
    // It swings up as it travels rather than sliding along the ground.
    const travel = Math.hypot(this.carryPos.x, this.carryPos.z);
    plot.setLift(this.liftAtCarryStart + Math.min(0.26, travel * 0.30));

    if (this.carrying && gap < 0.28) {
      this.basket.addHarvest(1000 + this.plotIndex * 7);
      plot.hidePlant();
      this.enterPhase('handoff');
    }
  }

  /* ---- 10: on to the next stem, with no explanation ---- */

  private updateHandoff(): void {
    if (this.phaseTime < 2.2) return;
    // The worker takes the tool with them; the open hole stays behind.
    this.plot.hideTool();
    const finished = this.plotIndex;
    this.plotIndex = (this.plotIndex + 1) % this.plots.length;
    // Replant the plot two behind, well out of shot, so the row never runs
    // out and the loop never needs a results screen.
    const recycle = (finished + this.plots.length - 1) % this.plots.length;
    if (recycle !== this.plotIndex) this.rebuildPlot(recycle);
    this.placeSupportingCast();
    this.enterPhase('approach');
    this.director.move(1.5);
  }

  private rebuildPlot(index: number): void {
    const old = this.plots[index];
    if (!old) return;
    old.dispose();
    const plot = new Plot(index, VARIATIONS[index]!, this.stage.quality);
    plot.group.position.set(index * PLOT_SPACING, 0, 0);
    this.stage.scene.add(plot.group);
    this.plots[index] = plot;
  }

  /* ---- clamp placement, every frame ---- */

  private updateClampPlacement(dt: number): void {
    const plot = this.plot;
    const clamp = plot.lifter.clamp;
    if (this.clampAttached) {
      // Locked to the stem: the chain, the clevis and the plant agree because
      // the lift is derived from the clevis height in the first place.
      plot.gripWorldPoint(this.tmpA);
      plot.lifter.group.worldToLocal(this.tmpA);
      clamp.position.copy(this.tmpA);
      clamp.rotation.y = 0;
    } else {
      // Hanging on its chain, swinging a little under its own weight.
      const clevis = this.tmpA;
      plot.lifter.clevis.getWorldPosition(clevis);
      plot.lifter.group.worldToLocal(clevis);
      clevis.y -= LEVER.chain + 0.056;
      clevis.x += this.hints.stir * 0.012;
      clamp.position.lerp(clevis, Math.min(1, dt * 12));
      clamp.rotation.z = this.hints.stir * 0.10;
    }
  }

  /* ---------------------------------------------------------------- */

  resize(): void {
    // Re-solving happens every frame from the live aspect ratio, so a rotation
    // mid-gesture reframes without touching any game state.
    this.aim(this.director.activeShot);
  }

  debugState(): DebugState {
    const plot = this.plot;
    return {
      phase: this.phase,
      plotIndex: this.plotIndex,
      clampAttached: this.clampAttached,
      clampGap: (() => {
        plot.gripWorldPoint(this.tmpB);
        plot.lifter.clamp.getWorldPosition(this.tmpA);
        return Math.hypot(this.tmpA.x - this.tmpB.x, this.tmpA.z - this.tmpB.z);
      })(),
      toolX: plot.lifter.group.position.x,
      toolZ: plot.lifter.group.position.z,
      leverStage1: this.leverA.value,
      leverStage2: this.leverB.value,
      rocks: this.rocks,
      shakes: plot.cluster.shakesDone,
      lift: plot.currentLift,
      cracksOpen: plot.patch.openedStage,
      crackOpen: plot.patch.maxOpen,
      shoulderY: plot.cluster.shoulderWorld(new THREE.Vector3()).y - plot.group.position.y,
      rootCount: plot.cluster.rootCount,
      archetype: plot.variation.archetype,
      soil: plot.variation.soil,
      fps: this.fps,
      tier: this.stage.quality.tier,
      audio: this.sound.running,
      reducedMotion: this.reducedMotion,
    };
  }

  /**
   * Test hook: the lifted cluster's extremities projected to screen space,
   * as fractions of the viewport. Used to prove that no part of the root
   * cluster is ever cropped, in portrait or landscape.
   */
  clusterOnScreen(): { minX: number; maxX: number; minY: number; maxY: number } {
    const points = this.plot.cluster.extremities([]);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      const q = p.clone().project(this.stage.camera);
      const x = (q.x + 1) / 2;
      const y = (1 - q.y) / 2;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    return { minX, maxX, minY, maxY };
  }

  /**
   * Test hook: where the current gesture starts and ends, in CSS pixels.
   * These are the same two points the wordless prompt traces, so a scripted
   * playthrough performs exactly the move the game is asking for.
   */
  gestureScreen(): { from: [number, number]; to: [number, number]; kind: string } {
    const rect = this.stage.renderer.domElement.getBoundingClientRect();
    const toScreen = (p: THREE.Vector3): [number, number] => {
      const q = p.clone().project(this.stage.camera);
      return [((q.x + 1) / 2) * rect.width, ((1 - q.y) / 2) * rect.height];
    };
    const kind =
      this.phase === 'approach' || this.phase === 'carry'
        ? 'drag'
        : this.phase === 'leverFirst' || this.phase === 'leverFull'
          ? 'push'
          : 'rock';
    return { from: toScreen(this.hints.fromPoint), to: toScreen(this.hints.toPoint), kind };
  }

  /**
   * Test hook: advance whatever gesture the current phase is waiting on.
   * Discrete strokes are rate-limited to roughly what a hand can do, so a
   * scripted playthrough exercises the same path a player takes.
   */
  drive(amount: number): void {
    const dt = 1 / 60;
    const strokeReady = this.phaseTime - this.driveCooldown > 0.34;
    switch (this.phase) {
      case 'approach': {
        const plot = this.plot;
        plot.gripWorldPoint(this.tmpB);
        plot.lifter.clamp.getWorldPosition(this.tmpA);
        plot.lifter.group.position.x += (this.tmpB.x - this.tmpA.x) * amount * 0.12;
        plot.lifter.group.position.z += (this.tmpB.z - this.tmpA.z) * amount * 0.12;
        break;
      }
      case 'leverFirst':
        this.leverA.begin();
        this.leverA.drive(amount * 0.08, dt);
        this.leverA.release();
        break;
      case 'leverFull':
        this.leverB.begin();
        this.leverB.drive(amount * 0.08, dt);
        this.leverB.release();
        break;
      case 'rocking':
        if (!strokeReady) break;
        this.driveCooldown = this.phaseTime;
        this.stemRock.begin();
        if (this.stemRock.drive(this.rocks % 2 === 0 ? 0.3 : -0.3, dt)) {
          this.rocks++;
          this.plot.patch.setSplit(1, 0.32 + this.rocks * 0.14);
          this.plot.patch.openNextCrack(0.30);
        }
        this.stemRock.release();
        break;
      case 'shakeOff': {
        if (!strokeReady) break;
        this.driveCooldown = this.phaseTime;
        this.clusterRock.begin();
        const dir = this.plot.cluster.shakesDone % 2 === 0 ? 0.3 : -0.3;
        if (this.clusterRock.drive(dir, dt)) this.plot.cluster.shake();
        this.clusterRock.release();
        break;
      }
      case 'carry': {
        this.carrying = true;
        const home = this.plot.group.position;
        const b = this.basket.group.position;
        this.carryPos.x += (b.x - home.x - this.carryPos.x) * amount * 0.06;
        this.carryPos.z += (b.z - home.z - this.carryPos.z) * amount * 0.06;
        break;
      }
      default:
        break;
    }
  }

  dispose(): void {
    this.pointer.dispose();
    this.sound.dispose();
    this.hints.dispose();
    for (const p of this.plots) p.dispose();
    this.field.dispose();
    this.worker.dispose();
    this.basket.dispose();
  }
}
