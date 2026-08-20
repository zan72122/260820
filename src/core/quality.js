// Device tiering + a slow adaptive governor.
//
// Rule from the design brief: when the frame budget is missed we shed spark
// count, bloom resolution and internal resolution -- in that order -- but the
// phase progression of the fireball is never touched. The story always plays.

const TIERS = {
  high: {
    name: 'high',
    maxSparks: 1500,
    sparkRate: 1.0,
    smoke: 22,
    bloomScale: 0.5,
    bloomPasses: 2,
    pixelRatioCap: 2.0,
    renderScale: 1.0,
    grain: true,
    emberDetail: 3,
  },
  medium: {
    name: 'medium',
    maxSparks: 900,
    sparkRate: 0.78,
    smoke: 14,
    bloomScale: 0.4,
    bloomPasses: 2,
    pixelRatioCap: 1.75,
    renderScale: 0.92,
    grain: true,
    emberDetail: 2,
  },
  low: {
    name: 'low',
    maxSparks: 480,
    sparkRate: 0.58,
    smoke: 8,
    bloomScale: 0.3,
    bloomPasses: 1,
    pixelRatioCap: 1.4,
    renderScale: 0.8,
    grain: false,
    emberDetail: 2,
  },
  floor: {
    name: 'floor',
    maxSparks: 300,
    sparkRate: 0.46,
    smoke: 5,
    bloomScale: 0.25,
    bloomPasses: 1,
    pixelRatioCap: 1.15,
    renderScale: 0.7,
    grain: false,
    emberDetail: 1,
  },
};

const ORDER = ['high', 'medium', 'low', 'floor'];

export function detectTier(gl) {
  const dpr = globalThis.devicePixelRatio || 1;
  const w = globalThis.screen?.width || 800;
  const h = globalThis.screen?.height || 600;
  const px = w * dpr * h * dpr;
  const cores = navigator?.hardwareConcurrency || 4;
  const mem = navigator?.deviceMemory || 4;

  let score = 0;
  if (cores >= 6) score += 1;
  if (cores >= 8) score += 1;
  if (mem >= 4) score += 1;
  if (mem >= 6) score += 1;
  // A very large physical framebuffer costs more than it earns on a handset.
  if (px > 3.2e6) score -= 1;
  if (px > 5.5e6) score -= 1;

  const renderer = safeRendererString(gl);
  if (/Apple (A1[4-9]|A2\d|M\d)/i.test(renderer)) score += 2;
  if (/Adreno \(TM\) [67]\d\d/i.test(renderer)) score += 1;
  if (/SwiftShader|llvmpipe|Software|Mesa OffScreen/i.test(renderer)) score -= 4;

  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  if (score >= 0) return 'low';
  return 'floor';
}

function safeRendererString(gl) {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
    return String(gl.getParameter(gl.RENDERER));
  } catch {
    return '';
  }
}

export class Quality {
  constructor(startTier) {
    this.index = Math.max(0, ORDER.indexOf(startTier));
    if (this.index < 0) this.index = 1;
    this.settings = { ...TIERS[ORDER[this.index]] };
    this.locked = false;
    this._acc = 0;
    this._frames = 0;
    this._cooldown = 3.0;
    this._goodStreak = 0;
    this.onChange = null;
  }

  get tier() {
    return ORDER[this.index];
  }

  forceTier(name) {
    const i = ORDER.indexOf(name);
    if (i < 0) return;
    this.index = i;
    this.settings = { ...TIERS[name] };
    this.locked = true;
    this.onChange?.(this.settings);
  }

  // Called once per frame with the real frame delta.
  sample(dt) {
    if (this.locked) return;
    this._cooldown -= dt;
    this._acc += dt;
    this._frames += 1;
    if (this._acc < 1.0) return;

    const fps = this._frames / this._acc;
    this._acc = 0;
    this._frames = 0;
    if (this._cooldown > 0) return;

    if (fps < 40 && this.index < ORDER.length - 1) {
      this.index += 1;
      this._goodStreak = 0;
      this._cooldown = 4.0;
      this.settings = { ...TIERS[ORDER[this.index]] };
      this.onChange?.(this.settings);
    } else if (fps > 57 && this.index > 0) {
      this._goodStreak += 1;
      if (this._goodStreak >= 6) {
        this._goodStreak = 0;
        this.index -= 1;
        this._cooldown = 6.0;
        this.settings = { ...TIERS[ORDER[this.index]] };
        this.onChange?.(this.settings);
      }
    } else {
      this._goodStreak = 0;
    }
  }
}

export { TIERS, ORDER };
