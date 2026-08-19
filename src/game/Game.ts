import * as THREE from 'three';
import { Renderer } from '../engine/Renderer';
import { PointerInput } from '../engine/PointerInput';
import { Config } from '../engine/config';
import { MaterialLibrary, updateCreamLighting } from '../scene/materials';
import { LAYOUT, Patisserie } from '../scene/Patisserie';
import { FlowerNail } from '../scene/FlowerNail';
import { PipingBag, Lifter } from '../scene/Tools';
import { Flower } from './Flower';
import { CameraDirector } from './CameraDirector';
import { Ghost } from '../ui/Ghost';
import { Hud } from '../ui/Hud';
import { Sfx } from '../audio/Sfx';
import { CONE, CREAM_COLORS, LAYERS, NAIL_RADIUS } from './flowerParams';
import type { TrailSample } from './PetalShaper';
import { clamp, damp, Rng } from '../util/math';

export type Act = 'parchment' | 'core' | 'petals' | 'lift' | 'carry' | 'done';

const ACT_STEP: Record<Act, number> = {
  parchment: 0,
  core: 1,
  petals: 2,
  lift: 3,
  carry: 3,
  done: 4,
};

interface Tween {
  obj: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  fromQ: THREE.Quaternion;
  toQ: THREE.Quaternion;
  t: number;
  dur: number;
  done?: () => void;
}

export class Game {
  act: Act = 'parchment';
  readonly patisserie: Patisserie;
  readonly nail: FlowerNail;
  readonly bag: PipingBag;
  readonly lifter: Lifter;
  readonly director: CameraDirector;
  readonly ghost: Ghost;
  readonly hud = new Hud();
  readonly sfx = new Sfx();

  flower: Flower;
  flowersPlaced = 0;
  /** Flowers already sitting on the cake; they keep their own settling sway. */
  private placed: Flower[] = [];
  private flowerIsPlaced = false;
  private colorIndex = 0;
  private rng: Rng;
  private mats: MaterialLibrary;

  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private ray = new THREE.Raycaster();
  private hitWorld = new THREE.Vector3();
  private hitLocal = new THREE.Vector3();
  private tmp = new THREE.Vector3();

  private extruding = false;
  private strokeStart = 0;
  private samples: TrailSample[] = [];
  private lastSample = new THREE.Vector3();
  private coneChimed = false;
  private draggingParchment = false;
  private carrying = false;
  private tweens: Tween[] = [];
  private cakeTarget = new THREE.Mesh();
  private ghostShownForLayer = -1;
  private tipTarget = new THREE.Vector3();
  private firstFlowerDone = false;
  private lastRealTime = performance.now();

  /** Test/debug telemetry. */
  readonly stats = { petals: 0, coneHeight: 0, flowers: 0, drawCalls: 0 };

  constructor(private renderer: Renderer, private pointer: PointerInput) {
    this.rng = new Rng(Config.seed);
    this.mats = new MaterialLibrary();
    this.patisserie = new Patisserie(this.mats, renderer.scene);
    this.nail = new FlowerNail(this.mats, renderer.scene);
    this.bag = new PipingBag(this.mats, renderer.scene, new THREE.Color(CREAM_COLORS[0].hex));
    this.lifter = new Lifter(this.mats, renderer.scene);
    this.director = new CameraDirector(renderer.camera);
    this.ghost = new Ghost(this.nail.flowerRoot);

    this.colorIndex = Math.floor(this.rng.next() * CREAM_COLORS.length);
    this.flower = this.spawnFlower();

    // soft ring showing where the flower wants to land on the cake
    this.cakeTarget = new THREE.Mesh(
      new THREE.RingGeometry(0.016, 0.021, 40),
      new THREE.MeshBasicMaterial({
        color: 0xfff0d4,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.cakeTarget.rotation.x = -Math.PI / 2;
    this.patisserie.cake.add(this.cakeTarget);

    this.hud.onDone = () => this.finishPetals();
    this.hud.onChoice = (same) => this.nextRound(same);
    this.hud.onMute = (m) => {
      this.sfx.muted = m;
      if (m) {
        this.sfx.setExtrude(0);
        this.sfx.setSpin(0);
      }
    };

    this.pointer.on((kind) => this.onPointer(kind));
    this.enterAct('parchment');
    this.director.update(0, renderer.viewport, true);
  }

  // ---------------------------------------------------------------- flowers

  private spawnFlower(): Flower {
    const f = new Flower(
      CREAM_COLORS[this.colorIndex].hex,
      Math.floor(this.rng.next() * 1e9),
      this.mats.creamStreak,
    );
    this.nail.flowerRoot.add(f.group);
    this.flowerIsPlaced = false;
    this.bag?.setCreamColor(new THREE.Color(CREAM_COLORS[this.colorIndex].hex));
    return f;
  }

  private cakeSlot(index: number, out: THREE.Vector3) {
    if (index === 0) return out.set(0, LAYOUT.cakeTop - LAYOUT.cake.y, 0);
    const a = (index - 1) * ((Math.PI * 2) / 5) + 0.4;
    return out.set(Math.cos(a) * 0.032, LAYOUT.cakeTop - LAYOUT.cake.y, Math.sin(a) * 0.032);
  }

  // ------------------------------------------------------------------- acts

  private enterAct(act: Act) {
    this.act = act;
    if (act !== 'carry') this.director.followWeight = 0;
    this.hud.setStep(ACT_STEP[act]);
    this.hud.showDone(false);
    this.hud.showChoices(0, 0, false);
    switch (act) {
      case 'parchment':
        this.director.set('tools');
        this.nail.spinSpeed = 0;
        this.hud.setHint('drag');
        this.ghost.hide();
        break;
      case 'core':
        this.director.set('core');
        this.nail.spinSpeed = 0.14;
        this.hud.setHint('press');
        this.ghost.showCentre(0);
        break;
      case 'petals':
        this.director.set('petals');
        this.nail.spinSpeed = 0.1;
        this.hud.setHint('draw');
        this.showGhostForLayer(true);
        break;
      case 'lift':
        this.director.set('transfer');
        this.nail.spinSpeed = 0;
        this.hud.setHint('lift');
        this.ghost.hide();
        this.placeLifterStart();
        break;
      case 'carry':
        this.director.set('transfer');
        this.hud.setHint('place');
        break;
      case 'done':
        this.director.set('finish');
        this.hud.setHint('none');
        this.hud.showChoices(
          CREAM_COLORS[this.colorIndex].hex,
          CREAM_COLORS[(this.colorIndex + 1) % CREAM_COLORS.length].hex,
          true,
        );
        break;
    }
    if (Config.debug) console.info('[act]', act);
  }

  private showGhostForLayer(force = false) {
    const li = this.flower.layerIndex;
    if (!force && this.ghostShownForLayer === li) return;
    this.ghostShownForLayer = li;
    // Show the invitation only for the very first petal of each layer.
    if (this.flower.petalsInLayer === 0) {
      const cam = this.renderer.camera.position;
      const front = Math.atan2(
        cam.z - this.nail.group.position.z,
        cam.x - this.nail.group.position.x,
      );
      this.ghost.showPetalPath(LAYERS[li], this.flower.coneHeight, front - this.nail.spinner.rotation.y);
    } else {
      this.ghost.hide();
    }
  }

  private placeLifterStart() {
    const origin = this.nail.worldOrigin(this.tmp).clone();
    this.lifter.group.visible = true;
    this.lifter.group.position.set(origin.x + 0.07, origin.y - 0.004, origin.z + 0.075);
    this.lifter.group.rotation.set(0, -0.5, 0);
  }

  // --------------------------------------------------------------- pointing

  /** Height of the plane the finger is projected onto for the current act. */
  private workPlaneY(): number {
    const originY = this.nail.worldOrigin(this.tmp).y;
    switch (this.act) {
      case 'parchment':
        // Once lifted, the square travels at nail-head height, so what the eye
        // aims at and what the finger controls are the same thing.
        return this.draggingParchment ? originY + 0.004 : LAYOUT.nail.y + 0.001;
      case 'core':
        return originY + this.flower.coneHeight * 0.5;
      case 'petals': {
        const l = this.flower.layer;
        return originY + this.flower.coneHeight * l.baseFrac + l.rise * 0.45;
      }
      case 'carry':
        // Once the flower is up, the finger aims at the cake surface itself.
        return this.carrying ? LAYOUT.cakeTop + 0.006 : originY - 0.002;
      default:
        return originY - 0.002;
    }
  }

  private projectPointer(): boolean {
    this.plane.set(new THREE.Vector3(0, 1, 0), -this.workPlaneY());
    this.ray.setFromCamera(this.pointer.ndc, this.renderer.camera);
    const hit = this.ray.ray.intersectPlane(this.plane, this.hitWorld);
    return !!hit;
  }

  private onPointer(kind: 'down' | 'move' | 'up' | 'cancel') {
    this.sfx.unlock();
    if (kind === 'down') {
      if (this.act === 'parchment') {
        this.draggingParchment = true;
      } else if (this.act === 'core' || this.act === 'petals') {
        this.beginStroke();
      }
      return;
    }
    if (kind === 'up' || kind === 'cancel') {
      if (this.draggingParchment) this.releaseParchment(kind === 'up');
      if (this.extruding) this.endStroke(kind === 'up');
      if (this.act === 'lift' || this.act === 'carry') this.releaseLifter(kind === 'up');
    }
  }

  private beginStroke() {
    this.extruding = true;
    this.strokeStart = performance.now();
    this.samples.length = 0;
    this.bag.setPressing(true);
    this.ghost.hide();
    if (this.act === 'petals') this.flower.beginPetal();
  }

  private endStroke(committed: boolean) {
    this.extruding = false;
    this.bag.setPressing(false);
    this.sfx.setExtrude(0);
    if (this.act === 'petals') {
      const piped = this.flower.layer;
      if (committed && this.samples.length > 0) {
        this.flower.updatePetal(this.samples, true);
        const { layerCompleted } = this.flower.endPetal();
        // The turntable presents the next gap, so even a child who keeps
        // drawing in the same spot ends up with petals all the way round.
        this.nail.advance(((Math.PI * 2) / piped.target) * this.rng.range(0.86, 1.12));
        this.stats.petals = this.flower.totalPetals;
        if (layerCompleted) {
          this.sfx.layerUp();
          this.showGhostForLayer(true);
        } else {
          this.sfx.petalDone();
        }
        if (this.flower.totalPetals >= 15) {
          this.finishPetals();
          return;
        }
        this.hud.showDone(this.flower.looksFinished);
      } else {
        this.flower.updatePetal(this.samples, true);
        this.flower.endPetal();
      }
      this.samples.length = 0;
    } else if (this.act === 'core') {
      if (this.flower.coneHeight >= CONE.targetHeight * 0.62) this.enterAct('petals');
    }
  }

  private releaseParchment(committed: boolean) {
    this.draggingParchment = false;
    if (!committed) return;
    const target = this.nail.worldOrigin(this.tmp).clone();
    const p = this.nail.parchment.position;
    let d = Math.hypot(p.x - target.x, p.z - target.z);
    if (this.projectPointer()) {
      d = Math.min(d, Math.hypot(this.hitWorld.x - target.x, this.hitWorld.z - target.z));
    }
    if (d < 0.085) {
      this.nail.spinner.attach(this.nail.parchment);
      this.nail.parchmentPlaced = true;
      this.sfx.snap();
      this.tween(this.nail.parchment, new THREE.Vector3(0, 0.0016, 0), new THREE.Quaternion(), 0.25, () =>
        this.enterAct('core'),
      );
    }
  }

  /** Horizontal distance from the cake's axis, for whatever is being carried. */
  private overCake(p: THREE.Vector3) {
    return Math.hypot(p.x - LAYOUT.cake.x, p.z - LAYOUT.cake.z);
  }

  private releaseLifter(committed: boolean) {
    if (!committed || !this.carrying) return;
    // Anywhere on the cake counts. The flower then walks itself to its slot.
    let d = this.overCake(this.lifter.group.position);
    if (this.projectPointer()) d = Math.min(d, this.overCake(this.hitWorld));
    if (d < LAYOUT.cakeRadius + 0.035) {
      this.placeFlower(this.cakeSlot(this.flowersPlaced, new THREE.Vector3()));
    }
  }

  private placeFlower(slot: THREE.Vector3) {
    this.carrying = false;
    this.patisserie.cake.attach(this.flower.group);
    this.tween(this.flower.group, slot.clone(), new THREE.Quaternion(), 0.4, () => {
      this.flower.nudge(1);
      this.sfx.placed();
      this.placed.push(this.flower);
      this.flowerIsPlaced = true;
      this.flowersPlaced++;
      this.stats.flowers = this.flowersPlaced;
      this.firstFlowerDone = true;
      this.enterAct('done');
    });
    this.lifter.group.visible = false;
    this.hud.setHint('none');
  }

  private finishPetals() {
    if (this.act !== 'petals') return;
    this.flower.mergeLayer();
    this.enterAct('lift');
  }

  private nextRound(sameColour: boolean) {
    if (!sameColour) this.colorIndex = (this.colorIndex + 1) % CREAM_COLORS.length;
    this.flower = this.spawnFlower();
    this.nail.spinner.rotation.y = this.rng.range(0, Math.PI * 2);
    this.ghostShownForLayer = -1;
    this.stats.petals = 0;
    // Later rounds skip the parchment step: the child goes straight to piping.
    this.enterAct(this.firstFlowerDone ? 'core' : 'parchment');
  }

  /**
   * Screen positions of the things a player aims at, in CSS pixels. Used by the
   * E2E suite so a stroke can be aimed the way a child aims: at the object.
   * The returned y is where the *finger* goes, i.e. the tool tip is drawn
   * `Config.tipLiftPx` above it.
   */
  anchors() {
    const cam = this.renderer.camera;
    const w = this.renderer.viewport.width;
    const h = this.renderer.viewport.height;
    const toScreen = (v: THREE.Vector3) => {
      const p = v.clone().project(cam);
      return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h + Config.tipLiftPx };
    };
    const slot = this.cakeSlot(this.flowersPlaced, new THREE.Vector3());
    this.patisserie.cake.localToWorld(slot);
    return {
      /** Where the piping tip actually is, with no lift applied. */
      tip: (() => {
        const p = this.bag.group.position.clone().project(cam);
        return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h };
      })(),
      nail: toScreen(this.nail.worldOrigin(new THREE.Vector3())),
      cake: toScreen(slot),
      parchment: toScreen(this.nail.parchment.getWorldPosition(new THREE.Vector3())),
      lifter: toScreen(this.lifter.group.position.clone()),
    };
  }

  // ------------------------------------------------------------------ tween

  private tween(obj: THREE.Object3D, to: THREE.Vector3, toQ: THREE.Quaternion, dur: number, done?: () => void) {
    this.tweens.push({
      obj,
      from: obj.position.clone(),
      to,
      fromQ: obj.quaternion.clone(),
      toQ,
      t: 0,
      dur,
      done,
    });
  }

  private updateTweens(dt: number) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      const k = clamp(tw.t / tw.dur, 0, 1);
      const e = k * k * (3 - 2 * k);
      tw.obj.position.lerpVectors(tw.from, tw.to, e);
      tw.obj.quaternion.slerpQuaternions(tw.fromQ, tw.toQ, e);
      if (k >= 1) {
        this.tweens.splice(i, 1);
        tw.done?.();
      }
    }
  }

  // ----------------------------------------------------------------- update

  update(dt: number) {
    // Cream flow follows the wall clock, not the render rate: on a slow device
    // a two second squeeze must still build the same cone.
    const now = performance.now();
    const realDt = clamp((now - this.lastRealTime) / 1000, 0, 0.3);
    this.lastRealTime = now;
    const hasHit = this.projectPointer();
    this.updateTweens(dt);

    switch (this.act) {
      case 'parchment':
        this.updateParchment(hasHit);
        break;
      case 'core':
        this.updateCore(dt, realDt, hasHit);
        break;
      case 'petals':
        this.updatePetals(dt, hasHit);
        break;
      case 'lift':
      case 'carry':
        this.updateCarry(dt, hasHit);
        break;
      case 'done':
        break;
    }

    this.nail.update(dt);
    if (!this.flowerIsPlaced) this.flower.update(dt);
    for (const f of this.placed) f.update(dt);
    this.bag.update(dt, this.extruding);
    this.ghost.update(dt, this.flower.coneHeight);
    this.sfx.setSpin(this.nail.spinSpeed > 0 ? 1 : 0);
    this.director.update(dt, this.renderer.viewport);

    // key light direction in view space, for the buttercream back-scatter
    this.tmp
      .copy(this.patisserie.keyLight.target.position)
      .sub(this.patisserie.keyLight.position)
      .normalize()
      .transformDirection(this.renderer.camera.matrixWorldInverse);
    updateCreamLighting(this.tmp);

    this.stats.coneHeight = this.flower.coneHeight;
    this.stats.drawCalls = this.renderer.gl.info.render.calls;
  }

  private updateParchment(hasHit: boolean) {
    if (this.draggingParchment && hasHit) {
      const p = this.nail.parchment;
      p.position.x = damp(p.position.x, this.hitWorld.x, 18, 1 / 60);
      p.position.z = damp(p.position.z, this.hitWorld.z, 18, 1 / 60);
      p.position.y = damp(p.position.y, this.hitWorld.y, 12, 1 / 60);
      const target = this.nail.worldOrigin(this.tmp);
      const d = Math.hypot(p.position.x - target.x, p.position.z - target.z);
      // gentle magnet so a rough drop still lands square on the nail
      if (d < 0.05) {
        p.position.x = damp(p.position.x, target.x, 6, 1 / 60);
        p.position.z = damp(p.position.z, target.z, 6, 1 / 60);
        p.rotation.y = damp(p.rotation.y, 0, 5, 1 / 60);
      }
    }
    this.bag.group.visible = false;
  }

  private updateCore(dt: number, realDt: number, hasHit: boolean) {
    this.bag.group.visible = true;
    const origin = this.nail.worldOrigin(this.tmp).clone();
    // the tip stays over the centre: pressing anywhere builds the cone
    this.tipTarget.set(origin.x, origin.y + this.flower.coneHeight + 0.004, origin.z);
    if (hasHit) {
      this.tipTarget.x += clamp(this.hitWorld.x - origin.x, -0.004, 0.004);
      this.tipTarget.z += clamp(this.hitWorld.z - origin.z, -0.004, 0.004);
    }
    this.bag.group.position.lerp(this.tipTarget, 1 - Math.exp(-14 * dt));

    if (this.extruding) {
      const before = this.flower.coneHeight;
      // growth eases off near the top so over-piping cannot ruin it
      const room = clamp((CONE.maxHeight - before) / (CONE.maxHeight - CONE.targetHeight * 0.5), 0.08, 1);
      this.flower.growCone(CONE.growthPerSecond * realDt * room);
      this.sfx.setExtrude(0.8 + room * 0.2);
      if (!this.coneChimed && this.flower.coneHeight >= CONE.targetHeight) {
        this.coneChimed = true;
        this.sfx.coneReady();
        this.pulseLight();
      }
    } else {
      this.sfx.setExtrude(0);
    }
    this.ghost.showCentre(this.flower.coneHeight);
  }

  private pulseLight() {
    const l = this.patisserie.keyLight;
    const base = l.intensity;
    const t0 = performance.now();
    const step = () => {
      const k = (performance.now() - t0) / 420;
      if (k >= 1) {
        l.intensity = base;
        return;
      }
      l.intensity = base * (1 + 0.35 * Math.sin(k * Math.PI));
      requestAnimationFrame(step);
    };
    step();
  }

  private updatePetals(dt: number, hasHit: boolean) {
    this.bag.group.visible = true;
    if (!hasHit) return;

    // clamp the tip to the nail so a wild swipe never leaves the workpiece
    this.hitLocal.copy(this.hitWorld);
    this.nail.spinner.worldToLocal(this.hitLocal);
    const r = Math.hypot(this.hitLocal.x, this.hitLocal.z);
    const maxR = NAIL_RADIUS * 1.25;
    if (r > maxR) {
      const k = maxR / r;
      this.hitLocal.x *= k;
      this.hitLocal.z *= k;
    }
    this.tmp.copy(this.hitLocal);
    this.nail.spinner.localToWorld(this.tmp);
    this.bag.group.position.lerp(this.tmp, 1 - Math.exp(-22 * dt));

    if (!this.extruding) {
      this.sfx.setExtrude(0);
      return;
    }
    this.sfx.setExtrude(0.75 + clamp(this.pointer.speed / 2000, 0, 0.25));

    const now = performance.now();
    const local = this.hitLocal;
    const moved = this.samples.length === 0 || this.lastSample.distanceTo(local) > 0.0005;
    const stale = this.samples.length > 0 && now - this.strokeStart - this.samples[this.samples.length - 1].t > 45;
    if (moved || stale) {
      this.samples.push({ x: local.x, z: local.z, t: now - this.strokeStart, speed: this.pointer.speed });
      this.lastSample.copy(local);
      if (this.samples.length > 140) this.samples.shift();
    }
    this.flower.updatePetal(this.samples, false);
  }

  private updateCarry(dt: number, hasHit: boolean) {
    this.bag.group.visible = false;
    if (hasHit && this.pointer.down) {
      this.tmp.copy(this.hitWorld);
      this.tmp.y = this.carrying
        ? Math.max(this.nail.worldOrigin(new THREE.Vector3()).y, LAYOUT.cakeTop + 0.006)
        : this.nail.worldOrigin(new THREE.Vector3()).y - 0.003;
      this.lifter.group.position.lerp(this.tmp, 1 - Math.exp(-16 * dt));
    }

    if (!this.carrying) {
      const origin = this.nail.worldOrigin(this.tmp).clone();
      let d = this.lifter.group.position.distanceTo(origin);
      if (hasHit && this.pointer.down) {
        d = Math.min(d, Math.hypot(this.hitWorld.x - origin.x, this.hitWorld.z - origin.z));
      }
      // the blade slides itself under the flower once it is close
      if (d < 0.06 && this.pointer.down) {
        this.lifter.group.position.x = damp(this.lifter.group.position.x, origin.x, 5, dt);
        this.lifter.group.position.z = damp(this.lifter.group.position.z, origin.z, 5, dt);
      }
      if (d < 0.045) {
        this.carrying = true;
        this.sfx.pickup();
        this.lifter.cradle.attach(this.flower.group);
        this.tween(this.flower.group, new THREE.Vector3(0, 0.002, 0), new THREE.Quaternion(), 0.25);
        this.flower.nudge(0.5);
        this.enterAct('carry');
      }
    } else {
      const slot = this.cakeSlot(this.flowersPlaced, new THREE.Vector3());
      this.patisserie.cake.localToWorld(slot);
      const d = this.overCake(this.lifter.group.position);
      const near = clamp(1 - d / (LAYOUT.cakeRadius + 0.05), 0, 1);
      (this.cakeTarget.material as THREE.MeshBasicMaterial).opacity = 0.15 + near * 0.5;
      this.cakeTarget.position.copy(this.cakeSlot(this.flowersPlaced, new THREE.Vector3()));
      this.cakeTarget.position.y += 0.0015;
      // magnetic seat: the flower settles onto the cake without precision
      if (near > 0.4 && this.pointer.down) {
        this.lifter.group.position.lerp(slot, 1 - Math.exp(-9 * near * dt));
      }
      this.director.follow.copy(this.lifter.group.position);
      this.director.followWeight = 0.15;
    }
  }
}
