import * as THREE from 'three';
import { PAIRS, classify, clearanceOf, dropX, channelCenters, rightGlyphX, glyphWidthM, type PairConfig, type GapState } from '../core/pairs';
import { getGlyph } from '../core/glyphs';
import { EM, BASE_Y, CAPSULE_R, DROP_Y, NET_Y, PHYS_DT, TRAY_TOP_Y, TRAY_WATER_Y, LETTER_DEPTH } from '../core/constants';
import { makeCapsule, stepCapsule, contoursToSegments, capsuleSpeed, type CapsuleBody, type Segment } from '../core/physics';
import { buildLetter, buildTray, type LetterRig, type TrayRig } from '../render/letters';
import { buildFacility, type Facility } from '../render/facility';
import { WaterRibbon, FoamSystem } from '../render/water';
import { CapsuleVisual } from '../render/capsule';
import { CameraRig } from '../render/cameraRig';
import { Ui } from '../ui/ui';
import { AudioKit } from '../ui/audio';
import { clamp, damp, lerp, smoothstep } from '../core/math';

export type Phase = 'intro' | 'adjust' | 'test' | 'result' | 'transition';
export type Outcome = 'fell' | 'stuck' | 'captured' | null;

interface SaveData {
  pairIndex: number;
  spacings: Record<string, number>;
  cleared: Record<string, boolean>;
  everDragged: boolean;
}

const SAVE_KEY = 'kerning-canyon-v1';

export class Game {
  scene = new THREE.Scene();
  rig = new CameraRig();
  facility: Facility;
  ui: Ui;
  audio = new AudioKit();

  phase: Phase = 'intro';
  outcome: Outcome = null;
  pairIndex = 0;
  spacing = 0;
  private spacingVisual = 0;
  private everDragged = false;
  private spacings: Record<string, number> = {};
  private cleared: Record<string, boolean> = {};

  private leftRig: LetterRig | null = null;
  private rightRig: LetterRig | null = null;
  private tray: TrayRig | null = null;
  private dragSlab: THREE.Mesh | null = null;
  private blobs: THREE.Mesh[] = [];
  private blobTex: THREE.Texture;

  private water = new WaterRibbon();
  private foam = new FoamSystem();
  private capsuleVis = new CapsuleVisual();
  private body: CapsuleBody | null = null;
  private capsuleFade = 0; // >0: fading out leftover capsule
  private segments: Segment[] = [];
  private segSpacing = NaN;
  private segPair = -1;

  private phaseT = 0;
  private testT = 0;
  private slowT = 0;
  private stillT = 0;
  private waterOn = false;
  private hintT = 0;
  private hintActive = 0;
  private autoDemoPending = false;
  private nudgeT = -1;
  private firstFailSeen = false;
  private accumulator = 0;
  private valveSpin = 0;
  private transT = 0;
  private transHalf = false;
  private prevRightX = 0;

  constructor(uiParent: HTMLElement, lowQuality: boolean) {
    this.scene.background = new THREE.Color(0xa4b0ba);
    this.scene.fog = new THREE.Fog(0xa4b0ba, 14, 34);

    this.facility = buildFacility(lowQuality);
    this.scene.add(this.facility.group);
    this.scene.add(this.water.mesh);
    this.scene.add(this.foam.points);
    this.scene.add(this.capsuleVis.group);
    this.capsuleVis.group.visible = false;

    // soft contact blobs (ground AO); the middle one joins the pair when
    // the spacing closes — shadows connecting, not a UI gauge
    this.blobTex = makeBlobTexture();
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: this.blobTex,
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
          color: 0x14161a,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.015 + i * 0.001;
      m.renderOrder = 2;
      this.scene.add(m);
      this.blobs.push(m);
    }

    this.ui = new Ui(uiParent, {
      onValve: () => this.onValvePressed(),
      onNext: () => this.nextPair(),
    });
    this.ui.setValveEnabled(false);
    this.ui.hideNext();

    this.load();
    this.buildPair(this.pairIndex, true);

    this.phase = 'intro';
    this.phaseT = 0;
    this.rig.snapTo('intro');
    this.autoDemoPending = !this.cleared[this.pair.id] && !this.everDragged;
  }

  get pair(): PairConfig {
    return PAIRS[this.pairIndex];
  }

  get gapState(): GapState {
    return classify(this.pair, this.spacing);
  }

  get clearance(): number {
    return clearanceOf(this.pair, this.spacing);
  }

  // ---------------------------------------------------------------- save
  private load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as SaveData;
      if (typeof d.pairIndex === 'number' && d.pairIndex >= 0 && d.pairIndex < PAIRS.length) {
        this.pairIndex = d.pairIndex;
      }
      this.spacings = d.spacings ?? {};
      this.cleared = d.cleared ?? {};
      this.everDragged = !!d.everDragged;
    } catch {
      /* first run */
    }
  }

  private save(): void {
    try {
      this.spacings[this.pair.id] = this.spacing;
      const d: SaveData = {
        pairIndex: this.pairIndex,
        spacings: this.spacings,
        cleared: this.cleared,
        everDragged: this.everDragged,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(d));
    } catch {
      /* private mode */
    }
  }

  // ------------------------------------------------------------ pair mgmt
  private disposeRig(rig: LetterRig | null): void {
    if (!rig) return;
    rig.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.dispose();
      }
    });
    this.scene.remove(rig.group);
  }

  private buildPair(index: number, restoreSpacing: boolean): void {
    this.disposeRig(this.leftRig);
    this.disposeRig(this.rightRig);
    if (this.tray) this.tray.group.removeFromParent();
    if (this.dragSlab) {
      this.dragSlab.geometry.dispose();
      (this.dragSlab.material as THREE.Material).dispose();
    }

    this.pairIndex = index;
    const pair = this.pair;
    this.leftRig = buildLetter(pair.left, 11 + index * 17);
    this.rightRig = buildLetter(pair.right, 29 + index * 23);
    this.scene.add(this.leftRig.group);
    this.scene.add(this.rightRig.group);
    this.leftRig.group.position.x = pair.leftX;

    const saved = this.spacings[pair.id];
    this.spacing = restoreSpacing && typeof saved === 'number' ? clamp(saved, pair.spacingMin, pair.spacingMax) : pair.spacing0;
    this.spacingVisual = this.spacing;

    // recovery tray cantilevered off the moving bogie
    this.tray = buildTray(pair.trayHalf, 91 + index);
    this.tray.group.position.x = pair.trayOffset;
    this.rightRig.group.add(this.tray.group);
    // support strut back to the bogie
    const strut = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x878d93, roughness: 0.55, metalness: 0.7 }),
    );
    strut.position.set(glyphWidthM(pair.right) / 2 - pair.trayOffset, 0.13, 0.42);
    strut.rotation.y = Math.PI / 2;
    strut.scale.x = Math.abs(strut.position.x) * 2.5 + 1;
    this.tray.group.add(strut);

    // generous invisible drag slab over the moving letter + bogie
    const w = glyphWidthM(pair.right);
    this.dragSlab = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.7, EM + 1.0, LETTER_DEPTH + 0.9),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.dragSlab.position.set(w / 2, BASE_Y + EM / 2 - 0.2, 0);
    this.rightRig.group.add(this.dragSlab);
    this.rightRig.hitMeshes.push(this.dragSlab);

    this.syncPositions(0, true);
    this.prevRightX = this.rightRig.group.position.x;
    this.body = null;
    this.capsuleVis.group.visible = false;
    this.water.visibleAmount = 0;
    this.segPair = -1;
    this.firstFailSeen = this.cleared[pair.id] === true;
  }

  /** meshes the pointer may grab to drag the movable letter. */
  get dragTargets(): THREE.Object3D[] {
    return this.rightRig ? this.rightRig.hitMeshes : [];
  }

  capsulePos(): { x: number; y: number } | null {
    return this.body ? { x: this.body.x, y: this.body.y } : null;
  }

  // ------------------------------------------------------------- controls
  /** Pointer drag moves the letter along its rail. dx in world meters. */
  dragBy(dx: number): void {
    if (this.phase !== 'adjust' && this.phase !== 'result') return;
    if (this.phase === 'result') {
      // touching the letter after a result returns to adjust framing
      this.toAdjust(true);
    }
    const p = this.pair;
    this.spacing = clamp(this.spacing + dx, p.spacingMin, p.spacingMax);
    if (!this.everDragged) {
      this.everDragged = true;
      this.nudgeT = -1;
    }
  }

  dragEnd(): void {
    this.save();
  }

  swipeNext(): void {
    if (this.canAdvance()) this.nextPair();
  }

  canAdvance(): boolean {
    return this.phase !== 'transition' && this.phase !== 'test' && this.cleared[this.pair.id] === true;
  }

  private onValvePressed(): void {
    this.audio.ensure();
    if (this.phase === 'adjust' || this.phase === 'result') {
      this.startTest(false);
    }
  }

  interacted(): void {
    this.audio.ensure();
    this.hintT = 0;
  }

  // ------------------------------------------------------------ test flow
  startTest(auto: boolean): void {
    if (this.phase === 'test' || this.phase === 'transition') return;
    const p = this.pair;
    this.phase = 'test';
    this.phaseT = 0;
    this.testT = 0;
    this.slowT = 0;
    this.stillT = 0;
    this.outcome = null;
    this.capsuleFade = 0;
    this.waterOn = true;
    this.valveSpin = auto ? 1.2 : 1.6;
    this.body = makeCapsule(dropX(p, this.spacing) + 0.028, DROP_Y);
    this.capsuleVis.group.visible = true;
    this.capsuleVis.group.scale.set(1, 1, 1);
    this.rig.goTo('test', 1.1);
    this.ui.setValveEnabled(false);
    this.ui.hideNext();
    this.audio.water(true);
  }

  private finishTest(outcome: Exclude<Outcome, null>): void {
    if (this.outcome) return;
    this.outcome = outcome;
    if (outcome === 'captured') {
      this.cleared[this.pair.id] = true;
      this.audio.splash();
      const cx = this.trayCenterX();
      this.foam.burst(cx, TRAY_WATER_Y + 0.06, 0.1, 18, 1.4);
      if (this.tray) this.tray.water.scale.set(1.06, 1.06, 1);
    } else if (outcome === 'fell') {
      this.audio.thud();
    }
    this.save();
  }

  private toAdjust(withCamera: boolean): void {
    this.phase = 'adjust';
    this.phaseT = 0;
    this.hintT = 0;
    if (withCamera) this.rig.goTo('front', 1.4);
    this.ui.setValveEnabled(true);
  }

  private toResult(): void {
    this.phase = 'result';
    this.phaseT = 0;
    this.rig.goTo('result', 1.7);
    this.waterOn = false;
    this.audio.water(false);
    this.ui.setValveEnabled(true);
    if (this.outcome === 'captured') {
      const next = PAIRS[(this.pairIndex + 1) % PAIRS.length];
      this.ui.showNext(next.left, next.right);
    }
  }

  nextPair(): void {
    if (!this.canAdvance()) return;
    this.save();
    this.phase = 'transition';
    this.phaseT = 0;
    this.transT = 0;
    this.transHalf = false;
    this.outcome = null;
    this.waterOn = false;
    this.audio.water(false);
    this.body = null;
    this.capsuleVis.group.visible = false;
    this.ui.hideNext();
    this.ui.setValveEnabled(false);
  }

  private trayCenterX(): number {
    return rightGlyphX(this.pair, this.spacingVisual) + this.pair.trayOffset;
  }

  // -------------------------------------------------------------- physics
  private rebuildSegments(): void {
    if (this.segPair === this.pairIndex && Math.abs(this.segSpacing - this.spacingVisual) < 0.0005) return;
    const p = this.pair;
    const gl = getGlyph(p.left);
    const gr = getGlyph(p.right);
    const rx = rightGlyphX(p, this.spacingVisual);
    this.segments = contoursToSegments(gl.contours, p.leftX, BASE_Y, EM).concat(
      contoursToSegments(gr.contours, rx, BASE_Y, EM),
    );
    // tray lips so near-misses bounce off visibly instead of ghosting
    const cx = rx + p.trayOffset;
    const half = p.trayHalf + 0.05;
    for (const s of [-1, 1]) {
      this.segments.push({ ax: cx + s * half, ay: 0.1, bx: cx + s * half, by: TRAY_TOP_Y + 0.02 });
    }
    this.segSpacing = this.spacingVisual;
    this.segPair = this.pairIndex;
  }

  private stepBody(): void {
    const b = this.body;
    if (!b) return;
    const p = this.pair;
    this.rebuildSegments();

    const state = classify(p, this.spacingVisual);
    let assist: { x: number; strength: number } | null = null;
    let flow = 0;

    if (this.phase === 'test' && state === 'ok') {
      if (p.mode === 'channel') {
        const centers = channelCenters(p, this.spacingVisual);
        if (centers.length > 1 && b.y > BASE_Y + 0.05 && b.y < BASE_Y + EM) {
          const yy = (b.y - BASE_Y) / EM;
          let cx = centers[centers.length - 1].x;
          for (let i = 0; i < centers.length - 1; i++) {
            const a = centers[i];
            const c = centers[i + 1];
            if (yy * EM <= a.y && yy * EM >= c.y) {
              const t = (a.y - yy * EM) / Math.max(1e-5, a.y - c.y);
              cx = lerp(a.x, c.x, t);
              break;
            }
          }
          assist = { x: cx, strength: 5.5 };
        }
      } else {
        // bridge: once past the foot end, ease into the slot center
        const footEnd = p.leftX + glyphWidthM('L');
        const stemLeft = rightGlyphX(p, this.spacingVisual) + getGlyph('T').contours[0][5].x * EM;
        if (b.x > footEnd - 0.06 && b.y < BASE_Y + 0.5) {
          assist = { x: (footEnd + stemLeft) / 2, strength: 5 };
        }
      }
    }
    if (p.mode === 'bridge' && this.waterOn) {
      const footTop = BASE_Y + 0.16 * EM;
      if (Math.abs(b.y - (footTop + CAPSULE_R)) < 0.16 && b.x < p.leftX + glyphWidthM('L') + 0.05) {
        flow = 3.0;
      }
    }

    stepCapsule(b, this.segments, {
      assist,
      flowAccel: flow,
      netMinX: -2.8,
      netMaxX: 2.8,
      maxFall: this.phase === 'test' ? 2.6 : undefined,
    });

    // foam at hard contacts while water runs
    if (this.waterOn) {
      for (const c of b.contacts) {
        if (c.impulse > 0.6) this.foam.burst(c.x, c.y, 0.05, 2, 0.5);
      }
    }

    // capture check
    if (this.phase === 'test' && !this.outcome) {
      const cx = this.trayCenterX();
      if (b.y < TRAY_TOP_Y + CAPSULE_R * 0.5 && b.y > 0.1 && Math.abs(b.x - cx) < this.pair.trayHalf) {
        this.finishTest('captured');
      }
    }
  }

  // --------------------------------------------------------------- update
  update(dt: number): void {
    dt = Math.min(dt, 0.1);
    this.phaseT += dt;

    // visual spacing follows logical spacing with slight mechanical lag
    this.spacingVisual = damp(this.spacingVisual, this.spacing, 16, dt);
    let wiggle = 0;
    if (this.nudgeT >= 0) {
      this.nudgeT += dt;
      const t = this.nudgeT;
      if (t < 2.4) {
        const env = Math.sin(Math.min(1, t / 0.3) * Math.PI * 0.5) * (1 - smoothstep(1.8, 2.4, t));
        wiggle = Math.sin(t * 7) * 0.045 * env;
      } else {
        this.nudgeT = -1;
      }
    }
    this.syncPositions(dt, false, wiggle);

    switch (this.phase) {
      case 'intro':
        if (this.phaseT > 1.9) {
          this.rig.goTo('front', 1.7);
          this.toAdjust(false);
          this.ui.hideTitle();
          if (this.autoDemoPending) {
            this.hintT = -0.6; // small beat before the demo pour
          }
        }
        break;

      case 'adjust': {
        if (this.autoDemoPending) {
          if (this.phaseT > 1.4) {
            this.autoDemoPending = false;
            this.startTest(true);
          }
          break;
        }
        this.hintT += dt;
        if (this.hintT > 8.5) {
          this.hintT = 0;
          this.hintActive = 1.6; // a short drip shows how the current gap behaves
        }
        break;
      }

      case 'test': {
        this.testT += dt;
        if (this.testT > 4.6 && this.waterOn) {
          this.waterOn = false;
          this.audio.water(false);
        }
        const b = this.body;
        if (b && !this.outcome) {
          const sp = capsuleSpeed(b);
          if (b.onNet && sp < 0.35) {
            this.slowT += dt;
            if (this.slowT > 0.5) this.finishTest('fell');
          } else if (!b.onNet && sp < 0.09 && b.y > 0.42) {
            this.stillT += dt;
            if (this.stillT > 0.85) this.finishTest('stuck');
          } else {
            this.slowT = 0;
            this.stillT = 0;
          }
          if (this.testT > 13) {
            this.finishTest(b.onNet ? 'fell' : b.y > 0.42 ? 'stuck' : 'fell');
          }
        }
        if (this.outcome) {
          // small beat so the child sees the end state, then the frontal read
          this.phase = 'result';
          this.phaseT = 0;
          this.rigResultDelay = 1.1;
        }
        break;
      }

      case 'result': {
        if (this.rigResultDelay > 0) {
          this.rigResultDelay -= dt;
          if (this.rigResultDelay <= 0) {
            this.toResult();
            if (this.outcome === 'fell' && !this.firstFailSeen) {
              this.firstFailSeen = true;
              if (!this.everDragged) this.nudgeT = 0;
            }
          }
        }
        break;
      }

      case 'transition': {
        this.transT += dt;
        const T = this.transT;
        if (T < 0.9) {
          const k = smoothstep(0, 0.9, T);
          if (this.leftRig) this.leftRig.group.position.x = this.pair.leftX - k * 7;
          if (this.rightRig) this.rightRig.group.position.x = rightGlyphX(this.pair, this.spacingVisual) + k * 7;
        } else if (!this.transHalf) {
          this.transHalf = true;
          const next = (this.pairIndex + 1) % PAIRS.length;
          this.buildPair(next, this.cleared[PAIRS[next].id] === true);
          this.rig.snapTo('intro');
          this.rig.focusX = this.focusTargetX();
        } else if (T < 1.9) {
          const k = smoothstep(0.9, 1.9, T);
          if (this.leftRig) this.leftRig.group.position.x = this.pair.leftX - (1 - k) * 7;
          if (this.rightRig) {
            this.rightRig.group.position.x = rightGlyphX(this.pair, this.spacingVisual) + (1 - k) * 7;
          }
        } else if (T > 3.2) {
          this.rig.goTo('front', 1.6);
          this.toAdjust(false);
        }
        break;
      }
    }

    // physics
    if (this.body) {
      this.accumulator += dt;
      const maxSteps = 8;
      let steps = 0;
      while (this.accumulator >= PHYS_DT && steps < maxSteps) {
        this.stepBody();
        this.accumulator -= PHYS_DT;
        steps++;
      }
      if (steps === maxSteps) this.accumulator = 0;
      this.updateCapsuleVisual(dt);
    }

    this.updateWater(dt);
    this.foam.update(dt);
    this.updateBlobs();
    this.updateChute(dt);
    if (this.tray) {
      const s = this.tray.water.scale.x;
      this.tray.water.scale.setScalar(1 + (s - 1) * Math.max(0, 1 - dt * 3));
    }

    if (this.valveSpin > 0) {
      this.ui.spinValve(dt, this.valveSpin);
      this.valveSpin = Math.max(0, this.valveSpin - dt * 1.4);
    }

    // camera focus follows the pair
    this.rig.focusX = damp(this.rig.focusX, this.focusTargetX(), 3, dt);
    const follow = this.phase === 'test' && this.body ? { x: this.body.x - this.rig.focusX, y: this.body.y } : null;
    this.rig.update(dt, follow);
  }

  private rigResultDelay = 0;

  private focusTargetX(): number {
    const p = this.pair;
    const rx = rightGlyphX(p, this.spacingVisual);
    const pairCenter = (p.leftX + rx + glyphWidthM(p.right)) / 2;
    const gapCenter = (p.leftX + glyphWidthM(p.left) + rx) / 2;
    return pairCenter * 0.45 + gapCenter * 0.55;
  }

  private syncPositions(dt: number, snap: boolean, wiggle = 0): void {
    if (!this.leftRig || !this.rightRig) return;
    if (this.phase === 'transition' && !snap) return;
    this.leftRig.group.position.x = this.pair.leftX;
    const rx = rightGlyphX(this.pair, this.spacingVisual) + wiggle;
    this.rightRig.group.position.x = rx;
    const dx = rx - this.prevRightX;
    this.prevRightX = rx;
    if (dt > 0 && Math.abs(dx) > 1e-6) {
      for (const w of this.rightRig.wheels) w.rotation.z -= dx / 0.085;
      this.audio.rumble(Math.abs(dx / dt), this.gapState);
    } else if (dt > 0) {
      this.audio.rumble(0, this.gapState);
    }

    // wet band follows the channel
    const gapC = (this.pair.leftX + glyphWidthM(this.pair.left) + rightGlyphX(this.pair, this.spacingVisual)) / 2;
    for (const rig of [this.leftRig, this.rightRig]) {
      rig.wet.uWetCenter.value = gapC;
      rig.wet.uWetHalf.value = Math.max(0.5, this.clearance / 2 + 0.45);
      rig.wet.uWetTopY.value = BASE_Y + EM * 0.95;
    }
  }

  private updateCapsuleVisual(dt: number): void {
    const b = this.body;
    if (!b) return;
    if (this.outcome === 'captured') {
      // settle into the tray water and bob
      const cx = this.trayCenterX();
      b.x = damp(b.x, cx, 6, dt);
      b.y = damp(b.y, TRAY_WATER_Y + CAPSULE_R * 0.55 + Math.sin(this.phaseT * 2.2) * 0.008, 6, dt);
      b.vx = 0;
      b.vy = 0;
      this.capsuleVis.group.position.set(b.x, b.y, 0);
      return;
    }
    this.capsuleVis.syncFromBody(b, dt);
    // leftover capsule after a fail fades once at rest on the net
    if ((this.phase === 'adjust' || this.phase === 'result') && b.onNet && capsuleSpeed(b) < 0.1) {
      this.capsuleFade += dt;
      if (this.capsuleFade > 2.2) {
        const s = Math.max(0, 1 - (this.capsuleFade - 2.2) / 0.5);
        this.capsuleVis.group.scale.setScalar(s);
        if (s <= 0) {
          this.body = null;
          this.capsuleVis.group.visible = false;
          this.capsuleVis.group.scale.setScalar(1);
        }
      }
    }
  }

  private updateWater(dt: number): void {
    let target = 0;
    if (this.waterOn) target = 1;
    else if (this.hintActive > 0) {
      this.hintActive -= dt;
      target = 0.4;
    }
    if (target > 0.01) {
      this.water.setPath(this.computeWaterPath(), 0.06, 0.11);
      // wet the channel walls while water runs
      if (this.leftRig && this.rightRig && this.waterOn) {
        for (const rig of [this.leftRig, this.rightRig]) {
          rig.wet.uWetAmount.value = Math.min(1, rig.wet.uWetAmount.value + dt * 0.55);
        }
      }
    }
    if (this.leftRig && this.rightRig && !this.waterOn) {
      for (const rig of [this.leftRig, this.rightRig]) {
        rig.wet.uWetAmount.value = Math.max(0, rig.wet.uWetAmount.value - dt * 0.02);
      }
    }
    this.water.update(dt, target);
  }

  private computeWaterPath(): { x: number; y: number }[] {
    const p = this.pair;
    const path: { x: number; y: number }[] = [];
    const dx0 = dropX(p, this.spacingVisual);
    if (p.mode === 'bridge') {
      const footTop = BASE_Y + 0.16 * EM;
      const footEnd = p.leftX + glyphWidthM('L');
      const stemLeft = rightGlyphX(p, this.spacingVisual) + getGlyph('T').contours[0][5].x * EM;
      for (let y = DROP_Y; y > footTop + 0.02; y -= 0.1) path.push({ x: dx0, y });
      for (let x = dx0; x < footEnd - 0.02; x += 0.08) path.push({ x, y: footTop + 0.025 });
      const slotC = clamp((footEnd + stemLeft) / 2, footEnd + 0.03, footEnd + 0.4);
      const endY = Math.abs(slotC - this.trayCenterX()) < p.trayHalf ? TRAY_WATER_Y : NET_Y;
      for (let y = footTop; y > endY; y -= 0.1) {
        const t = smoothstep(footTop, footTop - 0.3, y);
        path.push({ x: lerp(footEnd + 0.02, slotC, t), y });
      }
      return path;
    }
    // channel: the stream keeps its x until a wall pushes it inward
    const centers = channelCenters(p, this.spacingVisual);
    let x = dx0;
    for (let y = DROP_Y; y > BASE_Y + EM * 0.97; y -= 0.12) path.push({ x, y });
    for (const c of centers) {
      const wy = BASE_Y + c.y;
      x = clamp(x, c.x - c.halfW + 0.05, c.x + c.halfW - 0.05);
      // stuck capsule: the stream ends there in a spill
      const b = this.body;
      if (b && this.outcome === 'stuck' && wy < b.y + CAPSULE_R && Math.abs(b.x - x) < 0.25) {
        path.push({ x, y: b.y + CAPSULE_R * 0.8 });
        this.foam.burst(b.x, b.y + CAPSULE_R, 0.08, 1, 0.45);
        return path;
      }
      path.push({ x, y: wy });
    }
    const endY = Math.abs(x - this.trayCenterX()) < p.trayHalf ? TRAY_WATER_Y : NET_Y;
    for (let y = BASE_Y + EM * 0.02; y > endY; y -= 0.12) path.push({ x, y });
    this.foam.burst(x + (Math.sin(this.phaseT * 9) * 0.03), endY + 0.03, 0.05, 1, 0.5);
    return path;
  }

  private updateBlobs(): void {
    if (!this.leftRig || !this.rightRig) return;
    const p = this.pair;
    const lw = glyphWidthM(p.left);
    const rw = glyphWidthM(p.right);
    const rx = this.rightRig.group.position.x;
    const b0 = this.blobs[0];
    b0.position.x = this.leftRig.group.position.x + lw / 2;
    b0.scale.set(lw * 1.5, 1.1, 1);
    const b1 = this.blobs[1];
    b1.position.x = rx + rw / 2;
    b1.scale.set(rw * 1.5, 1.1, 1);
    // the joining shadow: grows as the gap closes, gone when far apart
    const b2 = this.blobs[2];
    const gapC = (this.leftRig.group.position.x + lw + rx) / 2;
    b2.position.x = gapC;
    const closeness = 1 - smoothstep(0.35, 0.95, this.clearance);
    b2.scale.set(Math.max(0.001, (this.clearance + 0.5) * 1.4), 0.95, 1);
    (b2.material as THREE.MeshBasicMaterial).opacity = 0.3 * closeness;
  }

  private updateChute(dt: number): void {
    const targetX = dropX(this.pair, this.spacingVisual);
    this.facility.chute.position.x = damp(this.facility.chute.position.x, targetX, 5, dt);
  }
}

function makeBlobTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(0,0,0,0.85)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}
