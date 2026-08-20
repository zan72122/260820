import * as THREE from 'three';
import { audio } from '../core/audio';
import { Engine } from '../core/engine';
import { Pointer } from '../core/pointer';
import { settings } from '../core/settings';
import { clamp01, damp, easeOutCubic, lerp, makeRng, smoothstep } from '../core/util';
import { DirtParticles } from '../world/particles';
import { ClusterKind, Plant, TuberInstance } from '../world/plant';
import { fillCrate, makeCrate, makeFork, makeGloveHand } from '../world/props';
import { Scenery } from '../world/scenery';
import { terrainHeight } from '../world/terrain';
import { FingerHint, Pt } from '../ui/hud';
import { CameraRig } from './camera';
import { hillPos } from './layout';

type Phase = 'trace' | 'place' | 'lever' | 'brush' | 'pull' | 'shake' | 'carry' | 'handoff';

const KINDS: ClusterKind[] = ['chunky', 'slender', 'oneBig', 'curved', 'hidden'];
const UP = new THREE.Vector3(0, 1, 0);

export class Director {
  private plants = new Map<number, Plant>();
  private retired: Array<{ index: number; group: THREE.Group; site: { dispose: () => void } }> = [];
  private index = 0;
  private phase: Phase = 'trace';
  private phaseTime = 0;
  private phasePress = 0;
  private idle = 0;
  private hintStage = 0;

  private fork: ReturnType<typeof makeFork>;
  private crate: ReturnType<typeof makeCrate>;
  private hand: THREE.Group;
  private particles: DirtParticles;
  private scenery: Scenery;

  private trace = 0;
  private traceTension = 0;
  private forkAngle = 0;
  private forkRadius = 0.36;
  private forkInsert = 0;
  private forkPlaced = false;
  private forkStowed = 0;
  private forkDragged = false;
  private lever = 0;
  private plantCrack = 0;
  private crackRevealed = false;
  private pull = 0;
  private shakeDir = 0;
  private shakeCount = 0;
  private carry = 0;
  private carryFrom = new THREE.Vector3();
  private handPose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), vis: 0 };
  private crateTarget = new THREE.Vector3();
  private rng = makeRng(20260820);
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private sunViewDir = new THREE.Vector3();
  private gust = 0;
  private gustPlant: Plant | null = null;
  private time = 0;

  constructor(
    private engine: Engine,
    private pointer: Pointer,
    private rig: CameraRig,
    private finger: FingerHint,
  ) {
    const first = this.ensurePlant(0);
    this.ensurePlant(1);
    this.ensurePlant(2);

    this.scenery = new Scenery(77, [hillPos(0), hillPos(1), hillPos(2), hillPos(3), hillPos(4)]);
    engine.scene.add(this.scenery.group);

    this.particles = new DirtParticles();
    engine.scene.add(this.particles.points);

    this.crate = makeCrate();
    fillCrate(this.crate.group, 5, 21);
    this.crateTarget.set(0.86, 0, first.crownWorld.z - 0.32);
    this.crate.group.position.copy(this.crateTarget);
    this.crate.group.position.y = terrainHeight(this.crateTarget.x, this.crateTarget.z);
    this.crate.group.rotation.y = -0.42;
    engine.scene.add(this.crate.group);

    this.fork = makeFork();
    engine.scene.add(this.fork.group);
    this.restFork(first);

    this.hand = makeGloveHand();
    this.hand.visible = false;
    engine.scene.add(this.hand);


    this.applyShot(0.001);
    this.rig.snap();
  }

  private ensurePlant(i: number) {
    const found = this.plants.get(i);
    if (found) return found;
    const p = hillPos(i);
    const heading = -Math.PI * 0.5 + (this.rng() - 0.5) * 0.5;
    const plant = new Plant(p.x, p.z, KINDS[i % KINDS.length], 1000 + i * 137, heading);
    plant.onPop = (t, idx) => this.onTuberPop(t, idx);
    this.engine.scene.add(plant.group);
    this.plants.set(i, plant);
    // Retire, do not delete: the hole a child dug has to stay in the field.
    // Measured against the hill in play, never the one being pre-built.
    for (const [key, old] of this.plants) {
      if (key < this.index - 1) {
        old.retire();
        this.retired.push({ index: key, group: old.group, site: old.digSite });
        this.plants.delete(key);
      }
    }
    while (this.retired.length > 12) {
      const gone = this.retired.shift()!;
      this.engine.scene.remove(gone.group);
      gone.site.dispose();
    }
    return plant;
  }

  private get plant() {
    return this.ensurePlant(this.index);
  }

  private get nextPlant() {
    return this.ensurePlant(this.index + 1);
  }

  private restFork(plant: Plant) {
    // the fork waits on the ground beside the row until it is needed
    const x = 0.62;
    const z = plant.crownWorld.z - 0.85;
    this.fork.group.position.set(x, terrainHeight(x, z) + 0.02, z);
    this.fork.group.rotation.set(-Math.PI * 0.5 + 0.12, 0.8, 0);
  }

  /* ------------------------------------------------------------------ */

  private toScreen(v: THREE.Vector3): Pt {
    this.tmp2.copy(v).project(this.engine.camera);
    return {
      x: (this.tmp2.x * 0.5 + 0.5) * window.innerWidth,
      y: (-this.tmp2.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  private groundPoint(y: number) {
    return this.pointer.planePoint(this.engine.camera, y, this.tmp);
  }

  private nearestOnVine(p: THREE.Vector3) {
    const curve = this.plant.vineCurve;
    let best = 0;
    let bestD = Infinity;
    const q = new THREE.Vector3();
    for (let i = 0; i <= 36; i++) {
      const t = i / 36;
      curve.getPointAt(t, q);
      const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return { t: best, dist: Math.sqrt(bestD) };
  }

  private onTuberPop(t: TuberInstance, idx: number) {
    audio.tuberPop();
    if (idx === 0) audio.haptic('pop');
    const at = t.group.getWorldPosition(new THREE.Vector3());
    this.particles.burst(at, 14, this.rng, 0.5, 1.1);
  }

  private setPhase(p: Phase) {
    this.phase = p;
    this.phaseTime = 0;
    // whatever the finger is doing right now belongs to the phase that ended
    this.phasePress = this.pointer.pressId;
    this.handPose.vis = 0;
    this.idle = 0;
    this.hintStage = 0;
    this.finger.hide();
  }

  /** True only for a press that began after the current phase started. */
  private get holding() {
    return this.pointer.down && this.pointer.pressId > this.phasePress;
  }

  /**
   * Horizontal direction that reads as "screen right" from the current lens.
   * A hand offset this way keeps its forearm across the frame instead of
   * pointing at the camera, where it would collapse into a disc.
   */
  private besideCamera(at: THREE.Vector3, out = new THREE.Vector3()) {
    out.subVectors(at, this.engine.camera.position).setY(0).normalize();
    return out.crossVectors(UP, out).normalize().multiplyScalar(-1);
  }

  private forkHandleWorld(out = new THREE.Vector3()) {
    this.fork.group.updateMatrixWorld();
    return out.set(0, this.fork.handleY, 0).applyMatrix4(this.fork.group.matrixWorld);
  }

  /* ------------------------------- shots ---------------------------- */

  private applyShot(dt: number) {
    const plant = this.plant;
    const portrait = this.engine.viewport.portrait;
    const crown = plant.crownWorld;
    const toward = new THREE.Vector3().subVectors(plant.vineTipWorld, crown).setY(0).normalize();
    const right = new THREE.Vector3().crossVectors(UP, toward).normalize();

    switch (this.phase) {
      case 'trace': {
        // low oblique that keeps vine, leaves and the ground plane readable
        const focus = plant.vineCurve.getPointAt(clamp01(lerp(0.42, 0.9, this.trace))).clone();
        focus.y += 0.06;
        const back = toward.clone().multiplyScalar(0.92).addScaledVector(right, 0.36).normalize();
        this.rig.apply(
          {
            focus,
            back,
            dist: lerp(1.7, 1.2, this.trace),
            height: lerp(0.74, 0.56, this.trace),
            fov: portrait ? 58 : 52,
            portraitDist: 1.06,
            lift: 0.6,
            rate: 1.9,
          },
          portrait,
        );
        break;
      }
      case 'place':
      case 'lever': {
        // side three-quarter holding grip, tines and crown in one frame, then
        // easing down to the crack once the ridge starts to break open
        const grip = this.forkHandleWorld(new THREE.Vector3());
        const wide = crown.clone().lerp(grip, 0.44);
        wide.y = lerp(crown.y, grip.y, 0.32);
        // close in on the fissure as it opens, not on some arbitrary lever value
        const closeIn = smoothstep((this.plantCrack - 0.2) / 0.55);
        const focus = wide.lerp(plant.revealTipWorld.clone().add(new THREE.Vector3(0, 0.04, 0)), closeIn);
        const back = toward.clone().multiplyScalar(0.5).addScaledVector(right, 0.98).normalize();
        this.rig.apply(
          {
            focus,
            back,
            dist: lerp(1.24, 0.66, closeIn),
            height: lerp(0.44, 0.3, closeIn),
            fov: portrait ? 56 : 48,
            lift: 0.55,
            rate: 2.0,
          },
          portrait,
        );
        break;
      }
      case 'brush': {
        const focus = crown.clone();
        focus.y -= 0.04;
        const back = toward.clone().multiplyScalar(0.62).addScaledVector(right, 0.78).normalize();
        this.rig.apply(
          {
            focus,
            back,
            dist: 0.78,
            height: 0.52,
            fov: portrait ? 50 : 42,
            rate: 2.4,
          },
          portrait,
        );
        break;
      }
      case 'pull':
      case 'shake': {
        // ease back as the cluster comes up so the hole stays in frame with it
        const centre = plant.clusterCentre(new THREE.Vector3());
        const focus = centre.lerp(crown, 0.35);
        const back = toward.clone().multiplyScalar(0.6).addScaledVector(right, 0.86).normalize();
        this.rig.apply(
          {
            focus,
            back,
            dist: lerp(0.82, 1.16, this.pull),
            height: lerp(0.44, 0.66, this.pull),
            fov: portrait ? 52 : 44,
            rate: 2.0,
          },
          portrait,
        );
        break;
      }
      case 'carry': {
        // crop and crate share the frame the whole way: the child needs to
        // see where it is going, not just what is in hand
        const cl = plant.clusterCentre(new THREE.Vector3());
        const crateTop = this.crate.group.position.clone().setY(this.crate.group.position.y + 0.22);
        const focus = cl.clone().lerp(crateTop, 0.45 + this.carry * 0.3);
        const spread = cl.distanceTo(crateTop);
        const back = toward.clone().multiplyScalar(0.35).addScaledVector(right, 1.0).normalize();
        this.rig.apply(
          { focus, back, dist: Math.max(1.25, spread * 1.5), height: 0.66, fov: portrait ? 54 : 46, rate: 2.0 },
          portrait,
        );
        break;
      }
      case 'handoff': {
        const next = this.nextPlant;
        const mid = new THREE.Vector3().lerpVectors(crown, next.vineTipWorld, 0.62);
        mid.y += 0.12;
        const back = toward.clone().multiplyScalar(0.9).addScaledVector(right, 0.5).normalize();
        this.rig.apply(
          { focus: mid, back, dist: 1.9, height: 1.05, fov: portrait ? 56 : 48, rate: 1.3 },
          portrait,
        );
        break;
      }
    }
    this.rig.update(dt);
  }

  /* ------------------------------- hints ---------------------------- */

  private hintPath(kind: 'trace' | 'down' | 'rub' | 'up' | 'side' | 'carry'): Pt[] {
    const plant = this.plant;
    const pts: Pt[] = [];
    switch (kind) {
      case 'trace': {
        for (let i = 0; i <= 6; i++) {
          pts.push(this.toScreen(plant.vineCurve.getPointAt(clamp01(0.03 + (i / 6) * 0.42))));
        }
        break;
      }
      case 'down': {
        const a = this.toScreen(this.fork.group.localToWorld(new THREE.Vector3(0, this.fork.handleY, 0)));
        for (let i = 0; i <= 4; i++) pts.push({ x: a.x + i * 4, y: a.y + i * 26 });
        break;
      }
      case 'rub': {
        const c = this.toScreen(plant.crownWorld);
        for (let i = 0; i <= 10; i++) {
          const t = (i / 10) * Math.PI * 2;
          pts.push({ x: c.x + Math.cos(t) * 46, y: c.y + Math.sin(t) * 22 });
        }
        break;
      }
      case 'up': {
        const c = this.toScreen(plant.crownWorld);
        for (let i = 0; i <= 4; i++) pts.push({ x: c.x, y: c.y - i * 28 });
        break;
      }
      case 'side': {
        const c = this.toScreen(plant.clusterCentre(new THREE.Vector3()));
        pts.push({ x: c.x - 44, y: c.y }, { x: c.x + 44, y: c.y }, { x: c.x - 44, y: c.y });
        break;
      }
      case 'carry': {
        const a = this.toScreen(plant.clusterCentre(new THREE.Vector3()));
        const b = this.toScreen(this.crate.group.position.clone().setY(this.crate.group.position.y + 0.3));
        for (let i = 0; i <= 4; i++) {
          pts.push({ x: lerp(a.x, b.x, i / 4), y: lerp(a.y, b.y, i / 4) - Math.sin((i / 4) * Math.PI) * 30 });
        }
        break;
      }
    }
    return pts;
  }

  private gustLeaves(plant: Plant, strength = 2.4) {
    this.gustPlant = plant;
    this.gust = strength;
  }

  private updateHints(dt: number) {
    const firstTime = this.index === 0;
    if (this.pointer.down) {
      this.idle = 0;
      this.hintStage = 0;
      this.finger.hide();
      return;
    }
    this.idle += dt;

    if (this.phase === 'trace') {
      // 3s: the tip stirs. 6s: a hand comes near. 9s: a finger shows the way.
      const t1 = firstTime ? 3 : 6;
      const t2 = firstTime ? 6 : 1e9;
      const t3 = firstTime ? 9 : 13;
      if (this.hintStage < 1 && this.idle > t1) {
        this.hintStage = 1;
        this.gustLeaves(this.plant, 2.6);
        audio.leafRustle(0.5);
      }
      if (this.hintStage < 2 && this.idle > t2) {
        this.hintStage = 2;
        // the hand comes in beside the vine, on the lens side, fully in frame
        const p = this.plant.vineCurve.getPointAt(0.16).clone();
        // reaching in from the side of the frame, forearm running out of it
        this.handPose.pos.copy(p).addScaledVector(this.besideCamera(p), 0.26);
        this.handPose.pos.y += 0.14;
        this.handPose.target.copy(this.plant.vineCurve.getPointAt(0.16));
      }
      if (this.hintStage >= 2 && this.hintStage < 4) this.handPose.vis = 1;
      if (this.hintStage < 3 && this.idle > t3) {
        this.hintStage = 3;
        this.finger.show(this.hintPath('trace'), 1.7, 2);
      }
      if (this.idle > t3 + 8) {
        this.hintStage = 2;
        this.idle = t3 - 1;
      }
      return;
    }

    // later phases: one quiet demonstration of the gesture, only if stuck
    const wait = firstTime ? 4.5 : 11;
    if (this.hintStage < 1 && this.idle > wait) {
      this.hintStage = 1;
      const kind =
        this.phase === 'place'
          ? 'carry'
          : this.phase === 'lever'
            ? 'down'
            : this.phase === 'brush'
              ? 'rub'
              : this.phase === 'pull'
                ? 'up'
                : this.phase === 'shake'
                  ? 'side'
                  : 'carry';
      if (this.phase === 'place') {
        const a = this.toScreen(this.fork.group.position);
        const b = this.toScreen(this.plant.crownWorld);
        this.finger.show(
          [a, { x: lerp(a.x, b.x, 0.6), y: lerp(a.y, b.y, 0.6) }],
          1.4,
          2,
        );
      } else {
        this.finger.show(this.hintPath(kind as 'down'), 1.4, 2);
      }
    }
    if (this.idle > wait + 7) {
      this.hintStage = 0;
      this.idle = wait - 1;
    }
  }

  /* ------------------------------ phases ---------------------------- */

  private updateTrace(dt: number) {
    const plant = this.plant;
    this.traceTension = damp(this.traceTension, 0, 3, dt);
    if (this.holding) {
      const gp = this.groundPoint(plant.crownWorld.y + 0.02);
      if (gp) {
        const { t, dist } = this.nearestOnVine(gp);
        if (dist < 0.42 && t > this.trace) {
          const step = Math.min(t - this.trace, 0.12);
          this.trace = clamp01(this.trace + step);
          this.traceTension = 1;
          if (this.rng() < step * 8) audio.leafRustle(0.35 + step * 3);
          if (this.rng() < step * 4) audio.vineTense();
        } else if (dist >= 0.42 && this.pointer.path > 30) {
          // forgiving fallback: a drag heading toward the crown still counts
          const toCrown = this.toScreen(plant.crownWorld);
          const dirX = toCrown.x - this.pointer.x;
          const dirY = toCrown.y - this.pointer.y;
          const len = Math.hypot(dirX, dirY) || 1;
          const along = (this.pointer.dx * dirX + this.pointer.dy * dirY) / len;
          if (along > 0) this.trace = clamp01(this.trace + along / 900);
        }
      }
    }
    plant.setTrace(this.trace, this.traceTension);
    plant.setCanopyOpen(smoothstep((this.trace - 0.55) / 0.42));
    if (this.trace > 0.9) {
      this.setPhase('place');
      this.forkPlaced = false;
      this.forkDragged = false;
      this.forkAngle = this.pickSafeAngle();
      audio.leafRustle(0.8);
    }
  }

  /** Compass angle from the crown toward the lens. */
  private camAngle() {
    const plant = this.plant;
    const camDir = new THREE.Vector3().subVectors(this.engine.camera.position, plant.crownWorld).setY(0).normalize();
    return Math.atan2(camDir.z, camDir.x);
  }

  /**
   * Where the tines are allowed to go: to one side of the hill, clear of the
   * crop and clear of the sight line, so nothing important is ever hidden.
   */
  private pickSafeAngle() {
    return this.camAngle() + 0.85;
  }

  private forkWorldPos() {
    const plant = this.plant;
    const x = plant.crownWorld.x + Math.cos(this.forkAngle) * this.forkRadius;
    const z = plant.crownWorld.z + Math.sin(this.forkAngle) * this.forkRadius;
    return new THREE.Vector3(x, terrainHeight(x, z), z);
  }

  private updatePlace(dt: number) {
    const plant = this.plant;
    if (this.holding) {
      const gp = this.groundPoint(plant.crownWorld.y + 0.02);
      if (gp) {
        const dx = gp.x - plant.crownWorld.x;
        const dz = gp.z - plant.crownWorld.z;
        let ang = Math.atan2(dz, dx);
        const camAng = this.camAngle();
        // assist: never let the tines land on the cluster, behind the hill, or
        // squarely between the child and what is about to come out of the soil
        let delta = ang - camAng;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        delta = THREE.MathUtils.clamp(delta, 0.38, 1.34);
        ang = camAng + delta;
        this.forkAngle = damp(this.forkAngle, ang, 12, dt);
        const wanted = Math.hypot(dx, dz);
        this.forkRadius = damp(this.forkRadius, THREE.MathUtils.clamp(wanted, 0.31, 0.44), 10, dt);
        if (this.pointer.path > 14) this.forkDragged = true;
      }
    }

    const base = this.forkWorldPos();
    const hover = this.holding ? 0.16 : 0.1 + Math.sin(this.time * 1.8) * 0.012;
    this.forkInsert = damp(this.forkInsert, this.forkPlaced ? 1 : 0, 7, dt);
    const depth = lerp(hover, -0.19, easeOutCubic(this.forkInsert));
    this.fork.group.position.set(base.x, base.y + depth, base.z);

    const toCrown = new THREE.Vector3().subVectors(plant.crownWorld, base).setY(0).normalize();
    const yaw = Math.atan2(toCrown.x, toCrown.z);
    this.fork.group.rotation.set(0, yaw, 0);
    this.fork.group.rotateX(lerp(-0.55, -0.22, this.forkInsert));

    if (!this.forkPlaced && this.forkDragged && this.pointer.justUp) {
      this.forkPlaced = true;
      audio.forkIn();
      this.particles.burst(base, 16, this.rng, 0.35, 0.7);
    }
    if (this.forkPlaced && this.forkInsert > 0.85) {
      this.setPhase('lever');
    }
  }

  private updateLever(dt: number) {
    const plant = this.plant;
    if (this.holding) {
      if (this.pointer.dy > 0) this.lever = clamp01(this.lever + this.pointer.dy / 300);
      else this.lever = clamp01(this.lever + this.pointer.dy / 900);
      if (this.pointer.dy > 1.5 && this.rng() < 0.25) audio.digScrape();
    } else {
      this.lever = damp(this.lever, Math.max(0, this.lever - 0.06), 1.2, dt);
    }

    plant.digSite.setLift(this.lever);
    const crack = smoothstep((this.lever - 0.22) / 0.78);
    this.plantCrack = crack;
    plant.digSite.setCrack(crack);

    const base = this.forkWorldPos();
    const toCrown = new THREE.Vector3().subVectors(plant.crownWorld, base).setY(0).normalize();
    const yaw = Math.atan2(toCrown.x, toCrown.z);
    this.fork.group.position.set(base.x, base.y - 0.19, base.z);
    this.fork.group.rotation.set(0, yaw, 0);
    this.fork.group.rotateX(lerp(-0.22, 0.72, this.lever));

    if (crack > 0.35 && !this.crackRevealed) {
      this.crackRevealed = true;
      audio.clodCrack(1);
      audio.haptic('crack');
      plant.digSite.seedReveal(plant.revealTipWorld, 0.085);
      this.particles.burst(plant.revealTipWorld, 18, this.rng, 0.35, 0.9);
      audio.soilFall(0.8);
    }
    if (this.lever > 0.5 && this.rng() < dt * 2.4) {
      audio.clodCrack(0.4);
      this.particles.burst(plant.crownWorld, 4, this.rng, 0.2, 0.4);
    }
    if (this.lever >= 0.995) {
      this.setPhase('brush');
      audio.digScrape();
    }
  }

  private updateBrush(dt: number) {
    const plant = this.plant;
    this.stowFork(dt);
    // with the fork out, the heaved ridge settles back; the break stays
    this.lever = damp(this.lever, 0.22, 1.6, dt);
    plant.digSite.setLift(this.lever);
    if (this.holding && Math.abs(this.pointer.dx) + Math.abs(this.pointer.dy) > 0.4) {
      const gp = this.groundPoint(plant.crownWorld.y + 0.01);
      if (gp && gp.distanceTo(plant.crownWorld) < 0.78) {
        const added = plant.digSite.paint(gp, 0.145, 0.22 * Math.min(1.6, dt * 60));
        if (added > 0.2) {
          if (this.rng() < 0.4) audio.digScrape();
          if (this.rng() < 0.25) audio.soilFall(0.4);
          this.particles.burst(gp, 3, this.rng, 0.22, 0.45);
        }
      }
    }
    const exposed = plant.tubers.filter((t) => plant.isExposed(t)).length;
    const enough = Math.max(2, Math.ceil(plant.tubers.length * 0.5));
    if (plant.digSite.cleared > 0.28 && exposed >= enough) this.setPhase('pull');
  }

  /** Lift the fork clear of the hill and lay it down beside the row. */
  private stowFork(dt: number) {
    if (this.forkStowed >= 1) return;
    this.forkStowed = Math.min(1, this.forkStowed + dt * 0.9);
    const k = easeOutCubic(this.forkStowed);
    const from = this.forkWorldPos();
    const rest = new THREE.Vector3(0.62, 0, this.plant.crownWorld.z - 0.85);
    rest.y = terrainHeight(rest.x, rest.z) + 0.02;
    const lift = Math.sin(Math.PI * k) * 0.22;
    this.fork.group.position.lerpVectors(from.setY(from.y - 0.19), rest, k);
    this.fork.group.position.y += lift;
    const toCrown = new THREE.Vector3().subVectors(this.plant.crownWorld, from).setY(0).normalize();
    this.fork.group.rotation.set(0, Math.atan2(toCrown.x, toCrown.z), 0);
    this.fork.group.rotateX(lerp(0.72, -Math.PI * 0.5 + 0.12, k));
    this.fork.group.rotateZ(k * 0.8);
  }

  private updatePull(dt: number) {
    const plant = this.plant;
    this.stowFork(dt);
    this.lever = damp(this.lever, 0.22, 1.6, dt);
    plant.digSite.setLift(this.lever);
    if (this.holding && this.pointer.dy < 0) {
      this.pull = clamp01(this.pull + -this.pointer.dy / 340);
      if (this.rng() < dt * 5) audio.soilFall(0.5);
    } else if (!this.pointer.down) {
      this.pull = damp(this.pull, Math.max(0, this.pull - 0.03), 1.0, dt);
    }
    plant.setPull(this.pull);

    // the hand steadies the crown while the child does the lifting, and sits
    // on the far side of it so it never covers what is coming up
    this.handPose.vis = 1;
    this.handPose.pos.copy(plant.crownWorld).addScaledVector(this.besideCamera(plant.crownWorld), 0.15);
    this.handPose.pos.y += 0.16 + this.pull * 0.46;
    // fingers point at the crown, forearm running out of frame to the side
    this.handPose.target.copy(plant.crownWorld).setY(plant.crownWorld.y + this.pull * 0.46);

    if (this.pull >= 0.995 && plant.tubers.every((t) => t.follow > 0.86)) {
      this.setPhase('shake');
      this.shakeDir = 0;
      this.shakeCount = 0;
    }
  }

  private updateShake() {
    const plant = this.plant;
    if (this.holding && Math.abs(this.pointer.dx) > 3.5) {
      const dir = Math.sign(this.pointer.dx);
      if (dir !== this.shakeDir) {
        this.shakeDir = dir;
        this.shakeCount++;
        plant.addShake(0.4);
        audio.grains();
        const c = plant.clusterCentre(new THREE.Vector3());
        this.particles.burst(c, 12, this.rng, 0.45, 0.5);
      }
    }
    this.handPose.vis = 1;
    this.handPose.vis = 0;

    if (this.shakeCount >= 4 || plant.mudLevel < 0.24) {
      this.setPhase('carry');
      this.carry = 0;
      this.carryFrom.copy(plant.cluster.position);
    }
  }

  private updateCarry(dt: number) {
    const plant = this.plant;
    const crateTop = this.crate.group.position.clone().add(new THREE.Vector3(0, 0.34, 0));
    if (this.holding) {
      const target = this.toScreen(crateTop);
      const dx = target.x - this.pointer.x;
      const dy = target.y - this.pointer.y;
      const len = Math.hypot(dx, dy) || 1;
      const along = (this.pointer.dx * dx + this.pointer.dy * dy) / len;
      const move = along > 0 ? along : Math.abs(along) * 0.15;
      this.carry = clamp01(this.carry + move / 260);
    }
    const k = easeOutCubic(this.carry);
    const mid = new THREE.Vector3().lerpVectors(this.carryFrom, crateTop, 0.5).add(new THREE.Vector3(0, 0.16, 0));
    const a = new THREE.Vector3().lerpVectors(this.carryFrom, mid, k);
    const b = new THREE.Vector3().lerpVectors(mid, crateTop, k);
    plant.cluster.position.lerpVectors(a, b, k);
    if (this.rng() < dt * (0.8 + this.carry * 2)) {
      this.particles.burst(plant.cluster.position, 2, this.rng, 0.2, 0.2);
    }

    this.handPose.vis = 1;
    this.handPose.pos.copy(plant.cluster.position).addScaledVector(this.besideCamera(plant.cluster.position), 0.15);
    this.handPose.pos.y += 0.15;
    this.handPose.target.copy(plant.cluster.position);

    if (this.carry >= 0.995) {
      audio.crateSet();
      // the crop stays with the crate from here on
      this.crate.group.attach(plant.cluster);
      this.setPhase('handoff');
      this.gustLeaves(this.nextPlant, 3.2);
      audio.leafRustle(0.9);
    }
  }

  private updateHandoff(dt: number) {
    const next = this.nextPlant;
    this.handPose.vis = damp(this.handPose.vis, 0, 3, dt);
    if (this.phaseTime > 0.6 && this.holding) {
      const gp = this.groundPoint(next.crownWorld.y + 0.02);
      if (gp) {
        // any touch near the next vine hands the row over to the child
        let bestD = Infinity;
        const q = new THREE.Vector3();
        for (let i = 0; i <= 24; i++) {
          next.vineCurve.getPointAt(i / 24, q);
          bestD = Math.min(bestD, q.distanceTo(gp));
        }
        if (bestD < 0.55) this.advance();
      }
    }
    if (this.phaseTime > 16) this.advance();
  }

  private advance() {
    this.index++;
    const plant = this.plant;
    this.ensurePlant(this.index + 1);
    this.ensurePlant(this.index + 2);
    this.trace = 0;
    this.lever = 0;
    this.plantCrack = 0;
    this.pull = 0;
    this.carry = 0;
    this.forkInsert = 0;
    this.forkPlaced = false;
    this.forkStowed = 0;
    this.forkDragged = false;
    this.crackRevealed = false;
    this.shakeCount = 0;
    this.forkRadius = 0.36;
    this.restFork(plant);
    this.crateTarget.set(0.86, 0, plant.crownWorld.z - 0.32);
    this.setPhase('trace');
  }

  /** Test hook: bare the whole hill in one step. */
  debugFillMask() {
    this.plant.digSite.fillAll();
  }

  /** Machine-readable snapshot used by the automated play-through. */
  debugState() {
    const plant = this.plant;
    return {
      phase: this.phase,
      hill: this.index,
      kind: plant.kind,
      trace: Number(this.trace.toFixed(3)),
      lever: Number(this.lever.toFixed(3)),
      cleared: Number(plant.digSite.cleared.toFixed(3)),
      exposed: plant.tubers.filter((t) => plant.isExposed(t)).length,
      tubers: plant.tubers.length,
      pull: Number(this.pull.toFixed(3)),
      mud: Number(plant.mudLevel.toFixed(3)),
      carry: Number(this.carry.toFixed(3)),
      fps: Math.round(this.engine.fps),
      tris: this.engine.renderer.info.render.triangles,
      calls: this.engine.renderer.info.render.calls,
      portrait: this.engine.viewport.portrait,
      crown: plant.crownWorld.toArray().map((v) => Number(v.toFixed(2))),
      vineTip: plant.vineTipWorld.toArray().map((v) => Number(v.toFixed(2))),
      crownScreen: this.toScreen(plant.crownWorld),
      vineTipScreen: this.toScreen(plant.vineTipWorld),
      forkHandleScreen: this.toScreen(this.fork.group.localToWorld(new THREE.Vector3(0, this.fork.handleY, 0))),
      clusterScreen: this.toScreen(plant.clusterCentre(new THREE.Vector3())),
      crateScreen: this.toScreen(this.crate.group.position.clone().setY(this.crate.group.position.y + 0.3)),
      vinePath: [0.05, 0.25, 0.45, 0.65, 0.85, 0.98].map((t) => this.toScreen(plant.vineCurve.getPointAt(t))),
      nextVinePath: [0.1, 0.35, 0.6, 0.85].map((t) => this.toScreen(this.nextPlant.vineCurve.getPointAt(t))),
    };
  }

  /* ------------------------------- frame ---------------------------- */

  update(dt: number, time: number) {
    this.time = time;
    this.phaseTime += dt;
    const plant = this.plant;

    this.sunViewDir.copy(this.engine.sunDir).transformDirection(this.engine.camera.matrixWorldInverse);

    switch (this.phase) {
      case 'trace':
        this.updateTrace(dt);
        break;
      case 'place':
        this.updatePlace(dt);
        break;
      case 'lever':
        this.updateLever(dt);
        break;
      case 'brush':
        this.updateBrush(dt);
        break;
      case 'pull':
        this.updatePull(dt);
        break;
      case 'shake':
        this.updateShake();
        break;
      case 'carry':
        this.updateCarry(dt);
        break;
      case 'handoff':
        this.updateHandoff(dt);
        break;
    }

    this.updateHints(dt);
    this.finger.update(dt);

    // gusts fade back into the ambient breeze
    const motion = settings.motionScale;
    if (this.gust > 0) {
      this.gust = Math.max(0, this.gust - dt * 1.1);
      this.gustPlant?.setWind((1 + this.gust) * motion);
      if (this.gust === 0) this.gustPlant?.setWind(motion);
    }
    this.scenery.setWind(motion);

    for (const p of this.plants.values()) p.update(dt, time, this.sunViewDir);
    this.scenery.update(time, this.sunViewDir);
    this.particles.update(dt, plant.crownWorld.y - 0.26);
    this.particles.pixelScale = this.engine.renderer.getPixelRatio();

    // crate follows the worker down the row, slowly
    const cy = terrainHeight(this.crateTarget.x, this.crateTarget.z);
    this.crate.group.position.x = damp(this.crate.group.position.x, this.crateTarget.x, 1.1, dt);
    this.crate.group.position.y = damp(this.crate.group.position.y, cy, 1.1, dt);
    this.crate.group.position.z = damp(this.crate.group.position.z, this.crateTarget.z, 1.1, dt);

    // hand
    if (this.handPose.vis > 0.01) {
      this.hand.visible = true;
      this.hand.position.lerp(this.handPose.pos, 1 - Math.exp(-6 * dt));
      this.hand.lookAt(this.handPose.target);
      this.hand.scale.setScalar(lerp(0.6, 1, clamp01(this.handPose.vis)));
    } else {
      this.hand.visible = false;
    }

    this.applyShot(dt);
    this.engine.focusShadow(plant.crownWorld);
  }
}
