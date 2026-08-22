import * as THREE from 'three';
import { KEY, LOCK } from '../core/config';
import { GameState } from '../core/GameState';
import { SceneRoot } from '../scene/SceneRoot';
import { createMaterials } from '../scene/materials';
import { buildRoom, RoomRig } from '../scene/RoomModel';
import { buildCabinet, CabinetRig } from '../scene/CabinetModel';
import { buildLock, LockRig } from '../scene/LockModel';
import { buildKey } from '../scene/KeyModel';
import { ALL_KEYS, lowerPinLength } from './FictionalKeyProfile';
import { PinStackRig } from './PinStackRig';
import { InsertionRail } from './InsertionRail';
import { Mechanism, PLUG_OPEN_ANGLE } from './Mechanism';
import { CameraDirector } from './CameraDirector';
import { ChildHintController } from './ChildHintController';
import { ReplayVariation } from './ReplayVariation';
import { Gestures, GestureMode } from '../input/Gestures';
import { Hud } from '../ui/Hud';
import { AudioChime } from './AudioChime';

const CHILD_SENTENCE = 'かぎの やまで、ちいさな ぼうの つなぎめを いっぽんの せんに するよ';

export class Game {
  readonly gs = new GameState();
  readonly rail = new InsertionRail();
  readonly mech = new Mechanism();
  readonly rig: PinStackRig;
  readonly director: CameraDirector;
  private root: SceneRoot;
  private lock: LockRig;
  private cabinet: CabinetRig;
  private room: RoomRig;
  private hud: Hud;
  private hint = new ChildHintController();
  private replay: ReplayVariation;
  private chime = new AudioChime();
  private keyGroups: THREE.Group[] = [];
  private clock = new THREE.Clock();
  private saveTimer = 0;
  private sentenceSaid = false;
  private driving = false; // finger currently rotating
  private doorPulled = 0;
  private scriptDepthTarget: number | null = null;
  private inspectTimer = 0;
  private musicPlayed = false;
  private tmpV3a = new THREE.Vector3();
  private tmpV3b = new THREE.Vector3();
  /** monotonically advancing sim time (for tests) */
  frames = 0;

  constructor(container: HTMLElement, fast: boolean, skipIntro: boolean) {
    this.root = new SceneRoot(container, { fast });
    const mats = createMaterials();
    this.room = buildRoom(mats);
    this.cabinet = buildCabinet(mats);
    const lowers: number[] = [];
    for (let i = 0; i < LOCK.pinCount; i++) lowers.push(lowerPinLength(i));
    this.lock = buildLock(mats, lowers);
    this.cabinet.lockMount.add(this.lock.group);
    this.root.scene.add(this.room.group, this.cabinet.group);
    this.root.lampLight.target = this.room.lampTarget;

    for (const spec of ALL_KEYS) this.keyGroups.push(buildKey(spec, mats));

    this.gs.restore();
    this.replay = new ReplayVariation(this.gs.playCount);
    this.rig = new PinStackRig(ALL_KEYS[this.gs.keyIndex] ?? ALL_KEYS[0]!);
    this.rail.depth = this.gs.depth;
    this.rail.setViewport(container.clientWidth, container.clientHeight);

    this.director = new CameraDirector(this.root.camera);

    this.hud = new Hud(ALL_KEYS, {
      onSelectKey: (i) => this.selectKey(i),
      onFreePlay: () => this.enterFreePlay(),
      onReturnKey: () => this.returnKeyToTray(),
    });

    new Gestures(this.root.renderer.domElement, {
      getMode: () => this.gestureMode(),
      getInsertAxis: () => this.insertAxisScreen(),
      getPlugCenter: () => this.plugCenterScreen(),
      onInsertDelta: (px) => this.onInsert(px),
      onRotateDelta: (rad) => this.onRotate(rad),
      onDoorDelta: (px) => this.onDoorPull(px),
      onDragEnd: () => this.onDragEnd(),
      onTap: () => this.onTap(),
    });

    this.applyRestoredState(skipIntro);

    window.addEventListener('resize', () => this.onResize(container));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.gs.depth = this.rail.depth;
        this.gs.persist();
      }
    });

    this.root.renderer.setAnimationLoop(() => this.tick());
  }

  // ------------------------------------------------------------- boot paths

  private applyRestoredState(skipIntro: boolean): void {
    const st = this.gs.state;
    if (st === 'KEY_OUT') {
      this.placeAllKeysOnTray();
      this.hud.showTray(true);
      this.hud.showFreePlay(true);
      this.director.goTo('tray', 0.01);
    } else if (st === 'DOOR_OPEN') {
      this.mountSelectedKey();
      this.rail.depth = 1;
      this.mech.plugAngle = PLUG_OPEN_ANGLE;
      this.mech.requestedAngle = PLUG_OPEN_ANGLE;
      this.mech.boltProgress = 1;
      this.gs.doorAngle = Mechanism.DOOR_OPEN;
      this.doorPulled = Mechanism.DOOR_OPEN;
      this.hud.showFreePlay(true);
      this.hud.showReturnKey(true);
      this.director.goTo('reveal', 0.01);
    } else {
      // KEY_PARTIAL / KEY_FULL — the standing start or a mid-game return
      this.mountSelectedKey();
      this.hud.showFreePlay(this.replay.trayEnabled() || this.gs.freePlay);
      this.hud.showReturnKey(this.replay.trayEnabled());
      if (!this.gs.introSeen && !skipIntro) {
        this.playIntro();
      } else {
        this.director.goTo('macro', 0.01);
      }
    }
    this.rig.setDepth(this.rail.depth);
    this.rig.snap();
  }

  private playIntro(): void {
    this.director.playSequence(
      [
        { name: 'roomWide', duration: 0.01, hold: 1.6 },
        { name: 'cabinet', duration: 2.2, hold: 1.0 },
        { name: 'keyClose', duration: 2.4, hold: 1.2 },
        { name: 'oblique', duration: 1.8, hold: 1.0 },
        { name: 'orbitMid', duration: 1.6, hold: 0.2 },
        { name: 'macro', duration: 2.2, hold: 0.4 },
      ],
      () => {
        this.gs.introSeen = true;
        this.gs.persist();
      }
    );
  }

  // ------------------------------------------------------------ key placing

  private placeAllKeysOnTray(): void {
    for (let i = 0; i < this.keyGroups.length; i++) {
      const g = this.keyGroups[i]!;
      g.removeFromParent();
      const slot = this.room.traySlots[i];
      if (slot) {
        g.position.set(0, 0, 0);
        g.rotation.set(0, 0, 0);
        slot.add(g);
      }
      g.visible = this.replay.playCount >= 1 || i === 0;
    }
  }

  private mountSelectedKey(): void {
    for (let i = 0; i < this.keyGroups.length; i++) {
      const g = this.keyGroups[i]!;
      g.removeFromParent();
      if (i === this.gs.keyIndex) {
        g.position.set(0, 0, 0);
        g.rotation.set(0, 0, 0);
        this.lock.keyHolder.add(g);
        g.visible = true;
      } else {
        const slot = this.room.traySlots[i];
        if (slot) {
          g.position.set(0, 0, 0);
          g.rotation.set(0, 0, 0);
          slot.add(g);
          g.visible = this.replay.playCount >= 1;
        }
      }
    }
  }

  // ------------------------------------------------------------- game flow

  selectKey(index: number): void {
    if (index < 0 || index >= ALL_KEYS.length) return;
    if (this.replay.playCount === 0 && index !== 0) return;
    this.hud.showTray(false);
    // close everything back up from a previous open
    this.closeDoorInstant();
    this.gs.keyIndex = index;
    this.rig.setProfile(ALL_KEYS[index]!);
    this.mountSelectedKey();
    this.rail.depth = this.rail.minDepth;
    this.rig.setDepth(this.rail.depth);
    this.rig.snap();
    this.gs.transition('KEY_PARTIAL');
    this.hud.showReturnKey(true);
    if (this.replay.showInspectBeforeInsert()) {
      // hold the key beside the keyway: mountain line vs pins, no words
      this.inspectTimer = 1.7;
      this.director.playSequence([{ name: 'inspect', duration: 0.9, hold: 1.4 }], () => {
        this.director.goTo('macro', 1.1);
      });
    } else {
      this.director.goTo('macro', 0.9);
    }
    this.gs.persist();
  }

  returnKeyToTray(): void {
    if (this.director.playing) return;
    this.closeDoorInstant();
    this.rail.depth = this.rail.minDepth;
    this.rig.setDepth(this.rail.depth);
    this.placeAllKeysOnTray();
    this.gs.transition('KEY_OUT');
    this.hud.showTray(true);
    this.hud.showReturnKey(false);
    this.hud.showFreePlay(true);
    this.director.goTo('tray', 1.0);
  }

  enterFreePlay(): void {
    this.gs.freePlay = true;
    this.gs.transition('FREE_PLAY');
    // free play = the signature back-and-forth, unrestricted: key stays
    // (or tray opens if none is mounted)
    if (this.gs.state === 'FREE_PLAY') {
      this.returnKeyToTray();
      this.gs.transition('KEY_OUT');
    }
    this.gs.persist();
  }

  private closeDoorInstant(): void {
    this.mech.reset();
    this.gs.doorAngle = 0;
    this.doorPulled = 0;
    this.gs.boltProgress = 0;
    this.musicPlayed = false;
    this.sentenceSaid = this.replay.playCount > 0;
  }

  // -------------------------------------------------------------- gestures

  private gestureMode(): GestureMode {
    if (this.director.playing) return 'none';
    const st = this.gs.state;
    if (st === 'KEY_OUT') return 'none';
    if (st === 'PLUG_ROTATING') return 'none';
    if (st === 'BOLT_RETRACTING' || st === 'DOOR_OPEN') return 'door';
    if (this.mech.plugAngle > 0.12) return 'rotate';
    if (this.rail.isFull()) return 'insert-or-rotate';
    return 'insert';
  }

  private insertAxisScreen(): THREE.Vector2 {
    // world direction "deeper" is the lock mount's -Z
    const m = this.cabinet.lockMount.matrixWorld;
    const a = this.tmpV3a.set(0, 0, 0).applyMatrix4(m);
    const b = this.tmpV3b.set(0, 0, -0.1).applyMatrix4(m);
    const sa = this.toScreen(a);
    const sb = this.toScreen(b);
    const axis = sb.sub(sa);
    return axis.lengthSq() > 1e-6 ? axis.normalize() : new THREE.Vector2(-1, 0);
  }

  private plugCenterScreen(): THREE.Vector2 {
    const m = this.cabinet.lockMount.matrixWorld;
    const p = this.tmpV3a.set(0, 0, 0.01).applyMatrix4(m);
    return this.toScreen(p);
  }

  private toScreen(v: THREE.Vector3): THREE.Vector2 {
    const w = this.root.renderer.domElement.clientWidth;
    const h = this.root.renderer.domElement.clientHeight;
    const p = v.clone().project(this.root.camera);
    return new THREE.Vector2(((p.x + 1) / 2) * w, ((1 - p.y) / 2) * h);
  }

  private onInsert(px: number): void {
    const st = this.gs.state;
    if (st !== 'KEY_PARTIAL' && st !== 'KEY_INSERTING' && st !== 'KEY_FULL' && st !== 'PINS_ALIGNED') return;
    if (this.mech.plugAngle > 0.12) return; // must be seated straight to slide
    this.scriptDepthTarget = null;
    const wasFull = this.rail.isFull();
    this.rail.push(px);
    if (st === 'KEY_PARTIAL') this.gs.transition('KEY_INSERTING');
    if (!wasFull && this.rail.isFull()) this.chime.seatClick();
  }

  private onRotate(rad: number): void {
    const st = this.gs.state;
    if (st !== 'KEY_FULL' && st !== 'PINS_ALIGNED' && st !== 'KEY_INSERTING') return;
    if (!this.rail.isFull()) return;
    this.driving = true;
    // screen angles: clockwise on screen = positive opening turn
    this.mech.requestedAngle = THREE.MathUtils.clamp(
      this.mech.requestedAngle + rad,
      -0.35,
      PLUG_OPEN_ANGLE + 0.05
    );
  }

  private onDoorPull(px: number): void {
    if (this.gs.state !== 'BOLT_RETRACTING' && this.gs.state !== 'DOOR_OPEN') return;
    if (!this.mech.boltCleared()) return;
    this.doorPulled = THREE.MathUtils.clamp(
      this.doorPulled + px * 0.0038,
      Mechanism.DOOR_POP,
      Mechanism.DOOR_OPEN
    );
  }

  private onDragEnd(): void {
    this.driving = false;
    if (this.gs.state === 'KEY_INSERTING') {
      this.gs.transition(this.rail.isFull() ? 'KEY_FULL' : 'KEY_PARTIAL');
    }
    this.gs.depth = this.rail.depth;
    this.gs.persist();
  }

  private onTap(): void {
    if (this.director.playing && !this.gs.introSeen) {
      // let an impatient grown-up skip the establishing chain
      this.director.skip();
      this.gs.introSeen = true;
      this.gs.persist();
    }
  }

  // ------------------------------------------------------------------ tick

  private tick(): void {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.step(dt);
    this.root.render();
    this.frames++;
  }

  /** one simulation step — also driven directly by tests */
  step(dt: number): void {
    // scripted glide (tests / key change animations)
    if (this.scriptDepthTarget !== null) {
      if (this.rail.glideTo(this.scriptDepthTarget, dt)) this.scriptDepthTarget = null;
    }
    if (this.inspectTimer > 0) this.inspectTimer -= dt;

    // deterministic pin targets from (profile, depth)
    this.rig.setDepth(this.rail.depth);

    // state promotions driven by the deterministic model
    const st = this.gs.state;
    const aligned = this.rig.isAligned() && this.rail.isFull();
    if ((st === 'KEY_FULL' || st === 'KEY_INSERTING') && aligned) {
      this.gs.transition('PINS_ALIGNED');
      if (!this.sentenceSaid) {
        this.sentenceSaid = true;
        this.hud.say(CHILD_SENTENCE, 6);
      }
    } else if (st === 'PINS_ALIGNED' && !aligned) {
      this.gs.transition(this.rail.isFull() ? 'KEY_FULL' : 'KEY_INSERTING');
    }

    // rotation & bolt
    this.mech.update(dt, aligned || this.mech.plugAngle > 0.2, this.driving);
    if (this.gs.state === 'PINS_ALIGNED' && this.mech.plugAngle > 1.45) {
      this.beginOpeningChain();
    }

    // door
    if (this.gs.state === 'BOLT_RETRACTING' || this.gs.state === 'DOOR_OPEN') {
      const target = Math.max(this.doorPulled, Mechanism.DOOR_POP);
      this.gs.doorAngle += (target - this.gs.doorAngle) * (1 - Math.exp(-10 * dt));
      if (this.gs.state === 'BOLT_RETRACTING' && this.gs.doorAngle > 0.5) {
        this.gs.transition('DOOR_OPEN');
        this.onDoorOpened();
      }
    }

    // hint: one anticipatory bounce while the mystery is on screen
    this.hint.update(
      dt,
      this.rig,
      this.rail.depth,
      !this.director.playing && this.replay.playCount === 0 && this.gs.state === 'KEY_PARTIAL'
    );

    // cosmetic springs then visual application
    this.rig.update(dt);
    for (let i = 0; i < this.rig.stacks.length; i++) {
      this.lock.setStack(i, this.rig.stacks[i]!.visualLift);
    }
    this.lock.keyHolder.position.z = -this.rail.depth * KEY.travel;
    this.lock.setPlugAngle(-this.mech.plugAngle);
    this.lock.setBoltProgress(this.mech.boltProgress);
    this.cabinet.setDoorAngle(this.gs.doorAngle);

    // reward micro-motion
    if (this.gs.state === 'DOOR_OPEN') {
      this.cabinet.musicCylinder.rotation.x += dt * 0.8;
      this.cabinet.governor.rotation.y += dt * 14;
    }

    this.director.update(dt);

    // throttled autosave of insertion depth
    this.saveTimer -= dt;
    if (this.saveTimer <= 0) {
      this.saveTimer = 0.8;
      if (Math.abs(this.gs.depth - this.rail.depth) > 0.001) {
        this.gs.depth = this.rail.depth;
        this.gs.persist();
      }
    }
  }

  private beginOpeningChain(): void {
    this.gs.transition('PLUG_ROTATING');
    this.driving = false;
    this.mech.requestedAngle = PLUG_OPEN_ANGLE;
    this.hint.disarm();
    // shot chain: plug/cam close → bolt sliding → cabinet wide, then the
    // door waits for a small pull
    this.director.playSequence(
      [
        { name: 'caseShot', duration: 1.3, hold: 0.5 },
        { name: 'boltShot', duration: 1.1, hold: 0.7 },
        { name: 'doorWide', duration: 1.7, hold: 0.1 },
      ],
      () => {
        this.gs.transition('BOLT_RETRACTING');
        this.doorPulled = Mechanism.DOOR_POP;
      }
    );
  }

  private onDoorOpened(): void {
    this.replay.completed();
    this.gs.playCount = this.replay.playCount;
    this.gs.persist();
    this.hud.showReturnKey(true);
    this.hud.showFreePlay(true);
    if (!this.musicPlayed) {
      this.musicPlayed = true;
      this.chime.musicBoxPhrase();
    }
    this.director.playSequence([{ name: 'reveal', duration: 2.2, hold: 0.5 }]);
  }

  // -------------------------------------------------------------- utilities

  private onResize(container: HTMLElement): void {
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.root.resize(w, h);
    this.rail.setViewport(w, h);
    // re-frame the current shot for the new orientation; pin/game state is
    // untouched by rotation
    if (!this.director.playing) {
      const st = this.gs.state;
      this.director.refresh(
        st === 'KEY_OUT' ? 'tray' : st === 'DOOR_OPEN' ? 'reveal' : 'macro'
      );
    }
  }

  // ------------------------------------------------------------- test hooks

  hookSetDepth(d: number): void {
    this.rail.depth = THREE.MathUtils.clamp(d, this.rail.minDepth, 1);
    if (this.gs.state === 'KEY_PARTIAL' || this.gs.state === 'KEY_INSERTING' || this.gs.state === 'KEY_FULL') {
      this.gs.transition(this.rail.isFull() ? 'KEY_FULL' : 'KEY_PARTIAL');
    }
  }

  hookRotate(rad: number): void {
    this.mech.requestedAngle = rad;
    this.driving = false;
  }

  hookPullDoor(): void {
    this.doorPulled = Mechanism.DOOR_OPEN;
  }

  hookAdvance(seconds: number): void {
    const step = 1 / 60;
    let left = seconds;
    while (left > 0) {
      this.step(Math.min(step, left));
      left -= step;
    }
    this.root.render();
  }

  hookSkipCinematic(): void {
    if (this.director.playing) this.director.skip();
  }

  hookReset(): void {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    location.reload();
  }
}
