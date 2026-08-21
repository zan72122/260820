import { clamp, TAU } from '../core/math';

export interface PumpBooking {
  /** 0..1 – how much of a full pump the swipe was worth. */
  strength: number;
  /** +1 = the rider wants to drive the forward half, -1 = the back half. */
  dir: number;
  /** Seconds the booking has been waiting for its phase window. */
  waited: number;
}

export interface SwingSnapshot {
  theta: number;
  omega: number;
  amplitude: number;
  phase: number;
  energy: number;
  playerEnergy: number;
  seatSpeed: number;
  /** Rises to 1 for a moment right after a pump lands. */
  pumpPulse: number;
}

const G = 9.81;

/**
 * Semi-analytic swing.
 *
 * The angle is integrated with the real pendulum equation (so the motion is not a
 * pasted-on sine), while amplitude and phase are recovered analytically from the
 * mechanical energy each frame. That gives an exact, cheap read-out of "how big is
 * this swing right now" without ever fighting the integrator.
 */
export class SwingModel {
  /** Chain length, pivot to the rider's centre of mass. */
  readonly length = 2.2;
  readonly pivotY = 2.62;
  readonly maxAmplitude = (61 * Math.PI) / 180;

  theta = 0;
  omega = 0;
  amplitude = 0;
  phase = 0;
  playerEnergy = 0;
  pumpPulse = 0;

  /** Viscous loss at the bearings plus air drag on the rider. */
  damping = 0.052;

  private booking: PumpBooking | null = null;
  private prevTheta = 0;
  private acc = 0;
  private onPump: ((strength: number, amplitude: number) => void) | null = null;
  private onBottom: ((speed: number, dir: number) => void) | null = null;
  private onApex: ((amplitude: number, dir: number) => void) | null = null;

  get omegaN(): number {
    return Math.sqrt(G / this.length);
  }

  get period(): number {
    // First-order amplitude correction to the small-angle period.
    const a = this.amplitude;
    return (TAU / this.omegaN) * (1 + (a * a) / 16);
  }

  /** Specific mechanical energy (J/kg) measured from the lowest point. */
  get energy(): number {
    const L = this.length;
    return 0.5 * L * L * this.omega * this.omega + G * L * (1 - Math.cos(this.theta));
  }

  events(handlers: {
    pump?: (strength: number, amplitude: number) => void;
    bottom?: (speed: number, dir: number) => void;
    apex?: (amplitude: number, dir: number) => void;
  }): void {
    this.onPump = handlers.pump ?? null;
    this.onBottom = handlers.bottom ?? null;
    this.onApex = handlers.apex ?? null;
  }

  reset(amplitude = 0): void {
    this.theta = amplitude;
    this.omega = 0;
    this.amplitude = amplitude;
    this.phase = 0;
    this.playerEnergy = 0;
    this.pumpPulse = 0;
    this.booking = null;
    this.prevTheta = amplitude;
    this.acc = 0;
  }

  /** The one-off gust that starts the scene: a shove, not a teleport. */
  nudge(deltaOmega: number): void {
    this.omega += deltaOmega;
  }

  /**
   * Reserve a pump for the next suitable phase. Early swipes are parked (not
   * thrown away) and late swipes still land as a smaller kick on the half cycle
   * that matches their direction.
   */
  book(strength: number, dir: number): void {
    const s = clamp(strength, 0.12, 1);
    if (this.booking) {
      // Two flicks in a row read as one firmer pump rather than two queued ones.
      this.booking.strength = clamp(this.booking.strength + s * 0.55, 0, 1);
      this.booking.dir = dir;
      return;
    }
    this.booking = { strength: s, dir, waited: 0 };
  }

  get hasBooking(): boolean {
    return this.booking !== null;
  }

  update(dt: number): void {
    // Fixed-step substeps keep the pendulum stable regardless of frame time.
    const step = 1 / 240;
    this.acc = Math.min(this.acc + dt, 0.25);
    while (this.acc >= step) {
      this.substep(step);
      this.acc -= step;
    }
    this.pumpPulse = Math.max(0, this.pumpPulse - dt * 2.2);
    this.playerEnergy = Math.max(0, this.playerEnergy - dt * 0.32);
    this.syncAnalytic();
  }

  private substep(dt: number): void {
    const L = this.length;
    const alpha = -(G / L) * Math.sin(this.theta) - this.damping * this.omega -
      0.012 * this.omega * Math.abs(this.omega);

    this.prevTheta = this.theta;
    this.omega += alpha * dt;
    this.theta += this.omega * dt;
    this.limitEnergy();

    if (this.booking) {
      this.booking.waited += dt;
      this.tryPump();
    }

    // Bottom-of-arc crossing: the moment the seat cuts the mist at full speed.
    if (this.prevTheta <= 0 && this.theta > 0) this.onBottom?.(Math.abs(this.omega) * L, 1);
    else if (this.prevTheta >= 0 && this.theta < 0) this.onBottom?.(Math.abs(this.omega) * L, -1);

    // Apex: angular velocity flips sign.
    if (Math.abs(this.theta) > 0.02) {
      const wasUp = this.prevTheta < this.theta;
      const isUp = this.omega > 0;
      if (wasUp !== isUp && Math.abs(this.omega) < 0.35) {
        this.onApex?.(Math.abs(this.theta), Math.sign(this.theta) || 1);
      }
    }
  }

  private tryPump(): void {
    const b = this.booking!;
    const movingDir = Math.sign(this.omega) || 1;
    const crossedBottom =
      (this.prevTheta <= 0 && this.theta > 0) || (this.prevTheta >= 0 && this.theta < 0);

    // The rider drives the legs through the bottom of the arc, on the half that
    // matches the swipe. A booking older than ~2.6 s stops being picky.
    const impatient = b.waited > 2.6;
    if (!crossedBottom) return;
    if (!impatient && movingDir !== b.dir) return;

    const headroom = clamp(1 - this.amplitude / this.maxAmplitude, 0, 1);
    const timing = impatient ? 0.42 : 1;
    // Impulse expressed as a velocity gain, tapered so the swing can never run away.
    const gain = (0.30 + 0.55 * b.strength) * Math.pow(headroom, 1.35) * timing;
    this.omega += movingDir * gain;
    this.playerEnergy = clamp(this.playerEnergy + 0.34 + 0.5 * b.strength, 0, 1.6);
    this.pumpPulse = 1;
    this.booking = null;
    this.onPump?.(b.strength * timing, this.amplitudeFromEnergy());
  }

  /**
   * A real swing set has a ceiling: chains go slack and a parent stops pushing
   * long before the seat reaches the beam. Energy is clipped, not just tapered,
   * so no amount of frantic swiping can send the rider over the top.
   */
  private limitEnergy(): void {
    const L = this.length;
    const eMax = G * L * (1 - Math.cos(this.maxAmplitude));
    if (this.energy <= eMax) return;
    if (Math.abs(this.theta) > this.maxAmplitude) {
      this.theta = Math.sign(this.theta) * this.maxAmplitude;
      this.omega *= 0.4;
      return;
    }
    const kinetic = eMax - G * L * (1 - Math.cos(this.theta));
    const target = Math.sqrt(Math.max(0, (2 * kinetic) / (L * L)));
    this.omega = (Math.sign(this.omega) || 1) * Math.min(Math.abs(this.omega), target);
  }

  private amplitudeFromEnergy(): number {
    const c = 1 - this.energy / (G * this.length);
    return Math.acos(clamp(c, -1, 1));
  }

  private syncAnalytic(): void {
    this.amplitude = this.amplitudeFromEnergy();
    const a = Math.max(this.amplitude, 1e-4);
    // Normalised phase-space coordinates give a continuous phase angle.
    const x = clamp(this.theta / a, -1, 1);
    const v = clamp(this.omega / (a * this.omegaN), -1.4, 1.4);
    this.phase = Math.atan2(v, x);
  }

  /** Seat centre in world space (swing plane is the world X axis). */
  seatPosition(out: { x: number; y: number; z: number }, theta = this.theta): void {
    out.x = Math.sin(theta) * this.length;
    out.y = this.pivotY - Math.cos(theta) * this.length;
    out.z = 0;
  }

  get seatSpeed(): number {
    return Math.abs(this.omega) * this.length;
  }

  snapshot(): SwingSnapshot {
    return {
      theta: this.theta,
      omega: this.omega,
      amplitude: this.amplitude,
      phase: this.phase,
      energy: this.energy,
      playerEnergy: this.playerEnergy,
      seatSpeed: this.seatSpeed,
      pumpPulse: this.pumpPulse,
    };
  }
}
