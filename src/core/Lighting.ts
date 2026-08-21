import { Color, Vector3 } from 'three'
import type { Framing } from '../render/CameraRig'
import { Curve, Ramp } from '../util/color'
import { clamp, damp, lerp } from '../util/math'
import type { GameState } from './GameState'

/** Wall-clock minute the park clock reads at night = 0. */
export const START_MINUTES = 18 * 60 + 44
/** Minutes the ratchet carries per tooth (12 degrees of a 60-minute dial). */
export const MINUTES_PER_TOOTH = 2

/**
 * Every continuous property of the evening lives here. Nothing in the scene
 * decides its own colour: the renderer, the sky, the town and the audio all read
 * this one object, so dusk -> night is a multi-parameter transition rather than a
 * blue filter fading in.
 */
export class LightingState {
  // --- sun / moon geometry ---
  sunElevation = 0
  sunAzimuth = 0
  readonly sunDir = new Vector3()
  readonly moonDir = new Vector3()
  moonElevation = 0

  // --- sky ---
  readonly zenith = new Color()
  readonly horizon = new Color()
  readonly warmBand = new Color()
  /** How tightly the warm band hugs the horizon; widens then collapses after sunset. */
  warmSpread = 0.5
  warmStrength = 1

  // --- clouds ---
  readonly cloudLit = new Color()
  readonly cloudShade = new Color()
  cloudOpacity = 0.85

  // --- lights ---
  sunIntensity = 1
  moonIntensity = 0
  ambientIntensity = 1
  readonly ambientSky = new Color()
  readonly ambientGround = new Color()
  /** Floor of readability: the guaranteed fill on the swing, rider and clock. */
  readFill = 0

  // --- atmosphere ---
  readonly fogColor = new Color()
  fogDensity = 0.006
  /** 0 = distance washes everything flat, 1 = crisp. Rises as the town lights itself. */
  distantContrast = 0.5

  // --- night sky ---
  starVisibility = 0
  moonGlow = 0

  // --- emissive budgets ---
  windowEmissive = 0
  lampEmissive = 0
  lampLightIntensity = 0
  groundPool = 0

  // --- camera ---
  exposure = 1

  // --- audio mix ---
  birds = 1
  insects = 0
  townMurmur = 0

  /** Minutes past midnight shown on the dial. */
  clockMinutes = START_MINUTES

  private smoothedNight = 0

  private static zenithRamp = new Ramp([
    { at: 0.0, color: '#7d96c4' },
    { at: 0.09, color: '#7184b9' },
    { at: 0.19, color: '#66709f' },
    { at: 0.34, color: '#4d5f97' },
    { at: 0.55, color: '#31406f' },
    { at: 0.78, color: '#1c2750' },
    { at: 1.0, color: '#0d1332' },
  ])

  private static horizonRamp = new Ramp([
    { at: 0.0, color: '#ffc487' },
    { at: 0.1, color: '#ffa96a' },
    { at: 0.19, color: '#ef9573' },
    { at: 0.27, color: '#e0887a' },
    { at: 0.42, color: '#a97490' },
    { at: 0.6, color: '#6a6295' },
    { at: 0.8, color: '#3b477a' },
    { at: 1.0, color: '#212c56' },
  ])

  private static warmRamp = new Ramp([
    { at: 0.0, color: '#ffe6bb' },
    { at: 0.12, color: '#ffb877' },
    { at: 0.26, color: '#ff8a4e' },
    { at: 0.4, color: '#d76a53' },
    { at: 0.58, color: '#8f5a6e' },
    { at: 0.78, color: '#4e4a75' },
    { at: 1.0, color: '#2c3560' },
  ])

  private static cloudLitRamp = new Ramp([
    { at: 0.0, color: '#ffe2c0' },
    { at: 0.16, color: '#ffbf93' },
    { at: 0.3, color: '#e39a86' },
    { at: 0.48, color: '#9d8298' },
    { at: 0.7, color: '#5d648f' },
    { at: 1.0, color: '#39447a' },
  ])

  private static cloudShadeRamp = new Ramp([
    { at: 0.0, color: '#b0a3ad' },
    { at: 0.3, color: '#7f7391' },
    { at: 0.6, color: '#464e78' },
    { at: 1.0, color: '#232c54' },
  ])

  private static ambientSkyRamp = new Ramp([
    { at: 0.0, color: '#a8bcdf' },
    { at: 0.3, color: '#7d8bbe' },
    { at: 0.6, color: '#4d5788' },
    { at: 1.0, color: '#2e3968' },
  ])

  private static ambientGroundRamp = new Ramp([
    { at: 0.0, color: '#8f7460' },
    { at: 0.35, color: '#6b5a52' },
    { at: 0.7, color: '#3c3a48' },
    { at: 1.0, color: '#2a2c39' },
  ])

  private static fogRamp = new Ramp([
    { at: 0.0, color: '#e7bd96' },
    { at: 0.18, color: '#d9a186' },
    { at: 0.36, color: '#a98496' },
    { at: 0.56, color: '#6b6a99' },
    { at: 0.78, color: '#3d4778' },
    { at: 1.0, color: '#1f2950' },
  ])

  private static sunCurve = new Curve([
    [0.0, 1.35],
    [0.12, 1.05],
    [0.24, 0.5],
    [0.36, 0.14],
    [0.5, 0.02],
    [0.65, 0.0],
  ])

  private static moonCurve = new Curve([
    [0.0, 0.0],
    [0.35, 0.02],
    [0.55, 0.12],
    [0.78, 0.3],
    [1.0, 0.42],
  ])

  private static ambientCurve = new Curve([
    [0.0, 0.95],
    [0.25, 0.72],
    [0.5, 0.46],
    [0.75, 0.32],
    [1.0, 0.27],
  ])

  private static exposureCurve = new Curve([
    [0.0, 0.98],
    [0.3, 1.05],
    [0.55, 1.16],
    [0.8, 1.3],
    [1.0, 1.38],
  ])

  private static starCurve = new Curve([
    [0.0, 0.0],
    [0.4, 0.0],
    [0.6, 0.22],
    [0.8, 0.68],
    [1.0, 1.0],
  ])

  private static fogDensityCurve = new Curve([
    [0.0, 0.0034],
    [0.3, 0.0044],
    [0.6, 0.0052],
    [1.0, 0.0042],
  ])

  private static cloudOpacityCurve = new Curve([
    [0.0, 0.9],
    [0.5, 0.78],
    [1.0, 0.6],
  ])

  private static warmSpreadCurve = new Curve([
    [0.0, 0.62],
    [0.18, 0.5],
    [0.4, 0.34],
    [0.7, 0.2],
    [1.0, 0.13],
  ])

  private static warmStrengthCurve = new Curve([
    [0.0, 0.85],
    [0.12, 1.0],
    [0.3, 0.82],
    [0.55, 0.45],
    [0.8, 0.2],
    [1.0, 0.1],
  ])

  /**
   * @param dt seconds. Exposure and light intensities are damped, never snapped,
   *           so a big swing cannot make the picture flash.
   */
  update(state: GameState, dt: number, framing: Framing): void {
    // The sky itself lags the ratchet slightly — the tick is crisp, the light is not.
    this.smoothedNight = damp(this.smoothedNight, state.night, 1.15, dt)
    const n = clamp(this.smoothedNight)
    const L = LightingState

    this.clockMinutes = START_MINUTES + state.teeth * MINUTES_PER_TOOTH

    // Sun sinks from +6 deg to -16 deg and drifts a little further round as it goes.
    // Its bearing is expressed relative to the authored viewpoint so the last warm
    // light always lands where the composition wants it, in both orientations.
    this.sunElevation = lerp(6, -16, n)
    this.sunAzimuth = framing.heading + framing.sunOffset + n * 0.08
    const se = (this.sunElevation * Math.PI) / 180
    this.sunDir.set(
      Math.cos(se) * Math.sin(this.sunAzimuth),
      Math.sin(se),
      Math.cos(se) * Math.cos(this.sunAzimuth),
    )

    // The moon climbs on the other side of the frame as the sun goes down.
    this.moonElevation = lerp(
      framing.moonElevLow,
      framing.moonElevHigh,
      clamp((n - 0.12) / 0.88),
    )
    const me = (this.moonElevation * Math.PI) / 180
    const ma = framing.heading + framing.moonOffset
    this.moonDir.set(Math.cos(me) * Math.sin(ma), Math.sin(me), Math.cos(me) * Math.cos(ma))

    L.zenithRamp.sample(n, this.zenith)
    L.horizonRamp.sample(n, this.horizon)
    L.warmRamp.sample(n, this.warmBand)
    L.cloudLitRamp.sample(n, this.cloudLit)
    L.cloudShadeRamp.sample(n, this.cloudShade)
    L.ambientSkyRamp.sample(n, this.ambientSky)
    L.ambientGroundRamp.sample(n, this.ambientGround)
    L.fogRamp.sample(n, this.fogColor)

    this.warmSpread = L.warmSpreadCurve.at(n)
    this.warmStrength = L.warmStrengthCurve.at(n)
    this.cloudOpacity = L.cloudOpacityCurve.at(n)

    this.sunIntensity = L.sunCurve.at(n) * 1.5
    this.moonIntensity = L.moonCurve.at(n) * (0.35 + 0.65 * state.moonReveal)
    this.ambientIntensity = L.ambientCurve.at(n)
    this.exposure = L.exposureCurve.at(n)
    this.starVisibility = L.starCurve.at(n)
    this.moonGlow = state.moonReveal
    this.fogDensity = L.fogDensityCurve.at(n)

    // Readability floor: never let the near field fall out of legibility.
    this.readFill = lerp(0.17, 0.44, n)

    // Lamp output ramps with darkness so a lamp lit early is dim, not blaring.
    this.lampEmissive = lerp(0.35, 1.0, clamp((n - 0.08) / 0.7))
    this.lampLightIntensity = lerp(0.25, 1.0, clamp((n - 0.05) / 0.6))
    this.groundPool = clamp((n - 0.12) / 0.55)
    this.windowEmissive = lerp(0.25, 1.0, clamp((n - 0.2) / 0.6))

    // The valley gains contrast as its own lights come on, not as a global curve.
    const litFraction = state.totalLit / Math.max(1, state.totalFixtures)
    this.distantContrast = clamp(lerp(0.42, 0.72, n) + litFraction * 0.3)

    this.birds = clamp(1 - n * 1.7)
    this.insects = clamp((n - 0.28) / 0.5)
    this.townMurmur = clamp(0.25 + litFraction * 0.75)
  }

  /**
   * The sky colour in a given direction, matching the dome shader.
   *
   * The moon and the cloud in front of it are graded against *this*, not against
   * a generic zenith value — otherwise a pale grey disc floats on an orange sky
   * and reads as a sticker.
   */
  skyColorAt(dir: Vector3, out = new Color()): Color {
    const h = clamp(dir.y, -1, 1)
    let t = clamp(h * 0.5 + 0.5)
    t = clamp((t - 0.5) * 2)
    out.copy(this.horizon).lerp(this.zenith, Math.pow(t, 0.62))

    const sfx = this.sunDir.x
    const sfz = this.sunDir.z
    const sl = Math.hypot(sfx, sfz) || 1
    const dl = Math.hypot(dir.x, dir.z) || 1
    const az = clamp((dir.x * sfx + dir.z * sfz) / (dl * sl), -1, 1)
    const azFall = Math.pow(clamp(az * 0.5 + 0.5), 3)
    const vertFall = Math.exp(-Math.max(h, -0.05) / Math.max(this.warmSpread, 0.04))
    out.lerp(this.warmBand, clamp(azFall * vertFall * this.warmStrength, 0, 0.94))
    return out
  }

  /** Hours/minutes for the dial. */
  clockHands(): { minuteAngle: number; hourAngle: number; hh: number; mm: number } {
    const m = this.clockMinutes
    const mm = m % 60
    const hh = Math.floor(m / 60) % 12
    return {
      minuteAngle: (mm / 60) * Math.PI * 2,
      hourAngle: ((hh + mm / 60) / 12) * Math.PI * 2,
      hh,
      mm,
    }
  }
}
