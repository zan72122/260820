/**
 * Hydraulic state as a directed graph of pipe segments carrying a fill fraction
 * and a moving water front. No CFD: flow is a conductance split, the front is
 * integrated per segment, and everything the player sees or hears is derived
 * from these few numbers so the pump, gauge, sound and water can never disagree.
 */

export type SegId =
  | 'suction'
  | 'sight'
  | 'pumpCase'
  | 'discharge'
  | 'riser'
  | 'topHeader'
  | 'branchA'
  | 'branchB'
  | 'branchC'
  | 'bypass';

export type BranchId = 'A' | 'B' | 'C';
export const BRANCHES: BranchId[] = ['A', 'B', 'C'];

export type Phase =
  | 'intro'
  | 'descend'
  | 'discover'
  | 'valveTurning'
  | 'priming'
  | 'ready'
  | 'starting'
  | 'chasing'
  | 'branching'
  | 'sliding'
  | 'reveal'
  | 'freeplay';

export type GameEvent =
  | 'valveNudge'
  | 'waterEntersSight'
  | 'airEscapes'
  | 'primeStroke'
  | 'primed'
  | 'motorStart'
  | 'motorSteady'
  | 'motorDry'
  | 'frontLeavesPump'
  | 'frontCrossesGround'
  | 'frontAtTop'
  | 'branchOpened'
  | 'slideWet'
  | 'loopComplete'
  | 'bypassOpened'
  | 'phase';

export interface Segment {
  id: SegId;
  /** litres-ish; controls how long the front takes to traverse it */
  volume: number;
  fill: number;
}

export interface Valve {
  id: string;
  open: number;
  /** accumulated hand rotation in turns, used to drive the stem/wheel visuals */
  wheelAngle: number;
  enabled: boolean;
}

export interface SlideState {
  id: BranchId;
  /** flow needed for a full sheet of water */
  demand: number;
  /** 0 = dry, 1 = full water film */
  film: number;
  /** how far the leading edge has run down the flume */
  front: number;
  wettedOnce: boolean;
}

type Listener = (e: GameEvent, payload?: unknown) => void;

const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const approach = (cur: number, target: number, rate: number, dt: number) => {
  const d = target - cur;
  const step = rate * dt;
  return Math.abs(d) <= step ? target : cur + Math.sign(d) * step;
};

export class PumpSim {
  phase: Phase = 'intro';
  phaseTime = 0;
  round = 0;

  readonly segments: Record<SegId, Segment> = {
    suction: { id: 'suction', volume: 1.1, fill: 0 },
    sight: { id: 'sight', volume: 0.22, fill: 0 },
    pumpCase: { id: 'pumpCase', volume: 0.5, fill: 0 },
    discharge: { id: 'discharge', volume: 0.8, fill: 0 },
    riser: { id: 'riser', volume: 5.4, fill: 0 },
    topHeader: { id: 'topHeader', volume: 0.9, fill: 0 },
    branchA: { id: 'branchA', volume: 0.9, fill: 0 },
    branchB: { id: 'branchB', volume: 0.7, fill: 0 },
    branchC: { id: 'branchC', volume: 1.1, fill: 0 },
    bypass: { id: 'bypass', volume: 0.6, fill: 0 },
  };

  readonly valves: Record<string, Valve> = {
    main: { id: 'main', open: 0, wheelAngle: 0, enabled: true },
    bypass: { id: 'bypass', open: 0, wheelAngle: 0, enabled: true },
    A: { id: 'A', open: 0, wheelAngle: 0, enabled: true },
    B: { id: 'B', open: 0, wheelAngle: 0, enabled: false },
    C: { id: 'C', open: 0, wheelAngle: 0, enabled: false },
  };

  readonly slides: Record<BranchId, SlideState> = {
    // Tuned so a single flume runs full on a modestly open main valve, while any
    // two together exceed what the pump can deliver — however far the main valve
    // was left open in the first round. Splitting always visibly costs something,
    // and opening the main further always visibly buys some of it back.
    A: { id: 'A', demand: 0.62, film: 0, front: 0, wettedOnce: false },
    B: { id: 'B', demand: 0.52, film: 0, front: 0, wettedOnce: false },
    C: { id: 'C', demand: 0.8, film: 0, front: 0, wettedOnce: false },
  };

  /** how full the surface run-out pool is; it starts bone dry */
  poolLevel = 0;

  /** trapped air in the priming leg: 1 = full of air, 0 = solid water */
  primeAir = 1;
  primeStrokes = 0;
  primed = false;

  motorOn = false;
  /** 0..1 spin-up ramp shared by impeller, gauge needle and the motor tone */
  rpm = 0;
  motorDryTime = 0;

  /** total flow leaving the pump, 0..1 */
  flow = 0;
  /** flow actually entering the riser after the bypass steals its share */
  riserFlow = 0;
  branchFlow: Record<BranchId, number> = { A: 0, B: 0, C: 0 };

  tankLevel = 0.72;
  tankRipple = 0;
  /** world-space progress of the visible front along the riser, 0..1 */
  private crossedGround = false;
  private toldTop = false;
  private toldLeave = false;
  private sightAnnounced = false;
  private airAnnounced = false;
  private loopAnnounced = false;

  private listeners: Listener[] = [];

  on(fn: Listener) {
    this.listeners.push(fn);
  }
  private emit(e: GameEvent, payload?: unknown) {
    for (const l of this.listeners) l(e, payload);
  }

  setPhase(p: Phase) {
    if (this.phase === p) return;
    this.phase = p;
    this.phaseTime = 0;
    this.emit('phase', p);
  }

  /** Hand rotation on a wheel, in turns. Positive opens. */
  turnValve(id: string, deltaTurns: number) {
    const v = this.valves[id];
    if (!v || !v.enabled) return;
    const before = v.open;
    // first contact on a shut valve opens whichever way the hand happens to go;
    // once it is cracked open, direction means what it means
    if (v.open <= 0.02 && deltaTurns < 0) deltaTurns = -deltaTurns;
    v.wheelAngle += deltaTurns * Math.PI * 2;
    // three full turns from shut to wide open, like a real rising-stem gate
    // the main valve is a big slow gate: several turns lock to lock
    v.open = clamp(v.open + deltaTurns / (id === 'main' ? 4.6 : 2.4));
    if (v.open > before + 1e-4) {
      if (id === 'main' && before < 0.02) this.emit('valveNudge');
      if (id === 'bypass' && before < 0.02) this.emit('bypassOpened');
      if ((id === 'A' || id === 'B' || id === 'C') && before < 0.05 && v.open >= 0.05)
        this.emit('branchOpened', id);
    }
    if (this.phase === 'discover' && id === 'main' && v.open > 0.02) this.setPhase('valveTurning');
  }

  /** One up/down stroke of the hand priming pump. */
  primeStroke() {
    if (this.segments.sight.fill < 0.35) {
      // nothing to draw yet — the stroke still moves the piston, just no water
      this.emit('primeStroke', { air: this.primeAir, dry: true });
      return;
    }
    this.primeStrokes++;
    const before = this.primeAir;
    this.primeAir = clamp(this.primeAir - 0.175 - Math.random() * 0.03);
    this.emit('primeStroke', { air: this.primeAir, dry: false, delta: before - this.primeAir });
    if (!this.primed && this.primeAir <= 0.02) {
      this.primed = true;
      this.emit('primed');
    }
  }

  startMotor() {
    if (this.motorOn) return;
    this.motorOn = true;
    this.emit('motorStart');
    if (!this.primed || this.valves.main.open < 0.12) this.emit('motorDry');
  }

  stopMotor() {
    this.motorOn = false;
  }

  /** Unlock the two further slides and reset the water, keeping what the child learned. */
  beginFreeplay() {
    this.round++;
    this.valves.B.enabled = true;
    this.valves.C.enabled = true;
    this.setPhase('freeplay');
  }

  get anyBranchOpen(): boolean {
    return BRANCHES.some((b) => this.valves[b].open > 0.05);
  }

  get openBranchCount(): number {
    return BRANCHES.filter((b) => this.valves[b].open > 0.08).length;
  }

  update(dt: number) {
    this.phaseTime += dt;

    // ---- pump spin-up -------------------------------------------------
    const targetRpm = this.motorOn ? 1 : 0;
    this.rpm = approach(this.rpm, targetRpm, this.motorOn ? 0.55 : 0.35, dt);
    if (this.motorOn && this.rpm > 0.92 && this.phase === 'starting') this.setPhase('chasing');

    // ---- suction side fills by gravity as soon as the valve cracks ----
    const s = this.segments;
    const main = this.valves.main.open;
    s.suction.fill = approach(s.suction.fill, clamp(main * 3.2), 0.9, dt);
    // the glass answers the very first crack of the valve: a thread of water,
    // then a rising column. This is the whole first lesson in one number.
    s.sight.fill = approach(s.sight.fill, clamp(main * 2.6), 0.6, dt);
    if (!this.sightAnnounced && s.sight.fill > 0.06) {
      this.sightAnnounced = true;
      this.emit('waterEntersSight');
    }
    if (!this.airAnnounced && s.sight.fill > 0.42) {
      this.airAnnounced = true;
      this.emit('airEscapes');
    }
    // the suction leg standing full is what makes priming possible at all;
    // the trapped air itself only leaves through the hand pump
    s.pumpCase.fill = approach(s.pumpCase.fill, 1 - this.primeAir, 0.8, dt);

    // ---- delivered flow ----------------------------------------------
    const primeFactor = this.primeAir < 0.03 ? 1 : Math.max(0, 0.12 - this.primeAir * 0.1);
    // the pump reaches full delivery before the main valve is fully open, so a
    // child who only cracked it open still gets a properly running flume
    this.flow = clamp(this.rpm * Math.min(1, main * 1.7) * primeFactor);
    if (this.motorOn && this.flow < 0.05) this.motorDryTime += dt;
    else this.motorDryTime = 0;

    const bypassOpen = this.valves.bypass.open;
    const bypassPull = bypassOpen * 0.62;
    this.riserFlow = this.flow * (1 - bypassPull);
    s.bypass.fill = approach(s.bypass.fill, bypassOpen > 0.05 && this.flow > 0.05 ? 1 : 0, 0.9, dt);

    // ---- fill the chain, one segment at a time -------------------------
    const chain: SegId[] = ['discharge', 'riser', 'topHeader'];
    let feed = this.riserFlow;
    // a column of water needs a minimum delivery to climb the riser at all
    const canClimb = this.riserFlow > 0.11;
    for (const id of chain) {
      const seg = s[id];
      if (id === 'riser' && !canClimb) {
        seg.fill = approach(seg.fill, 0, 0.22, dt);
        feed = 0;
        continue;
      }
      if (feed <= 0.001) {
        seg.fill = approach(seg.fill, 0, 0.14, dt);
        continue;
      }
      if (seg.fill < 1) {
        seg.fill = clamp(seg.fill + (feed / seg.volume) * dt * 1.35);
        if (seg.fill < 1) {
          feed = 0;
          break;
        }
      }
    }

    if (!this.toldLeave && s.discharge.fill > 0.2) {
      this.toldLeave = true;
      this.emit('frontLeavesPump');
    }
    if (!this.crossedGround && s.riser.fill > 0.52) {
      this.crossedGround = true;
      this.emit('frontCrossesGround');
    }
    if (!this.toldTop && s.topHeader.fill > 0.6) {
      this.toldTop = true;
      this.emit('frontAtTop');
      if (this.phase === 'chasing') this.setPhase('branching');
    }

    // ---- branch split --------------------------------------------------
    const headerReady = s.topHeader.fill > 0.85 ? 1 : 0;
    const caps: Record<BranchId, number> = { A: 1, B: 0.78, C: 1.25 };
    let totalCond = 0;
    for (const b of BRANCHES) totalCond += this.valves[b].open * caps[b];
    for (const b of BRANCHES) {
      const cond = this.valves[b].open * caps[b];
      const share = totalCond > 0 ? cond / totalCond : 0;
      const q = headerReady * this.riserFlow * share;
      this.branchFlow[b] = q;
      const seg = s[`branch${b}` as SegId];
      seg.fill =
        q > 0.02
          ? clamp(seg.fill + (q / seg.volume) * dt * 1.5)
          : approach(seg.fill, 0, 0.5, dt);

      const slide = this.slides[b];
      const arriving = seg.fill > 0.98 ? q : 0;
      slide.front = arriving > 0.02 ? clamp(slide.front + dt * (0.35 + arriving * 0.9)) : approach(slide.front, 0, 0.4, dt);
      const filmTarget = arriving > 0 ? clamp(arriving / slide.demand) : 0;
      slide.film = approach(slide.film, filmTarget * slide.front, 0.55, dt);
      if (!slide.wettedOnce && slide.film > 0.25) {
        slide.wettedOnce = true;
        this.emit('slideWet', b);
        if (this.phase === 'branching') this.setPhase('sliding');
      }
    }

    // ---- return leg ------------------------------------------------------
    const returning = BRANCHES.reduce((a, b) => a + (this.slides[b].front > 0.98 ? this.branchFlow[b] : 0), 0);
    this.tankRipple = approach(this.tankRipple, Math.min(1, returning * 2 + this.flow * 0.4), 1.2, dt);
    this.poolLevel = clamp(this.poolLevel + (returning > 0.02 ? returning * dt * 0.5 : -dt * 0.02));
    this.tankLevel = 0.72 - this.riserFlow * 0.05 - this.poolLevel * 0.06;

    if (!this.loopAnnounced && returning > 0.05 && this.phase === 'sliding') {
      this.loopAnnounced = true;
      this.emit('loopComplete');
      this.setPhase('reveal');
    }
  }
}
