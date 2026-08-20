import * as THREE from 'three';

// A deliberately small post chain: bright-pass, two separable blurs, composite.
// UnrealBloomPass would look softer but costs five mip levels; here the only
// thing allowed to bloom is the fire itself, so a tight two-tap chain is both
// cheaper and closer to the brief ("the darkness around the fireball is what
// makes it worth something").

const QUAD = new THREE.PlaneGeometry(2, 2);

const VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BRIGHT_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;
void main(){
  vec3 c = texture2D(tSrc, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // Soft knee so the bright-pass edge never shows as a hard ring.
  float k = uKnee;
  float soft = clamp(l - uThreshold + k, 0.0, 2.0 * k);
  soft = soft * soft / (4.0 * k + 1e-5);
  float contrib = max(soft, l - uThreshold) / max(l, 1e-5);
  gl_FragColor = vec4(c * clamp(contrib, 0.0, 1.0), 1.0);
}
`;

const BLUR_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uDir;
varying vec2 vUv;
void main(){
  // 9-tap gaussian folded into 5 bilinear samples.
  vec3 s = texture2D(tSrc, vUv).rgb * 0.2270270270;
  vec2 o1 = uDir * 1.3846153846;
  vec2 o2 = uDir * 3.2307692308;
  s += texture2D(tSrc, vUv + o1).rgb * 0.3162162162;
  s += texture2D(tSrc, vUv - o1).rgb * 0.3162162162;
  s += texture2D(tSrc, vUv + o2).rgb * 0.0702702703;
  s += texture2D(tSrc, vUv - o2).rgb * 0.0702702703;
  gl_FragColor = vec4(s, 1.0);
}
`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloomA;
uniform sampler2D tBloomB;
uniform float uBloomStrength;
uniform float uBloomWide;
uniform float uVignette;
uniform float uGrain;
uniform float uAberration;
uniform float uTime;
uniform float uExposure;
uniform float uFade;
varying vec2 vUv;

float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main(){
  vec2 uv = vUv;
  vec2 fromCenter = uv - 0.5;
  float r2 = dot(fromCenter, fromCenter);

  vec3 scene;
  if (uAberration > 0.0) {
    // Lateral chromatic aberration, very slight. Macro glass really does this.
    vec2 off = fromCenter * r2 * uAberration;
    scene.r = texture2D(tScene, uv + off).r;
    scene.g = texture2D(tScene, uv).g;
    scene.b = texture2D(tScene, uv - off).b;
  } else {
    scene = texture2D(tScene, uv).rgb;
  }

  vec3 bloom = texture2D(tBloomA, uv).rgb + texture2D(tBloomB, uv).rgb * uBloomWide;
  vec3 color = scene + bloom * uBloomStrength;

  color *= uExposure;

  // Vignette: gentle, and it doubles as a frame for a very small subject.
  float vig = 1.0 - uVignette * smoothstep(0.06, 0.75, r2);
  color *= vig;

  color *= uFade;

  gl_FragColor = vec4(color, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>

  if (uGrain > 0.0) {
    // Grain after encoding: it is a display-referred artefact, and it also
    // dithers away the banding you otherwise get in a very dark gradient.
    float n = hash12(gl_FragCoord.xy + fract(uTime) * 431.17);
    gl_FragColor.rgb += (n - 0.5) * uGrain;
  }
}
`;

export class PostChain {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const type = THREE.HalfFloatType;
    const rtOpts = {
      type,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      colorSpace: THREE.NoColorSpace,
    };
    this.sceneRT = new THREE.WebGLRenderTarget(2, 2, rtOpts);
    const dimOpts = { ...rtOpts, depthBuffer: false };
    this.brightRT = new THREE.WebGLRenderTarget(2, 2, dimOpts);
    this.blurRT = new THREE.WebGLRenderTarget(2, 2, dimOpts);
    this.wideRT = new THREE.WebGLRenderTarget(2, 2, dimOpts);
    this.wideTmpRT = new THREE.WebGLRenderTarget(2, 2, dimOpts);

    this.brightMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: BRIGHT_FRAG,
      uniforms: {
        tSrc: { value: null },
        uThreshold: { value: 1.0 },
        uKnee: { value: 0.55 },
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.blurMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: BLUR_FRAG,
      uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.compositeMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: COMPOSITE_FRAG,
      uniforms: {
        tScene: { value: this.sceneRT.texture },
        tBloomA: { value: this.blurRT.texture },
        tBloomB: { value: this.wideRT.texture },
        uBloomStrength: { value: 0.52 },
        uBloomWide: { value: 0.30 },
        uVignette: { value: 0.34 },
        uGrain: { value: 0.016 },
        uAberration: { value: 0.0 },
        uTime: { value: 0 },
        uExposure: { value: 1.0 },
        uFade: { value: 1.0 },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.quad = new THREE.Mesh(QUAD, this.brightMat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);

    this.bloomScale = 0.5;
    this.bloomPasses = 2;
    this.size = new THREE.Vector2(2, 2);
  }

  setSize(w, h) {
    this.size.set(w, h);
    this.sceneRT.setSize(w, h);
    const bw = Math.max(2, Math.floor(w * this.bloomScale));
    const bh = Math.max(2, Math.floor(h * this.bloomScale));
    this.brightRT.setSize(bw, bh);
    this.blurRT.setSize(bw, bh);
    const ww = Math.max(2, Math.floor(bw * 0.5));
    const wh = Math.max(2, Math.floor(bh * 0.5));
    this.wideRT.setSize(ww, wh);
    this.wideTmpRT.setSize(ww, wh);
  }

  applyQuality(settings) {
    this.bloomScale = settings.bloomScale;
    this.bloomPasses = settings.bloomPasses;
    this.compositeMat.uniforms.uGrain.value = settings.grain ? 0.016 : 0.0;
    this.compositeMat.uniforms.uAberration.value = settings.name === 'high' ? 0.0022 : 0.0;
    this.setSize(this.size.x, this.size.y);
  }

  _draw(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.clear(true, false, false);
    this.renderer.render(this.scene, this.camera);
  }

  render(scene, camera, time, fade) {
    const r = this.renderer;
    r.setRenderTarget(this.sceneRT);
    r.clear(true, true, false);
    r.render(scene, camera);

    // Bright pass.
    this.brightMat.uniforms.tSrc.value = this.sceneRT.texture;
    this._draw(this.brightMat, this.brightRT);

    // Tight blur.
    const bw = this.brightRT.width;
    const bh = this.brightRT.height;
    for (let i = 0; i < this.bloomPasses; i++) {
      const spread = 1.0 + i * 1.4;
      this.blurMat.uniforms.tSrc.value = i === 0 ? this.brightRT.texture : this.blurRT.texture;
      this.blurMat.uniforms.uDir.value.set(spread / bw, 0);
      this._draw(this.blurMat, this._tightScratch());
      this.blurMat.uniforms.tSrc.value = this._tightTmp.texture;
      this.blurMat.uniforms.uDir.value.set(0, spread / bh);
      this._draw(this.blurMat, this.blurRT);
    }

    // Wide, low halo: a hint of atmosphere around the fireball only.
    const ww = this.wideRT.width;
    const wh = this.wideRT.height;
    this.blurMat.uniforms.tSrc.value = this.blurRT.texture;
    this.blurMat.uniforms.uDir.value.set(2.0 / ww, 0);
    this._draw(this.blurMat, this.wideTmpRT);
    this.blurMat.uniforms.tSrc.value = this.wideTmpRT.texture;
    this.blurMat.uniforms.uDir.value.set(0, 2.0 / wh);
    this._draw(this.blurMat, this.wideRT);

    this.compositeMat.uniforms.uTime.value = time;
    this.compositeMat.uniforms.uFade.value = fade;
    r.setRenderTarget(null);
    this._draw(this.compositeMat, null);
  }

  // The tight blur needs a scratch target the same size as blurRT.
  _tightScratch() {
    if (!this._tightTmp) {
      this._tightTmp = new THREE.WebGLRenderTarget(2, 2, {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        stencilBuffer: false,
        colorSpace: THREE.NoColorSpace,
      });
    }
    if (this._tightTmp.width !== this.brightRT.width || this._tightTmp.height !== this.brightRT.height) {
      this._tightTmp.setSize(this.brightRT.width, this.brightRT.height);
    }
    return this._tightTmp;
  }

  dispose() {
    for (const rt of [this.sceneRT, this.brightRT, this.blurRT, this.wideRT, this.wideTmpRT, this._tightTmp]) {
      rt?.dispose();
    }
    this.brightMat.dispose();
    this.blurMat.dispose();
    this.compositeMat.dispose();
    QUAD.dispose();
  }
}
