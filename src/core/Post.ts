import {
  Camera,
  Vector3,
  ClampToEdgeWrapping,
  DepthTexture,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NearestFilter,
  NoColorSpace,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  UnsignedIntType,
  Vector2,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three'

const FS_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const BRIGHT_FRAG = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D tSrc;
  uniform vec2 tex;
  uniform float uThreshold;
  uniform float uKnee;
  void main() {
    // 4-tap box downsample, then a soft highlight knee.
    vec3 c = texture2D(tSrc, vUv + tex * vec2(-1.0, -1.0)).rgb;
    c += texture2D(tSrc, vUv + tex * vec2(1.0, -1.0)).rgb;
    c += texture2D(tSrc, vUv + tex * vec2(-1.0, 1.0)).rgb;
    c += texture2D(tSrc, vUv + tex * vec2(1.0, 1.0)).rgb;
    c *= 0.25;
    float l = max(c.r, max(c.g, c.b));
    float s = clamp((l - uThreshold) / max(uKnee, 1e-4), 0.0, 1.0);
    gl_FragColor = vec4(c * s * s, 1.0);
  }
`

const BLUR_FRAG = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D tSrc;
  uniform vec2 uDir;
  void main() {
    vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
    c += texture2D(tSrc, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
    c += texture2D(tSrc, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
    c += texture2D(tSrc, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
    c += texture2D(tSrc, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
    gl_FragColor = vec4(c, 1.0);
  }
`

const FINAL_FRAG = /* glsl */ `
  precision highp float;
  #include <common>
  #include <packing>
  varying vec2 vUv;
  uniform sampler2D tScene;
  uniform sampler2D tBloom;
  uniform sampler2D tDepth;
  uniform vec2 uTexel;
  uniform float uBloom;
  uniform float uNear;
  uniform float uFar;
  uniform float uFocus;
  uniform float uBlurNear;
  uniform float uBlurFar;
  uniform float uVignette;
  uniform float uAberration;
  uniform float uDofEnabled;
  uniform float uSaturation;
  uniform float uContrast;
  uniform vec3 uLift;

  float viewDistance(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    return -perspectiveDepthToViewZ(d, uNear, uFar);
  }

  void main() {
    vec2 uv = vUv;
    vec3 col;

    // --- restrained depth of field ----------------------------------------
    float dist = viewDistance(uv);
    float coc = 0.0;
    if (uDofEnabled > 0.5) {
      float back = clamp((dist - uFocus) / max(uFocus * 2.4, 0.001), 0.0, 1.0);
      float front = clamp((uFocus - dist) / max(uFocus * 0.72, 0.001), 0.0, 1.0);
      coc = max(pow(back, 0.75) * uBlurFar, pow(front, 1.3) * uBlurNear);
    }
    if (coc > 0.15) {
      vec2 r = uTexel * coc;
      col = texture2D(tScene, uv).rgb * 0.30;
      col += texture2D(tScene, uv + r * vec2(0.95, 0.31)).rgb * 0.1167;
      col += texture2D(tScene, uv + r * vec2(-0.59, 0.81)).rgb * 0.1167;
      col += texture2D(tScene, uv + r * vec2(-0.81, -0.59)).rgb * 0.1167;
      col += texture2D(tScene, uv + r * vec2(0.31, -0.95)).rgb * 0.1167;
      col += texture2D(tScene, uv + r * vec2(1.62, -0.52) * 0.62).rgb * 0.1166;
      col += texture2D(tScene, uv + r * vec2(-1.30, -1.05) * 0.62).rgb * 0.1166;
    } else {
      col = texture2D(tScene, uv).rgb;
    }

    // --- a whisper of lateral colour fringing at the frame edge ------------
    if (uAberration > 0.0) {
      vec2 d = uv - 0.5;
      float r2 = dot(d, d);
      vec2 off = d * r2 * uAberration;
      col.r = texture2D(tScene, uv + off).r;
      col.b = texture2D(tScene, uv - off).b;
    }

    col += texture2D(tBloom, uv).rgb * uBloom;

    // --- grade -------------------------------------------------------------
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(lum), col, uSaturation);
    col = max(vec3(0.0), (col - 0.18) * uContrast + 0.18);
    col += uLift * lum;

    // --- vignette ----------------------------------------------------------
    vec2 q = (uv - 0.5) * vec2(1.0, 1.0);
    float v = 1.0 - uVignette * dot(q, q) * 1.6;
    col *= clamp(v, 0.0, 1.0);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export interface PostOptions {
  bloom: boolean
  dof: boolean
}

export class Post {
  sceneRT!: WebGLRenderTarget
  private bloomA!: WebGLRenderTarget
  private bloomB!: WebGLRenderTarget
  private quad: Mesh
  private quadScene = new Scene()
  private quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private brightMat: ShaderMaterial
  private blurMat: ShaderMaterial
  private finalMat: ShaderMaterial
  private hdr: boolean
  private msaa = 4
  private width = 2
  private height = 2
  options: PostOptions = { bloom: true, dof: true }

  constructor(renderer: WebGLRenderer) {
    this.hdr =
      renderer.extensions.has('EXT_color_buffer_float') ||
      renderer.extensions.has('EXT_color_buffer_half_float')

    this.brightMat = new ShaderMaterial({
      vertexShader: FS_VERT,
      fragmentShader: BRIGHT_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tSrc: { value: null },
        tex: { value: new Vector2() },
        uThreshold: { value: this.hdr ? 1.35 : 0.80 },
        uKnee: { value: 0.7 },
      },
    })
    this.blurMat = new ShaderMaterial({
      vertexShader: FS_VERT,
      fragmentShader: BLUR_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: { tSrc: { value: null }, uDir: { value: new Vector2() } },
    })
    this.finalMat = new ShaderMaterial({
      vertexShader: FS_VERT,
      fragmentShader: FINAL_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        tDepth: { value: null },
        uTexel: { value: new Vector2() },
        uBloom: { value: 0.55 },
        uNear: { value: 0.05 },
        uFar: { value: 200 },
        uFocus: { value: 1.8 },
        uBlurNear: { value: 2.1 },
        uBlurFar: { value: 1.7 },
        uVignette: { value: 0.30 },
        uAberration: { value: 0.0008 },
        uDofEnabled: { value: 1 },
        uSaturation: { value: 1.16 },
        uContrast: { value: 1.14 },
        uLift: { value: new Vector3(0.012, 0.010, 0.004) },
      },
    })

    this.quad = new Mesh(new PlaneGeometry(2, 2), this.finalMat)
    this.quad.frustumCulled = false
    this.quadScene.add(this.quad)

    this.allocate(2, 2)
  }

  private allocate(w: number, h: number): void {
    const type = this.hdr ? HalfFloatType : UnsignedByteType
    const depth = new DepthTexture(w, h)
    depth.type = UnsignedIntType
    depth.minFilter = NearestFilter
    depth.magFilter = NearestFilter
    this.sceneRT = new WebGLRenderTarget(w, h, {
      type,
      depthTexture: depth,
      depthBuffer: true,
      stencilBuffer: false,
      samples: this.msaa,
    })
    this.sceneRT.texture.colorSpace = NoColorSpace
    this.sceneRT.texture.minFilter = LinearFilter
    this.sceneRT.texture.magFilter = LinearFilter
    this.sceneRT.texture.wrapS = ClampToEdgeWrapping
    this.sceneRT.texture.wrapT = ClampToEdgeWrapping

    const bw = Math.max(1, Math.floor(w / 4))
    const bh = Math.max(1, Math.floor(h / 4))
    const opts = { type, depthBuffer: false, stencilBuffer: false }
    this.bloomA = new WebGLRenderTarget(bw, bh, opts)
    this.bloomB = new WebGLRenderTarget(bw, bh, opts)
    for (const rt of [this.bloomA, this.bloomB]) {
      rt.texture.colorSpace = NoColorSpace
      rt.texture.minFilter = LinearFilter
      rt.texture.magFilter = LinearFilter
      rt.texture.wrapS = ClampToEdgeWrapping
      rt.texture.wrapT = ClampToEdgeWrapping
    }
  }

  setSize(w: number, h: number): void {
    w = Math.max(2, Math.floor(w))
    h = Math.max(2, Math.floor(h))
    if (w === this.width && h === this.height) return
    this.width = w
    this.height = h
    this.sceneRT.dispose()
    this.sceneRT.depthTexture?.dispose()
    this.bloomA.dispose()
    this.bloomB.dispose()
    this.allocate(w, h)
  }

  /** 0 disables multisampling; used by the adaptive quality manager. */
  setSamples(n: number): void {
    if (n === this.msaa) return
    this.msaa = n
    const w = this.width
    const h = this.height
    this.sceneRT.dispose()
    this.sceneRT.depthTexture?.dispose()
    this.bloomA.dispose()
    this.bloomB.dispose()
    this.allocate(w, h)
  }

  setFocus(distance: number): void {
    this.finalMat.uniforms.uFocus.value = distance
  }

  render(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera): void {
    renderer.setRenderTarget(this.sceneRT)
    renderer.clear(true, true, false)
    renderer.render(scene, camera)

    const bw = this.bloomA.width
    const bh = this.bloomA.height

    if (this.options.bloom) {
      this.brightMat.uniforms.tSrc.value = this.sceneRT.texture
      ;(this.brightMat.uniforms.tex.value as Vector2).set(0.5 / this.width, 0.5 / this.height)
      this.blit(renderer, this.brightMat, this.bloomA)

      this.blurMat.uniforms.tSrc.value = this.bloomA.texture
      ;(this.blurMat.uniforms.uDir.value as Vector2).set(1 / bw, 0)
      this.blit(renderer, this.blurMat, this.bloomB)

      this.blurMat.uniforms.tSrc.value = this.bloomB.texture
      ;(this.blurMat.uniforms.uDir.value as Vector2).set(0, 1 / bh)
      this.blit(renderer, this.blurMat, this.bloomA)
    }

    const u = this.finalMat.uniforms
    u.tScene.value = this.sceneRT.texture
    u.tBloom.value = this.options.bloom ? this.bloomA.texture : null
    u.tDepth.value = this.sceneRT.depthTexture
    ;(u.uTexel.value as Vector2).set(1 / this.width, 1 / this.height)
    u.uBloom.value = this.options.bloom ? 0.40 : 0
    u.uNear.value = camera.near
    u.uFar.value = camera.far
    u.uDofEnabled.value = this.options.dof ? 1 : 0
    this.blit(renderer, this.finalMat, null)
  }

  private blit(renderer: WebGLRenderer, mat: ShaderMaterial, target: WebGLRenderTarget | null): void {
    this.quad.material = mat
    renderer.setRenderTarget(target)
    renderer.render(this.quadScene, this.quadCam as Camera)
  }

  dispose(): void {
    this.sceneRT.dispose()
    this.bloomA.dispose()
    this.bloomB.dispose()
  }
}
