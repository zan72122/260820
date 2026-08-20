/**
 * Bakes what each square millimetre of paper sees of the lamps inside the nebuta.
 *
 * Each panel is rasterised into its own atlas tile in UV space; for every texel a ray is
 * traced to each of the three interior lamps and tested against the bamboo, wood and wire
 * members of the frame. The result is stored once and costs nothing afterwards:
 *
 *   R,G,B  what lamp 0 / 1 / 2 delivers here (incidence x falloff x soft frame shadow)
 *   A      how much frame sits directly behind the sheet — the shadow you see by day too
 *
 * The bake is spread over several frames during the opening so it never stalls the game.
 */

import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  NoBlending,
  OrthographicCamera,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector3,
  Vector4,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import type { CapsuleSeg } from '../util/tube';
import { LAMP_POSITIONS } from './shape';
import type { PanelRuntime } from './Paper';

const MAX_SEG = 30;

const VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNrm;
void main() {
  vWorld = position;
  vNrm = normalize(normal);
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorld;
varying vec3 vNrm;
uniform vec3 uLampPos[3];
uniform vec3 uSegA[${MAX_SEG}];
uniform vec4 uSegB[${MAX_SEG}];   // xyz end point, w radius
uniform int uSegCount;

float segSegDist(vec3 p1, vec3 q1, vec3 p2, vec3 q2) {
  vec3 d1 = q1 - p1;
  vec3 d2 = q2 - p2;
  vec3 r = p1 - p2;
  float a = dot(d1, d1);
  float e = dot(d2, d2);
  float f = dot(d2, r);
  float c = dot(d1, r);
  float b = dot(d1, d2);
  float denom = a * e - b * b;
  float s = denom > 1e-8 ? clamp((b * f - c * e) / denom, 0.0, 1.0) : 0.0;
  float t = clamp((b * s + f) / max(e, 1e-8), 0.0, 1.0);
  s = clamp((b * t - c) / max(a, 1e-8), 0.0, 1.0);
  return distance(p1 + d1 * s, p2 + d2 * t);
}

void main() {
  // start a little inside the sheet so the surface never shadows itself
  vec3 origin = vWorld - vNrm * 0.006;
  vec3 lit = vec3(0.0);
  float behind = 0.0;
  vec3 inward = origin - vNrm * 0.13;

  for (int L = 0; L < 3; L++) {
    vec3 lp = uLampPos[L];
    vec3 dir = lp - origin;
    float dist = length(dir);
    vec3 n = dir / max(dist, 1e-4);
    // wrapped incidence: paper is translucent, so it does not go black past the terminator
    float incidence = clamp(dot(-vNrm, n) * 0.78 + 0.22, 0.0, 1.0);
    float falloff = 1.0 / (1.0 + pow(dist / 0.56, 2.0));
    float occl = 0.0;
    for (int i = 0; i < ${MAX_SEG}; i++) {
      if (i >= uSegCount) break;
      vec3 a = uSegA[i];
      vec4 bw = uSegB[i];
      float d = segSegDist(origin, lp, a, bw.xyz);
      occl += smoothstep(bw.w * 2.6, bw.w * 0.55, d);
    }
    float vis = clamp(1.0 - occl * 0.9, 0.06, 1.0);
    lit[L] = incidence * falloff * vis;
  }

  for (int i = 0; i < ${MAX_SEG}; i++) {
    if (i >= uSegCount) break;
    vec3 a = uSegA[i];
    vec4 bw = uSegB[i];
    float d = segSegDist(origin, inward, a, bw.xyz);
    behind = max(behind, smoothstep(bw.w * 3.0, bw.w * 0.7, d));
  }

  gl_FragColor = vec4(clamp(lit, 0.0, 1.0), behind);
}
`;

export class InteriorBake {
  readonly target: WebGLRenderTarget;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: ShaderMaterial;
  private queue: PanelRuntime[] = [];
  private capsules: CapsuleSeg[] = [];
  private cleared = false;
  private total = 1;

  constructor(
    private readonly renderer: WebGLRenderer,
    size: number,
  ) {
    this.target = new WebGLRenderTarget(size, size, {
      type: UnsignedByteType,
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    });
    this.target.texture.colorSpace = LinearSRGBColorSpace;

    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uLampPos: { value: LAMP_POSITIONS.map((v) => v.clone()) },
        uSegA: { value: Array.from({ length: MAX_SEG }, () => new Vector3()) },
        // xyz is the far end of the member, w its radius
        uSegB: { value: Array.from({ length: MAX_SEG }, () => new Vector4(0, 0, 0, 0.01)) },
        uSegCount: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
      blending: NoBlending,
    });
  }

  begin(panels: PanelRuntime[], capsules: CapsuleSeg[]): void {
    this.queue = [...panels];
    this.total = Math.max(1, panels.length);
    this.capsules = capsules;
    this.cleared = false;
  }

  get done(): boolean {
    return this.queue.length === 0;
  }

  get progress(): number {
    return 1 - this.queue.length / this.total;
  }

  /** Bakes one panel. Call once per frame until `done`. */
  step(): boolean {
    const prev = this.renderer.getRenderTarget();
    const prevAuto = this.renderer.autoClear;
    this.renderer.autoClear = false;
    if (!this.cleared) {
      this.renderer.setRenderTarget(this.target);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.clear(true, false, false);
      this.cleared = true;
    }
    const panel = this.queue.shift();
    if (panel) {
      this.selectCapsules(panel);
      const mesh = new Mesh(panel.mesh.geometry, this.material);
      mesh.frustumCulled = false;
      this.scene.clear();
      this.scene.add(mesh);
      this.renderer.setRenderTarget(this.target);
      this.renderer.render(this.scene, this.camera);
      this.scene.clear();
    }
    this.renderer.autoClear = prevAuto;
    this.renderer.setRenderTarget(prev);
    return this.queue.length === 0;
  }

  /** Keeps only the frame members that can plausibly shadow this panel. */
  private selectCapsules(panel: PanelRuntime): void {
    const box = panel.mesh.geometry.boundingBox;
    const centre = panel.centre;
    const scored = this.capsules
      .map((c) => {
        const mx = (c.ax + c.bx) * 0.5;
        const my = (c.ay + c.by) * 0.5;
        const mz = (c.az + c.bz) * 0.5;
        let d = Math.hypot(mx - centre.x, my - centre.y, mz - centre.z);
        if (box) {
          const cx = Math.max(box.min.x, Math.min(box.max.x, mx));
          const cy = Math.max(box.min.y, Math.min(box.max.y, my));
          const cz = Math.max(box.min.z, Math.min(box.max.z, mz));
          d = Math.min(d, Math.hypot(mx - cx, my - cy, mz - cz));
        }
        return { c, d };
      })
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_SEG);

    const A = this.material.uniforms.uSegA.value as Vector3[];
    const B = this.material.uniforms.uSegB.value as Vector4[];
    scored.forEach((s, i) => {
      A[i].set(s.c.ax, s.c.ay, s.c.az);
      B[i].set(s.c.bx, s.c.by, s.c.bz, s.c.r);
    });
    this.material.uniforms.uSegCount.value = scored.length;
    this.material.uniformsNeedUpdate = true;
  }

  dispose(): void {
    this.target.dispose();
    this.material.dispose();
  }
}
