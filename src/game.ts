import * as THREE from 'three';
import { AudioFx, clamp, damp, lerp, mulberry32, setThreadSun, smoothstep } from './core';
import { buildWorld, WorldRefs } from './world';
import { Unicorn } from './unicorn';
import { ActiveThread, Droplet, DropletField, HornSpool, THREAD_COLORS } from './threads';
import { Bridge } from './bridge';

/**
 * State flow — one continuous causal chain, never a cut-scene:
 * INTRO → DISCOVER → FIRSTWIND → COLLECT → GOANCHOR → ANCHORED →
 * SPAN → WEAVE → CLOSE → TEST → CROSSREADY → CROSSING → AFTER
 */
export type GameState =
  | 'INTRO' | 'DISCOVER' | 'FIRSTWIND' | 'COLLECT'
  | 'GOANCHOR' | 'ANCHORED' | 'SPAN' | 'WEAVE' | 'CLOSE'
  | 'TEST' | 'TESTING' | 'CROSSREADY' | 'CROSSING' | 'AFTER';

const WIND_RATIO = 4;          // quarter of a finger-circle = one wrap on the horn
const NEED_TURNS = 12;         // 4 support lines + weave + the closing wrap
const WEAVE_TURNS = 1.5;       // finger circles to weave the deck
const HOOK_DIST = 0.16;

interface PointerSample { x: number; y: number; t: number }

export class Game {
  state: GameState = 'INTRO';
  errors: string[] = [];

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private world: WorldRefs;
  private unicorn: Unicorn;
  private droplets: DropletField;
  private spool: HornSpool;
  private liveThread: ActiveThread;
  private anchorThread: ActiveThread;
  private bridge: Bridge;
  private audio = new AudioFx();
  private rng: () => number;

  private hooked: Droplet | null = null;
  private windSign = 0;          // dominant winding direction (±1)
  private signVotes = 0;

  private time = 0;
  private idleTimer = 0;
  private gustDroplet: Droplet | null = null;
  private gustT = -1;

  // pointer / gesture
  private pointerDown = false;
  private samples: PointerSample[] = [];
  private lastAngle: number | null = null;
  private gestureSpeed = 0;      // rad/s smoothed
  private gestureRadius = 0;     // px
  private windPhase = 0;
  private aimHold = 0;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();

  // camera rig
  private camPos = new THREE.Vector3(4, 3, 12);
  private camLook = new THREE.Vector3(0, 1, 0);
  private camFov = 50;

  // span/bridge bookkeeping
  private spanScreenDir = new THREE.Vector2(0, -1);
  private closeProgress = 0;
  private crossT = 0;
  private loadClock = 0;
  private railSide: 0 | 1 = 0;
  private afterWalkBusy = false;

  private tmp = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private el: HTMLElement;

  readonly e2e: boolean;

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
    el: HTMLElement
  ) {
    this.scene = scene;
    this.camera = camera;
    this.el = el;

    const params = new URLSearchParams(location.search);
    this.e2e = params.get('e2e') === '1';
    let seed: number;
    if (params.get('seed')) seed = Number(params.get('seed'));
    else if (this.e2e) seed = 12345;
    else {
      // each visit reshuffles droplet colours/positions a little
      let n = 0;
      try {
        n = Number(localStorage.getItem('rtb-plays') ?? '0');
        localStorage.setItem('rtb-plays', String(n + 1));
      } catch { /* private mode */ }
      seed = 1000 + n * 7919;
    }
    this.rng = mulberry32(seed);
    if (this.e2e) this.audio.enabled = false;

    this.world = buildWorld(scene, renderer);
    setThreadSun(this.world.sunDir);

    this.unicorn = new Unicorn(scene, this.world.groundY);
    this.droplets = new DropletField(scene, this.world.dropletMounts, this.rng);
    this.spool = new HornSpool(this.unicorn.hornSpec);
    this.liveThread = new ActiveThread(scene);
    this.anchorThread = new ActiveThread(scene);
    // bridge ends sit at the rim, clear of the stones; short ties carry the
    // load into the rock anchors so the force path stays readable
    const bNear = this.world.nearAnchor.groove.clone().add(new THREE.Vector3(-0.45, -0.14, -0.32));
    const bFar = this.world.farAnchor.pos.clone().add(new THREE.Vector3(-0.45, -0.22, 0.42));
    this.bridge = new Bridge(scene, bNear, bFar, this.rng, {
      near: this.world.nearAnchor.groove, far: this.world.farAnchor.pos
    });

    this.unicorn.onFootfall = (pos, soft) => {
      const deck = this.bridge.deckInfo(pos.x, pos.z);
      if (deck) {
        this.bridge.setLoad(deck.s, 0.85);
        this.audio.clop(false);
      } else {
        this.audio.clop(soft);
      }
    };

    // shadow follows the action
    this.world.sun.target.position.set(0, 0, -1);

    this.bindInput();
    this.installDebugApi();

    // opening gaze: the herd's hoofprints across the gap
    this.unicorn.setGaze(new THREE.Vector3(0.4, 0.6, -9));
    window.setTimeout(() => { if (this.state === 'INTRO') this.enter('DISCOVER'); }, this.e2e ? 300 : 4200);
  }

  // ================================================================ input

  private bindInput(): void {
    const el = this.el;
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      this.audio.init();
      this.pointerDown = true;
      this.idleTimer = 0;
      this.samples = [];
      this.lastAngle = null;
      this.pushSample(e.clientX, e.clientY);
      this.onTap(e.clientX, e.clientY);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.pointerDown) return;
      this.idleTimer = 0;
      this.pushSample(e.clientX, e.clientY);
      this.onDrag(e.clientX, e.clientY);
    });
    const up = () => {
      this.pointerDown = false;
      this.lastAngle = null;
      this.gestureSpeed = 0;
      this.unicorn.setWindMotion(null);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  private pushSample(x: number, y: number): void {
    const now = performance.now();
    this.samples.push({ x, y, t: now });
    if (this.samples.length > 14) this.samples.shift();
  }

  /** Signed angular increment (rad) of the pointer about its recent centroid. */
  private gestureDelta(): number {
    if (this.samples.length < 5) return 0;
    let cx = 0, cy = 0;
    for (const s of this.samples) { cx += s.x; cy += s.y; }
    cx /= this.samples.length; cy /= this.samples.length;
    const last = this.samples[this.samples.length - 1];
    const r = Math.hypot(last.x - cx, last.y - cy);
    this.gestureRadius = damp(this.gestureRadius, r, 8, 1 / 60);
    if (r < 8) { this.lastAngle = null; return 0; }
    const ang = Math.atan2(last.y - cy, last.x - cx);
    if (this.lastAngle === null) { this.lastAngle = ang; return 0; }
    let d = ang - this.lastAngle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.lastAngle = ang;
    if (Math.abs(d) > 1.2) return 0;   // teleporting finger — ignore
    return d;
  }

  private screenRay(x: number, y: number): THREE.Raycaster {
    this.ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster;
  }

  /** Pointer → point on the vertical droplet plane (z const) for horn aiming. */
  private aimPoint(x: number, y: number, planeZ: number): THREE.Vector3 | null {
    const ray = this.screenRay(x, y).ray;
    if (Math.abs(ray.direction.z) < 1e-4) return null;
    const t = (planeZ - ray.origin.z) / ray.direction.z;
    if (t < 0) return null;
    const p = ray.origin.clone().addScaledVector(ray.direction, t);
    p.x = clamp(p.x, -3.2, 3.2);
    p.y = clamp(p.y, this.world.groundY(p.x, planeZ) + 0.15, 2.0);
    return p;
  }

  // ================================================================ taps & drags

  private onTap(x: number, y: number): void {
    switch (this.state) {
      case 'TEST': {
        // touch the new deck → the unicorn tests it with a forehoof
        const hit = this.rayToDeck(x, y);
        if (hit) this.beginTest();
        break;
      }
      case 'CROSSREADY': {
        const p = this.rayToGround(x, y);
        if (p && p.z < this.world.gapNearZ) this.beginCross();
        break;
      }
      case 'AFTER': {
        const p = this.rayToGround(x, y);
        if (p && !this.afterWalkBusy) this.freeWalk(p);
        break;
      }
      default: break;
    }
  }

  private onDrag(x: number, y: number): void {
    switch (this.state) {
      case 'DISCOVER':
      case 'FIRSTWIND':
      case 'COLLECT':
        this.dragCollect(x, y);
        break;
      case 'GOANCHOR':
      case 'ANCHORED':
        this.dragAnchor(x, y);
        break;
      case 'SPAN':
        this.dragSpan();
        break;
      case 'WEAVE':
      case 'CLOSE':
        this.dragWeave();
        break;
      case 'CROSSREADY': {
        // dragging toward the far side also starts the crossing
        const d = this.dragAlongSpan();
        if (d > 0.25) this.beginCross();
        break;
      }
      case 'AFTER':
        this.dragAfter();
        break;
      default: break;
    }
  }

  // ---------------------------------------------------------------- collect phase

  private dragCollect(x: number, y: number): void {
    const dTheta = this.gestureDelta();

    if (!this.hooked) {
      // guide the horn tip with the finger — offset upward so the fibre,
      // the tip and the catch all happen ABOVE the child's fingertip
      const p = this.aimPoint(x, y, 2.8);
      if (p) {
        p.y = Math.min(p.y + 0.22, 2.0);
        // magnet: droplets sit at slightly different depths than the aim
        // plane, so pull the target onto the nearest fibre end
        const tipV = new THREE.Vector3();
        let magnet: THREE.Vector3 | null = null;
        let bestD = 0.5;
        for (const d of this.droplets.list) {
          if (d.dead || d.turnsLeft <= 0.05) continue;
          d.tipWorld(tipV);
          const dist = Math.hypot(tipV.x - p.x, tipV.y - p.y);
          if (dist < bestD) { bestD = dist; magnet = tipV.clone(); }
        }
        if (magnet) p.copy(magnet);
        this.unicorn.setAimTarget(p);
        this.aimHold = 0.8;
        // does the fibre catch on the horn tip?
        const tip = this.unicorn.hornTipWorld(this.tmp);
        const cand = this.droplets.nearestHookable(tip, HOOK_DIST);
        if (cand) this.hook(cand);
        // …or rewind a dangling loop by circling forward
        if (this.spool.loose > 0 && dTheta !== 0) {
          const turns = Math.abs(dTheta) / (Math.PI * 2) * WIND_RATIO;
          if (Math.sign(dTheta) === this.windSign || this.windSign === 0) {
            this.spool.rewindLoose(turns, this.gestureSpeed);
          }
        } else if (dTheta !== 0 && this.windSign !== 0 && Math.sign(dTheta) === -this.windSign) {
          // reversing with nothing hooked: only a DELIBERATE reverse sheds a
          // wrap — stray scribbles must not undo a child's progress
          const turns = Math.abs(dTheta) / (Math.PI * 2) * WIND_RATIO;
          this.reverseAcc += turns;
          if (this.reverseAcc > 1.2 && this.spool.unwindTop(turns) > 0.001) {
            this.tickUnwindSound(turns);
          }
        } else if (dTheta !== 0) {
          this.reverseAcc = 0;
        }
      }
      return;
    }

    // hooked: circles wind, reverse circles unwind back to the drop
    if (dTheta === 0) return;
    const sp = Math.abs(dTheta) * 60; // rough rad/s
    this.gestureSpeed = damp(this.gestureSpeed, sp, 6, 1 / 60);
    this.windPhase += dTheta;
    this.unicorn.setWindMotion(this.windPhase, clamp(this.gestureRadius / (Math.min(window.innerWidth, window.innerHeight) * 0.28), 0.25, 1));

    const dir = Math.sign(dTheta);
    if (this.windSign === 0) { this.windSign = dir; }
    this.signVotes += dir;
    if (Math.abs(this.signVotes) > 40) this.windSign = Math.sign(this.signVotes);

    const turns = Math.abs(dTheta) / (Math.PI * 2) * WIND_RATIO;
    if (dir === this.windSign) {
      // a dangling loop rewinds first (it came off the horn, not the drop)
      let rem = turns - this.spool.rewindLoose(turns, this.gestureSpeed);
      const avail = Math.min(rem, this.hooked.turnsLeft);
      const wound = this.spool.wind(avail, this.gestureSpeed);
      if (wound > 0) {
        this.hooked.turnsLeft -= wound;
        this.pingProgress(wound);
        if (this.hooked.turnsLeft <= 0.03) this.exhaustDroplet();
      }
    } else {
      // reverse: one wrap at a time slips off and returns to the raindrop
      const back = this.spool.unwindActive(turns);
      if (back > 0) {
        this.hooked.turnsLeft = Math.min(3, this.hooked.turnsLeft + back);
        this.tickUnwindSound(back);
        if (this.spool.totalTurns <= 0.01 && this.state === 'FIRSTWIND') {
          // fully unwound before finishing the first wrap — stay in discovery
          this.unhook();
          this.enter('DISCOVER');
        }
      }
    }
  }

  private pingAcc = 0;
  private pingProgress(wound: number): void {
    this.pingAcc += wound;
    if (this.pingAcc >= 0.5 && this.hooked) {
      this.pingAcc = 0;
      this.audio.ping(this.hooked.colorDef.idx, this.gestureSpeed);
    }
  }
  private unwindAcc = 0;
  private tickUnwindSound(t: number): void {
    this.unwindAcc += t;
    if (this.unwindAcc >= 0.5) { this.unwindAcc = 0; this.audio.unwindTick(); }
  }

  private reverseAcc = 0;

  private hook(d: Droplet): void {
    this.reverseAcc = 0;
    this.hooked = d;
    d.hooked = true;
    this.spool.begin(d.colorDef.idx);
    this.liveThread.setColor(d.colorDef.color);
    this.audio.hook();
    if (this.state === 'DISCOVER') this.enter('FIRSTWIND');
  }

  private unhook(): void {
    if (this.hooked) this.hooked.hooked = false;
    this.hooked = null;
    this.liveThread.hide();
  }

  private exhaustDroplet(): void {
    if (!this.hooked) return;
    this.hooked.die();
    this.hooked = null;
    this.liveThread.hide();
    // she looks straight at the next droplet — the child follows her gaze
    const head = this.unicorn.headWorld(this.tmp);
    const next = this.droplets.nearestHookable(head, 9);
    if (next) this.unicorn.setGaze(next.tipWorld(this.tmpB));
    this.idleTimer = 18;   // re-arm the wind hint quickly if they stall here
  }

  // ---------------------------------------------------------------- anchor phase

  private dragAnchor(x: number, y: number): void {
    const groove = this.world.nearAnchor.groove;
    const p = this.aimPoint(x, y, groove.z + 0.35);
    if (!p) return;
    this.unicorn.setAimTarget(new THREE.Vector3(
      clamp(p.x, groove.x - 1.4, groove.x + 1.4),
      clamp(p.y, groove.y - 0.8, groove.y + 0.8),
      groove.z + 0.3
    ));
    this.aimHold = 0.8;
    if (this.state === 'GOANCHOR') {
      // arrived near the stone yet?
      const dx = this.unicorn.position.distanceTo(this.world.nearAnchor.standPos);
      if (dx < 0.5) this.enter('ANCHORED');
      return;
    }
    // ANCHORED: slot the horn tip into the crack
    const tip = this.unicorn.hornTipWorld(this.tmp);
    if (tip.distanceTo(groove) < 0.2) {
      this.audio.hook();
      this.enter('SPAN');
    }
  }

  // ---------------------------------------------------------------- span phase

  private computeSpanScreenDir(): void {
    const a = this.world.nearAnchor.groove.clone().project(this.camera);
    const b = this.world.farAnchor.pos.clone().project(this.camera);
    this.spanScreenDir.set(b.x - a.x, b.y - a.y).normalize();
  }

  /** Screen-space drag component toward the far anchor, in NDC-ish units. */
  private dragAlongSpan(): number {
    if (this.samples.length < 2) return 0;
    const s0 = this.samples[this.samples.length - 2];
    const s1 = this.samples[this.samples.length - 1];
    const dx = (s1.x - s0.x) / window.innerWidth * 2;
    const dy = -(s1.y - s0.y) / window.innerHeight * 2;
    this.computeSpanScreenDir();
    return dx * this.spanScreenDir.x + dy * this.spanScreenDir.y;
  }

  private dragSpan(): void {
    let d = this.dragAlongSpan();
    if (d === 0) return;
    if (this.bridge.currentLine < 0 || this.bridge.lines[this.bridge.currentLine]?.locked) {
      // a swing back (or fresh swing out) starts the next support line
      if (d > 0.004 && this.spool.totalTurns > 0.2) {
        if (!this.bridge.startLine()) return;
      } else {
        // swinging the head back for the next pass — just move the head
        this.headSwing(d);
        return;
      }
    }
    if (d <= 0) { this.headSwing(d); return; }
    const dProg = clamp(d * 1.7, 0, 0.06);
    const turnsNeeded = dProg * this.bridge.turnsPerLine();
    const segs = this.spool.takeTurns(turnsNeeded);
    const got = segs.reduce((s, x) => s + x.turns, 0);
    const scale = got > 0 ? got / turnsNeeded : 0;
    if (scale <= 0) return;
    const locked = this.bridge.payLine(dProg * scale, segs);
    this.tickUnwindSound(got);
    this.headSwing(d);
    if (locked) {
      this.audio.thrum();
      if (this.bridge.linesDone) this.enter('WEAVE');
    }
  }

  private headSwingX = 0;
  private headSwing(d: number): void {
    // head sweeps across the gap as the line pays out
    this.headSwingX = clamp(this.headSwingX + d * 3, -1, 1);
    const line = this.bridge.lines[this.bridge.currentLine];
    const off = line ? line.offset * 2 : 0;
    const t = this.tmp.set(
      this.world.nearAnchor.groove.x + off + this.headSwingX * 0.5,
      this.world.nearAnchor.groove.y + 0.4,
      this.world.nearAnchor.groove.z - 1.2 - this.headSwingX * 1.2
    );
    this.unicorn.setAimTarget(t);
    this.aimHold = 0.6;
  }

  // ---------------------------------------------------------------- weave & close

  private dragWeave(): void {
    const dTheta = this.gestureDelta();
    if (dTheta === 0) return;
    this.windPhase += dTheta;
    this.unicorn.setWindMotion(this.windPhase, 0.5);
    const turns = Math.abs(dTheta) / (Math.PI * 2);
    const dir = Math.sign(dTheta);
    if (this.state === 'WEAVE') {
      if (dir === this.windSign || this.windSign === 0) {
        this.bridge.weave(turns / WEAVE_TURNS);
        const used = this.spool.takeTurns(turns * 0.8);
        if (used.length) this.pingProgress(turns);
        if (this.bridge.weaveProgress >= 1) this.enter('CLOSE');
      }
      return;
    }
    // CLOSE: one full REVERSE circle unrolls the last wrap and the deck knits shut
    if (dir === -this.windSign) {
      this.closeProgress = clamp(this.closeProgress + turns, 0, 1);
      this.spool.takeTurns(turns * 0.6);
      this.bridge.closeDeck(turns, this.spool.colorSequence());
      this.tickUnwindSound(turns);
      if (this.closeProgress >= 1) {
        this.bridge.closeDeck(1, this.spool.colorSequence());
        this.enter('TEST');
      }
    }
  }

  // ---------------------------------------------------------------- test & cross

  private rayToDeck(x: number, y: number): { s: number } | null {
    const ray = this.screenRay(x, y).ray;
    for (let t = 1; t < 20; t += 0.25) {
      const p = ray.origin.clone().addScaledVector(ray.direction, t);
      const info = this.bridge.deckInfo(p.x, p.z);
      if (info && Math.abs(p.y - info.y) < 0.6) return info;
    }
    return null;
  }

  private rayToGround(x: number, y: number): THREE.Vector3 | null {
    const ray = this.screenRay(x, y).ray;
    let prev = ray.origin.clone();
    for (let t = 0.5; t < 40; t += 0.5) {
      const p = ray.origin.clone().addScaledVector(ray.direction, t);
      if (p.y < this.world.groundY(p.x, p.z)) {
        return prev.lerp(p, 0.5);
      }
      prev = p;
    }
    return null;
  }

  private beginTest(): void {
    this.enter('TESTING');
    this.unicorn.setGroundFn(this.groundWithDeck);   // hooves respect the deck from now on
    const start = this.bridge.centerAt(0);
    const stand = new THREE.Vector3(start.x - 0.3, 0, start.z + 0.85);
    this.unicorn.setAimTarget(null);
    this.unicorn.walkTo([stand], () => {
      this.unicorn.faceToward(this.bridge.centerAt(0.35));
      this.unicorn.startTestHoof(
        (load, hx, hz) => {
          const info = this.bridge.deckInfo(hx, hz) ?? { s: 0.06, y: 0 };
          this.bridge.setLoad(info.s, load);
          if (load > 0.9 && !this.testedRippled) {
            this.testedRippled = true;
            this.bridge.startRipple();
            this.audio.clop(false);
          }
        },
        () => this.enter('CROSSREADY')
      );
    }, 0.7);
  }
  private testedRippled = false;

  private groundWithDeck = (x: number, z: number): number => {
    const g = this.world.groundY(x, z);
    const d = this.bridge.deckInfo(x, z);
    return d ? Math.max(g, d.y) : g;
  };

  private beginCross(): void {
    this.enter('CROSSING');
    this.unicorn.setGroundFn(this.groundWithDeck);
    const pts: THREE.Vector3[] = [];
    const start = this.bridge.centerAt(0);
    pts.push(new THREE.Vector3(start.x - 0.3, 0, start.z + 0.55));
    for (let s = 0.12; s <= 1; s += 0.22) {
      const c = this.bridge.centerAt(s);
      pts.push(new THREE.Vector3(c.x, 0, c.z));
    }
    const end = this.bridge.centerAt(1);
    pts.push(new THREE.Vector3(end.x - 0.2, 0, end.z - 1.1));
    pts.push(new THREE.Vector3(0.2, 0, -9.4));
    this.unicorn.walkTo(pts, () => {
      this.unicorn.setGaze(new THREE.Vector3(0, 1, -18));
      this.enter('AFTER');
    }, 0.55);
  }

  // ---------------------------------------------------------------- after / free play

  private freeWalk(p: THREE.Vector3): void {
    const target = p.clone();
    target.y = 0;
    const hereFar = this.unicorn.position.z < this.world.gapNearZ - 2.5;
    const thereFar = target.z < this.world.gapFarZ + 0.5;
    const thereNear = target.z > this.world.gapNearZ - 0.3;
    target.x = clamp(target.x, -6, 6);
    target.z = clamp(target.z, -14, 7);
    const pts: THREE.Vector3[] = [];
    if ((hereFar && thereNear) || (!hereFar && thereFar)) {
      // route over the bridge — it is a real path now
      const dirIn = hereFar ? 1 : 0;
      const s0 = dirIn ? 1 : 0, s1 = dirIn ? 0 : 1;
      const a = this.bridge.centerAt(s0);
      pts.push(new THREE.Vector3(a.x, 0, a.z + (dirIn ? -0.8 : 0.8)));
      for (let k = 1; k <= 4; k++) {
        const c = this.bridge.centerAt(lerp(s0, s1, k / 5));
        pts.push(new THREE.Vector3(c.x, 0, c.z));
      }
      const b = this.bridge.centerAt(s1);
      pts.push(new THREE.Vector3(b.x, 0, b.z + (dirIn ? 0.8 : -0.8)));
    } else if (target.z < this.world.gapNearZ + 0.4 && target.z > this.world.gapFarZ - 0.4) {
      return; // no walking into the crevasse
    }
    pts.push(target);
    this.afterWalkBusy = true;
    this.unicorn.walkTo(pts, () => { this.afterWalkBusy = false; }, 0.8);
  }

  private dragAfter(): void {
    // leftover thread → wrap the handrails with slow circles
    const dTheta = this.gestureDelta();
    if (dTheta === 0) return;
    const turns = Math.abs(dTheta) / (Math.PI * 2);
    if (this.spool.totalTurns > 0.1) {
      const segs = this.spool.takeTurns(turns * 0.8);
      if (segs.length) {
        this.bridge.addRail(this.railSide, turns * 0.5, segs[0].colorIdx);
        this.pingProgress(turns);
        if (this.bridge.railProgress[this.railSide] >= 1) this.railSide = this.railSide === 0 ? 1 : 0;
      }
    }
  }

  // ================================================================ state & hints

  private enter(s: GameState): void {
    this.state = s;
    this.idleTimer = 0;
    if (s === 'GOANCHOR') {
      this.unhook();
      this.unicorn.setWindMotion(null);
      this.unicorn.walkTo([this.world.nearAnchor.standPos.clone()], () => {
        this.unicorn.faceToward(this.world.nearAnchor.groove);
        if (this.state === 'GOANCHOR') this.enter('ANCHORED');
      }, 0.8);
    }
    if (s === 'SPAN') {
      this.headSwingX = 0;
    }
    if (s === 'TEST') {
      this.unicorn.setAimTarget(null);
      this.unicorn.setWindMotion(null);
      this.anchorThread.hide();
    }
  }

  /** Ready to build? — the unicorn starts glancing toward the anchor stone. */
  private get readyToBuild(): boolean {
    return this.spool.totalTurns >= NEED_TURNS;
  }

  private updateHints(dt: number): void {
    this.idleTimer += dt;
    // discovery help stays live while there are still droplets worth finding
    const discovery = this.state === 'DISCOVER' ||
      (this.state === 'COLLECT' && !this.readyToBuild && !this.hooked);
    if (discovery) {
      // the wind lends a hand exactly once per long idle: one fibre brushes the horn
      if (this.idleTimer > 22 && this.gustT < 0) {
        const tip = this.unicorn.hornTipWorld(this.tmp);
        this.gustDroplet = this.droplets.nearestHookable(tip, 5);
        if (this.gustDroplet) {
          this.gustT = 0;
          this.audio.gust();
          this.world.grassUniforms.uGust.value = 1;
        }
        this.idleTimer = 0;
      }
      if (this.gustT >= 0 && this.gustDroplet) {
        this.gustT += dt;
        const tip = this.unicorn.hornTipWorld(this.tmp);
        const k = this.gustT < 1.2 ? smoothstep(0, 1.2, this.gustT)
          : 1 - smoothstep(1.2, 2.2, this.gustT);
        this.gustDroplet.gustLean = k * 0.85;      // touches, then slips away — no demo
        this.gustDroplet.gustTarget = tip.clone();
        this.world.grassUniforms.uGust.value = Math.max(0, 1 - this.gustT / 2.5);
        if (this.gustT > 2.4) {
          this.gustDroplet.gustLean = 0;
          this.gustDroplet = null;
          this.gustT = -1;
        }
      }
      // her attention teaches without words
      if (!this.pointerDown && this.aimHold <= 0) {
        const tip = this.unicorn.headWorld(this.tmp);
        const d = this.droplets.nearestHookable(tip, 8);
        if (d) this.unicorn.setGaze(d.tipWorld(this.tmpB));
      }
    }
    if (this.state === 'COLLECT' && this.readyToBuild && !this.pointerDown && this.idleTimer > 2.5) {
      // enough thread: she glances at the split stone by the rim
      this.unicorn.setGaze(this.world.nearAnchor.groove);
    }
  }

  // ================================================================ camera

  private cameraTargets(): { pos: THREE.Vector3; look: THREE.Vector3; fov: number; rate: number } {
    const portrait = window.innerHeight > window.innerWidth;
    const u = this.unicorn.position;
    const head = this.unicorn.headWorld(new THREE.Vector3());
    const groove = this.world.nearAnchor.groove;
    const yaw = this.unicorn.yaw;
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const P = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const off = (base: THREE.Vector3, r: number, f: number, up: number) =>
      base.clone().addScaledVector(right, r).addScaledVector(fwd, f).add(new THREE.Vector3(0, up, 0));
    let pos: THREE.Vector3, look: THREE.Vector3, fov = portrait ? 56 : 46, rate = 1.6;

    switch (this.state) {
      case 'INTRO':
      case 'DISCOVER':
        // wide 3/4: her profile and gaze, the droplet grass, crevasse and far meadow
        if (portrait) { pos = P(u.x + 2.75, 1.4, u.z + 1.3); look = P(u.x - 1.0, 0.65, u.z - 2.9); fov = 62; }
        else { pos = P(u.x + 2.9, 1.35, u.z + 1.1); look = P(u.x - 1.1, 0.6, u.z - 2.8); }
        if (this.state === 'DISCOVER' && (this.pointerDown || this.aimHold > 0)) {
          // lean toward the horn as the child reaches out
          pos = pos.lerp(off(head, 1.1, 0.7, 0.15), 0.55);
          look = look.lerp(off(head, 0, 0.2, 0.1), 0.65);
        }
        break;
      case 'FIRSTWIND': {
        // close side-on: horn axis diagonal, and the hooked raindrop kept in
        // frame so "drop shrinks ↔ coil grows" reads as one picture
        pos = off(head, portrait ? 0.85 : 1.0, 0.66, 0.12);
        look = off(head, -0.08, 0.12, 0.16);
        if (this.hooked) look.lerp(this.hooked.pos, 0.42);
        fov = portrait ? 55 : 46;
        rate = 2.2;
        break;
      }
      case 'COLLECT':
        if (!this.pointerDown && !this.hooked && this.aimHold <= 0) {
          // idle: pull wide again so the remaining droplets re-enter the frame
          if (portrait) { pos = P(u.x + 2.75, 1.4, u.z + 1.3); look = P(u.x - 1.0, 0.65, u.z - 2.9); fov = 62; }
          else { pos = P(u.x + 2.9, 1.35, u.z + 1.1); look = P(u.x - 1.1, 0.6, u.z - 2.8); }
        } else {
          pos = off(head, portrait ? 1.15 : 1.4, 0.85, 0.3);
          look = off(head, -0.1, 0.1, 0.05);
          if (this.hooked) look.lerp(this.hooked.pos, 0.35);
          fov = portrait ? 55 : 46;
        }
        break;
      case 'GOANCHOR':
      case 'ANCHORED':
        // stone, groove and her head together
        pos = portrait ? P(groove.x + 1.6, groove.y + 0.55, groove.z + 2.3)
          : P(groove.x + 2.0, groove.y + 0.65, groove.z + 2.1);
        look = P(groove.x - 0.35, groove.y - 0.1, groove.z + 0.15);
        fov = portrait ? 54 : 46;
        break;
      case 'SPAN':
        if (portrait) {
          // near-bottom → far-top depth composition down the span
          pos = P(groove.x + 0.85, groove.y + 1.65, groove.z + 3.6);
          look = this.bridge.centerAt(0.35); look.y += 0.1;
          fov = 63;
        } else {
          pos = P(-3.4, groove.y + 1.4, -0.4);
          look = this.bridge.centerAt(0.5);
        }
        break;
      case 'WEAVE':
      case 'CLOSE': {
        // keep the near anchor in frame so cause (unwinding horn) and effect
        // (growing weave) share the shot
        const a0 = this.bridge.centerAt(0.05);
        pos = portrait ? P(a0.x + 1.9, a0.y + 1.15, a0.z + 2.4) : P(a0.x + 2.4, a0.y + 1.2, a0.z + 2.0);
        look = this.bridge.centerAt(0.42);
        break;
      }
      case 'TEST':
      case 'TESTING': {
        // low lateral: forehoof, deck edge and support lines in one view
        // from over the gap looking back: forehoof, deck and lines converge on her
        const a = this.bridge.centerAt(0.5);
        const b = this.bridge.centerAt(0.05);
        pos = P(a.x + (portrait ? 1.25 : 1.6), a.y + 0.55, a.z);
        look = P(b.x - 0.25, b.y + 0.25, b.z + 0.4);
        fov = portrait ? 54 : 46;
        break;
      }
      case 'CROSSREADY':
      case 'CROSSING': {
        pos = P(u.x + (portrait ? 1.5 : 2.0), this.groundWithDeck(u.x, u.z) + 1.0, u.z + 1.9);
        const ahead = P(u.x - Math.sin(this.unicorn.yaw) * 2, this.groundWithDeck(u.x, u.z) + 0.5, u.z - Math.cos(this.unicorn.yaw) * 2);
        look = ahead;
        rate = 2.4;
        break;
      }
      case 'AFTER':
      default:
        pos = portrait ? P(4.2, 3.0, 6.5) : P(5.5, 2.8, 5.5);
        look = P(0, 0.4, -5);
        fov = portrait ? 58 : 46;
        rate = 0.9;
        break;
    }
    return { pos, look, fov, rate };
  }

  private updateCamera(dt: number): void {
    const t = this.cameraTargets();
    // never cut — always move
    this.camPos.lerp(t.pos, 1 - Math.exp(-t.rate * dt));
    this.camLook.lerp(t.look, 1 - Math.exp(-t.rate * 1.35 * dt));
    this.camFov = damp(this.camFov, t.fov, 2, dt);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    if (Math.abs(this.camera.fov - this.camFov) > 0.05) {
      this.camera.fov = this.camFov;
      this.camera.updateProjectionMatrix();
    }
  }

  // ================================================================ main update

  update(dt: number): void {
    this.time += dt;
    this.world.grassUniforms.uTime.value = this.time;

    this.aimHold = Math.max(0, this.aimHold - dt);
    if (this.aimHold <= 0 && !this.pointerDown &&
      (this.state === 'DISCOVER' || this.state === 'COLLECT' || this.state === 'FIRSTWIND')) {
      if (!this.hooked) this.unicorn.setAimTarget(null);
    }

    // hooked thread follows horn ↔ droplet
    if (this.hooked) {
      const tip = this.unicorn.hornTipWorld(this.tmp);
      const tension = this.pointerDown ? 0.85 : 0.4;
      this.liveThread.set(this.hooked.pos, tip, tension);
      // keep the head near the droplet while hooked
      if (!this.pointerDown) {
        this.unicorn.setAimTarget(this.hooked.pos.clone().add(new THREE.Vector3(0, 0.1, 0.25)));
      }
      // wandered too far off → the fibre slips off the horn (no punishment, just physics)
      if (tip.distanceTo(this.hooked.pos) > 1.9) {
        this.unhook();
      }
    }

    // anchored thread visual: groove → horn base while building
    if (this.state === 'ANCHORED' || this.state === 'SPAN' || this.state === 'WEAVE' || this.state === 'CLOSE') {
      const hb = this.unicorn.hornPointWorld(0.35, this.tmp);
      this.anchorThread.setColor(THREAD_COLORS[this.spool.colorSequence()[0] ?? 0].color);
      this.anchorThread.set(this.world.nearAnchor.groove, hb, 0.75);
    }

    // FIRSTWIND → COLLECT once a full wrap sits on the horn
    if (this.state === 'FIRSTWIND' && this.spool.totalTurns >= 0.95) this.enter('COLLECT');
    // COLLECT → the stone, once the child aims there with enough thread
    if (this.state === 'COLLECT' && this.readyToBuild && this.pointerDown) {
      const last = this.samples[this.samples.length - 1];
      if (last && !this.hooked) {
        const p = this.aimPoint(last.x, last.y, this.world.nearAnchor.groove.z + 0.4);
        if (p && p.distanceTo(this.world.nearAnchor.groove) < 1.1) this.enter('GOANCHOR');
      }
    }

    // standing weight: steady sag under whichever hooves rest on the deck
    if (this.bridge.deckProgress >= 0.6) {
      const steady: { s: number; w: number }[] = [];
      for (let i = 0; i < 4; i++) {
        const h = this.unicorn.hoofWorld(i, this.tmp);
        const info = this.bridge.deckInfo(h.x, h.z);
        if (info && h.y < info.y + 0.12) steady.push({ s: info.s, w: 0.45 });
      }
      this.bridge.setSteadyLoads(steady);
    }
    this.spool.flush();

    this.updateHints(dt);
    this.droplets.update(this.time);
    this.unicorn.update(dt, this.time);
    this.bridge.update(dt);
    this.updateCamera(dt);

    // sun shadow tracks the unicorn
    this.world.sun.target.position.set(this.unicorn.position.x, 0, this.unicorn.position.z);
  }

  // ================================================================ debug / e2e API

  private installDebugApi(): void {
    const g = {
      version: 1,
      state: () => this.state,
      totalTurns: () => this.spool.totalTurns,
      coils: () => this.spool.coils.map(c => ({ color: THREAD_COLORS[c.colorIdx].name, turns: c.turns, wav: c.wav.length ? c.wav.reduce((a, b) => a + b, 0) / c.wav.length : 0 })),
      droplets: () => this.droplets.list.map(d => ({ color: d.colorDef.name, left: d.turnsLeft, dead: d.dead, hooked: d.hooked })),
      bridge: () => ({
        lines: this.bridge.lines.map(l => ({ progress: l.progress, locked: l.locked, segs: l.segs.length })),
        weave: this.bridge.weaveProgress, deck: this.bridge.deckProgress,
        rails: [...this.bridge.railProgress]
      }),
      errors: this.errors,
      // deterministic drivers (used by tests; equivalent to gestures)
      hookFirst: () => {
        const tip = this.unicorn.hornTipWorld(new THREE.Vector3());
        const d = this.droplets.nearestHookable(tip, 99);
        if (d) {
          this.unicorn.setAimTarget(d.tipWorld(new THREE.Vector3()));
          this.hook(d);
        }
        return !!d;
      },
      wind: (turns: number, speed = 1) => {
        if (!this.hooked) return 0;
        if (this.windSign === 0) this.windSign = 1;
        const avail = Math.min(turns, this.hooked.turnsLeft);
        const wound = this.spool.wind(avail, speed);
        this.hooked.turnsLeft -= wound;
        if (this.hooked.turnsLeft <= 0.03) this.exhaustDroplet();
        if (this.state === 'FIRSTWIND' && this.spool.totalTurns >= 0.95) this.enter('COLLECT');
        return wound;
      },
      reverse: (turns: number) => {
        if (this.hooked) {
          const b = this.spool.unwindActive(turns);
          this.hooked.turnsLeft = Math.min(3, this.hooked.turnsLeft + b);
          return b;
        }
        return this.spool.unwindTop(turns);
      },
      collectAll: () => {
        while (this.spool.totalTurns < NEED_TURNS + 1) {
          if (!g.hookFirst()) break;
          g.wind(3, 1.2);
        }
        return this.spool.totalTurns;
      },
      gotoAnchor: () => { this.enter('GOANCHOR'); },
      forceAnchor: () => {
        this.unicorn.position.copy(this.world.nearAnchor.standPos);
        this.unicorn.stop();
        this.enter('ANCHORED');
        this.enter('SPAN');
      },
      pay: (amount: number) => {
        if (this.state !== 'SPAN') return false;
        if (this.bridge.currentLine < 0 || this.bridge.lines[this.bridge.currentLine]?.locked) this.bridge.startLine();
        const turnsNeeded = amount * this.bridge.turnsPerLine();
        const segs = this.spool.takeTurns(turnsNeeded);
        const locked = this.bridge.payLine(amount, segs);
        if (locked && this.bridge.linesDone) this.enter('WEAVE');
        return locked;
      },
      weave: (amount: number) => {
        if (this.state !== 'WEAVE') return;
        this.bridge.weave(amount);
        if (this.bridge.weaveProgress >= 1) this.enter('CLOSE');
      },
      close: (amount: number) => {
        if (this.state !== 'CLOSE') return;
        this.closeProgress = clamp(this.closeProgress + amount, 0, 1);
        this.bridge.closeDeck(amount, this.spool.colorSequence());
        if (this.closeProgress >= 1) this.enter('TEST');
      },
      test: () => { if (this.state === 'TEST') this.beginTest(); },
      cross: () => { if (this.state === 'CROSSREADY') this.beginCross(); },
      hornTip: () => { const v = this.unicorn.hornTipWorld(new THREE.Vector3()); return { x: v.x, y: v.y, z: v.z }; },
      unicornPos: () => ({ x: this.unicorn.position.x, y: this.unicorn.position.y, z: this.unicorn.position.z }),
      deckYAt: (s: number) => this.bridge.centerAt(s).y,
      camera: () => ({ pos: this.camPos.toArray(), look: this.camLook.toArray() })
    };
    (window as any).__game = g;
  }
}
