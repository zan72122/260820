/**
 * A deliberately small post chain: the scene is drawn into a linear HDR target, a knee
 * threshold isolates only the genuinely bright pixels (the lit paper and the lamps), those
 * are blurred at a couple of low resolutions, and the composite adds them back before ACES
 * tone mapping. Nothing on screen is blurred wholesale, so the ink lines, the fibre grain
 * and the dye density survive the light-up.
 */

import {
  ClampToEdgeWrapping,
  HalfFloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  NoBlending,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Texture,
  UniformsUtils,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const THRESHOLD_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;
uniform float uThreshold;
uniform float uKnee;
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float soft = clamp(l - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-5);
  float contrib = max(soft, l - uThreshold) / max(l, 1e-5);
  gl_FragColor = vec4(c * contrib, 1.0);
}
`;

const BLUR_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tSrc;
uniform vec2 uDir;   // texel-sized step
void main() {
  // 9-tap gaussian folded into 5 bilinear fetches
  vec4 sum = texture2D(tSrc, vUv) * 0.2270270270;
  vec2 o1 = uDir * 1.3846153846;
  vec2 o2 = uDir * 3.2307692308;
  sum += texture2D(tSrc, vUv + o1) * 0.3162162162;
  sum += texture2D(tSrc, vUv - o1) * 0.3162162162;
  sum += texture2D(tSrc, vUv + o2) * 0.0702702703;
  sum += texture2D(tSrc, vUv - o2) * 0.0702702703;
  gl_FragColor = sum;
}
`;

const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;
uniform sampler2D tBloom0;
uniform sampler2D tBloom1;
uniform sampler2D tBloom2;
uniform float uBloomStrength;
uniform float uBloomLevels;
uniform float uExposure;
uniform float uVignette;
uniform float uGrain;
uniform float uTime;
uniform float uWarm;

// ACES filmic approximation (Narkowicz)
vec3 aces(vec3 x) {
  const float a = 2.51; const float b = 0.03; const float c = 2.43;
  const float d = 0.59; const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 col = texture2D(tScene, vUv).rgb;
  if (uBloomStrength > 0.0) {
    vec3 b = texture2D(tBloom0, vUv).rgb * 0.55;
    if (uBloomLevels > 1.5) b += texture2D(tBloom1, vUv).rgb * 0.34;
    if (uBloomLevels > 2.5) b += texture2D(tBloom2, vUv).rgb * 0.22;
    col += b * uBloomStrength;
  }
  col *= uExposure;
  // a whisper of warmth on the lit side, never a full-screen colour wash
  col = mix(col, col * vec3(1.06, 1.0, 0.93), uWarm);
  col = aces(col);

  vec2 d = vUv - 0.5;
  float vig = 1.0 - uVignette * dot(d, d) * 1.35;
  col *= vig;

  if (uGrain > 0.0) {
    float n = fract(sin(dot(vUv * 1024.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    col += (n - 0.5) * uGrain;
  }
  gl_FragColor = vec4(toSRGB(col), 1.0);
}
`;

function makeRT(w: number, h: number, samples = 0): WebGLRenderTarget {
  const rt = new WebGLRenderTarget(Math.max(2, Math.floor(w)), Math.max(2, Math.floor(h)), {
    type: HalfFloatType,
    format: RGBAFormat,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
    depthBuffer: true,
    stencilBuffer: false,
    generateMipmaps: false,
    samples,
  });
  rt.texture.colorSpace = LinearSRGBColorSpace;
  return rt;
}

export class PostPipeline {
  readonly sceneRT: WebGLRenderTarget;
  private readonly bright: WebGLRenderTarget[] = [];
  private readonly temp: WebGLRenderTarget[] = [];
  private readonly quadScene = new Scene();
  private readonly quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: Mesh;
  private readonly thresholdMat: ShaderMaterial;
  private readonly blurMat: ShaderMaterial;
  private readonly compositeMat: ShaderMaterial;
  private levels: number;

  bloomStrength = 0;
  exposure = 1;
  vignette = 0.18;
  grain = 0;
  warm = 0;

  constructor(
    private readonly renderer: WebGLRenderer,
    width: number,
    height: number,
    levels: number,
    samples: number,
  ) {
    this.levels = Math.max(1, Math.min(3, levels));
    this.sceneRT = makeRT(width, height, samples);

    for (let i = 0; i < 3; i++) {
      const div = Math.pow(2, i + 1);
      this.bright.push(makeRT(width / div, height / div));
      this.temp.push(makeRT(width / div, height / div));
    }

    this.thresholdMat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: THRESHOLD_FRAG,
      uniforms: { tScene: { value: null }, uThreshold: { value: 1.12 }, uKnee: { value: 0.38 } },
      depthTest: false,
      depthWrite: false,
      blending: NoBlending,
    });
    this.blurMat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: BLUR_FRAG,
      uniforms: { tSrc: { value: null }, uDir: { value: new Vector2() } },
      depthTest: false,
      depthWrite: false,
      blending: NoBlending,
    });
    this.compositeMat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: COMPOSITE_FRAG,
      uniforms: UniformsUtils.clone({
        tScene: { value: null },
        tBloom0: { value: null },
        tBloom1: { value: null },
        tBloom2: { value: null },
        uBloomStrength: { value: 0 },
        uBloomLevels: { value: this.levels },
        uExposure: { value: 1 },
        uVignette: { value: 0.18 },
        uGrain: { value: 0 },
        uTime: { value: 0 },
        uWarm: { value: 0 },
      }),
      depthTest: false,
      depthWrite: false,
      blending: NoBlending,
    });

    this.quad = new Mesh(new PlaneGeometry(2, 2), this.thresholdMat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  setSize(width: number, height: number): void {
    this.sceneRT.setSize(Math.max(2, Math.floor(width)), Math.max(2, Math.floor(height)));
    for (let i = 0; i < 3; i++) {
      const div = Math.pow(2, i + 1);
      this.bright[i].setSize(Math.max(2, Math.floor(width / div)), Math.max(2, Math.floor(height / div)));
      this.temp[i].setSize(Math.max(2, Math.floor(width / div)), Math.max(2, Math.floor(height / div)));
    }
  }

  private blit(mat: ShaderMaterial, target: WebGLRenderTarget | null): void {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  /** Runs the bloom chain and composites to the default framebuffer. */
  present(time: number): void {
    const doBloom = this.bloomStrength > 0.0005;
    if (doBloom) {
      this.thresholdMat.uniforms.tScene.value = this.sceneRT.texture;
      this.blit(this.thresholdMat, this.bright[0]);

      let src: Texture = this.bright[0].texture;
      for (let i = 0; i < this.levels; i++) {
        const dst = this.bright[i];
        const tmp = this.temp[i];
        this.blurMat.uniforms.tSrc.value = src;
        this.blurMat.uniforms.uDir.value.set(1 / dst.width, 0);
        this.blit(this.blurMat, tmp);
        this.blurMat.uniforms.tSrc.value = tmp.texture;
        this.blurMat.uniforms.uDir.value.set(0, 1 / dst.height);
        this.blit(this.blurMat, dst);
        src = dst.texture;
      }
    }

    const u = this.compositeMat.uniforms;
    u.tScene.value = this.sceneRT.texture;
    u.tBloom0.value = this.bright[0].texture;
    u.tBloom1.value = this.bright[1].texture;
    u.tBloom2.value = this.bright[2].texture;
    u.uBloomStrength.value = doBloom ? this.bloomStrength : 0;
    u.uBloomLevels.value = this.levels;
    u.uExposure.value = this.exposure;
    u.uVignette.value = this.vignette;
    u.uGrain.value = this.grain;
    u.uWarm.value = this.warm;
    u.uTime.value = time;
    this.blit(this.compositeMat, null);
    this.renderer.setRenderTarget(null);
  }

  /**
   * Compiles every post shader up front so the "click, and there is light" moment never
   * pays a first-use shader compile.
   */
  prewarm(): void {
    const prevStrength = this.bloomStrength;
    this.bloomStrength = 0.0001;
    const prevTarget = this.renderer.getRenderTarget();
    this.thresholdMat.uniforms.tScene.value = this.sceneRT.texture;
    this.blit(this.thresholdMat, this.bright[0]);
    this.blurMat.uniforms.tSrc.value = this.bright[0].texture;
    this.blurMat.uniforms.uDir.value.set(1 / this.bright[0].width, 0);
    this.blit(this.blurMat, this.temp[0]);
    this.blit(this.compositeMat, this.temp[2]);
    this.bloomStrength = prevStrength;
    this.renderer.setRenderTarget(prevTarget);
  }

  dispose(): void {
    this.sceneRT.dispose();
    for (const rt of this.bright) rt.dispose();
    for (const rt of this.temp) rt.dispose();
    this.thresholdMat.dispose();
    this.blurMat.dispose();
    this.compositeMat.dispose();
    this.quad.geometry.dispose();
  }
}
