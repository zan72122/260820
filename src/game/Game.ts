import * as THREE from 'three';
import { Quality } from '../gfx/quality';
import { Environment } from '../world/Environment';
import { Field, PLANT_SPACING, RIDGE_HEIGHT, ROW_SPACING } from '../world/Field';
import { HeroPlant, PlantAssets, type PlantVariant } from '../world/Plant';
import { Harvester } from '../world/Harvester';
import { Debris } from '../world/Debris';
import { GameAudio } from '../audio/Audio';
import { CameraRig, type Anchors } from './CameraRig';
import { Input } from './Input';
import { Hints, arcPath, forwardPath, leverPath, shakePath } from './Hints';
import { makeRng } from '../gfx/textures';

export type Phase = 'idle' | 'lower' | 'advance' | 'shake' | 'flip' | 'reveal' | 'survey' | 'reposition';

interface RunPlant {
  p: HeroPlant;
  x: number;
  u: number;
  state: 'standing' | 'convey' | 'flip' | 'laid';
  flipT: number;
  hero: boolean;
  layAt: THREE.Vector3;
  layJitter: THREE.Vector3;
  layYaw: number;
}

const HERO_COUNT = 12;
const CONVEY_RATE_IDLE = 0.055;
const CONVEY_RATE_MOVING = 0.16;

/**
 * 畝の裏側 — the whole game.
 *
 * One ridge, one machine, one finger. Lower the lever, move forward, shake the
 * soil off, turn the plants over. The only thing the player is ever asked to
 * discover is what is underneath the leaves.
 */
export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  private quality: Quality;
  private env: Environment;
  private field: Field;
  private assets: PlantAssets;
  private machine: Harvester;
  private debris: Debris;
  readonly audio = new GameAudio();
  private rig = new CameraRig();
  private input: Input;
  private hints: Hints;

  private lastFrameMs = 0;
  /** ?step=0.1 advances the simulation a fixed amount per frame, so a test
   *  run does not depend on how fast the host can actually render. */
  private fixedStep = 0;
  private plants: RunPlant[] = [];
  private runGroup = new THREE.Group();

  phase: Phase = 'idle';
  round = 0;
  private machineX = 0;
  private rowIndex = 0;
  private speed = 0;
  private lift = 0;
  private flipT = 0;
  private revealT = 0;
  private shakeShed = 0;
  private repositionT = 0;
  private repositionFrom = new THREE.Vector3();
  private hasTouched = false;
  private phaseTime = 0;
  private simTime = 0;
  private stallTime = 0;
  private idleHintStage = 0;
  private idleTimer = 0;
  private hintCooldown = 0;
  private lastRevealSound = false;
  private started = false;
  private conveyorSpeed = 0;
  private tmp = new THREE.Vector3();
  private shadowFocus = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private screen = new THREE.Vector2();
  private anchors: Anchors = {
    machine: new THREE.Vector3(),
    blade: new THREE.Vector3(),
    conveyor: new THREE.Vector3(),
    plant: new THREE.Vector3(),
    rowZ: 0,
    flipT: 0,
  };
  fps = 0;

  constructor(private container: HTMLElement, fast: boolean) {
    this.hints = new Hints(container);
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !fast,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      preserveDrawingBuffer: new URLSearchParams(location.search).get('capture') === '1',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = fast ? THREE.BasicShadowMap : THREE.PCFShadowMap;

    const stepParam = new URLSearchParams(location.search).get('step');
    if (stepParam) this.fixedStep = Math.min(0.2, Math.max(0.005, Number(stepParam) || 0));

    this.quality = new Quality(this.renderer, fast);
    this.renderer.setPixelRatio(this.quality.maxPixelRatio);

    this.env = new Environment(this.scene, this.renderer, this.quality);
    this.assets = new PlantAssets();
    this.field = new Field(this.assets, this.quality);
    this.scene.add(this.field.group);
    this.machine = new Harvester();
    this.scene.add(this.machine.group);
    this.debris = new Debris(this.quality);
    this.scene.add(this.debris.group);
    this.scene.add(this.runGroup);

    this.debris.onLand = (size, bounce) => {
      if (bounce === 0) this.audio.clod(size, 0.3);
    };

    this.input = new Input(canvas);
    canvas.addEventListener(
      'pointerdown',
      () => {
        this.hasTouched = true;
        this.audio.start();
        this.audio.resume();
        this.hints.stop();
      },
      { passive: true }
    );

    // a quality change resizes the drawing buffer, not just the pixel ratio
    this.quality.onChange(() => this.resize());

    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.audio.resume();
    });

    this.startRun(0);
    this.rig.prime(this.anchors);
  }

  /* ------------------------------------------------------------- layout */

  private resize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(this.quality.maxPixelRatio);
    this.renderer.setSize(w, h, false);
    this.hints.resize(w, h);
  };

  /* ---------------------------------------------------------------- run */

  /**
   * Set up a ridge to work. Nothing about the rules changes between runs, only
   * the crop: how many pods, how big, how damp the soil is, how much of it
   * clings to the roots and how the finished row lies.
   */
  private startRun(round: number) {
    this.round = round;
    const rng = makeRng(1000 + round * 137);
    // the field is finite, so past the last row the machine starts over on
    // the first one; the crop grows back and the row is worked again
    this.rowIndex = round % this.field.ridges.length;
    const ridge = this.field.ridgeAt(this.rowIndex);

    const keep = this.plants.filter((rp) => rp.state === 'laid').slice(-24);
    for (const rp of this.plants) {
      if (!keep.includes(rp)) {
        this.runGroup.remove(rp.p.group);
        rp.p.dispose();
      }
    }
    this.plants = keep;

    const wetness = rng();
    const variantBase = {
      podCount: 18 + Math.floor(rng() * 17),
      podScale: 0.86 + rng() * 0.42,
      podSpread: 0.05 + rng() * 0.038,
      clumpCount: 10 + Math.floor(rng() * 9),
      wetness,
    };

    const firstX = 1.0;
    for (let i = 0; i < HERO_COUNT; i++) {
      const variant: PlantVariant = {
        ...variantBase,
        podCount: Math.max(12, variantBase.podCount + Math.floor((rng() - 0.5) * 8)),
        podScale: variantBase.podScale * (0.9 + rng() * 0.22),
        seed: 7000 + round * 991 + i * 37,
      };
      const p = new HeroPlant(this.assets, variant);
      const x = firstX + i * PLANT_SPACING;
      p.group.position.set(x, RIDGE_HEIGHT - 0.015, ridge.z + (rng() - 0.5) * 0.06);
      p.group.rotation.y = rng() * Math.PI * 2;
      this.runGroup.add(p.group);
      const rp: RunPlant = {
        p,
        x,
        u: 0,
        state: 'standing',
        flipT: 0,
        hero: i === 0,
        // the finished row lies a little differently every time; the exact
        // spot is fixed when the plant leaves the kickers
        layAt: new THREE.Vector3(0, 0.115, ridge.z),
        layJitter: new THREE.Vector3((rng() - 0.5) * 0.2, 0, (rng() - 0.5) * 0.24),
        layYaw: (rng() - 0.5) * 0.7,
      };
      this.plants.push(rp);
      if (i === 0) this.heroRef = rp;
    }
    // a re-worked ridge closes up and grows back before the machine starts
    ridge.restoreCrop();
    ridge.resetDig(-999);
    // then the scenery crop steps aside for the plants the player will work
    ridge.hideRange(firstX - 0.3, firstX + HERO_COUNT * PLANT_SPACING + 0.3);

    this.machineX = 0;
    this.speed = 0;
    this.lift = 0;
    this.flipT = 0;
    this.revealT = 0;
    this.shakeShed = 0;
    this.machine.applyLift(0);
    this.machine.group.position.set(this.machineX, 0, ridge.z);
    this.setPhase('idle');
    this.idleHintStage = 0;
    this.idleTimer = 0;
    this.updateAnchors();
  }

  private setPhase(p: Phase) {
    if (this.phase === p) return;
    this.phase = p;
    this.phaseTime = 0;
    this.stallTime = 0;
    this.idleHintStage = 0;
    this.idleTimer = 0;
    this.hints.stop();
  }

  private heroRef: RunPlant | null = null;

  /** The plant this run is about: still the anchor after it has been laid. */
  private get hero(): RunPlant | undefined {
    return this.heroRef ?? undefined;
  }

  /* -------------------------------------------------------------- update */

  private updateAnchors() {
    const ridge = this.field.ridgeAt(this.rowIndex);
    this.anchors.machine.set(this.machineX, 0, ridge.z);
    this.machine.bladeWorld(this.anchors.blade);
    this.machine.conveyorPoint(0.45, this.anchors.conveyor);
    const h = this.hero;
    if (h) this.anchors.plant.copy(h.p.group.position);
    else this.anchors.plant.set(this.machineX - 2.2, 0.2, ridge.z);
    // during the reveal the eye belongs on the pods, not the plant's origin
    if (h && h.state === 'laid') this.anchors.plant.y = Math.max(this.anchors.plant.y, 0.16);
    this.anchors.rowZ = ridge.z;
    this.anchors.flipT = this.flipT;
  }

  private handleIdleHints(dt: number) {
    this.idleTimer += dt;
    this.hintCooldown = Math.max(0, this.hintCooldown - dt);
    if (this.input.isDown) {
      this.idleTimer = 0;
      return;
    }
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    // stage 1 at 3 s: the machine itself asks, with no interface at all
    if (this.idleTimer > 3 && this.idleHintStage < 1) {
      this.idleHintStage = 1;
    }
    // stage 2 at 6 s: one short translucent trail, showing the shape of the
    // gesture and nothing about its result
    if (this.idleTimer > 6 && this.idleHintStage < 2 && this.hintCooldown <= 0) {
      this.idleHintStage = 2;
      this.hintCooldown = 9;
      switch (this.phase) {
        case 'idle':
        case 'lower': {
          this.machine.leverWorld(this.tmp);
          this.rig.project(this.tmp, w, h, this.screen);
          this.hints.play(leverPath(this.screen.clone(), h));
          break;
        }
        case 'advance':
          this.hints.play(forwardPath(w, h));
          break;
        case 'shake': {
          this.rig.project(this.anchors.conveyor, w, h, this.screen);
          this.hints.play(shakePath(this.screen.clone(), w), 2.3);
          break;
        }
        case 'flip': {
          this.rig.project(this.anchors.plant, w, h, this.screen);
          this.hints.play(arcPath(this.screen.clone(), w, h), 2.1);
          break;
        }
        case 'survey':
          this.hints.play(forwardPath(w, h));
          break;
        default:
          break;
      }
      // back to stage 1, so a long hesitation can bring the trail back once
      // the cooldown has run out
      this.idleHintStage = 1;
      this.idleTimer = 0;
    }
    // the driver only looks at the lever while the lever is the answer
    const wantsLever = this.phase === 'idle' || this.phase === 'lower';
    this.machine.lookAtLever = wantsLever && this.idleHintStage >= 1 ? 1 : 0;
  }

  private stepIdle() {
    // a few millimetres of vibration in the lever: an invitation, not a label
    if (this.idleHintStage >= 1) {
      this.machine.nudgeLever(Math.sin(this.phaseTime * 34) * 0.012);
    }
    const down = this.input.consumeDown();
    if (down > 0.004) {
      this.setPhase('lower');
      this.applyLower(down);
    }
  }

  private applyLower(down: number) {
    const gain = this.input.startedOnLever ? 3.0 : 2.0;
    const before = this.lift;
    this.lift = Math.min(1, this.lift + down * gain);
    if (this.lift > before) {
      this.stallTime = 0;
      this.machine.applyLift(this.lift);
      if (Math.floor(before * 4) !== Math.floor(this.lift * 4)) this.audio.hydraulic(true);
      // the crust splits from the moment the share touches it, not when the
      // stroke finishes
      if (this.lift > 0.5) this.field.ridgeAt(this.rowIndex).setDig(this.anchors.blade.x);
      // the moment steel meets soil, in the same frame as the lever
      if (before < 0.52 && this.lift >= 0.52) {
        this.audio.bladeEnter();
        this.machine.bladeWorld(this.tmp);
        for (let i = 0; i < 8; i++) this.debris.spawnClod(this.tmp, 0.7, 0.4, 0.7);
        this.debris.spawnDust(this.tmp, 1.1);
      }
      if (this.lift >= 1) this.setPhase('advance');
    }
  }

  private stepLower(dt: number) {
    const down = this.input.consumeDown();
    if (down > 0) this.applyLower(down);
    else {
      this.stallTime += dt;
      // if a small hand runs out of screen, the cylinder keeps going slowly
      if (this.hasTouched && this.stallTime > 3.5 && this.lift > 0.05) {
        this.applyLower(dt * 0.09);
      }
    }
  }

  private stepAdvance(dt: number) {
    const fwd = this.input.consumeForward();
    if (fwd > 0.002) {
      this.speed = Math.min(1.7, this.speed + fwd * 6.5);
      this.stallTime = 0;
    } else {
      this.stallTime += dt;
      if (this.hasTouched && this.stallTime > 4 && this.speed < 0.1) this.speed = 0.28;
    }
    // any sideways work still counts: nothing the child does is wasted
    const lat = this.input.consumeLateral();
    if (lat.travel > 0) this.addShake(lat.travel, lat.reversals);
  }

  private addShake(travel: number, reversals: number) {
    const energy = travel * 0.9 + reversals * 0.12;
    if (energy <= 0) return;
    this.shakeShed = Math.min(1, this.shakeShed + energy * 0.22);
    for (const rp of this.plants) if (rp.state === 'convey') rp.p.shake(energy * 1.6);
    if (energy > 0.02) this.audio.rustle(Math.min(1, energy * 3));
    this.stallTime = 0;
  }

  private stepFlip(dt: number) {
    const h = this.hero;
    if (!h) {
      this.setPhase('advance');
      return;
    }
    const arc = this.input.consumeArc();
    const lat = this.input.consumeLateral();
    const fwd = this.input.consumeForward();
    const down = this.input.consumeDown();
    // a big sweep is ideal, but any decisive movement turns the plant over
    const drive = arc * 0.5 + (lat.travel + fwd + down) * 0.5;
    if (drive > 0.002) this.stallTime = 0;
    else this.stallTime += dt;
    let step = drive * 0.5;
    if (this.hasTouched && this.stallTime > 3.5) step += dt * 0.16;
    if (this.flipT > 0.02) step = Math.max(step, dt * 0.3); // once it commits, it completes
    // the turn always takes about a second and a half, however hard the sweep:
    // this is the moment the whole game exists for, and it has to be readable
    this.flipT = Math.min(1, this.flipT + Math.min(step, dt * 0.72));
    if (this.flipT > 0.03 && !this.lastRevealSound) {
      this.lastRevealSound = true;
      // the machine drops away so the crop can be heard turning over
      this.audio.duckMachine(1.9, 0.2);
    }
  }

  /** Where this plant comes to rest: just behind the kickers, right now. */
  private setLayPoint(rp: RunPlant) {
    const ridge = this.field.ridgeAt(this.rowIndex);
    rp.layAt.set(this.machineX - 2.4 + rp.layJitter.x, 0.115, ridge.z + rp.layJitter.z);
  }

  private updatePlants(dt: number) {
    const ridge = this.field.ridgeAt(this.rowIndex);
    const bladeX = this.anchors.blade.x;
    const conveyRate = CONVEY_RATE_IDLE + this.speed * CONVEY_RATE_MOVING;

    for (const rp of this.plants) {
      const p = rp.p;
      switch (rp.state) {
        case 'standing': {
          if (this.lift > 0.5 && bladeX > rp.x) {
            rp.state = 'convey';
            rp.u = 0;
            this.audio.clod(0.9, 0.4);
            for (let i = 0; i < 6; i++) {
              this.tmp.set(rp.x, 0.1, ridge.z + (Math.random() - 0.5) * 0.3);
              this.debris.spawnClod(this.tmp, 0.9, 0.5, 0.8);
            }
            this.debris.spawnDust(p.group.position, 1.0);
          }
          break;
        }
        case 'convey': {
          rp.u = Math.min(1, rp.u + dt * conveyRate);
          if (rp.u < 0.15) {
            // out of the ground: still packed with soil, roots first
            const k = rp.u / 0.15;
            const s = k * k * (3 - 2 * k);
            this.machine.conveyorPoint(0, this.tmp);
            this.tmp2.set(rp.x, RIDGE_HEIGHT - 0.015, ridge.z);
            p.group.position.lerpVectors(this.tmp2, this.tmp, s);
            p.body.rotation.z = -0.5 * s;
          } else {
            const cu = (rp.u - 0.15) / 0.8;
            this.machine.conveyorPoint(Math.min(1, cu), p.group.position);
            p.body.rotation.z = -0.5 - Math.sin(rp.u * 9) * 0.06 * Math.min(1, this.conveyorSpeed);
            const base = 1 - Math.min(1, cu) * 0.5;
            p.setSoil(Math.max(0.02, base - this.shakeShed * 0.75), (w, size, wet) => {
              this.debris.spawnClod(w, size, wet, 0.6);
            });
          }
          if (rp.u >= 1) {
            if (rp.hero) {
              // the lead plant waits at the kickers for the player's sweep
              if (this.phase === 'advance' || this.phase === 'shake') this.setPhase('flip');
              if (this.phase === 'flip') {
                rp.state = 'flip';
                rp.flipT = this.flipT;
                this.setLayPoint(rp);
              }
            } else {
              rp.state = 'flip';
              rp.flipT = 0;
              this.setLayPoint(rp);
            }
          }
          break;
        }
        case 'flip': {
          const t = rp.hero ? this.flipT : Math.min(1, rp.flipT + dt * 1.5);
          rp.flipT = t;
          const s = t * t * (3 - 2 * t);
          this.machine.conveyorPoint(1, this.tmp);
          p.group.position.lerpVectors(this.tmp, rp.layAt, s);
          p.group.position.y += Math.sin(s * Math.PI) * 0.12;
          p.body.rotation.x = Math.PI * s;
          p.body.rotation.z = -0.5 * (1 - s);
          p.group.rotation.y += (rp.layYaw - p.group.rotation.y) * Math.min(1, dt * 3);
          // the pods swing clear only as the plant comes over
          p.setPodReveal(Math.max(0, (t - 0.35) / 0.5));
          p.setSoil(Math.max(0.02, 0.4 - this.shakeShed * 0.5 - t * 0.3), (w, size, wet) => {
            this.debris.spawnClod(w, size, wet, 0.5);
          });
          if (t >= 1) {
            rp.state = 'laid';
            p.setPodReveal(1);
            this.audio.vineLand();
            this.debris.spawnDust(rp.layAt, 1.3);
            for (let i = 0; i < 4; i++) this.debris.spawnClod(rp.layAt, 0.5, 0.4, 0.5);
            if (rp.hero) {
              this.setPhase('reveal');
              this.revealT = 0;
            }
          }
          break;
        }
        case 'laid':
          break;
      }
      p.update(dt);
    }
  }

  /* --------------------------------------------------------------- loop */

  private step(dt: number) {
    this.phaseTime += dt;
    this.simTime += dt;
    const ridge = this.field.ridgeAt(this.rowIndex);

    this.handleIdleHints(dt);

    switch (this.phase) {
      case 'idle':
        this.stepIdle();
        break;
      case 'lower':
        this.stepLower(dt);
        break;
      case 'advance': {
        this.stepAdvance(dt);
        const h = this.hero;
        if (h && h.state === 'convey' && h.u > 0.3) this.setPhase('shake');
        break;
      }
      case 'shake': {
        const lat = this.input.consumeLateral();
        this.addShake(lat.travel, lat.reversals);
        const fwd = this.input.consumeForward();
        if (fwd > 0.002) this.speed = Math.min(1.7, this.speed + fwd * 5.5);
        this.stallTime += dt;
        break;
      }
      case 'flip':
        this.stepFlip(dt);
        break;
      case 'reveal':
        this.revealT += dt;
        // hold: soil finishes falling, the whole underside stays on screen
        if (this.revealT > 2.0) this.setPhase('survey');
        break;
      case 'survey': {
        const fwd = this.input.consumeForward();
        const arc = this.input.consumeArc();
        const lat = this.input.consumeLateral();
        if (this.phaseTime > 1.2 && (fwd > 0.01 || arc > 0.05 || lat.travel > 0.05)) {
          this.repositionT = 0;
          this.repositionFrom.set(this.machineX, 0, ridge.z);
          this.setPhase('reposition');
        }
        break;
      }
      case 'reposition': {
        // the machine lines itself up on the next ridge: no driving to learn
        this.repositionT = Math.min(1, this.repositionT + dt * 0.55);
        const t = this.repositionT;
        const s = t * t * (3 - 2 * t);
        const nextZ = -((this.round + 1) % this.field.ridges.length) * ROW_SPACING;
        this.machineX = THREE.MathUtils.lerp(this.repositionFrom.x, 0, s);
        this.machine.group.position.set(
          this.machineX,
          0,
          THREE.MathUtils.lerp(this.repositionFrom.z, nextZ, s)
        );
        this.lift = Math.max(0, 1 - s * 1.6);
        this.machine.applyLift(this.lift);
        if (t >= 1) {
          this.flipT = 0;
          this.lastRevealSound = false;
          this.startRun(this.round + 1);
        }
        break;
      }
    }

    // travel
    if (this.phase === 'advance' || this.phase === 'shake') {
      this.speed = Math.max(0, this.speed - dt * 0.75);
      this.machineX += this.speed * dt;
      const last = this.plants[this.plants.length - 1];
      const limit = last ? last.x + 0.6 : this.machineX;
      if (this.machineX > limit) {
        this.machineX = limit;
        this.speed = 0;
      }
      this.machine.group.position.x = this.machineX;
      if (this.lift > 0.5) {
        ridge.setDig(this.anchors.blade.x);
        // soil boils away from the shares while they are cutting
        if (this.speed > 0.05 && Math.random() < this.speed * 0.9) {
          this.tmp.copy(this.anchors.blade).add(
            new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.05, (Math.random() - 0.5) * 0.5)
          );
          this.debris.spawnClod(this.tmp, 0.7, 0.4, 0.9);
        }
      }
    } else if (this.phase !== 'reposition') {
      this.speed = Math.max(0, this.speed - dt * 1.6);
    }

    this.conveyorSpeed =
      this.phase === 'idle' || this.phase === 'lower' ? 0.25 : 0.6 + Math.min(1, this.speed) * 0.9;
    this.machine.conveyorSpeed = this.conveyorSpeed;
    this.machine.update(dt, this.speed);
    this.updateAnchors();
    this.updatePlants(dt);

    // camera chain
    const shot = this.pickShot();
    this.rig.setShot(shot, this.phase === 'flip' || this.phase === 'reveal' ? 1.5 : 1.05);

    // sound
    this.audio.setEngine(1, Math.min(1, this.speed * 0.7 + this.lift * 0.3));
    this.audio.setConveyor(this.phase === 'idle' ? 0.15 : Math.min(1, 0.35 + this.speed * 0.6));

    this.shadowFocus.copy(this.anchors.plant).lerp(this.anchors.blade, 0.4);
    this.env.focusShadow(this.shadowFocus);
  }

  private pickShot() {
    switch (this.phase) {
      case 'idle':
        return 'establish' as const;
      case 'lower':
        return this.lift > 0.5 ? ('bladeEntry' as const) : ('lever' as const);
      case 'advance':
        return 'follow' as const;
      case 'shake':
        return 'conveyor' as const;
      case 'flip':
        return 'flip' as const;
      case 'reveal':
        return 'reveal' as const;
      case 'survey':
      case 'reposition':
        return 'survey' as const;
    }
  }

  private frame = () => {
    const now = performance.now();
    const dt = this.fixedStep || Math.min(0.05, Math.max(0.0005, (now - this.lastFrameMs) / 1000));
    this.lastFrameMs = now;
    this.fps = this.fps * 0.9 + (1 / Math.max(0.001, dt)) * 0.1;

    this.step(dt);

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.rig.update(dt, w / h, this.anchors);

    // keep the lever hot spot on the actual lever, whatever the camera does
    this.machine.leverWorld(this.tmp);
    this.rig.project(this.tmp, w, h, this.screen);
    this.input.setLeverHotspot(this.screen, Math.max(76, Math.min(w, h) * 0.17));

    this.assets.uniforms.uTime.value += dt;
    this.debris.update(dt, this.rig.camera.quaternion);
    this.hints.update(dt);

    this.renderer.render(this.scene, this.rig.camera);

    this.quality.sample(dt, now);
    requestAnimationFrame(this.frame);
  };

  start() {
    if (this.started) return;
    this.started = true;
    this.lastFrameMs = performance.now();
    requestAnimationFrame(this.frame);
  }

  /** Read-only snapshot used by the smoke test and by nobody else. */
  debugState() {
    const h = this.hero;
    const w = this.container.clientWidth || window.innerWidth;
    const hh = this.container.clientHeight || window.innerHeight;
    this.machine.leverWorld(this.tmp);
    this.rig.project(this.tmp, w, hh, this.screen);
    return {
      leverScreen: [Math.round(this.screen.x), Math.round(this.screen.y)] as [number, number],
      viewport: [w, hh] as [number, number],
      phase: this.phase,
      round: this.round,
      lift: Number(this.lift.toFixed(3)),
      machineX: Number(this.machineX.toFixed(3)),
      flipT: Number(this.flipT.toFixed(3)),
      heroU: h ? Number(h.u.toFixed(3)) : -1,
      heroState: h ? h.state : 'none',
      heroSoil: h ? Number(h.p.soilLevel.toFixed(3)) : -1,
      laid: this.plants.filter((p) => p.state === 'laid').length,
      plantPos: h ? h.p.group.position.toArray().map((v) => Number(v.toFixed(2))) : null,
      camPos: this.rig.camera.position.toArray().map((v) => Number(v.toFixed(2))),
      podReveal: h ? Number(h.p.podRevealLevel.toFixed(3)) : 0,
      simTime: Number(this.simTime.toFixed(2)),
      tier: this.quality.tier,
      fps: Math.round(this.fps),
      hintPlaying: this.hints.playing,
      hint: this.hints.debug(),
      audio: this.audio.started,
    };
  }
}
