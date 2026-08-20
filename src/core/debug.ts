import type { WebGLRenderer } from 'three';
import type { Director } from '../game/director';
import type { QualityManager } from './quality';
import { SLIDE_LENGTH } from '../world/slideCurve';

/**
 * `?debug=1` only. Nothing here is drawn in the normal game and nothing is
 * sent anywhere — it exists so the design claims can be checked on a device.
 */
export class DebugOverlay {
  readonly enabled: boolean;
  private el: HTMLDivElement | null = null;
  private acc = 0;

  constructor() {
    this.enabled = new URLSearchParams(location.search).get('debug') === '1';
    if (!this.enabled) return;
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'z-index:50',
      'margin:max(6px, env(safe-area-inset-top)) 6px',
      'padding:7px 9px',
      'font:11px/1.42 ui-monospace,SFMono-Regular,Menlo,monospace',
      'color:#dff0f6',
      'background:rgba(8,20,26,0.74)',
      'border-radius:8px',
      'white-space:pre',
      'pointer-events:none',
      'max-width:min(92vw,430px)',
      'backdrop-filter:blur(3px)',
    ].join(';');
    document.body.appendChild(el);
    this.el = el;
  }

  update(
    dt: number,
    renderer: WebGLRenderer,
    quality: QualityManager,
    director: Director,
  ): void {
    if (!this.el) return;
    this.acc += dt;
    if (this.acc < 0.25) return;
    this.acc = 0;

    const t = director.telemetry;
    const d = director.debugState;
    const info = renderer.info;
    const b = d.body;
    const yn = (v: boolean): string => (v ? 'yes' : 'no ');

    const speed = b ? (b.onSlide ? b.v : Math.hypot(b.vx, b.vz)) : 0;
    const cov = b?.cov;
    const zone = cov
      ? `dry ${cov.dry.toFixed(2)} wet ${cov.wet.toFixed(2)} sand ${cov.sand.toFixed(2)} rub ${cov.rubber.toFixed(2)}`
      : '-';
    const pred = d.prediction
      ? d.prediction.onSlide
        ? `slide ${d.prediction.arc!.toFixed(2)}/${SLIDE_LENGTH.toFixed(1)} m`
        : `ground x=${d.prediction.x.toFixed(2)} z=${d.prediction.z.toFixed(2)}`
      : '-';

    const texMB = estimateTextureMB(renderer);

    this.el.textContent = [
      `stage ${d.stage} layer ${d.layer} run ${d.runState}`,
      `first gate touch  ${t.firstGateTouch === null ? 'not yet' : t.firstGateTouch.toFixed(1) + ' s'}`,
      `hint stage        ${t.hintStage}`,
      `compared 1st/2nd  ${yn(t.comparedFirstTwo)}`,
      `same obj, heights ${yn(t.sameObjectDifferentZones)}`,
      `same height, objs ${yn(t.sameZoneDifferentObjects)}`,
      `same obj, surface ${yn(t.sameObjectDifferentSurfaces)}`,
      `mat moved after   ${yn(t.matMovedAfterResult)}`,
      `runs ${t.runs.length}  objects ${t.distinctObjects}`,
      '--',
      `object ${d.id} @ ${d.zone}`,
      `speed  ${speed.toFixed(2)} m/s   mu ${(b?.mu ?? 0).toFixed(3)}`,
      `under  ${zone}`,
      `stops  ${pred}`,
      '--',
      `fps ${quality.fps.toFixed(0)}  tier ${quality.settings.tier}  scale ${quality.renderScale.toFixed(2)}`,
      `calls ${info.render.calls}  tris ${(info.render.triangles / 1000).toFixed(1)}k`,
      `tex ${info.memory.textures} (~${texMB.toFixed(1)} MB)  geo ${info.memory.geometries}`,
      `shadow ${quality.settings.shadowMapSize}  foliage ${quality.settings.foliageDensity.toFixed(2)}`,
    ].join('\n');
  }
}

/** Rough VRAM figure: enough to spot a texture budget problem on a phone. */
function estimateTextureMB(renderer: WebGLRenderer): number {
  const props = (renderer as unknown as {
    properties?: { get?: unknown };
  }).properties;
  if (!props) return 0;
  // three does not expose per-texture bytes; approximate from the counts we
  // know we bake: RGBA8 with mipmaps.
  const count = renderer.info.memory.textures;
  const avgPixels = 512 * 256;
  return (count * avgPixels * 4 * 1.33) / (1024 * 1024);
}
