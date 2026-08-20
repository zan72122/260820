/**
 * Adaptive quality. Starts from a conservative guess for the device, then
 * degrades in the order required by the design brief when the frame budget
 * is missed: environment reflection updates -> shadow resolution ->
 * distant foliage -> particles.
 */

export type QualityTier = 'low' | 'medium' | 'high';

export interface QualitySettings {
  tier: QualityTier;
  pixelRatioCap: number;
  shadowMapSize: number;
  envResolution: number;
  /** Seconds between environment reflection refreshes; Infinity = bake once. */
  envRefreshInterval: number;
  foliageDensity: number;
  particles: boolean;
  /** Real refraction for the ice disc (expensive: needs a transmission pass). */
  transmission: boolean;
  antialias: boolean;
  contactShadows: boolean;
  anisotropicSlide: boolean;
}

const PRESETS: Record<QualityTier, QualitySettings> = {
  high: {
    tier: 'high',
    pixelRatioCap: 2.0,
    shadowMapSize: 2048,
    envResolution: 256,
    envRefreshInterval: 8,
    foliageDensity: 1,
    particles: true,
    transmission: true,
    antialias: true,
    contactShadows: true,
    anisotropicSlide: true,
  },
  medium: {
    tier: 'medium',
    pixelRatioCap: 1.75,
    shadowMapSize: 1024,
    envResolution: 192,
    envRefreshInterval: 20,
    foliageDensity: 0.7,
    particles: true,
    transmission: true,
    antialias: false,
    contactShadows: true,
    anisotropicSlide: true,
  },
  low: {
    tier: 'low',
    pixelRatioCap: 1.3,
    shadowMapSize: 512,
    envResolution: 128,
    envRefreshInterval: Infinity,
    foliageDensity: 0.4,
    particles: false,
    transmission: false,
    antialias: false,
    contactShadows: true,
    anisotropicSlide: false,
  },
};

export const isIOS = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function guessTier(): QualityTier {
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const px = window.screen.width * window.screen.height * (window.devicePixelRatio || 1);
  if (mem <= 3 || cores <= 4) return 'low';
  if (px > 4.2e6 && cores <= 6) return 'medium';
  if (mem >= 6 && cores >= 6) return 'high';
  return 'medium';
}

export type QualityListener = (s: QualitySettings, reason: string) => void;

export class QualityManager {
  settings: QualitySettings;
  /** Extra render-scale multiplier applied on top of the pixel ratio cap. */
  renderScale = 1;

  private listeners: QualityListener[] = [];
  private accum = 0;
  private frames = 0;
  private badWindows = 0;
  private goodWindows = 0;
  private step = 0;
  private locked = false;
  private smoothedFps = 60;

  constructor(tier: QualityTier = guessTier()) {
    this.settings = { ...PRESETS[tier] };
  }

  get fps(): number {
    return this.smoothedFps;
  }

  onChange(fn: QualityListener): void {
    this.listeners.push(fn);
  }

  /** Freeze adaptation (used by the debug overlay / automated checks). */
  lock(): void {
    this.locked = true;
  }

  private emit(reason: string): void {
    for (const fn of this.listeners) fn(this.settings, reason);
  }

  /** Call once per rendered frame with the frame delta in seconds. */
  sample(dt: number): void {
    if (dt <= 0 || dt > 0.5) return;
    this.smoothedFps += (1 / dt - this.smoothedFps) * 0.06;
    this.accum += dt;
    this.frames++;
    if (this.accum < 1.5) return;
    const fps = this.frames / this.accum;
    this.accum = 0;
    this.frames = 0;
    if (this.locked) return;

    if (fps < 34) {
      this.goodWindows = 0;
      this.badWindows++;
      if (this.badWindows >= 2) {
        this.badWindows = 0;
        this.degrade();
      }
    } else if (fps > 56) {
      this.badWindows = 0;
      this.goodWindows++;
      if (this.goodWindows >= 8) {
        this.goodWindows = 0;
        this.recover();
      }
    }
  }

  private degrade(): void {
    const s = this.settings;
    switch (this.step) {
      case 0:
        s.envRefreshInterval = Infinity;
        this.emit('env reflections frozen');
        break;
      case 1:
        s.shadowMapSize = Math.max(512, s.shadowMapSize >> 1);
        this.emit('shadow resolution reduced');
        break;
      case 2:
        s.foliageDensity = Math.max(0.25, s.foliageDensity * 0.5);
        this.emit('distant foliage reduced');
        break;
      case 3:
        s.particles = false;
        this.emit('particles off');
        break;
      case 4:
        s.transmission = false;
        this.emit('refraction simplified');
        break;
      case 5:
        this.renderScale = 0.82;
        this.emit('render scale 0.82');
        break;
      case 6:
        this.renderScale = 0.7;
        this.emit('render scale 0.70');
        break;
      default:
        return;
    }
    this.step++;
  }

  private recover(): void {
    if (this.step <= 0) return;
    this.step--;
    const s = this.settings;
    const base = PRESETS[s.tier];
    switch (this.step) {
      case 0:
        s.envRefreshInterval = base.envRefreshInterval;
        this.emit('env reflections restored');
        break;
      case 1:
        s.shadowMapSize = base.shadowMapSize;
        this.emit('shadow resolution restored');
        break;
      case 2:
        s.foliageDensity = base.foliageDensity;
        this.emit('foliage restored');
        break;
      case 3:
        s.particles = base.particles;
        this.emit('particles restored');
        break;
      case 4:
        s.transmission = base.transmission;
        this.emit('refraction restored');
        break;
      case 5:
        this.renderScale = 0.82;
        this.emit('render scale 0.82');
        break;
      default:
        this.renderScale = 1;
        this.emit('render scale 1.0');
    }
  }
}
