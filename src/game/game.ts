import * as THREE from 'three';
import { GameScene } from '../scene/scene';
import { SoftAudio } from '../core/audio';
import { setToolChip, pulseChip } from '../ui';

export type Phase =
  | 'intro'
  | 'inspect'
  | 'clean'
  | 'fill'
  | 'cure'
  | 'polish'
  | 'test'
  | 'free';

/**
 * The understanding the game is built around:
 *   light stops → raking light shows dirt & cracks stop it →
 *   wash/fill/polish exactly as far as you worked → light follows your trail.
 * Every phase feeds that one causal rule; nothing is scored or timed.
 */
export class Game {
  phase: Phase = 'intro';
  private phaseT = 0;
  private idleT = 0;
  readonly timeScale: number;

  // input
  private pointerDown = false;
  private px = 0;
  private py = 0;
  private lastPx = 0;
  private lastPy = 0;
  private pointerSpeed = 0; // px/s smoothed
  private raycaster = new THREE.Raycaster();
  private dragTarget: 'horn' | 'prism' | 'mirror' | 'screen' | null = null;

  // inspect
  lampSweep = 0.15;
  private prevSweep = 0.15;
  private sweepMin = 0.15;
  private sweepMax = 0.15;
  private dewShown = false;
  private nudging = false;
  private discoverCooldown = 0;

  // clean / polish stroke continuity (frame-rate independent coverage)
  private initialDirt: number;
  private lightSteps = 0;
  private lastStrokeT: number | null = null;

  // cure
  private cureAim = 0.5;

  // free
  private restT = 0;

  private blockInfo: { front: number; blocker: string; crackIndex: number };
  private introFront = 0.02;

  constructor(
    readonly gs: GameScene,
    readonly audio: SoftAudio,
    timeScale = 1
  ) {
    this.timeScale = timeScale;
    this.initialDirt = gs.horn.dirtRemaining();
    this.blockInfo = gs.horn.computeLightFront();
    this.bindInput();
    setToolChip(null);
    gs.horn.lightFront = 0.02;
    gs.horn.lightPower = 0;
  }

  // ------------------------------------------------------------------ input

  private bindInput() {
    const el = this.gs.renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      this.audio.unlock();
      this.pointerDown = true;
      this.px = this.lastPx = e.clientX;
      this.py = this.lastPy = e.clientY;
      this.idleT = 0;
      this.dragTarget = this.pickDragTarget(e.clientX, e.clientY);
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.pointerDown) return;
      this.px = e.clientX;
      this.py = e.clientY;
      this.idleT = 0;
    });
    const up = () => {
      this.pointerDown = false;
      this.dragTarget = null;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  private ndc(x: number, y: number): THREE.Vector2 {
    return new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  }

  private pickDragTarget(x: number, y: number): 'horn' | 'prism' | 'mirror' | 'screen' {
    this.raycaster.setFromCamera(this.ndc(x, y), this.gs.camera);
    const prismHit = this.raycaster.intersectObject(this.gs.prism.group, true);
    // generous prism grab: direct hit or near it on screen
    if (prismHit.length > 0) return 'prism';
    const pScr = this.worldToScreen(this.gs.prism.group.position);
    if (pScr && Math.hypot(pScr.x - x, pScr.y - y) < 90) return 'prism';
    const mScr = this.worldToScreen(
      this.gs.mirror.group.position.clone().add(new THREE.Vector3(0, 0.12, 0))
    );
    if (mScr && Math.hypot(mScr.x - x, mScr.y - y) < 80) return 'mirror';
    const hornHit = this.raycastHorn(x, y);
    if (hornHit) return 'horn';
    return 'screen';
  }

  worldToScreen(w: THREE.Vector3): { x: number; y: number } | null {
    const v = w.clone().project(this.gs.camera);
    if (v.z > 1) return null;
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  /**
   * Raycast the horn → {t, u}. The true surface hit wins whenever the ray
   * touches the horn at all; the fat proxy only widens the touch area. For
   * proxy-only touches, t comes from the point on the horn AXIS closest to
   * the ray — projecting the proxy's entry point would shift the work point
   * tipward of the finger (parallax), which breaks "scrub the dirt you see".
   */
  raycastHorn(x: number, y: number): { t: number; u: number } | null {
    this.raycaster.setFromCamera(this.ndc(x, y), this.gs.camera);
    const hornHits = this.raycaster.intersectObject(this.gs.horn.mesh, false);
    if (hornHits.length && hornHits[0].uv) {
      return { t: THREE.MathUtils.clamp(hornHits[0].uv.y, 0, 1), u: hornHits[0].uv.x };
    }
    const proxyHits = this.raycaster.intersectObject(this.gs.hornProxy, false);
    if (!proxyHits.length) return null;
    // closest point between the touch ray and the horn axis line
    const base = this.gs.hornBase();
    const tip = this.gs.hornTip();
    const axis = tip.clone().sub(base);
    const len = axis.length();
    axis.divideScalar(len);
    const o = this.raycaster.ray.origin;
    const d = this.raycaster.ray.direction;
    const w0 = o.clone().sub(base);
    const b = d.dot(axis);
    const denom = 1 - b * b;
    if (Math.abs(denom) < 1e-4) return null;
    const s = (w0.dot(axis) - b * w0.dot(d)) / denom;
    const t = THREE.MathUtils.clamp(s / len, 0, 1);
    // u from where the ray passes the axis (which side was touched)
    const rayT = (b * s - w0.dot(d)) / 1; // param along ray of closest point
    const p = o.clone().addScaledVector(d, Math.max(0, rayT));
    const local = this.gs.horn.mesh.worldToLocal(p);
    const u = ((Math.atan2(local.z, local.x) / (Math.PI * 2)) % 1 + 1) % 1;
    return { t, u };
  }

  /**
   * Work applies exactly where the finger is (a child scrubs the dirt they
   * see); only the tool MODEL is drawn offset above so it never hides the
   * work. Groove magnetization forgives imprecision.
   */
  private workPoint(): { t: number; u: number } | null {
    return this.raycastHorn(this.px, this.py);
  }

  /**
   * Absolute finger→axis mapping: where along the horn axis (t 0..1) the
   * pointer sits, judged in screen space. Frame-rate independent — the lamp
   * and the mirror aim simply follow the finger.
   */
  private axisTUnderPointer(): number | null {
    const a = this.worldToScreen(this.gs.hornAxisPoint(0));
    const b = this.worldToScreen(this.gs.hornAxisPoint(1));
    if (!a || !b) return null;
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const len2 = vx * vx + vy * vy;
    if (len2 < 1) return null;
    return ((this.px - a.x) * vx + (this.py - a.y) * vy) / len2;
  }

  /** Rail z closest to the current pointer ray (prism magnetization). */
  private railZUnderPointer(): number | null {
    const rail = this.gs.workshop.prismRail;
    this.raycaster.setFromCamera(this.ndc(this.px, this.py), this.gs.camera);
    const o = this.raycaster.ray.origin;
    const d = this.raycaster.ray.direction;
    const p0 = new THREE.Vector3(rail.x, rail.y, 0);
    const ez = new THREE.Vector3(0, 0, 1);
    // closest point between ray (o + t·d) and line (p0 + s·ez)
    const w0 = o.clone().sub(p0);
    const b = d.dot(ez);
    const denom = 1 - b * b;
    if (Math.abs(denom) < 1e-4) return null;
    const s = (b * -w0.dot(d) + w0.dot(ez)) / denom;
    return s;
  }

  /** Project a drag delta onto a world direction, returns scalar in world units. */
  private dragAlong(worldFrom: THREE.Vector3, worldDir: THREE.Vector3): number {
    const a = this.worldToScreen(worldFrom);
    const b = this.worldToScreen(worldFrom.clone().addScaledVector(worldDir, 0.1));
    if (!a || !b) return 0;
    const sx = b.x - a.x;
    const sy = b.y - a.y;
    const len2 = sx * sx + sy * sy;
    if (len2 < 1) return 0;
    const dx = this.px - this.lastPx;
    const dy = this.py - this.lastPy;
    return ((dx * sx + dy * sy) / len2) * 0.1;
  }

  // ------------------------------------------------------------------ phases

  private setPhase(p: Phase) {
    this.phase = p;
    this.phaseT = 0;
    this.idleT = 0;
    this.lastStrokeT = null;
    const gs = this.gs;
    gs.rinse.reset();
    gs.resin.reset();
    gs.cloth.reset();
    gs.brush.reset();
    gs.rinse.updateHose();
    gs.water.setStream(null, null, 0, gs.horn, 0);
    gs.resinBead.set(null, 0);
    gs.sunBeamIn.mesh.visible = false;
    gs.sunBeamOut.mesh.visible = false;
    if (p !== 'cure') gs.sunSpot.hide();
    // a drag straddling a phase change must not carry into the new tool
    this.dragTarget = null;
    this.audio.setWater(0);
    switch (p) {
      case 'inspect':
        gs.transitionTo('work', 1.8 / this.timeScale);
        gs.rootGlow.level = 0;
        setToolChip('lamp');
        break;
      case 'clean':
        setToolChip('rinse');
        break;
      case 'fill':
        setToolChip('resin');
        break;
      case 'cure':
        gs.transitionTo('cure', 1.4 / this.timeScale);
        setToolChip('mirror');
        break;
      case 'polish':
        gs.transitionTo('work', 1.4 / this.timeScale);
        setToolChip('cloth');
        break;
      case 'test':
        gs.transitionTo('test', 2.2 / this.timeScale);
        setToolChip(null);
        gs.dew.hide();
        break;
      case 'free':
        setToolChip('play');
        break;
    }
  }

  update(rawDt: number, time: number) {
    const dt = Math.min(0.05, rawDt) * this.timeScale;
    this.phaseT += dt;
    const gs = this.gs;

    // pointer speed (screen px/s)
    const pdx = this.px - this.lastPx;
    const pdy = this.py - this.lastPy;
    const spd = Math.hypot(pdx, pdy) / Math.max(rawDt, 0.001);
    this.pointerSpeed = THREE.MathUtils.lerp(this.pointerSpeed, this.pointerDown ? spd : 0, 0.25);
    if (!this.pointerDown) this.idleT += dt;

    this.blockInfo = gs.horn.computeLightFront();

    switch (this.phase) {
      case 'intro':
        this.updateIntro(dt, time);
        break;
      case 'inspect':
        this.updateInspect(dt, time);
        break;
      case 'clean':
        this.updateClean(dt, time);
        break;
      case 'fill':
        this.updateFill(dt, time);
        break;
      case 'cure':
        this.updateCure(dt, time);
        break;
      case 'polish':
        this.updatePolish(dt, time);
        break;
      case 'test':
        this.updateTest(dt, time);
        break;
      case 'free':
        this.updateFree(dt, time);
        break;
    }

    // shared: dew and the light-front glow follow the causal front
    gs.frontGlow.level =
      this.phase === 'test' || this.phase === 'free'
        ? 0
        : this.phase === 'intro'
          ? Math.min(1, gs.horn.lightPower)
          : 1;
    gs.frontGlow.boost = this.phase === 'intro' ? 1.7 : 1;
    gs.frontGlow.update(gs.horn, time);
    gs.dew.update(dt, gs.horn, this.blockInfo.front);
    gs.water.update(dt, gs.horn, this.blockInfo.front, gs.workshop.tray.position);
    gs.rootGlow.update(gs.hornBase(), time);
    this.lastPx = this.px;
    this.lastPy = this.py;
  }

  // -------------------------------------------------------- intro (the puzzle)

  private updateIntro(dt: number, time: number) {
    const gs = this.gs;
    const t = this.phaseT;
    // 0-1.5s: quiet workshop. 1.5s: light gathers at the root.
    gs.rootGlow.level = THREE.MathUtils.clamp((t - 1.2) / 1.2, 0, 1) * 0.9;
    // 2.5s+: the light tries to travel — and stalls at the first blockage
    if (t > 2.5) {
      gs.horn.lightPower = Math.min(1, (t - 2.5) / 1.0);
      const target = this.blockInfo.front;
      this.introFront = Math.min(target, this.introFront + dt * 0.16);
      gs.horn.lightFront = this.introFront;
      gs.horn.tipFlicker = THREE.MathUtils.clamp((t - 3.5) / 1.0, 0, 1);
    }
    // 4s+: faint, interrupted band on the wall; unstable sputter from the tip
    if (t > 4) {
      // sputtering, mostly-off trickle: the light is NOT getting through
      const sput = Math.sin(time * 9) * Math.sin(time * 3.7);
      const flick = sput > 0.35 ? 0.18 : 0.04;
      gs.beam.set(gs.hornTip(), gs.prismWorld(), flick, time);
      const sp = gs.spectrumParams();
      gs.spectrum.set(sp.center, sp.dir, 0.05, 0.5, 0.3, 0.38, time);
    }
    // 5.5s: dew appears and creeps to the first dirty stretch
    if (t > 5.5 && !gs.dew.active) gs.dew.start(0.04);
    if (t > 7.5) {
      this.setPhase('inspect');
    }
  }

  // ------------------------------------------------- inspect (raking light)

  private updateInspect(dt: number, time: number) {
    const gs = this.gs;
    gs.lamp.setOn(true);

    // the lamp follows the finger: any drag maps to a position along the horn
    if (this.pointerDown) {
      const t = this.axisTUnderPointer();
      if (t !== null) {
        const target = THREE.MathUtils.clamp(t, 0.02, 0.98);
        this.lampSweep = THREE.MathUtils.lerp(
          this.lampSweep,
          target,
          1 - Math.pow(0.002, dt)
        );
      }
      this.nudging = false;
    }

    // gentle auto-nudge if the child hesitates a long time: the lamp drifts
    // a few centimetres TOWARD the trouble spot and stops short — showing
    // where to look, never doing the looking. Discovery stays the child's.
    const undiscovered = gs.horn.cracks.find((c) => !c.discovered);
    if (this.idleT > 12 && undiscovered) {
      this.nudging = true;
    }
    if (this.nudging && undiscovered) {
      const side = Math.sign(this.lampSweep - undiscovered.v) || 1;
      const stopShort = undiscovered.v + side * 0.11;
      this.lampSweep = THREE.MathUtils.lerp(this.lampSweep, stopShort, dt * 0.7);
    }
    // 6s idle: the unicorn's eyes and ear turn toward the trouble spot
    if (this.idleT > 6 && undiscovered) {
      gs.unicorn.lookAt(gs.horn.crackPointWorld(undiscovered), 1);
    }

    gs.lamp.aimAt(gs.hornAxisPoint(this.lampSweep));

    // discovery: the raking highlight crossing a crack makes it glint.
    // Judged over the swept interval so a fast swipe cannot skip a crack —
    // but at most one discovery fires per beat, so each glint gets its own
    // moment instead of one smear finding everything at once.
    this.discoverCooldown = Math.max(0, this.discoverCooldown - dt);
    const lo = Math.min(this.prevSweep, this.lampSweep) - 0.045;
    const hi = Math.max(this.prevSweep, this.lampSweep) + 0.045;
    if (this.discoverCooldown <= 0) {
      for (const c of gs.horn.cracks) {
        if (!c.discovered && c.v > lo && c.v < hi) {
          c.discovered = true;
          c.glint = 1;
          this.audio.chime(880, 0.7, 0.1);
          this.discoverCooldown = 1.4;
          break;
        }
      }
    }
    // sweeping past the first grime wakes the dew-drop demonstration
    if (!this.dewShown && hi > this.firstDirtT() - 0.05) {
      this.dewShown = true;
      if (!gs.dew.active) gs.dew.start(0.04);
    }
    this.prevSweep = this.lampSweep;
    this.sweepMin = Math.min(this.sweepMin, this.lampSweep);
    this.sweepMax = Math.max(this.sweepMax, this.lampSweep);

    // move on only once the child has really looked: all glints found, the
    // dew shown, the lamp actually travelled the horn, and a beat of rest
    const allFound = gs.horn.cracks.every((c) => c.discovered);
    const lookedEnough = this.sweepMax - this.sweepMin > 0.35 || this.phaseT > 14;
    if (allFound && this.dewShown && this.phaseT > 6 && lookedEnough) {
      this.setPhase('clean');
      this.audio.chime(659, 0.8, 0.12);
    }
    void time;
  }

  private firstDirtT(): number {
    for (let i = 0; i < 256; i++) {
      if (this.gs.horn.dirt[i] > 0.3) return i / 255;
    }
    return 1;
  }

  // ------------------------------------------------------- clean (the aha)

  private updateClean(dt: number, time: number) {
    const gs = this.gs;
    gs.lamp.setOn(true, 0.55);
    gs.lamp.aimAt(gs.hornAxisPoint(Math.min(0.6, this.blockInfo.front + 0.1)));
    if (!gs.dew.active) gs.dew.start(0.04);

    const wp = this.pointerDown && this.dragTarget === 'horn' ? this.workPoint() : null;
    if (wp) {
      // speed shapes the water, not success: fast = long thin stream,
      // slow = pooling in the groove. Both clean.
      const fast = THREE.MathUtils.clamp(this.pointerSpeed / 900, 0, 1);
      // paced so one careful pass washes about a third: the child watches
      // water and light gain ground stroke by stroke, not all at once
      const rate = 0.7 + fast * 0.4;
      this.strokeApply(wp.t, (t, k) =>
        gs.horn.cleanAt(t, 0.042 + (1 - fast) * 0.012, dt * rate * k)
      );
      // anchor the wand and its stream on the touched (visible) side
      const surface = gs.horn.surfacePointWorld(wp.u, wp.t);
      const n = gs.horn.surfaceNormalWorld(wp.u, wp.t);
      const wandTip = surface.clone().addScaledVector(n, 0.035 + fast * 0.03);
      // wand leans in from above like a held tool, never end-on to the camera
      const wandAim = n.clone().negate().add(new THREE.Vector3(0.25, -1.0, 0.2)).normalize();
      gs.rinse.holdAt(wandTip, wandAim, dt);
      gs.water.setStream(wandTip, surface, wp.t, gs.horn, 1 - fast * 0.5);
      this.audio.setWater(0.5 + fast * 0.5);
    } else {
      this.lastStrokeT = null;
      gs.rinse.release(dt);
      gs.water.setStream(null, null, 0, gs.horn, 0);
      this.audio.setWater(0);
    }
    gs.rinse.updateHose();

    // light follows the cleaned trail — same distance, same moment
    this.followFront(dt, time);

    // idle → chip pulse + unicorn glances at the next dirty stretch
    if (this.idleT > 8) {
      pulseChip(true);
      const t0 = this.firstDirtT();
      if (t0 < 1) gs.unicorn.lookAt(gs.horn.groovePointWorld(t0), 0.8);
    } else pulseChip(false);

    // done when no dirt is left that can block the light (the causal rule),
    // and the groove is visually clean overall
    const remaining = gs.horn.dirtRemaining();
    if (this.blockInfo.blocker !== 'dirt' && remaining < Math.max(0.03, this.initialDirt * 0.12)) {
      // washed clean — light runs to the first crack and waits there
      this.audio.setWater(0);
      this.setPhase('fill');
      this.audio.chime(659, 0.8, 0.12);
    }
  }

  /**
   * Apply a stroke continuously from the previous frame's work point to the
   * current one, so slow frames (or fast fingers) never leave gaps.
   */
  private strokeApply(t: number, fn: (t: number, share: number) => void) {
    const prev = this.lastStrokeT;
    this.lastStrokeT = t;
    if (prev === null || Math.abs(t - prev) < 0.015 || Math.abs(t - prev) > 0.4) {
      fn(t, 1);
      return;
    }
    const n = Math.min(24, Math.ceil(Math.abs(t - prev) / 0.015));
    for (let i = 1; i <= n; i++) {
      fn(prev + ((t - prev) * i) / n, 1);
    }
  }

  /** Light front chases the causal front; chimes as it gains ground. */
  private followFront(dt: number, _time: number) {
    const gs = this.gs;
    const target = this.blockInfo.front;
    if (gs.horn.lightFront < target - 0.005) {
      gs.horn.lightFront = Math.min(target, gs.horn.lightFront + dt * 0.22);
      const step = Math.floor(gs.horn.lightFront * 8);
      if (step > this.lightSteps) {
        this.lightSteps = step;
        this.audio.lightAdvance(step);
      }
    } else if (gs.horn.lightFront > target + 0.01) {
      gs.horn.lightFront = Math.max(target, gs.horn.lightFront - dt * 0.3);
    }
    gs.horn.tipFlicker = Math.max(0, gs.horn.tipFlicker - dt * 0.4);
  }

  // ------------------------------------------------------------ fill (resin)

  private updateFill(dt: number, time: number) {
    const gs = this.gs;
    gs.lamp.setOn(true, 0.55);
    const targetCrack = gs.horn.cracks.find((c) => c.fill < 0.95);
    if (targetCrack) gs.lamp.aimAt(gs.horn.crackPointWorld(targetCrack));

    const wp = this.pointerDown && this.dragTarget === 'horn' ? this.workPoint() : null;
    let squeezing = false;
    if (wp) {
      const ci = gs.horn.nearestCrack(wp.u, wp.t, 0.14);
      if (ci >= 0) {
        const c = gs.horn.cracks[ci];
        const p = gs.horn.crackPointWorld(c, (c.fill * 2 - 1) * 0.8);
        const n = gs.horn.surfaceNormalWorld(c.u, c.v);
        const tip = p.clone().addScaledVector(n, 0.006);
        gs.resin.holdAt(tip.clone().addScaledVector(n, 0.02), n.clone().negate(), dt);
        gs.horn.fillCrack(ci, dt * 0.4);
        gs.resin.setLevel(gs.resin.level - dt * 0.06);
        gs.resinBead.set(tip, 0.4 + 0.3 * Math.sin(time * 6));
        squeezing = true;
        if (c.fill >= 0.95 && c.glint <= 0) {
          c.glint = 0.5; // soft confirmation shimmer
          this.audio.chime(784, 0.6, 0.09);
        }
      } else {
        // near the horn but not a crack: syringe hovers, nothing is wasted
        const n = gs.horn.surfaceNormalWorld(wp.u, wp.t);
        const hover = gs.horn.groovePointWorld(wp.t).addScaledVector(n, 0.03);
        gs.resin.holdAt(hover, n.clone().negate(), dt);
      }
    } else {
      gs.resin.release(dt);
    }
    if (!squeezing) gs.resinBead.set(null, 0);

    this.followFront(dt, time);
    // resin passed but uncured: the light gets through, wavering
    const filledUncured = gs.horn.cracks.some((c) => c.fill > 0.9 && c.cured < 0.9);
    gs.horn.lightPower = filledUncured ? 1 + Math.sin(time * 8.5) * 0.13 : 1;

    if (this.idleT > 8 && targetCrack) {
      pulseChip(true);
      gs.unicorn.lookAt(gs.horn.crackPointWorld(targetCrack), 0.8);
    } else pulseChip(false);

    if (gs.horn.cracks.every((c) => c.fill >= 0.95) && this.phaseT > 1.5) {
      this.setPhase('cure');
      this.audio.chime(659, 0.8, 0.12);
    }
  }

  // ------------------------------------------- cure (sunlight via the mirror)

  private updateCure(dt: number, time: number) {
    const gs = this.gs;
    gs.lamp.setOn(false);

    if (this.pointerDown) {
      // any drag tilts the mirror: the sun spot follows the finger's
      // position along the horn
      const t = this.axisTUnderPointer();
      if (t !== null) {
        this.cureAim = THREE.MathUtils.lerp(
          this.cureAim,
          THREE.MathUtils.clamp(t, 0.1, 0.95),
          1 - Math.pow(0.002, dt)
        );
      }
    }

    // wide magnetic snap onto the nearest uncured resin
    const uncured = gs.horn.cracks.filter((c) => c.fill > 0.9 && c.cured < 1);
    let spotT = this.cureAim;
    let curing: (typeof gs.horn.cracks)[number] | null = null;
    for (const c of uncured) {
      if (Math.abs(this.cureAim - c.v) < 0.13) {
        spotT = THREE.MathUtils.lerp(spotT, c.v, 0.7);
        curing = c;
        break;
      }
    }
    const spotPos = gs.hornAxisPoint(spotT).addScaledVector(gs.horn.grooveNormalWorld(spotT), 0.012);
    gs.sunSpot.setAt(spotPos, curing ? 1 : 0.55);
    gs.mirror.update(gs.workshop.windowCenter, spotPos);
    // the visible optical path: window sun → mirror face → resin
    const mirrorHead = gs.mirror.group.position.clone().add(new THREE.Vector3(0, 0.125, 0));
    gs.sunBeamIn.set(gs.workshop.windowCenter, mirrorHead, curing ? 0.22 : 0.14, time);
    gs.sunBeamOut.set(mirrorHead, spotPos, curing ? 0.65 : 0.35, time);

    if (curing) {
      curing.cured = Math.min(1, curing.cured + dt * 0.5);
      if (curing.cured >= 1) this.audio.chime(740, 0.7, 0.1);
    }
    // liquid highlight settles into a calm translucent solid (shader B.w)

    gs.horn.lightPower =
      gs.horn.cracks.some((c) => c.cured < 0.9) ? 1 + Math.sin(time * 8.5) * 0.1 : 1;
    this.followFront(dt, time);

    if (this.idleT > 8 && uncured.length) {
      pulseChip(true);
      gs.unicorn.lookAt(gs.horn.crackPointWorld(uncured[0]), 0.8);
    } else pulseChip(false);

    if (gs.horn.cracks.every((c) => c.cured >= 1) && this.phaseT > 1) {
      gs.sunSpot.setAt(null, 0);
      this.setPhase('polish');
      this.audio.chime(659, 0.8, 0.12);
    }
  }

  // ------------------------------------------------------- polish (the sheen)

  private updatePolish(dt: number, time: number) {
    const gs = this.gs;
    gs.lamp.setOn(true, 0.6);
    gs.lamp.aimAt(gs.hornAxisPoint(0.55));

    const wp = this.pointerDown && this.dragTarget === 'horn' ? this.workPoint() : null;
    if (wp) {
      this.strokeApply(wp.t, (t, k) => gs.horn.polishAt(t, 0.05, dt * 1.4 * k));
      const surface = gs.horn.surfacePointWorld(wp.u, wp.t);
      const n = gs.horn.surfaceNormalWorld(wp.u, wp.t);
      gs.cloth.holdAt(surface.clone().addScaledVector(n, 0.012), n.clone().negate(), dt);
      if (Math.random() < dt * 4) this.audio.swish();
    } else {
      this.lastStrokeT = null;
      gs.cloth.release(dt);
    }
    this.followFront(dt, time);

    if (this.idleT > 8) pulseChip(true);
    else pulseChip(false);

    const covered = gs.horn.polishCoverage(0.12, 0.92);
    const smoothedAll = gs.horn.cracks.every((c) => c.smoothed > 0.8 || c.overfill < 0.1);
    if (covered > 0.72 && smoothedAll && this.phaseT > 2) {
      this.setPhase('test');
    }
  }

  // ------------------------------------------------ test (light runs through)

  private updateTest(dt: number, time: number) {
    const gs = this.gs;
    gs.lamp.setOn(false);
    const t = this.phaseT;
    gs.rootGlow.level = THREE.MathUtils.clamp(t / 1.2, 0, 1) * (t > 4 ? Math.max(0, 1.5 - (t - 4)) : 1);
    if (t > 1.2) {
      // the repaired horn carries the light straight through
      gs.horn.lightFront = Math.min(1, gs.horn.lightFront + dt * 0.28);
      gs.horn.lightPower = 1;
      gs.horn.tipFlicker = 0;
    }
    const arrived = gs.horn.lightFront >= 0.995;
    const beamK = arrived ? THREE.MathUtils.clamp((t - 3) * 0.8, 0, 1) : 0;
    gs.beam.set(gs.hornTip(), gs.prismWorld(), beamK, time);
    const sp = gs.spectrumParams();
    const crisp = 0.35 + gs.horn.polishCoverage() * 0.6;
    gs.spectrum.set(sp.center, sp.dir, 0.06, beamK * 0.95, crisp, 1, time);
    if (arrived && t > 3 && t < 3.1 && beamK < 0.1) this.audio.success();
    if (t > 6.5) this.setPhase('free');
  }

  // ---------------------------------------------- free play (owned knowledge)

  private updateFree(dt: number, time: number) {
    const gs = this.gs;

    if (this.pointerDown) {
      if (this.dragTarget === 'prism') {
        // the prism sticks to the finger: slide it to the rail point
        // nearest the touch ray (works from any camera angle)
        const z = this.railZUnderPointer();
        if (z !== null) {
          gs.prism.group.position.z = THREE.MathUtils.lerp(
            gs.prism.group.position.z,
            THREE.MathUtils.clamp(z, gs.workshop.prismRail.zMin, gs.workshop.prismRail.zMax),
            0.35
          );
        }
      } else if (this.dragTarget === 'mirror') {
        // mirror = light amount: raise or lower the fed light
        gs.freeLight = THREE.MathUtils.clamp(gs.freeLight - (this.py - this.lastPy) * 0.004, 0.55, 1.3);
      } else if (this.dragTarget === 'horn') {
        const wp = this.workPoint();
        if (wp) {
          // rubbing keeps refining the sheen…
          gs.horn.polishAt(wp.t, 0.05, dt * 0.9);
          const surface = gs.horn.surfacePointWorld(wp.u, wp.t);
          const n = gs.horn.surfaceNormalWorld(wp.u, wp.t);
          gs.cloth.holdAt(surface.clone().addScaledVector(n, 0.012), n.clone().negate(), dt);
        }
        // …and a sideways pull turns the horn a little
        const axisDir = gs.hornAxisPoint(1).sub(gs.hornAxisPoint(0)).normalize();
        const side = new THREE.Vector3(0, 0, 1);
        const d = this.dragAlong(gs.hornAxisPoint(0.8), side);
        void axisDir;
        gs.hornYaw = THREE.MathUtils.clamp(gs.hornYaw + d * 1.1, -0.16, 0.16);
        gs.unicorn.hornAnchor.rotation.y = -gs.hornYaw;
      }
    } else {
      gs.cloth.release(dt);
      // horn settles gently back toward center
      gs.hornYaw = THREE.MathUtils.lerp(gs.hornYaw, 0, dt * 0.4);
      gs.unicorn.hornAnchor.rotation.y = -gs.hornYaw;
    }

    gs.horn.lightFront = 1;
    gs.horn.lightPower = gs.freeLight;
    const beamStr = 0.85 * gs.freeLight;
    gs.beam.set(gs.hornTip(), gs.prismWorld(), beamStr, time);
    const sp = gs.spectrumParams();
    const crisp = 0.35 + gs.horn.polishCoverage() * 0.6;
    gs.spectrum.set(
      sp.center,
      sp.dir,
      0.05 + 0.03 * gs.freeLight,
      0.9 * gs.freeLight,
      crisp,
      1,
      time
    );
    gs.rootGlow.level = 0.25 * gs.freeLight;

    // the unicorn relaxes, occasionally watching the colors on the wall
    this.restT += dt;
    if (this.restT > 6) {
      const wallPoint = new THREE.Vector3(1.7, 1.0, gs.prism.group.position.z);
      gs.unicorn.lookAt(wallPoint, 0.5);
      if (this.restT > 9) this.restT = 0;
    }
  }

  // ---------------------------------------------------------------- external

  /** Introspection for tests & tuning. */
  snapshot() {
    const gs = this.gs;
    return {
      phase: this.phase,
      lightFront: gs.horn.lightFront,
      blockFront: this.blockInfo.front,
      blocker: this.blockInfo.blocker,
      dirtRemaining: gs.horn.dirtRemaining(),
      initialDirt: this.initialDirt,
      polish: gs.horn.polishCoverage(),
      cracks: gs.horn.cracks.map((c) => ({
        v: c.v,
        u: c.u,
        fill: c.fill,
        cured: c.cured,
        smoothed: c.smoothed,
        overfill: c.overfill,
        discovered: c.discovered,
      })),
      lampSweep: this.lampSweep,
      cureAim: this.cureAim,
      prismZ: gs.prism.group.position.z,
    };
  }
}
