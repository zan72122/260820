// Syrup on the pile, in two coupled layers rendered on the GPU at grid resolution.
//
//   surf : rgb = colour of the film sitting on top, a = how much is sitting there
//   soak : rgb = colour that has gone *into* the crystals, a = how deep
//
// Each step the film is deposited under the bottle, creeps downhill along the
// pile's own gradient, and is slowly drunk by the ice underneath. That delay --
// draw a line, watch it wet, watch it sink, watch it slide -- is the whole point.

import {
  WebGLRenderTarget, Scene, OrthographicCamera, Mesh, PlaneGeometry,
  ShaderMaterial, NearestFilter, LinearFilter, RGBAFormat, HalfFloatType,
  UnsignedByteType, Vector2, Vector3, Color, ClampToEdgeWrapping,
} from 'three';

const VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tSurf;
uniform sampler2D tSoak;
uniform sampler2D tHeight;
uniform vec2  uTexel;
uniform float uDt;
uniform float uCell;
uniform float uFlow;
uniform float uSoakRate;
uniform float uSoakGain;
uniform float uWick;
uniform float uPass;      // 0 = surface film, 1 = soaked interior
uniform vec3  uBrushCol;
uniform vec3  uBrush;     // xy = uv centre, z = radius in uv
uniform float uAmount;    // deposit per second (0 while not pouring)

float terrain(vec2 uv) { return texture2D(tHeight, uv).r; }
float snowAt(vec2 uv) { return texture2D(tHeight, uv).g; }

void main() {
  vec4 c = texture2D(tSurf, vUv);
  vec4 s = texture2D(tSoak, vUv);
  float hHere = terrain(vUv);
  float solid = smoothstep(0.0004, 0.0016, snowAt(vUv));

  // --- deposit under the bottle mouth -------------------------------------
  float d = 0.0;
  if (uAmount > 0.0) {
    float dist = length((vUv - uBrush.xy) * vec2(1.0, 1.0));
    float g = exp(-(dist * dist) / max(uBrush.z * uBrush.z, 1e-6));
    d = uAmount * uDt * g * solid;
  }

  if (uPass < 0.5) {
    // ------------------------------------------------------------ film pass
    float amt = c.a;
    vec3  col = c.rgb;
    float acc = amt;
    vec3  wcol = col * amt;

    // the film has its own thickness, so a thick puddle also pushes outward
    float H0 = hHere + amt * 0.0022;
    vec2 offs[4];
    offs[0] = vec2( uTexel.x, 0.0);
    offs[1] = vec2(-uTexel.x, 0.0);
    offs[2] = vec2(0.0,  uTexel.y);
    offs[3] = vec2(0.0, -uTexel.y);
    float k = uFlow * uDt / max(uCell, 1e-5);
    for (int i = 0; i < 4; i++) {
      vec2 nuv = clamp(vUv + offs[i], vec2(0.0), vec2(1.0));
      vec4 cn = texture2D(tSurf, nuv);
      float Hn = terrain(nuv) + cn.a * 0.0022;
      float fin  = min(cn.a * clamp(k * (Hn - H0), 0.0, 0.22), cn.a * 0.22);
      float fout = min(amt  * clamp(k * (H0 - Hn), 0.0, 0.22), amt  * 0.22);
      acc  += fin - fout;
      wcol += cn.rgb * fin - col * fout;
    }

    // deposit
    acc += d;
    wcol += uBrushCol * d;

    // the ice drinks it
    float drink = min(max(acc, 0.0), uSoakRate * uDt * (1.0 - s.a * 0.55));
    acc -= drink;

    acc = max(acc, 0.0) * solid;
    vec3 outCol = acc > 1e-5 ? clamp(wcol / max(acc, 1e-5), 0.0, 1.0) : col;
    // syrup that reached bare bowl just disappears down the side
    gl_FragColor = vec4(outCol, min(acc, 3.0));
  } else {
    // ------------------------------------------------------------ soak pass
    float drink = min(max(c.a, 0.0), uSoakRate * uDt * (1.0 - s.a * 0.55)) * uSoakGain;
    float na = s.a + drink;
    vec3 nc = (s.rgb * s.a + c.rgb * drink) / max(na, 1e-5);

    // capillary wicking sideways through the crystals: a gentle blur
    float w = uWick * uDt;
    if (w > 0.0) {
      vec4 acc4 = vec4(0.0);
      float wsum = 0.0;
      for (int i = -1; i <= 1; i++) {
        for (int j = -1; j <= 1; j++) {
          vec2 nuv = clamp(vUv + vec2(float(i), float(j)) * uTexel, vec2(0.0), vec2(1.0));
          vec4 sn = texture2D(tSoak, nuv);
          float wt = (i == 0 && j == 0) ? 1.0 : 0.5;
          acc4 += vec4(sn.rgb * sn.a, sn.a) * wt;
          wsum += wt;
        }
      }
      acc4 /= wsum;
      float blurA = acc4.a;
      vec3 blurC = acc4.rgb / max(blurA, 1e-5);
      na = mix(na, blurA, clamp(w, 0.0, 0.6));
      nc = mix(nc, blurC, clamp(w, 0.0, 0.6));
    }

    na = min(na, 1.35) * step(0.0004, snowAt(vUv));
    gl_FragColor = vec4(clamp(nc, 0.0, 1.0), na);
  }
}
`;

export class SyrupSim {
  constructor(renderer, { size = 128, cell = 0.0018, heightTex }) {
    this.size = size;
    const floatOK =
      renderer.extensions.has('EXT_color_buffer_float') ||
      renderer.extensions.has('EXT_color_buffer_half_float');
    const type = floatOK ? HalfFloatType : UnsignedByteType;
    this.type = type;

    const opts = {
      type, format: RGBAFormat, depthBuffer: false, stencilBuffer: false,
      minFilter: LinearFilter, magFilter: LinearFilter,
      wrapS: ClampToEdgeWrapping, wrapT: ClampToEdgeWrapping,
      generateMipmaps: false,
    };
    this.surf = [new WebGLRenderTarget(size, size, opts), new WebGLRenderTarget(size, size, opts)];
    this.soak = [new WebGLRenderTarget(size, size, opts), new WebGLRenderTarget(size, size, opts)];
    this.cur = 0;

    this.uniforms = {
      tSurf: { value: null }, tSoak: { value: null }, tHeight: { value: heightTex },
      uTexel: { value: new Vector2(1 / size, 1 / size) },
      uDt: { value: 0.016 }, uCell: { value: cell },
      uFlow: { value: 0.62 },
      uSoakRate: { value: 0.70 },
      uSoakGain: { value: 4.5 },
      uWick: { value: 0.22 },
      uPass: { value: 0 },
      uBrushCol: { value: new Color(1, 0, 0) },
      uBrush: { value: new Vector3(0.5, 0.5, 0.05) },
      uAmount: { value: 0 },
    };

    this.mat = new ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG,
      depthTest: false, depthWrite: false,
    });
    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new Mesh(new PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);

    this.clear(renderer);
  }

  get surfTexture() { return this.surf[this.cur].texture; }
  get soakTexture() { return this.soak[this.cur].texture; }

  clear(renderer) {
    const prev = renderer.getRenderTarget();
    const col = renderer.getClearColor(this._clearCol || (this._clearCol = new Color()));
    const alpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    for (const rt of [...this.surf, ...this.soak]) {
      renderer.setRenderTarget(rt);
      renderer.clear(true, false, false);
    }
    renderer.setRenderTarget(prev);
    renderer.setClearColor(col, alpha);
  }

  /** brush = { u, v, radius, amount, color } — amount 0 means "not pouring". */
  step(renderer, dt, brush) {
    const u = this.uniforms;
    u.uDt.value = Math.min(dt, 1 / 30);
    if (brush) {
      u.uBrush.value.set(brush.u, brush.v, brush.radius);
      u.uAmount.value = brush.amount;
      u.uBrushCol.value.copy(brush.color);
    } else {
      u.uAmount.value = 0;
    }
    const src = this.cur, dst = 1 - this.cur;
    const prevRT = renderer.getRenderTarget();
    const prevAuto = renderer.autoClear;
    renderer.autoClear = false;

    u.tSurf.value = this.surf[src].texture;
    u.tSoak.value = this.soak[src].texture;

    u.uPass.value = 1;
    renderer.setRenderTarget(this.soak[dst]);
    renderer.render(this.scene, this.camera);

    u.uPass.value = 0;
    renderer.setRenderTarget(this.surf[dst]);
    renderer.render(this.scene, this.camera);

    renderer.setRenderTarget(prevRT);
    renderer.autoClear = prevAuto;
    this.cur = dst;
  }

  dispose() {
    for (const rt of [...this.surf, ...this.soak]) rt.dispose();
    this.mat.dispose();
    this.quad.geometry.dispose();
  }
}
