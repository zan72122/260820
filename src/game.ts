import * as THREE from 'three';
import { Rng, clamp, lerp } from './util/rng';
import { AudioEngine } from './audio';
import { buildEnvironment, Environment } from './world/terrain';
import { WaterSystem } from './world/water';
import { Unicorn } from './world/unicorn';
import { MurkSystem, Streak } from './world/murk';
import { FishSchool, Rabbit } from './world/critters';
import { PointerInput } from './systems/input';
import { CameraDirector } from './systems/camera';

export type Phase = 'arrive' | 'approach' | 'ready' | 'discovery' | 'play' | 'reveal' | 'freeplay';

// The whole game bends toward two moments:
//  1) the first quarter-circle that pulls ONE filament up the spiral, and
//  2) the itch, right after, to try faster / bigger / backwards.
export class Game {
  phase: Phase = 'arrive';
  env: Environment;
  water: WaterSystem;
  unicorn: Unicorn;
  murk: MurkSystem;
  fish: FishSchool;
  rabbit: Rabbit;
  input: PointerInput;
  director: CameraDirector;
  audio: AudioEngine;
  time = 0;
  private phaseT = 0;
  private idleMark = 0;
  private nextRippleHint = 8;
  private nextDemoHint = 16;
  private demoT = -1;
  private tipInWater = false;
  private wasInWater = false;
  private splashTimer = 0;
  private discoveryHold = 0;
  hornLoad = 0; // wound murk units carried on the horn
  private transferState: 'idle' | 'aim' | 'run' = 'idle';
  private transferT = 0;
  private glanceT = 0;
  private powder: THREE.Points | null = null;
  private powderT = 0;
  private powderSeeds: Float32Array;
  onFreeplay: (() => void) | null = null;
  private tipV = new THREE.Vector3();

  constructor(
    public scene: THREE.Scene,
    public camera: THREE.PerspectiveCamera,
    canvas: HTMLElement,
    public rng: Rng,
    public e2e: boolean
  ) {
    this.audio = new AudioEngine();
    this.env = buildEnvironment(scene, rng, e2e);
    this.water = new WaterSystem(scene, rng, this.env.terrainHeight, e2e);
    this.unicorn = new Unicorn();
    this.unicorn.group.position.set(0, this.env.terrainHeight(0, -1.85), -1.85);
    this.unicorn.group.rotation.y = -0.08;
    scene.add(this.unicorn.group);
    this.unicorn.plantHooves(this.env.terrainHeight);
    this.murk = new MurkSystem(scene, this.water, this.unicorn, rng);
    this.fish = new FishSchool(scene, this.water, this.murk, rng, (x, z) => {
      this.water.splash(x, z, 0.8);
    });
    this.rabbit = new Rabbit(
      scene,
      this.env.terrainHeight,
      () => this.audio.lap(),
      (x, z) => this.water.splash(x, z, 1.2)
    );
    this.input = new PointerInput(canvas, camera);
    this.director = new CameraDirector(camera);

    // powder stream: horn → porous stone (dry mineral dust)
    const pCount = 70;
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pCount * 3), 3));
    this.powderSeeds = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i++) this.powderSeeds[i] = rng.next();
    this.powder = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        color: 0x57485c,
        size: 0.014,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    this.powder.frustumCulled = false;
    scene.add(this.powder);

    this.murk.onCleared = (s) => this.onStreakCleared(s);
    this.murk.onFirstWindDone = () => {
      this.audio.clearBloom();
      this.discoveryHold = 1.2; // the quiet beat: let the child SEE what she did
    };
    this.murk.onLoosen = () => this.audio.loosen();
  }

  private onStreakCleared(s: Streak) {
    if (this.phase !== 'discovery') this.audio.clearBloom();
    this.hornLoad += s.isMain ? 1 : 0.5;
    this.unicorn.setHornLoad(this.hornLoad / 6);
    if (this.murk.remainingMain() === 0 && (this.phase === 'play' || this.phase === 'discovery')) {
      this.setPhase('reveal');
    }
  }

  private setPhase(p: Phase) {
    this.phase = p;
    this.phaseT = 0;
    this.idleMark = this.time;
    switch (p) {
      case 'approach':
        this.director.transitionTo('medium', 1.9);
        break;
      case 'ready':
        this.director.transitionTo('close', 1.7, 0.5);
        this.nextRippleHint = 8;
        this.nextDemoHint = 16;
        break;
      case 'play':
        this.director.transitionTo('play', 2.6, 0.4);
        break;
      case 'reveal':
        this.director.transitionTo('reveal', 6);
        this.audio.birdsEnabled = true;
        this.fish.lively = true;
        this.rabbit.drinkNow();
        this.murk.activateWisps();
        break;
      case 'freeplay':
        this.director.transitionTo('free', 2.2, 0.45);
        if (this.onFreeplay) this.onFreeplay();
        break;
    }
  }

  replay() {
    this.water.clarity.reset();
    this.murk.reset();
    this.hornLoad = 0;
    this.unicorn.setHornLoad(0);
    this.env.setStoneDust(0);
    this.fish.lively = false;
    this.audio.birdsEnabled = false;
    this.rabbit.reset();
    this.transferState = 'idle';
    this.setPhase('ready');
  }

  clarityAvg(): number {
    return this.water.clarity.averageInPond();
  }

  update(dt: number) {
    this.time += dt;
    this.phaseT += dt;
    this.input.update(dt);
    const tapped = this.input.consumeTap();
    if (this.input.down) this.idleMark = this.time;

    // ---------- phase flow ----------
    switch (this.phase) {
      case 'arrive':
        if (this.phaseT > 4.4 || (tapped && this.phaseT > 0.8)) {
          this.setPhase('approach');
        }
        break;
      case 'approach':
        if (this.phaseT > 0.5) this.unicorn.setKneel(1);
        if (Math.abs(this.phaseT - 0.9) < dt) this.audio.hoof();
        if (Math.abs(this.phaseT - 1.5) < dt) this.audio.hoof(true);
        if (this.phaseT > 2.6) this.setPhase('ready');
        break;
      case 'ready': {
        // first discovery gate: a quarter circle with the tip in the water
        // near the intro filament
        if (
          this.input.down &&
          (this.tipInWater || this.unicorn.tipWorld(this.tipV).y < 0.1) &&
          Math.abs(this.input.accumAngle) > Math.PI / 2
        ) {
          const tip = this.unicorn.tipWorld(this.tipV);
          const c = this.murk.intro().centroid(new THREE.Vector3());
          if (tip.distanceTo(c) < 0.8 + this.input.radiusWorld * 2) {
            this.murk.beginFirstSequence();
            this.setPhase('discovery');
          }
        }
        this.runGuidance(dt);
        break;
      }
      case 'discovery':
        if (!this.murk.firstSequenceRunning() && this.discoveryHold > 0) {
          this.discoveryHold -= dt;
          if (this.discoveryHold <= 0 && this.phase === 'discovery') {
            this.setPhase('play');
          }
        }
        break;
      case 'reveal': {
        // clean water spreads across the whole spring during the pull-back
        const k = Math.min(this.phaseT / 5.5, 1);
        this.water.clarity.paint(0, 0, 0.3 + k * 1.5, dt * 0.45);
        if (this.phaseT > 6.4) this.setPhase('freeplay');
        break;
      }
    }

    // ---------- aiming ----------
    const interactive = this.phase === 'ready' || this.phase === 'discovery' || this.phase === 'play' || this.phase === 'reveal' || this.phase === 'freeplay';
    let aim: THREE.Vector3 | null = null;
    const stoneTop = this.env.stoneTop;
    let nearStone = false;
    if (interactive && this.input.down && this.input.groundPoint) {
      // the stone rises above the ground plane, so target it in screen space
      const sp = stoneTop.clone().project(this.camera);
      const w = window.innerWidth;
      const h = window.innerHeight;
      const sx = ((sp.x + 1) / 2) * w;
      const sy = ((1 - sp.y) / 2) * h;
      const dPix = Math.hypot(this.input.screen.x - sx, this.input.screen.y - h * 0.085 - sy);
      if (dPix < Math.min(w, h) * 0.16 && this.hornLoad > 0.01) nearStone = true;
      if (nearStone || this.transferState === 'run') {
        aim = stoneTop.clone().add(new THREE.Vector3(0, 0.1, 0));
      } else if (this.input.waterPoint) {
        aim = this.input.waterPoint.clone();
        aim.y = -0.055; // the tip settles just under the surface
      }
    } else if (this.demoT >= 0) {
      // silent demonstration: the unicorn lowers its horn briefly, no circle
      const c = this.murk.intro().centroid(new THREE.Vector3());
      const k = this.demoT;
      const dip = k < 0.6 ? k / 0.6 : k < 1.2 ? 1 : Math.max(0, 1 - (k - 1.2) / 0.5);
      aim = new THREE.Vector3(c.x, lerp(0.35, -0.04, dip), c.z);
      this.demoT += dt;
      if (this.demoT > 1.8) {
        this.demoT = -1;
        aim = null;
      }
    }
    this.unicorn.setAim(aim);

    // ---------- transfer to the purification stone ----------
    if (this.transferState === 'idle' && nearStone) {
      this.transferState = 'aim';
      this.transferT = 0;
    } else if (this.transferState === 'aim') {
      if (!nearStone) this.transferState = 'idle';
      else {
        this.transferT += dt;
        const tip = this.unicorn.tipWorld(this.tipV);
        if (this.transferT > 0.35 && tip.distanceTo(stoneTop) < 0.58) {
          this.transferState = 'run';
          this.transferT = 0;
          this.powderT = 0;
          this.audio.transferPowder();
        }
      }
    } else if (this.transferState === 'run') {
      this.transferT += dt;
      this.powderT += dt;
      this.updatePowder();
      if (this.transferT > 1.3) {
        this.env.setStoneDust(Math.min(1, this.env.getStoneDust() + this.hornLoad * 0.14));
        this.hornLoad = 0;
        this.unicorn.setHornLoad(0);
        this.transferState = 'idle';
        (this.powder!.material as THREE.PointsMaterial).opacity = 0;
      }
    }

    // ---------- tip / water contact ----------
    const tip = this.unicorn.tipWorld(this.tipV);
    this.tipInWater = tip.y < 0.01 && Math.hypot(tip.x, tip.z) < 1.5;
    if (this.tipInWater && !this.wasInWater) {
      this.audio.touchWater();
      this.water.splash(tip.x, tip.z, 1);
    }
    this.wasInWater = this.tipInWater;
    this.water.setTip(tip, this.tipInWater);
    if (this.tipInWater && this.input.down) {
      this.splashTimer -= dt;
      if (this.splashTimer <= 0) {
        this.splashTimer = this.input.circling ? 0.3 : 0.7;
        this.water.splash(tip.x, tip.z, 0.5 + this.input.angSpeed * 0.06);
      }
    }

    // ---------- murk ----------
    this.murk.update(dt, {
      phase: this.phase,
      tip,
      tipInWater: this.tipInWater,
      pointerDown: this.input.down,
      circling: this.input.circling,
      angSpeed: this.input.angSpeed,
      dirSign: this.input.dirSign,
      radiusWorld: this.input.radiusWorld,
      camera: this.camera,
    });
    if (!this.input.down) this.murk.releaseActive();

    // winding audio follows the child's real speed
    const winding = this.murk.active && this.murk.active.state === 'wind';
    this.audio.setWinding(winding ? 1 : 0, clamp(this.input.angSpeed / 9, 0, 1));

    // ---------- ears / glance ----------
    if (this.phase === 'ready') {
      const h = this.murk.intro().headPos(new THREE.Vector3());
      this.unicorn.setEarTarget(h);
    } else if (this.murk.active) {
      this.unicorn.setEarTarget(this.murk.active.centroid(new THREE.Vector3()));
    } else {
      const near = this.murk.nearestCapturable(tip, 2);
      this.unicorn.setEarTarget(near ? near.centroid(new THREE.Vector3()) : null);
    }
    if (this.hornLoad >= 2 && !this.input.down && (this.phase === 'play' || this.phase === 'freeplay')) {
      this.glanceT += dt;
      const cyc = this.glanceT % 8;
      this.unicorn.setGlance(cyc < 1.6 ? stoneTop : null);
    } else {
      this.unicorn.setGlance(null);
    }

    // ---------- world ----------
    this.unicorn.update(dt, this.time);
    this.water.update(dt);
    this.fish.update(dt, this.time);
    this.rabbit.update(dt, this.time);
    this.env.update(dt, this.time, this.camera);
    this.audio.update(dt);

    const interacting = this.input.down && this.tipInWater;
    this.director.update(dt, this.phase === 'arrive' ? null : tip, interacting);
  }

  private runGuidance(dt: number) {
    // Escalating, wordless, and only while the child hesitates.
    const idle = this.time - this.idleMark;
    if (idle > this.nextRippleHint) {
      const h = this.murk.intro().headPos(new THREE.Vector3());
      this.water.addRipple(h.x, h.z);
      this.nextRippleHint = idle + 12;
    }
    if (idle > this.nextDemoHint && this.demoT < 0) {
      this.demoT = 0;
      this.nextDemoHint = idle + 20;
    }
  }

  private updatePowder() {
    if (!this.powder) return;
    const tip = this.unicorn.tipWorld(new THREE.Vector3());
    const target = this.env.stoneTop;
    const attr = this.powder.geometry.attributes.position as THREE.BufferAttribute;
    const n = attr.count;
    const mat = this.powder.material as THREE.PointsMaterial;
    mat.opacity = clamp(Math.min(this.powderT * 3, (1.3 - this.powderT) * 3), 0, 0.85);
    for (let i = 0; i < n; i++) {
      const s0 = this.powderSeeds[i * 3];
      const s1 = this.powderSeeds[i * 3 + 1];
      const s2 = this.powderSeeds[i * 3 + 2];
      const k = clamp((this.powderT * 1.4 - s0 * 0.5) % 1.2, 0, 1);
      const x = lerp(tip.x, target.x, k) + Math.sin(k * 9 + s1 * 9) * 0.02;
      const y = lerp(tip.y, target.y, k) + Math.sin(k * Math.PI) * 0.08 - k * k * 0.05 + (s2 - 0.5) * 0.03;
      const z = lerp(tip.z, target.z, k) + Math.cos(k * 7 + s2 * 8) * 0.02;
      attr.setXYZ(i, x, y, z);
    }
    attr.needsUpdate = true;
  }
}
