import * as THREE from 'three';
import type { BallSpec, FloorSpec } from '../physics/params';
import type { GameState } from '../state/game';

/**
 * Development read-out, shown only when the page is opened with `?debug=1`.
 *
 * It stays on the device. Nothing here is transmitted, stored beyond the tab
 * session, or shown to a player: it exists so an adult can check that the
 * discovery sequence is doing its job, not to grade the child.
 */

const yes = (b: boolean) => (b ? '✓' : '·');

export class DebugOverlay {
  private el: HTMLElement;
  readonly enabled: boolean;
  private frames = 0;
  private acc = 0;
  private fps = 0;
  private text = '';

  constructor() {
    this.enabled = new URLSearchParams(location.search).get('debug') === '1';
    this.el = document.getElementById('debug')!;
    if (this.enabled) this.el.classList.add('on');
  }

  update(
    dt: number,
    renderer: THREE.WebGLRenderer,
    state: GameState,
    floor: FloorSpec,
    ball: BallSpec,
    heightIndex: number,
    extra: { tier: string; chainSlots: number; particles: number }
  ) {
    if (!this.enabled) return;
    this.frames++;
    this.acc += dt;
    if (this.acc < 0.25) return;
    this.fps = this.frames / this.acc;
    this.frames = 0;
    this.acc = 0;

    const info = renderer.info;
    const m = state.metrics;
    const texBytes = estimateTextureMemory();

    const lines = [
      `phase        ${state.phase}`,
      `unlocked     floor:${yes(state.unlocks.floors)} ball:${yes(state.unlocks.balls)} height:${yes(
        state.unlocks.height
      )} yard:${yes(state.unlocks.chain)}`,
      '',
      '— behaviour (device-local, never transmitted) —',
      `time to ring touch      ${m.timeToFirstTouch === null ? 'not yet' : m.timeToFirstTouch.toFixed(1) + 's'}`,
      `second floor unaided    ${yes(m.triedSecondFloorAlone)}`,
      `changed floor only      ${yes(m.isolatedTheFloor)}`,
      `varied ball / height    ${yes(m.variedBallOrHeight)}`,
      `built a 3-surface chain ${yes(m.builtChain)}`,
      `repeated same test      ${m.repeats}`,
      `drops total / post      ${m.dropsTotal} / ${m.dropsAfterUnderstanding}`,
      `floors / balls tried    ${m.floorsTried.size} / ${m.ballsTried.size}`,
      `heights tried / sweeps  ${m.heightsTried.size} / ${m.sweeps}`,
      `chain runs / filled     ${m.chainRuns} / ${extra.chainSlots}`,
      '',
      '— current specimen —',
      `floor ${floor.id.padEnd(9)} e=${floor.restitution.toFixed(2)} mu=${floor.friction.toFixed(
        2
      )} def=${floor.deformation.toFixed(4)} t=${floor.contactTime.toFixed(3)} mark=${floor.mark}`,
      `ball  ${ball.id.padEnd(9)} m=${ball.mass.toFixed(3)} r=${ball.radius.toFixed(
        3
      )} e=${ball.restitution.toFixed(2)} squash=${ball.squash.toFixed(2)}`,
      `pair  e=${(floor.restitution * ball.restitution).toFixed(3)}  height slot ${heightIndex}`,
      '',
      '— render —',
      `fps ${this.fps.toFixed(0)}   tier ${extra.tier}   dpr ${renderer.getPixelRatio().toFixed(2)}`,
      `draw calls ${info.render.calls}   tris ${info.render.triangles}`,
      `programs ${renderer.info.programs?.length ?? 0}   geoms ${info.memory.geometries}   texs ${info.memory.textures}`,
      `texture est ${(texBytes / (1024 * 1024)).toFixed(1)} MB   particles ${extra.particles}`,
    ];
    const next = lines.join('\n');
    if (next !== this.text) {
      this.text = next;
      this.el.textContent = next;
    }
  }
}

/**
 * Rough GPU texture footprint, summed over every texture the game baked. It is
 * an estimate, which is all a budget check needs.
 */
function estimateTextureMemory() {
  let total = 0;
  for (const t of trackedTextures) {
    const img = t.image as { width?: number; height?: number } | undefined;
    if (!img?.width || !img?.height) continue;
    const base = img.width * img.height * 4;
    total += t.generateMipmaps ? base * 1.34 : base;
  }
  return total;
}

const trackedTextures = new Set<THREE.Texture>();

/** Called by the app for every texture it creates, so the estimate is real. */
export function trackTexture(t: THREE.Texture) {
  trackedTextures.add(t);
}
